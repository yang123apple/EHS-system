/**
 * 数据库备份服务
 * 负责结构化数据的全量和增量备份
 * 
 * 备份策略：
 * - 全量备份：每日凌晨2:00（SQLite dump）
 * - 增量备份：每小时备份 WAL 文件
 * - 保留策略：全量30天，增量7天
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

interface BackupResult {
  success: boolean;
  type: 'full' | 'incremental';
  filePath: string;
  sizeBytes: number;
  timestamp: Date;
  message?: string;
}

export class DatabaseBackupService {
  private prisma: PrismaClient;
  private backupDir: string;
  private fullBackupDir: string;
  private incrementalBackupDir: string;

  constructor() {
    this.prisma = new PrismaClient();
    const dataDir = path.join(process.cwd(), 'data', 'backups', 'database');
    this.backupDir = dataDir;
    this.fullBackupDir = path.join(dataDir, 'full');
    this.incrementalBackupDir = path.join(dataDir, 'incremental');

    // 确保目录存在
    [this.backupDir, this.fullBackupDir, this.incrementalBackupDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  /**
   * 执行数据库 checkpoint，确保 WAL 文件合并到主数据库
   */
  private async checkpointDatabase(): Promise<void> {
    try {
      await this.prisma.$queryRaw`PRAGMA wal_checkpoint(TRUNCATE)`;
      console.log('✓ 数据库 WAL checkpoint 完成');
    } catch (error: any) {
      console.warn('⚠ WAL checkpoint 失败:', error.message);
    }
  }

  /**
   * 执行全量备份
   */
  async performFullBackup(): Promise<BackupResult> {
    try {
      console.log('📦 开始数据库全量备份...');

      // 执行 checkpoint
      await this.checkpointDatabase();

      // 生成备份文件名
      const timestamp = new Date().toISOString()
        .replace(/T/, '_')
        .replace(/\..+/, '')
        .replace(/:/g, '-');
      const backupFileName = `full_${timestamp}.db`;
      const backupFilePath = path.join(this.fullBackupDir, backupFileName);

      // 获取数据库文件路径
      const dbPath = path.join(process.cwd(), 'prisma', 'dev.db');

      if (!fs.existsSync(dbPath)) {
        throw new Error('数据库文件不存在');
      }

      // 使用 SQLite 的 .backup 命令进行备份
      const backupCommand = `sqlite3 "${dbPath}" ".backup '${backupFilePath}'"`;
      
      await execAsync(backupCommand);

      const stats = fs.statSync(backupFilePath);
      
      console.log(`✅ 全量备份完成: ${backupFileName} (${this.formatBytes(stats.size)})`);

      return {
        success: true,
        type: 'full',
        filePath: backupFilePath,
        sizeBytes: stats.size,
        timestamp: new Date(),
      };
    } catch (error: any) {
      console.error('❌ 全量备份失败:', error);
      return {
        success: false,
        type: 'full',
        filePath: '',
        sizeBytes: 0,
        timestamp: new Date(),
        message: error.message,
      };
    }
  }

  /**
   * 执行增量备份（备份 WAL 文件）
   */
  async performIncrementalBackup(): Promise<BackupResult> {
    try {
      console.log('📦 开始数据库增量备份...');

      // 获取 WAL 文件路径
      const walPath = path.join(process.cwd(), 'prisma', 'dev.db-wal');

      if (!fs.existsSync(walPath)) {
        // 如果没有 WAL 文件，说明数据库不在 WAL 模式，跳过增量备份
        return {
          success: true,
          type: 'incremental',
          filePath: '',
          sizeBytes: 0,
          timestamp: new Date(),
          message: '数据库未启用 WAL 模式，跳过增量备份',
        };
      }

      // 生成备份文件名
      const timestamp = new Date().toISOString()
        .replace(/T/, '_')
        .replace(/\..+/, '')
        .replace(/:/g, '-');
      const backupFileName = `wal_${timestamp}.wal`;
      const backupFilePath = path.join(this.incrementalBackupDir, backupFileName);

      // 复制 WAL 文件
      fs.copyFileSync(walPath, backupFilePath);

      const stats = fs.statSync(backupFilePath);
      
      console.log(`✅ 增量备份完成: ${backupFileName} (${this.formatBytes(stats.size)})`);

      return {
        success: true,
        type: 'incremental',
        filePath: backupFilePath,
        sizeBytes: stats.size,
        timestamp: new Date(),
      };
    } catch (error: any) {
      console.error('❌ 增量备份失败:', error);
      return {
        success: false,
        type: 'incremental',
        filePath: '',
        sizeBytes: 0,
        timestamp: new Date(),
        message: error.message,
      };
    }
  }

  /**
   * 清理过期备份
   */
  async cleanupOldBackups(
    fullRetentionDays: number = 30,
    incrementalRetentionDays: number = 7
  ): Promise<{ deletedFull: number; deletedIncremental: number; freedSpace: number }> {
    const now = Date.now();
    const fullRetentionMs = fullRetentionDays * 24 * 60 * 60 * 1000;
    const incrementalRetentionMs = incrementalRetentionDays * 24 * 60 * 60 * 1000;

    let deletedFull = 0;
    let deletedIncremental = 0;
    let freedSpace = 0;

    // 清理全量备份
    if (fs.existsSync(this.fullBackupDir)) {
      const files = fs.readdirSync(this.fullBackupDir);
      for (const file of files) {
        if (file.startsWith('full_') && file.endsWith('.db')) {
          const filePath = path.join(this.fullBackupDir, file);
          const stats = fs.statSync(filePath);
          
          if (stats.mtimeMs < now - fullRetentionMs) {
            fs.unlinkSync(filePath);
            deletedFull++;
            freedSpace += stats.size;
            console.log(`🗑️  删除过期全量备份: ${file}`);
          }
        }
      }
    }

    // 清理增量备份
    if (fs.existsSync(this.incrementalBackupDir)) {
      const files = fs.readdirSync(this.incrementalBackupDir);
      for (const file of files) {
        if (file.startsWith('wal_') && file.endsWith('.wal')) {
          const filePath = path.join(this.incrementalBackupDir, file);
          const stats = fs.statSync(filePath);
          
          if (stats.mtimeMs < now - incrementalRetentionMs) {
            fs.unlinkSync(filePath);
            deletedIncremental++;
            freedSpace += stats.size;
            console.log(`🗑️  删除过期增量备份: ${file}`);
          }
        }
      }
    }

    if (deletedFull > 0 || deletedIncremental > 0) {
      console.log(`✅ 清理完成: 删除 ${deletedFull} 个全量备份, ${deletedIncremental} 个增量备份, 释放 ${this.formatBytes(freedSpace)}`);
    }

    return { deletedFull, deletedIncremental, freedSpace };
  }

  /**
   * 获取备份统计信息
   */
  async getBackupStats(): Promise<{
    fullBackups: { count: number; totalSize: number; latest: Date | null };
    incrementalBackups: { count: number; totalSize: number; latest: Date | null };
  }> {
    const stats = {
      fullBackups: { count: 0, totalSize: 0, latest: null as Date | null },
      incrementalBackups: { count: 0, totalSize: 0, latest: null as Date | null },
    };

    // 统计全量备份
    if (fs.existsSync(this.fullBackupDir)) {
      const files = fs.readdirSync(this.fullBackupDir)
        .filter(f => f.startsWith('full_') && f.endsWith('.db'))
        .map(f => {
          const filePath = path.join(this.fullBackupDir, f);
          return { name: f, path: filePath, stats: fs.statSync(filePath) };
        })
        .sort((a, b) => b.stats.mtimeMs - a.stats.mtimeMs);

      stats.fullBackups.count = files.length;
      stats.fullBackups.totalSize = files.reduce((sum, f) => sum + f.stats.size, 0);
      stats.fullBackups.latest = files.length > 0 ? files[0].stats.mtime : null;
    }

    // 统计增量备份
    if (fs.existsSync(this.incrementalBackupDir)) {
      const files = fs.readdirSync(this.incrementalBackupDir)
        .filter(f => f.startsWith('wal_') && f.endsWith('.wal'))
        .map(f => {
          const filePath = path.join(this.incrementalBackupDir, f);
          return { name: f, path: filePath, stats: fs.statSync(filePath) };
        })
        .sort((a, b) => b.stats.mtimeMs - a.stats.mtimeMs);

      stats.incrementalBackups.count = files.length;
      stats.incrementalBackups.totalSize = files.reduce((sum, f) => sum + f.stats.size, 0);
      stats.incrementalBackups.latest = files.length > 0 ? files[0].stats.mtime : null;
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

