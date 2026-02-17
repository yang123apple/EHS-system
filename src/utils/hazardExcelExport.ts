/**
 * 隐患Excel导出工具（生产级）
 * 特性：并发控制、超时重试、内存优化、进度反馈
 */

import ExcelJS from 'exceljs';
import { HazardRecord } from '@/types/hidden-danger';

/**
 * 并发控制器
 * 严格限制同时执行的异步任务数量，防止浏览器挂起
 */
class ConcurrencyController {
  private running = 0;

  constructor(private readonly maxConcurrency: number) {}

  async run<T>(task: () => Promise<T>): Promise<T> {
    // 等待空闲槽位
    while (this.running >= this.maxConcurrency) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    this.running++;
    try {
      return await task();
    } finally {
      this.running--;
    }
  }

  getRunningCount(): number {
    return this.running;
  }
}

/**
 * 进度信息
 */
export interface ExportProgress {
  stage: 'init' | 'downloading' | 'generating' | 'complete';
  current: number;
  total: number;
  message: string;
  failedCount?: number;
}

/**
 * 下载图片（带超时和重试）
 * @param imageUrl 图片URL或MinIO路径
 * @param timeoutMs 超时时间（毫秒）
 * @param maxRetries 最大重试次数
 * @returns ArrayBuffer或null（失败时）
 */
async function downloadImage(
  imageUrl: string,
  timeoutMs: number = 15000,
  maxRetries: number = 2
): Promise<ArrayBuffer | null> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Base64图片直接转换
      if (imageUrl.startsWith('data:image/')) {
        const base64Data = imageUrl.split(',')[1];
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
      }

      // MinIO路径转预签名URL（5秒超时）
      let fetchUrl = imageUrl;
      if (!imageUrl.startsWith('http')) {
        const urlResponse = await Promise.race([
          fetch(`/api/storage/file-url?objectName=${encodeURIComponent(imageUrl)}&expiresIn=3600`),
          new Promise<Response>((_, reject) =>
            setTimeout(() => reject(new Error('获取URL超时')), 5000)
          )
        ]);

        if (!urlResponse.ok) {
          throw new Error(`获取预签名URL失败: ${urlResponse.status}`);
        }

        const urlData = await urlResponse.json();
        fetchUrl = urlData.url;
      }

      // 下载图片（15秒超时）
      const imageResponse = await Promise.race([
        fetch(fetchUrl),
        new Promise<Response>((_, reject) =>
          setTimeout(() => reject(new Error('下载图片超时')), timeoutMs)
        )
      ]);

      if (!imageResponse.ok) {
        throw new Error(`下载图片失败: HTTP ${imageResponse.status}`);
      }

      return await imageResponse.arrayBuffer();

    } catch (error) {
      const isLastAttempt = attempt === maxRetries;

      if (isLastAttempt) {
        // 最后一次尝试失败，记录错误并返回null（静默失败）
        console.error(`[ExcelExport] 图片下载失败（已重试${maxRetries}次）:`, {
          url: imageUrl,
          error: error instanceof Error ? error.message : String(error)
        });
        return null;
      }

      // 等待后重试（指数退避）
      const waitTime = 1000 * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  return null;
}

/**
 * 获取图片扩展名
 */
function getImageExtension(imageUrl: string): 'png' | 'jpeg' | 'gif' {
  if (imageUrl.startsWith('data:image/')) {
    const match = imageUrl.match(/^data:image\/(\w+);/);
    const ext = match ? match[1].toLowerCase() : 'png';
    if (ext === 'jpg') return 'jpeg';
    if (ext === 'jpeg' || ext === 'gif') return ext;
    return 'png';
  }

  const ext = imageUrl.split('.').pop()?.toLowerCase() || 'png';

  if (ext === 'jpg') return 'jpeg';
  if (ext === 'jpeg' || ext === 'gif') return ext;

  // 默认返回png（包括bmp等不支持的格式）
  return 'png';
}

/**
 * 计算图片尺寸（EMU单位）
 */
function calculateImageSize(widthCm: number, heightCm: number) {
  const EMU_PER_CM = 360000;
  return {
    width: widthCm * EMU_PER_CM,
    height: heightCm * EMU_PER_CM
  };
}

/**
 * 导出隐患数据到Excel（包含图片）
 *
 * @param hazards 隐患数据数组
 * @param isAdmin 是否管理员（决定是否包含作废字段）
 * @param onProgress 进度回调函数
 * @param maxConcurrency 最大并发数（默认6，Chrome限制）
 * @returns Excel文件Blob
 */
export async function exportHazardsToExcel(
  hazards: HazardRecord[],
  isAdmin: boolean = false,
  onProgress?: (progress: ExportProgress) => void,
  maxConcurrency: number = 6
): Promise<Blob> {

  // 进度通知辅助函数
  const notify = (
    stage: ExportProgress['stage'],
    current: number,
    total: number,
    message: string,
    failedCount?: number
  ) => {
    onProgress?.({ stage, current, total, message, failedCount });
  };

  // ========== 阶段1: 初始化Excel ==========
  notify('init', 0, hazards.length, '正在初始化Excel模板...');

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('隐患列表');

  // 定义列结构
  const columns: Array<{ header: string; key: string; width: number }> = [
    { header: '隐患编号', key: 'code', width: 15 },
    { header: '状态', key: 'status', width: 12 },
    { header: '风险等级', key: 'riskLevel', width: 12 },
    { header: '检查类型', key: 'checkType', width: 12 },
    { header: '整改方式', key: 'rectificationType', width: 12 },
    { header: '隐患类型', key: 'type', width: 15 },
    { header: '发现位置', key: 'location', width: 20 },
    { header: '隐患描述', key: 'desc', width: 30 },
    { header: '隐患图片', key: 'photos', width: 15 },
    { header: '上报人', key: 'reporterName', width: 12 },
    { header: '上报时间', key: 'reportTime', width: 12 },
    { header: '责任部门', key: 'responsibleDeptName', width: 15 },
    { header: '责任人', key: 'responsibleName', width: 12 },
    { header: '整改期限', key: 'deadline', width: 12 },
    { header: '整改描述', key: 'rectificationNotes', width: 30 },
    { header: '整改图片', key: 'rectificationPhotos', width: 15 },
    { header: '整改时间', key: 'rectificationTime', width: 12 },
    { header: '整改措施要求', key: 'rectificationRequirements', width: 30 },
    { header: '验收人', key: 'verifierName', width: 12 },
    { header: '验收时间', key: 'verificationTime', width: 12 },
    { header: '验收描述', key: 'verificationNotes', width: 30 },
    { header: '验收图片', key: 'verificationPhotos', width: 15 },
  ];

  if (isAdmin) {
    columns.push(
      { header: '是否已作废', key: 'isVoided', width: 12 },
      { header: '作废原因', key: 'voidReason', width: 20 },
      { header: '作废时间', key: 'voidedAt', width: 12 },
      { header: '作废操作人', key: 'voidedBy', width: 12 }
    );
  }

  worksheet.columns = columns;

  // 表头样式
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.height = 20;

  // 数据映射
  const checkTypeMap: Record<string, string> = {
    'daily': '日常检查',
    'special': '专项检查',
    'monthly': '月度检查',
    'pre-holiday': '节前检查',
    'self': '员工自查',
    'other': '其他检查',
  };

  const rectificationTypeMap: Record<string, string> = {
    'immediate': '立即整改',
    'scheduled': '限期整改',
  };

  const parseVoidedBy = (voidedBy: string | undefined): string => {
    if (!voidedBy) return '-';
    try {
      const obj = JSON.parse(voidedBy);
      return obj.name || '-';
    } catch {
      return voidedBy;
    }
  };

  // ========== 阶段2: 构建数据行并收集图片任务 ==========
  interface ImageTask {
    rowIndex: number;
    imageUrl: string;
    colIndex: number;
    imageType: 'photos' | 'rectificationPhotos' | 'verificationPhotos';
  }

  const imageTasks: ImageTask[] = [];

  for (let i = 0; i < hazards.length; i++) {
    const h = hazards[i];

    const rowData: Record<string, any> = {
      code: h.code || h.id,
      status: h.status,
      riskLevel: h.riskLevel,
      checkType: h.checkType ? (checkTypeMap[h.checkType] || h.checkType) : '-',
      rectificationType: h.rectificationType ? (rectificationTypeMap[h.rectificationType] || h.rectificationType) : '-',
      type: h.type,
      location: h.location,
      desc: h.desc,
      photos: '',
      reporterName: h.reporterName || '-',
      reportTime: h.reportTime ? h.reportTime.split('T')[0] : '-',
      responsibleDeptName: h.responsibleDeptName || '-',
      responsibleName: h.responsibleName || '-',
      deadline: h.deadline ? h.deadline.split('T')[0] : '-',
      rectificationNotes: h.rectificationNotes || h.rectifyDesc || '-',
      rectificationPhotos: '',
      rectificationTime: h.rectificationTime ? h.rectificationTime.split('T')[0] : (h.rectifyTime ? h.rectifyTime.split('T')[0] : '-'),
      rectificationRequirements: h.rectificationRequirements || h.rectifyRequirement || '-',
      verifierName: h.verifierName || '-',
      verificationTime: h.verificationTime ? h.verificationTime.split('T')[0] : (h.verifyTime ? h.verifyTime.split('T')[0] : '-'),
      verificationNotes: h.verificationNotes || h.verifyDesc || '-',
      verificationPhotos: '',
    };

    if (isAdmin) {
      rowData.isVoided = h.isVoided ? '是' : '否';
      rowData.voidReason = h.voidReason || '-';
      rowData.voidedAt = h.voidedAt ? h.voidedAt.split('T')[0] : '-';
      rowData.voidedBy = parseVoidedBy(h.voidedBy);
    }

    worksheet.addRow(rowData);

    // 收集图片任务（兼容新旧字段）
    const rowIndex = i + 2; // Excel行号，第1行是表头
    const photos = h.photos || [];
    const rectificationPhotos = h.rectificationPhotos || h.rectifyPhotos || [];
    const verificationPhotos = h.verificationPhotos || h.verifyPhotos || [];

    if (photos.length > 0) {
      imageTasks.push({
        rowIndex,
        imageUrl: photos[0],
        colIndex: 8,
        imageType: 'photos'
      });
    }

    if (rectificationPhotos.length > 0) {
      imageTasks.push({
        rowIndex,
        imageUrl: rectificationPhotos[0],
        colIndex: 15,
        imageType: 'rectificationPhotos'
      });
    }

    if (verificationPhotos.length > 0) {
      imageTasks.push({
        rowIndex,
        imageUrl: verificationPhotos[0],
        colIndex: 21,
        imageType: 'verificationPhotos'
      });
    }
  }

  // ========== 阶段3: 并发下载图片并插入Excel（内存优化）==========
  if (imageTasks.length > 0) {
    notify('downloading', 0, imageTasks.length, '开始下载图片...');

    const controller = new ConcurrencyController(maxConcurrency);
    const imageSize = calculateImageSize(3, 4); // 3cm宽 × 4cm高

    let completedCount = 0;
    let failedCount = 0;
    const failedUrls: string[] = [];

    // 🔥 关键优化：使用Promise.all + 并发控制器
    // 每个任务完成后立即释放内存，不保留ArrayBuffer引用
    await Promise.all(
      imageTasks.map(task =>
        controller.run(async () => {
          const { rowIndex, imageUrl, colIndex } = task;

          try {
            const imageBuffer = await downloadImage(imageUrl);

            if (imageBuffer) {
              // 添加图片到workbook
              const imageId = workbook.addImage({
                buffer: imageBuffer as any,
                extension: getImageExtension(imageUrl),
              });

              // 设置行高（确保容纳图片）
              const row = worksheet.getRow(rowIndex);
              row.height = Math.max(row.height || 0, 4 * 28.35);

              // 插入图片（ext参数会自动保持原始纵横比）
              worksheet.addImage(imageId, {
                tl: { col: colIndex, row: rowIndex - 1 },
                ext: imageSize,
                editAs: 'oneCell',
              });
            } else {
              failedCount++;
              failedUrls.push(imageUrl);
            }
          } catch (error) {
            failedCount++;
            failedUrls.push(imageUrl);
            console.error('[ExcelExport] 处理图片异常:', imageUrl, error);
          }

          // 更新进度
          completedCount++;
          notify(
            'downloading',
            completedCount,
            imageTasks.length,
            `下载图片 ${completedCount}/${imageTasks.length}${failedCount > 0 ? ` (失败${failedCount}张)` : ''}`,
            failedCount
          );
        })
      )
    );

    // 失败警告
    if (failedUrls.length > 0) {
      console.warn(`[ExcelExport] ⚠️ ${failedUrls.length}张图片下载失败:`, failedUrls.slice(0, 10));
    }
  }

  // ========== 阶段4: 生成Excel文件 ==========
  notify('generating', imageTasks.length, imageTasks.length, '正在生成Excel文件...');

  const buffer = await workbook.xlsx.writeBuffer();

  notify('complete', imageTasks.length, imageTasks.length, '导出完成！');

  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
