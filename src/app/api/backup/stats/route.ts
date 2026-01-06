/**
 * 备份统计 API
 * 提供详细的备份统计信息
 */

import { NextRequest, NextResponse } from 'next/server';
import { DatabaseBackupService } from '@/services/backup/databaseBackup.service';
import { FileBackupService } from '@/services/backup/fileBackup.service';
import { LogArchiveService } from '@/services/backup/logArchive.service';
import fs from 'fs';
import path from 'path';

/**
 * GET - 获取详细备份统计
 */
export async function GET(request: NextRequest) {
  try {
    const [dbStats, logStats, fileStats] = await Promise.all([
      getDatabaseStats(),
      getLogStats(),
      getFileStats(),
    ]);

    // 清理资源
    const dbService = new DatabaseBackupService();
    const logService = new LogArchiveService();
    await Promise.all([
      dbService.cleanup(),
      logService.cleanup(),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        database: dbStats,
        files: fileStats,
        logs: logStats,
        summary: {
          totalBackupSize: dbStats.totalSize + fileStats.totalSize + logStats.totalSize,
          totalBackupCount: dbStats.count + fileStats.count + logStats.count,
        },
      },
    });
  } catch (error: any) {
    console.error('获取备份统计失败:', error);
    return NextResponse.json(
      { success: false, error: error.message || '获取备份统计失败' },
      { status: 500 }
    );
  }
}

/**
 * 获取数据库备份统计
 */
async function getDatabaseStats() {
  const service = new DatabaseBackupService();
  const stats = await service.getBackupStats();
  await service.cleanup();

  return {
    full: {
      count: stats.fullBackups.count,
      totalSize: stats.fullBackups.totalSize,
      latest: stats.fullBackups.latest,
    },
    incremental: {
      count: stats.incrementalBackups.count,
      totalSize: stats.incrementalBackups.totalSize,
      latest: stats.incrementalBackups.latest,
    },
    count: stats.fullBackups.count + stats.incrementalBackups.count,
    totalSize: stats.fullBackups.totalSize + stats.incrementalBackups.totalSize,
  };
}

/**
 * 获取文件备份统计
 */
async function getFileStats() {
  const fileService = new FileBackupService();
  const stats = await fileService.getBackupStats();
  await fileService.cleanup();

  // 转换为与 stats API 一致的格式（使用 full 和 incremental 而不是 fullBackups 和 incrementalBackups）
  return {
    full: {
      count: stats.fullBackups.count,
      totalSize: stats.fullBackups.totalSize,
      latest: stats.fullBackups.latest,
    },
    incremental: {
      count: stats.incrementalBackups.count,
      totalSize: stats.incrementalBackups.totalSize,
      latest: stats.incrementalBackups.latest,
    },
    count: stats.fullBackups.count + stats.incrementalBackups.count,
    totalSize: stats.fullBackups.totalSize + stats.incrementalBackups.totalSize,
  };
}

/**
 * 获取日志归档统计
 */
async function getLogStats() {
  const service = new LogArchiveService();
  const stats = await service.getArchiveStats();
  await service.cleanup();

  return {
    count: stats.totalFiles,
    totalSize: stats.totalSize,
    oldest: stats.oldestArchive,
    newest: stats.newestArchive,
  };
}

