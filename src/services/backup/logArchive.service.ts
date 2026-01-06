/**
 * 日志归档服务
 * 负责系统日志的导出、压缩和归档
 * 
 * 归档策略：
 * - 每15天导出过去15天的 SystemLog 记录
 * - 压缩为 .gz 格式（体积减少90%）
 * - 从数据库删除已导出的记录（保留最近90天）
 * - 文件归档保留10年后自动删除
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { createGzip } from 'zlib';
import { pipeline } from 'stream/promises';

interface ArchiveResult {
  success: boolean;
  filePath: string;
  sizeBytes: number;
  compressedSizeBytes: number;
  recordCount: number;
  timestamp: Date;
  message?: string;
}

export class LogArchiveService {
  private prisma: PrismaClient;
  private archiveDir: string;
  private retentionDays: number = 90; // 数据库保留90天
  private fileRetentionDays: number = 3650; // 文件保留10年（3650天）

  constructor() {
    this.prisma = new PrismaClient();
    this.archiveDir = path.join(process.cwd(), 'data', 'backups', 'logs', 'archives');

    // 确保目录存在
    if (!fs.existsSync(this.archiveDir)) {
      fs.mkdirSync(this.archiveDir, { recursive: true });
    }
  }

  /**
   * 归档指定日期的日志
   */
  async archiveLogsByDate(targetDate: Date): Promise<ArchiveResult> {
    try {
      console.log(`📦 开始归档日志: ${targetDate.toISOString().split('T')[0]}`);

      // 计算日期范围（当天的开始和结束）
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);

      // 查询该日期的所有日志
      const logs = await this.prisma.systemLog.findMany({
        where: {
          createdAt: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
      });

      if (logs.length === 0) {
        console.log('✓ 没有日志需要归档');
        return {
          success: true,
          filePath: '',
          sizeBytes: 0,
          compressedSizeBytes: 0,
          recordCount: 0,
          timestamp: new Date(),
          message: '没有日志需要归档',
        };
      }

      // 生成归档文件名
      const dateStr = targetDate.toISOString().split('T')[0];
      const jsonFileName = `logs_${dateStr}.json`;
      const jsonFilePath = path.join(this.archiveDir, jsonFileName);
      const gzFileName = `${jsonFileName}.gz`;
      const gzFilePath = path.join(this.archiveDir, gzFileName);

      // 导出为 JSON
      const jsonContent = JSON.stringify(logs, null, 2);
      fs.writeFileSync(jsonFilePath, jsonContent, 'utf-8');

      // 压缩为 .gz
      const input = fs.createReadStream(jsonFilePath);
      const output = fs.createWriteStream(gzFilePath);
      const gzip = createGzip();

      await pipeline(input, gzip, output);

      // 删除原始 JSON 文件
      fs.unlinkSync(jsonFilePath);

      const stats = fs.statSync(gzFilePath);
      const originalSize = Buffer.byteLength(jsonContent, 'utf-8');

      console.log(`✅ 日志归档完成: ${gzFileName}`);
      console.log(`   记录数: ${logs.length}`);
      console.log(`   原始大小: ${this.formatBytes(originalSize)}`);
      console.log(`   压缩后: ${this.formatBytes(stats.size)}`);
      console.log(`   压缩率: ${((1 - stats.size / originalSize) * 100).toFixed(1)}%`);

      return {
        success: true,
        filePath: gzFilePath,
        sizeBytes: originalSize,
        compressedSizeBytes: stats.size,
        recordCount: logs.length,
        timestamp: new Date(),
      };
    } catch (error: any) {
      console.error('❌ 日志归档失败:', error);
      return {
        success: false,
        filePath: '',
        sizeBytes: 0,
        compressedSizeBytes: 0,
        recordCount: 0,
        timestamp: new Date(),
        message: error.message,
      };
    }
  }

  /**
   * 归档昨天的日志
   */
  async archiveYesterdayLogs(): Promise<ArchiveResult> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return this.archiveLogsByDate(yesterday);
  }

  /**
   * 归档过去15天的日志
   * 用于每15天执行一次的归档任务
   * 归档范围：从15天前到昨天（不包括今天，因为今天的日志还在产生）
   */
  async archiveLast15DaysLogs(): Promise<ArchiveResult[]> {
    const results: ArchiveResult[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0); // 今天的开始时间
    
    console.log('📦 开始归档过去15天的日志...');
    
    // 归档过去15天（从15天前到昨天，不包括今天）
    for (let i = 15; i >= 1; i--) {
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() - i);
      
      // 检查该日期的归档文件是否已存在
      const dateStr = targetDate.toISOString().split('T')[0];
      const gzFileName = `logs_${dateStr}.json.gz`;
      const gzFilePath = path.join(this.archiveDir, gzFileName);
      
      if (fs.existsSync(gzFilePath)) {
        console.log(`✓ 跳过已归档的日期: ${dateStr}`);
        continue;
      }
      
      const result = await this.archiveLogsByDate(targetDate);
      results.push(result);
    }
    
    const successCount = results.filter(r => r.success).length;
    const totalRecords = results.reduce((sum, r) => sum + r.recordCount, 0);
    
    console.log(`✅ 归档完成，共处理 ${results.length} 天的日志，成功 ${successCount} 天，总计 ${totalRecords} 条记录`);
    
    return results;
  }

  /**
   * 清理数据库中的旧日志（保留最近 N 天）
   */
  async cleanupDatabaseLogs(retentionDays: number = 90): Promise<{ deleted: number }> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      console.log(`🧹 清理数据库日志（保留最近 ${retentionDays} 天）...`);

      const result = await this.prisma.systemLog.deleteMany({
        where: {
          createdAt: {
            lt: cutoffDate,
          },
        },
      });

      console.log(`✅ 已删除 ${result.count} 条旧日志记录`);

      return { deleted: result.count };
    } catch (error: any) {
      console.error('❌ 清理数据库日志失败:', error);
      return { deleted: 0 };
    }
  }

  /**
   * 清理过期的归档文件
   * 默认保留10年（3650天），可根据需要调整
   */
  async cleanupOldArchives(retentionDays: number = 3650): Promise<{ deleted: number; freedSpace: number }> {
    const now = Date.now();
    const retentionMs = retentionDays * 24 * 60 * 60 * 1000;
    let deleted = 0;
    let freedSpace = 0;

    if (!fs.existsSync(this.archiveDir)) {
      return { deleted: 0, freedSpace: 0 };
    }

    const files = fs.readdirSync(this.archiveDir);
    
    for (const file of files) {
      if (file.startsWith('logs_') && file.endsWith('.json.gz')) {
        const filePath = path.join(this.archiveDir, file);
        const stats = fs.statSync(filePath);
        
        if (stats.mtimeMs < now - retentionMs) {
          fs.unlinkSync(filePath);
          deleted++;
          freedSpace += stats.size;
          console.log(`🗑️  删除过期归档: ${file}`);
        }
      }
    }

    if (deleted > 0) {
      console.log(`✅ 清理完成: 删除 ${deleted} 个归档文件, 释放 ${this.formatBytes(freedSpace)}`);
    } else {
      console.log(`✓ 没有需要清理的归档文件（保留期: ${retentionDays} 天）`);
    }

    return { deleted, freedSpace };
  }

  /**
   * 获取归档统计信息
   */
  async getArchiveStats(): Promise<{
    totalFiles: number;
    totalSize: number;
    oldestArchive: Date | null;
    newestArchive: Date | null;
  }> {
    const stats = {
      totalFiles: 0,
      totalSize: 0,
      oldestArchive: null as Date | null,
      newestArchive: null as Date | null,
    };

    if (!fs.existsSync(this.archiveDir)) {
      return stats;
    }

    const files = fs.readdirSync(this.archiveDir)
      .filter(f => f.startsWith('logs_') && f.endsWith('.json.gz'))
      .map(f => {
        const filePath = path.join(this.archiveDir, f);
        return { name: f, path: filePath, stats: fs.statSync(filePath) };
      })
      .sort((a, b) => a.stats.mtimeMs - b.stats.mtimeMs);

    if (files.length > 0) {
      stats.totalFiles = files.length;
      stats.totalSize = files.reduce((sum, f) => sum + f.stats.size, 0);
      stats.oldestArchive = files[0].stats.mtime;
      stats.newestArchive = files[files.length - 1].stats.mtime;
    }

    return stats;
  }

  /**
   * 格式化文件大小
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    await this.prisma.$disconnect();
  }
}

