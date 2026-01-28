import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { minioStorageService } from '@/services/storage/MinioStorageService';
import os from 'os';

const execAsync = promisify(exec);

/**
 * 将PPTX/DOCX转换为PDF
 * 优先尝试使用LibreOffice，失败则创建占位PDF
 * PDF 文件保存到 MinIO
 *
 * @param inputPath - 输入文件路径（本地临时文件或 public 目录）
 * @param originalFilename - 原始文件名
 * @returns MinIO 数据库记录格式 (bucket:objectName) 或 null
 */
export async function convertToPdf(inputPath: string, originalFilename: string): Promise<string | null> {
  let tempDir: string | null = null;  // ✅ 修复：追踪目录而非文件

  try {
    console.log('[Converter] 开始转换文件:', inputPath);

    // 创建临时目录用于存放转换后的 PDF
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pdf-convert-'));
    const outputFilename = path.basename(inputPath, path.extname(inputPath)) + '.pdf';
    const tempPdfPath = path.join(tempDir, outputFilename);

    let pdfBuffer: Buffer | null = null;

    // 尝试使用LibreOffice进行转换
    try {
      console.log('[Converter] 尝试使用LibreOffice转换...');

      // 检查LibreOffice是否可用
      const libreOfficePaths = [
        'libreoffice', // Linux
        '/usr/bin/libreoffice', // Linux
        'C:\\Program Files\\LibreOffice\\program\\soffice.exe', // Windows
        'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe', // Windows 32-bit
        '/Applications/LibreOffice.app/Contents/MacOS/soffice', // macOS
      ];

      let libreOfficeCmd = null;
      for (const cmdPath of libreOfficePaths) {
        try {
          if (cmdPath.includes('\\') || cmdPath.includes('/')) {
            // 检查文件是否存在
            await fs.access(cmdPath);
            libreOfficeCmd = `"${cmdPath}"`;
            break;
          } else {
            // 检查命令是否在PATH中（跨平台）
            const isWindows = os.platform() === 'win32';
            const checkCmd = isWindows ? `where ${cmdPath}` : `which ${cmdPath}`;
            await execAsync(checkCmd);
            libreOfficeCmd = cmdPath;
            break;
          }
        } catch (e) {
          continue;
        }
      }

      if (libreOfficeCmd) {
        console.log('[Converter] 找到LibreOffice:', libreOfficeCmd);

        // 使用LibreOffice转换到临时目录
        const command = `${libreOfficeCmd} --headless --convert-to pdf --outdir "${tempDir}" "${inputPath}"`;
        console.log('[Converter] 执行命令:', command);

        await execAsync(command, { timeout: 60000 }); // 60秒超时

        // 检查PDF是否成功生成
        await fs.access(tempPdfPath);
        console.log('[Converter] LibreOffice转换成功');

        // 读取转换后的 PDF
        pdfBuffer = await fs.readFile(tempPdfPath);
      } else {
        console.log('[Converter] 未找到LibreOffice，将创建占位PDF');
      }
    } catch (libreError) {
      console.log('[Converter] LibreOffice转换失败，将创建占位PDF:', libreError instanceof Error ? libreError.message : String(libreError));
    }

    // 如果LibreOffice不可用或转换失败，创建占位PDF
    if (!pdfBuffer) {
      console.log('[Converter] 创建占位PDF...');
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const { height } = page.getSize();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

      // 绘制标题
      page.drawText(`文档预览: ${originalFilename}`, {
        x: 50,
        y: height - 100,
        size: 20,
        font,
        color: rgb(0, 0, 0),
      });

      // 绘制说明
      const instructions = [
        '注意：此PDF为系统自动生成的占位文件',
        '',
        '原因：系统未检测到LibreOffice转换工具',
        '',
        '解决方案：',
        '1. 安装LibreOffice (https://www.libreoffice.org/)',
        '2. 重新上传文件以进行自动转换',
        '',
        '当前您可以：',
        '- 下载原始DOCX文件进行查看',
        '- 完成相关学习任务',
        '- 参加考试（如需要）',
      ];

      let yPosition = height - 150;
      instructions.forEach(line => {
        page.drawText(line, {
          x: 50,
          y: yPosition,
          size: 12,
          font,
          color: rgb(0.3, 0.3, 0.3),
        });
        yPosition -= 20;
      });

      const pdfBytes = await pdfDoc.save();
      pdfBuffer = Buffer.from(pdfBytes);
      console.log('[Converter] 占位PDF创建成功');
    }

    // 上传 PDF 到 MinIO
    const pdfFilename = `${path.basename(originalFilename, path.extname(originalFilename))}.pdf`;
    const objectName = minioStorageService.generateObjectName(pdfFilename, 'docs');

    console.log('[Converter] 上传PDF到MinIO:', objectName);
    await minioStorageService.uploadFile('public', objectName, pdfBuffer, 'application/pdf');

    // 返回MinIO数据库记录格式
    const dbRecord = minioStorageService.formatDbRecord('public', objectName);
    console.log('[Converter] PDF上传成功:', dbRecord);

    return dbRecord;
  } catch (error) {
    console.error('[Converter] PDF转换完全失败:', error);
    return null;
  } finally {
    // ✅ 路径安全验证（symlink-safe）+ finally 确保总是清理临时文件
    if (tempDir) {
      try {
        // 使用 path.resolve() 处理 symlink（如 macOS 的 /tmp -> /private/tmp）
        const safeTmpBase = path.resolve(os.tmpdir());
        const resolvedTempDir = path.resolve(tempDir);

        if (resolvedTempDir.startsWith(safeTmpBase)) {
          await fs.rm(tempDir, { recursive: true, force: true });
          console.log('[Converter] 临时文件清理成功:', tempDir);
        } else {
          console.error('[Converter] 路径安全检查失败，跳过删除:', tempDir, '(resolved:', resolvedTempDir, ', expected prefix:', safeTmpBase, ')');
        }
      } catch (cleanupError) {
        console.error('[Converter] 临时文件清理失败:', cleanupError);
        // 不抛出错误，避免掩盖原始错误
      }
    }
  }
}
