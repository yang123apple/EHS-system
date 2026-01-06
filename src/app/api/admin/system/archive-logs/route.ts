import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/middleware/auth';
import LogArchiveService from '@/services/logArchive.service';
import { LogArchiveService as BackupLogArchiveService } from '@/services/backup/logArchive.service';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { createGunzip } from 'zlib';
import { pipeline } from 'stream/promises';

/**
 * POST /api/admin/system/archive-logs
 * 
 * 归档旧日志到本地文件系统
 * 
 * 权限要求：管理员权限（role === 'admin'）
 * 
 * 请求体：
 * {
 *   retentionMonths?: number,  // 保留月数，默认6个月
 *   batchSize?: number         // 批处理大小，默认1000
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // ========== 权限检查 ==========
    // 要求用户已登录
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;

    // 检查是否为管理员（伪代码示例：实际应根据你的权限系统调整）
    if (user.role !== 'admin') {
      return NextResponse.json(
        {
          success: false,
          error: '权限不足',
          message: '只有管理员可以执行日志归档操作',
        },
        { status: 403 }
      );
    }

    // ========== 解析请求参数 ==========
    const body = await request.json().catch(() => ({}));
    const retentionMonths = body.retentionMonths ?? 6;
    const batchSize = body.batchSize ?? 1000;

    // 参数验证
    if (typeof retentionMonths !== 'number' || retentionMonths < 1) {
      return NextResponse.json(
        {
          success: false,
          error: '参数错误',
          message: 'retentionMonths 必须是一个大于等于1的数字',
        },
        { status: 400 }
      );
    }

    if (typeof batchSize !== 'number' || batchSize < 1 || batchSize > 10000) {
      return NextResponse.json(
        {
          success: false,
          error: '参数错误',
          message: 'batchSize 必须是一个1-10000之间的数字',
        },
        { status: 400 }
      );
    }

    // ========== 执行归档 ==========
    console.log(`📦 [Archive API] 管理员 ${user.name} (${user.id}) 开始执行日志归档...`);
    
    const result = await LogArchiveService.archiveOldLogs(retentionMonths, batchSize);

    // ========== 返回结果 ==========
    return NextResponse.json({
      success: true,
      message: '日志归档完成',
      data: {
        archivedCount: result.count,
        filePath: result.filePath,
        startDate: result.startDate.toISOString(),
        endDate: result.endDate.toISOString(),
        retentionMonths,
      },
    });
  } catch (error) {
    console.error('❌ [Archive API] 日志归档失败:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: '归档失败',
        message: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/system/archive-logs
 * 
 * 功能1：获取归档文件列表（不带参数）
 * 功能2：读取归档文件内容（带 ?file=filename.json 参数）
 * 
 * 权限要求：管理员权限
 */
export async function GET(request: NextRequest) {
  try {
    // ========== 权限检查 ==========
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;

    // 检查是否为管理员
    if (user.role !== 'admin') {
      return NextResponse.json(
        {
          success: false,
          error: '权限不足',
          message: '只有管理员可以查看归档文件',
        },
        { status: 403 }
      );
    }

    // ========== 检查是否有 file 查询参数 ==========
    const { searchParams } = new URL(request.url);
    const fileName = searchParams.get('file');

    // 功能2：读取文件内容
    if (fileName) {
      try {
        // 支持两种归档文件格式：
        // 1. 旧格式：audit_archive_*.json
        // 2. 新格式：logs_*.json.gz（备份系统）
        
        let archiveData: any;
        
        if (fileName.endsWith('.json.gz')) {
          // 新备份系统的归档文件（.gz 压缩格式）
          const logArchive = new BackupLogArchiveService();
          const archiveDir = path.join(process.cwd(), 'data', 'backups', 'logs', 'archives');
          const filePath = path.join(archiveDir, fileName);
          
          // 验证文件名安全性
          if (!/^logs_[0-9]{4}-[0-9]{2}-[0-9]{2}\.json\.gz$/.test(fileName)) {
            return NextResponse.json(
              {
                success: false,
                error: '文件名格式错误',
                message: '归档文件名格式应为 logs_YYYY-MM-DD.json.gz',
              },
              { status: 400 }
            );
          }
          
          if (!fs.existsSync(filePath)) {
            return NextResponse.json(
              {
                success: false,
                error: '文件不存在',
                message: `归档文件 ${fileName} 不存在`,
              },
              { status: 404 }
            );
          }
          
          // 解压并读取文件
          const input = fs.createReadStream(filePath);
          const gunzip = createGunzip();
          const chunks: Buffer[] = [];
          
          await new Promise<void>((resolve, reject) => {
            gunzip.on('data', (chunk) => chunks.push(chunk));
            gunzip.on('end', () => resolve());
            gunzip.on('error', reject);
            input.pipe(gunzip);
          });
          
          const jsonContent = Buffer.concat(chunks).toString('utf-8');
          archiveData = JSON.parse(jsonContent);
          
        } else if (fileName.endsWith('.json')) {
          // 旧格式的归档文件
          if (!/^[a-zA-Z0-9_.-]+\.json$/.test(fileName)) {
            return NextResponse.json(
              {
                success: false,
                error: '文件名格式错误',
                message: '文件名只能包含字母、数字、下划线、点和连字符，且必须以 .json 结尾',
              },
              { status: 400 }
            );
          }
          
          // 确保文件名以 audit_archive_ 开头（额外的安全检查）
          if (!fileName.startsWith('audit_archive_')) {
            return NextResponse.json(
              {
                success: false,
                error: '文件名格式错误',
                message: '归档文件名必须以 audit_archive_ 开头',
              },
              { status: 400 }
            );
          }
          
          archiveData = await LogArchiveService.readArchiveFile(fileName);
        } else {
          return NextResponse.json(
            {
              success: false,
              error: '文件格式不支持',
              message: '只支持 .json 或 .json.gz 格式的归档文件',
            },
            { status: 400 }
          );
        }
        
        return NextResponse.json({
          success: true,
          data: {
            logs: Array.isArray(archiveData) ? archiveData : archiveData.logs || [],
            fileName,
          },
        });
      } catch (error) {
        console.error(`❌ [Archive API] 读取归档文件失败: ${fileName}`, error);
        
        return NextResponse.json(
          {
            success: false,
            error: '读取文件失败',
            message: error instanceof Error ? error.message : '未知错误',
          },
          { status: 500 }
        );
      }
    }

    // 功能1：获取归档文件列表（包含新旧两种格式）
    const oldFiles = await LogArchiveService.getArchiveFiles();
    const logArchive = new BackupLogArchiveService();
    const backupStats = await logArchive.getArchiveStats();
    
    // 读取新备份系统的归档文件列表
    const archiveDir = path.join(process.cwd(), 'data', 'backups', 'logs', 'archives');
    const newFiles: Array<{ name: string; size: number; createdAt: Date }> = [];
    
    if (fs.existsSync(archiveDir)) {
      const files = fs.readdirSync(archiveDir)
        .filter(f => f.startsWith('logs_') && f.endsWith('.json.gz'))
        .map(f => {
          const filePath = path.join(archiveDir, f);
          const stats = fs.statSync(filePath);
          return {
            name: f,
            size: stats.size,
            createdAt: stats.mtime,
          };
        })
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      
      newFiles.push(...files);
    }
    
    // 合并新旧文件列表
    const allFiles = [
      ...oldFiles.map(file => ({
        fileName: file.name,
        size: file.size,
        sizeFormatted: formatFileSize(file.size),
        createdAt: file.createdAt.toISOString(),
        type: 'old' as const,
      })),
      ...newFiles.map(file => ({
        fileName: file.name,
        size: file.size,
        sizeFormatted: formatFileSize(file.size),
        createdAt: file.createdAt.toISOString(),
        type: 'new' as const,
      })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({
      success: true,
      data: {
        files: allFiles,
        totalCount: allFiles.length,
      },
    });
  } catch (error) {
    console.error('❌ [Archive API] 获取归档文件列表失败:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: '获取失败',
        message: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/system/archive-logs
 * 
 * 导入归档日志文件（上传并解析归档文件）
 * 
 * 权限要求：管理员权限
 * 
 * 请求体：FormData
 * - file: 归档文件（.json 或 .json.gz）
 */
export async function PUT(request: NextRequest) {
  try {
    // ========== 权限检查 ==========
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;

    if (user.role !== 'admin') {
      return NextResponse.json(
        {
          success: false,
          error: '权限不足',
          message: '只有管理员可以导入归档日志',
        },
        { status: 403 }
      );
    }

    // ========== 解析上传的文件 ==========
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        {
          success: false,
          error: '参数错误',
          message: '请上传归档文件',
        },
        { status: 400 }
      );
    }

    // 验证文件类型
    const fileName = file.name;
    if (!fileName.endsWith('.json') && !fileName.endsWith('.json.gz')) {
      return NextResponse.json(
        {
          success: false,
          error: '文件格式错误',
          message: '只支持 .json 或 .json.gz 格式的归档文件',
        },
        { status: 400 }
      );
    }

    // 读取文件内容
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    let logs: any[];
    
    if (fileName.endsWith('.gz')) {
      // 解压 .gz 文件
      const gunzip = createGunzip();
      const chunks: Buffer[] = [];
      
      await new Promise<void>((resolve, reject) => {
        gunzip.on('data', (chunk) => chunks.push(chunk));
        gunzip.on('end', () => resolve());
        gunzip.on('error', reject);
        gunzip.write(buffer);
        gunzip.end();
      });
      
      const jsonContent = Buffer.concat(chunks).toString('utf-8');
      logs = JSON.parse(jsonContent);
    } else {
      // 直接解析 JSON
      const jsonContent = buffer.toString('utf-8');
      logs = JSON.parse(jsonContent);
    }

    if (!Array.isArray(logs)) {
      return NextResponse.json(
        {
          success: false,
          error: '文件格式错误',
          message: '归档文件必须包含日志数组',
        },
        { status: 400 }
      );
    }

    // ========== 导入日志到数据库 ==========
    const prisma = new PrismaClient();
    let importedCount = 0;
    let skippedCount = 0;
    const batchSize = 100; // 批量处理大小

    try {
      // 先检查所有日志的 ID，找出已存在的记录
      const existingIds = new Set<string>();
      const logIds = logs.map(log => log.id).filter(Boolean) as string[];
      
      if (logIds.length > 0) {
        const existing = await prisma.systemLog.findMany({
          where: {
            id: { in: logIds },
          },
          select: { id: true },
        });
        existing.forEach(log => existingIds.add(log.id));
      }

      // 批量导入日志（避免重复）
      const logsToImport: any[] = [];
      
      for (const log of logs) {
        // 如果 ID 已存在，跳过
        if (log.id && existingIds.has(log.id)) {
          skippedCount++;
          continue;
        }

        // 准备导入数据
        const logData: any = {
          id: log.id || undefined, // 如果没有 ID，让数据库自动生成
          userId: log.userId || null,
          userName: log.userName || null,
          userRole: log.userRole || null,
          userDepartment: log.userDepartment || null,
          userDepartmentId: log.userDepartmentId || null,
          userJobTitle: log.userJobTitle || null,
          userRoleInAction: log.userRoleInAction || null,
          action: log.action || '',
          actionLabel: log.actionLabel || null,
          module: log.module || 'SYSTEM',
          businessCode: log.businessCode || null,
          targetId: log.targetId || null,
          targetType: log.targetType || null,
          targetLabel: log.targetLabel || null,
          targetLink: log.targetLink || null,
          details: log.details || null,
          ip: log.ip || null,
          snapshot: log.snapshot ? (typeof log.snapshot === 'string' ? log.snapshot : JSON.stringify(log.snapshot)) : null,
          diff: log.diff ? (typeof log.diff === 'string' ? log.diff : JSON.stringify(log.diff)) : null,
          changes: log.changes ? (typeof log.changes === 'string' ? log.changes : JSON.stringify(log.changes)) : null,
          beforeData: log.beforeData ? (typeof log.beforeData === 'string' ? log.beforeData : JSON.stringify(log.beforeData)) : null,
          afterData: log.afterData ? (typeof log.afterData === 'string' ? log.afterData : JSON.stringify(log.afterData)) : null,
          createdAt: log.createdAt ? new Date(log.createdAt) : new Date(),
          updatedAt: log.updatedAt ? new Date(log.updatedAt) : new Date(),
        };

        // 如果没有 ID，移除该字段让数据库自动生成
        if (!logData.id) {
          delete logData.id;
        }

        logsToImport.push(logData);
      }

      // 批量插入（分批处理）
      for (let i = 0; i < logsToImport.length; i += batchSize) {
        const batch = logsToImport.slice(i, i + batchSize);
        
        try {
          // SQLite 可能不支持 skipDuplicates，改用逐条插入并捕获重复错误
          for (const logData of batch) {
            try {
              await prisma.systemLog.create({
                data: logData,
              });
              importedCount++;
            } catch (error: any) {
              // 如果是唯一约束冲突（重复记录），跳过
              if (error.code === 'P2002' || error.message?.includes('UNIQUE constraint')) {
                // 跳过重复记录
                continue;
              }
              throw error; // 其他错误继续抛出
            }
          }
        } catch (error: any) {
          console.error(`批量导入失败 (批次 ${i / batchSize + 1}):`, error);
          // 如果批量插入失败，尝试逐条插入
          for (const logData of batch) {
            try {
              await prisma.systemLog.create({
                data: logData,
              });
              importedCount++;
            } catch (singleError: any) {
              console.error('导入单条日志失败:', singleError);
              skippedCount++;
            }
          }
        }
      }
    } finally {
      await prisma.$disconnect();
    }

    return NextResponse.json({
      success: true,
      message: '归档日志导入完成',
      data: {
        fileName,
        totalLogs: logs.length,
        importedCount,
        skippedCount,
      },
    });
  } catch (error) {
    console.error('❌ [Archive API] 导入归档日志失败:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: '导入失败',
        message: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}

/**
 * 格式化文件大小
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

