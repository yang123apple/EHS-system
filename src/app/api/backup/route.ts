/**
 * 备份管理 API
 * 提供备份状态查询、手动触发备份等功能
 */

import { NextRequest, NextResponse } from 'next/server';
import { getBackupScheduler, initializeApp, isAppInitialized } from '@/lib/startup';
import { DatabaseBackupService } from '@/services/backup/databaseBackup.service';
import { FileBackupService } from '@/services/backup/fileBackup.service';
import { LogArchiveService } from '@/services/backup/logArchive.service';

/**
 * GET - 获取备份状态
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // database, files, logs, all

    // 如果服务未初始化，尝试自动初始化
    let scheduler = getBackupScheduler();
    if (!scheduler && !isAppInitialized()) {
      console.log('⚠️ 备份调度服务未初始化，尝试自动初始化...');
      try {
        await initializeApp();
        scheduler = getBackupScheduler();
      } catch (error: any) {
        console.error('自动初始化失败:', error);
        return NextResponse.json(
          { success: false, error: `备份调度服务初始化失败: ${error.message}` },
          { status: 503 }
        );
      }
    }
    
    if (!scheduler) {
      return NextResponse.json(
        { success: false, error: '备份调度服务未初始化' },
        { status: 503 }
      );
    }

    // 获取总体状态
    const status = await scheduler.getBackupStatus();

    // 根据类型返回不同数据
    if (type === 'database') {
      const dbService = new DatabaseBackupService();
      const dbStats = await dbService.getBackupStats();
      await dbService.cleanup();
      
      return NextResponse.json({
        success: true,
        data: {
          scheduler: status.scheduler,
          database: dbStats,
        },
      });
    }

    if (type === 'files') {
      const fileService = new FileBackupService();
      const fileStats = await fileService.getBackupStats();
      await fileService.cleanup();
      
      return NextResponse.json({
        success: true,
        data: {
          scheduler: status.scheduler,
          files: fileStats,
        },
      });
    }

    if (type === 'logs') {
      const logService = new LogArchiveService();
      const logStats = await logService.getArchiveStats();
      await logService.cleanup();
      
      return NextResponse.json({
        success: true,
        data: {
          scheduler: status.scheduler,
          logs: logStats,
        },
      });
    }

    // 返回全部状态
    return NextResponse.json({
      success: true,
      data: status,
    });
  } catch (error: any) {
    console.error('获取备份状态失败:', error);
    return NextResponse.json(
      { success: false, error: error.message || '获取备份状态失败' },
      { status: 500 }
    );
  }
}

/**
 * POST - 手动触发备份任务
 * 
 * 请求体：
 * {
 *   "action": "database-full" | "database-incremental" | "file-full" | "file-incremental" | "log-archive"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (!action) {
      return NextResponse.json(
        { success: false, error: '缺少 action 参数' },
        { status: 400 }
      );
    }

    // 如果服务未初始化，尝试自动初始化
    let scheduler = getBackupScheduler();
    if (!scheduler && !isAppInitialized()) {
      console.log('⚠️ 备份调度服务未初始化，尝试自动初始化...');
      try {
        await initializeApp();
        scheduler = getBackupScheduler();
      } catch (error: any) {
        console.error('自动初始化失败:', error);
        return NextResponse.json(
          { success: false, error: `备份调度服务初始化失败: ${error.message}` },
          { status: 503 }
        );
      }
    }
    
    if (!scheduler) {
      return NextResponse.json(
        { success: false, error: '备份调度服务未初始化' },
        { status: 503 }
      );
    }

    let result;

    switch (action) {
      case 'full-backup-all':
        // 一键全量备份：数据库全量 + 文件全量 + 日志归档
        const results = {
          database: null as any,
          files: null as any,
          logs: null as any,
        };
        
        try {
          // 1. 数据库全量备份
          await scheduler.triggerDatabaseFullBackup();
          results.database = { success: true, message: '数据库全量备份已触发' };
        } catch (error: any) {
          results.database = { success: false, message: error.message };
        }
        
        try {
          // 2. 文件全量备份
          await scheduler.triggerFileFullBackup();
          results.files = { success: true, message: '文件全量备份已触发' };
        } catch (error: any) {
          results.files = { success: false, message: error.message };
        }
        
        try {
          // 3. 日志归档
          await scheduler.triggerLogArchive();
          results.logs = { success: true, message: '日志归档已触发' };
        } catch (error: any) {
          results.logs = { success: false, message: error.message };
        }
        
        const allSuccess = results.database.success && results.files.success && results.logs.success;
        result = {
          message: allSuccess ? '一键全量备份已触发' : '一键全量备份部分成功',
          details: results,
        };
        break;

      case 'database-full':
        await scheduler.triggerDatabaseFullBackup();
        result = { message: '数据库全量备份已触发' };
        break;

      case 'database-incremental':
        // 增量备份：检查是否有新数据
        const dbService = new DatabaseBackupService();
        const path = require('path');
        const fs = require('fs');
        const walPath = path.join(process.cwd(), 'prisma', 'dev.db-wal');
        
        if (!fs.existsSync(walPath)) {
          await dbService.cleanup();
          return NextResponse.json({
            success: true,
            data: { 
              message: '无需更新备份',
              reason: '数据库未启用 WAL 模式，无增量数据',
            },
          });
        }
        
        // 检查 WAL 文件大小和修改时间
        const walStats = fs.statSync(walPath);
        const backupStats = await dbService.getBackupStats();
        
        // 如果 WAL 文件为空（0字节），没有新数据
        if (walStats.size === 0) {
          await dbService.cleanup();
          return NextResponse.json({
            success: true,
            data: { 
              message: '无需更新备份',
              reason: 'WAL 文件为空，无新数据需要备份',
            },
          });
        }
        
        // 检查是否有最近的增量备份，比较 WAL 文件的修改时间
        if (backupStats.incrementalBackups.latest) {
          const latestBackupTime = new Date(backupStats.incrementalBackups.latest).getTime();
          const walModifiedTime = walStats.mtimeMs;
          
          // 如果 WAL 文件在最近备份之后没有修改，可能不需要备份
          // 但为了安全，我们仍然执行备份，只是检查文件大小
          // 如果 WAL 文件很小（小于1KB），可能只是元数据，没有实际数据变化
          if (walStats.size < 1024 && walModifiedTime <= latestBackupTime + 1000) {
            // 给1秒的容差，避免时间精度问题
            await dbService.cleanup();
            return NextResponse.json({
              success: true,
              data: { 
                message: '无需更新备份',
                reason: 'WAL 文件无新数据变化',
              },
            });
          }
        }
        
        // 执行增量备份
        const dbResult = await dbService.performIncrementalBackup();
        await dbService.cleanup();
        
        // 如果备份文件大小为0，说明没有新数据
        if (dbResult.sizeBytes === 0 && dbResult.message) {
          result = { 
            message: '无需更新备份',
            reason: dbResult.message,
          };
        } else {
          result = dbResult;
        }
        break;

      case 'file-full':
      case 'minio-full':
        await scheduler.triggerMinIOFullSync();
        result = { message: 'MinIO 全量同步备份已触发' };
        break;

      case 'file-incremental':
      case 'minio-incremental':
        await scheduler.triggerMinIOIncrementalSync();
        result = { message: 'MinIO 增量同步备份已触发' };
        break;

      case 'log-archive':
        await scheduler.triggerLogArchive();
        result = { message: '日志归档已触发' };
        break;

      default:
        return NextResponse.json(
          { success: false, error: `未知的备份操作: ${action}` },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('触发备份失败:', error);
    return NextResponse.json(
      { success: false, error: error.message || '触发备份失败' },
      { status: 500 }
    );
  }
}
