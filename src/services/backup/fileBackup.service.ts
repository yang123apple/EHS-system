/**
 * 文件备份服务
 * 负责非结构化数据的增量备份
 * 
 * 备份策略：
 * - 首次全量扫描：建立文件索引（MD5哈希表）
 * - 增量备份：每日扫描，只备份新增/修改的文件
 * - 基于 MD5 哈希对比，识别变化文件
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createGzip } from 'zlib';
import { pipeline } from 'stream/promises';
import archiver from 'archiver';

interface FileIndex {
  [filePath: string]: {
    md5: string;
    size: number;
    mtime: number;
  };
}

interface BackupResult {
  success: boolean;
  type: 'full' | 'incremental';
  filePath: string;
  sizeBytes: number;
  filesCount: number;
  timestamp: Date;
  message?: string;
}

export class FileBackupService {
  private prisma: PrismaClient;
  private uploadsDir: string;
  private backupDir: string;
  private indexFile: string;
  private fileIndex: FileIndex = {};

  // 需要备份的文件类型和目录
  private readonly backupCategories = [
    'docs',      // 制度文件
    'training',  // 培训材料
    'avatars',   // 用户头像
    'thumbnails', // 缩略图
  ];

  constructor() {
    this.prisma = new PrismaClient();
    this.uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    this.backupDir = path.join(process.cwd(), 'data', 'backups', 'files');
    this.indexFile = path.join(process.cwd(), 'data', 'file-index', 'index.json');

    // 确保目录存在
    [this.backupDir, path.dirname(this.indexFile)].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });

    // 加载文件索引
    this.loadIndex();
  }

  /**
   * 加载文件索引
   */
  private loadIndex(): void {
    try {
      if (fs.existsSync(this.indexFile)) {
        const content = fs.readFileSync(this.indexFile, 'utf-8');
        this.fileIndex = JSON.parse(content);
        console.log(`✓ 加载文件索引: ${Object.keys(this.fileIndex).length} 个文件`);
      }
    } catch (error) {
      console.warn('⚠ 加载文件索引失败，将重新扫描:', error);
      this.fileIndex = {};
    }
  }

  /**
   * 保存文件索引
   */
  private saveIndex(): void {
    try {
      fs.writeFileSync(this.indexFile, JSON.stringify(this.fileIndex, null, 2), 'utf-8');
    } catch (error) {
      console.error('❌ 保存文件索引失败:', error);
    }
  }

  /**
   * 计算文件的 MD5 哈希
   */
  private async calculateMD5(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('md5');
      const stream = fs.createReadStream(filePath);

      stream.on('data', (data) => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  /**
   * 递归扫描目录，收集文件信息
   */
  private async scanDirectory(dirPath: string, basePath: string = ''): Promise<FileIndex> {
    const index: FileIndex = {};

    if (!fs.existsSync(dirPath)) {
      return index;
    }

    const items = fs.readdirSync(dirPath);

    for (const item of items) {
      const fullPath = path.join(dirPath, item);
      const relativePath = path.join(basePath, item).replace(/\\/g, '/');
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        // 递归扫描子目录
        const subIndex = await this.scanDirectory(fullPath, relativePath);
        Object.assign(index, subIndex);
      } else if (stat.isFile()) {
        // 计算文件 MD5
        try {
          const md5 = await this.calculateMD5(fullPath);
          index[relativePath] = {
            md5,
            size: stat.size,
            mtime: stat.mtimeMs,
          };
        } catch (error) {
          console.warn(`⚠ 计算文件 MD5 失败: ${fullPath}`, error);
        }
      }
    }

    return index;
  }

  /**
   * 执行全量备份（首次扫描）
   */
  async performFullBackup(): Promise<BackupResult> {
    try {
      console.log('📦 开始文件全量备份...');

      // 扫描所有上传文件
      const newIndex: FileIndex = {};
      
      for (const category of this.backupCategories) {
        const categoryDir = path.join(this.uploadsDir, category);
        if (fs.existsSync(categoryDir)) {
          const categoryIndex = await this.scanDirectory(categoryDir, category);
          Object.assign(newIndex, categoryIndex);
        }
      }

      // 扫描根目录下的文件（如果有）
      if (fs.existsSync(this.uploadsDir)) {
        const rootFiles = fs.readdirSync(this.uploadsDir)
          .filter(item => {
            const fullPath = path.join(this.uploadsDir, item);
            return fs.statSync(fullPath).isFile();
          });

        for (const file of rootFiles) {
          const fullPath = path.join(this.uploadsDir, file);
          try {
            const md5 = await this.calculateMD5(fullPath);
            newIndex[file] = {
              md5,
              size: fs.statSync(fullPath).size,
              mtime: fs.statSync(fullPath).mtimeMs,
            };
          } catch (error) {
            console.warn(`⚠ 处理文件失败: ${fullPath}`, error);
          }
        }
      }

      // 创建备份文件
      const timestamp = new Date().toISOString()
        .replace(/T/, '_')
        .replace(/\..+/, '')
        .replace(/:/g, '-');
      const backupFileName = `full_${timestamp}.tar.gz`;
      const backupFilePath = path.join(this.backupDir, 'full', backupFileName);

      // 确保目录存在
      if (!fs.existsSync(path.dirname(backupFilePath))) {
        fs.mkdirSync(path.dirname(backupFilePath), { recursive: true });
      }

      // 创建 tar.gz 压缩包
      const output = fs.createWriteStream(backupFilePath);
      const archive = archiver('tar', { gzip: true });

      await new Promise<void>((resolve, reject) => {
        output.on('close', resolve);
        archive.on('error', reject);

        archive.pipe(output);

        // 添加所有文件到压缩包
        for (const [relativePath, info] of Object.entries(newIndex)) {
          const fullPath = path.join(this.uploadsDir, relativePath);
          if (fs.existsSync(fullPath)) {
            archive.file(fullPath, { name: relativePath });
          }
        }

        archive.finalize();
      });

      const stats = fs.statSync(backupFilePath);
      const filesCount = Object.keys(newIndex).length;

      // 更新索引
      this.fileIndex = newIndex;
      this.saveIndex();

      console.log(`✅ 全量备份完成: ${backupFileName} (${this.formatBytes(stats.size)}, ${filesCount} 个文件)`);

      return {
        success: true,
        type: 'full',
        filePath: backupFilePath,
        sizeBytes: stats.size,
        filesCount,
        timestamp: new Date(),
      };
    } catch (error: any) {
      console.error('❌ 全量备份失败:', error);
      return {
        success: false,
        type: 'full',
        filePath: '',
        sizeBytes: 0,
        filesCount: 0,
        timestamp: new Date(),
        message: error.message,
      };
    }
  }

  /**
   * 执行增量备份
   */
  async performIncrementalBackup(): Promise<BackupResult> {
    try {
      console.log('📦 开始文件增量备份...');

      // 重新扫描文件
      const newIndex: FileIndex = {};
      
      for (const category of this.backupCategories) {
        const categoryDir = path.join(this.uploadsDir, category);
        if (fs.existsSync(categoryDir)) {
          const categoryIndex = await this.scanDirectory(categoryDir, category);
          Object.assign(newIndex, categoryIndex);
        }
      }

      // 找出变化的文件（新增或修改）
      const changedFiles: string[] = [];

      for (const [relativePath, newInfo] of Object.entries(newIndex)) {
        const oldInfo = this.fileIndex[relativePath];
        
        if (!oldInfo || oldInfo.md5 !== newInfo.md5) {
          changedFiles.push(relativePath);
        }
      }

      // 检查已删除的文件（从索引中移除）
      for (const relativePath of Object.keys(this.fileIndex)) {
        if (!newIndex[relativePath]) {
          // 文件已删除，不需要备份
          delete this.fileIndex[relativePath];
        }
      }

      if (changedFiles.length === 0) {
        console.log('✓ 没有文件变化，跳过备份');
        return {
          success: true,
          type: 'incremental',
          filePath: '',
          sizeBytes: 0,
          filesCount: 0,
          timestamp: new Date(),
          message: '没有文件变化',
        };
      }

      // 创建增量备份文件
      const timestamp = new Date().toISOString()
        .replace(/T/, '_')
        .replace(/\..+/, '')
        .replace(/:/g, '-');
      const backupFileName = `inc_${timestamp}.tar.gz`;
      const backupFilePath = path.join(this.backupDir, 'incremental', backupFileName);

      // 确保目录存在
      if (!fs.existsSync(path.dirname(backupFilePath))) {
        fs.mkdirSync(path.dirname(backupFilePath), { recursive: true });
      }

      // 创建 tar.gz 压缩包
      const output = fs.createWriteStream(backupFilePath);
      const archive = archiver('tar', { gzip: true });

      await new Promise<void>((resolve, reject) => {
        output.on('close', resolve);
        archive.on('error', reject);

        archive.pipe(output);

        // 只添加变化的文件
        for (const relativePath of changedFiles) {
          const fullPath = path.join(this.uploadsDir, relativePath);
          if (fs.existsSync(fullPath)) {
            archive.file(fullPath, { name: relativePath });
          }
        }

        archive.finalize();
      });

      const stats = fs.statSync(backupFilePath);

      // 更新索引
      this.fileIndex = newIndex;
      this.saveIndex();

      console.log(`✅ 增量备份完成: ${backupFileName} (${this.formatBytes(stats.size)}, ${changedFiles.length} 个文件)`);

      return {
        success: true,
        type: 'incremental',
        filePath: backupFilePath,
        sizeBytes: stats.size,
        filesCount: changedFiles.length,
        timestamp: new Date(),
      };
    } catch (error: any) {
      console.error('❌ 增量备份失败:', error);
      return {
        success: false,
        type: 'incremental',
        filePath: '',
        sizeBytes: 0,
        filesCount: 0,
        timestamp: new Date(),
        message: error.message,
      };
    }
  }

  /**
   * 清理过期备份
   */
  async cleanupOldBackups(retentionDays: number = 30): Promise<{ deleted: number; freedSpace: number }> {
    const now = Date.now();
    const retentionMs = retentionDays * 24 * 60 * 60 * 1000;
    let deleted = 0;
    let freedSpace = 0;

    // 清理全量备份
    const fullBackupDir = path.join(this.backupDir, 'full');
    if (fs.existsSync(fullBackupDir)) {
      const files = fs.readdirSync(fullBackupDir);
      for (const file of files) {
        if (file.startsWith('full_') && file.endsWith('.tar.gz')) {
          const filePath = path.join(fullBackupDir, file);
          const stats = fs.statSync(filePath);
          
          if (stats.mtimeMs < now - retentionMs) {
            fs.unlinkSync(filePath);
            deleted++;
            freedSpace += stats.size;
            console.log(`🗑️  删除过期备份: ${file}`);
          }
        }
      }
    }

    // 清理增量备份
    const incrementalBackupDir = path.join(this.backupDir, 'incremental');
    if (fs.existsSync(incrementalBackupDir)) {
      const files = fs.readdirSync(incrementalBackupDir);
      for (const file of files) {
        if (file.startsWith('inc_') && file.endsWith('.tar.gz')) {
          const filePath = path.join(incrementalBackupDir, file);
          const stats = fs.statSync(filePath);
          
          if (stats.mtimeMs < now - retentionMs) {
            fs.unlinkSync(filePath);
            deleted++;
            freedSpace += stats.size;
            console.log(`🗑️  删除过期备份: ${file}`);
          }
        }
      }
    }

    if (deleted > 0) {
      console.log(`✅ 清理完成: 删除 ${deleted} 个备份文件, 释放 ${this.formatBytes(freedSpace)}`);
    }

    return { deleted, freedSpace };
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
   * 获取文件备份统计信息
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
    const fullBackupDir = path.join(this.backupDir, 'full');
    if (fs.existsSync(fullBackupDir)) {
      const files = fs.readdirSync(fullBackupDir)
        .filter(f => f.startsWith('full_') && f.endsWith('.tar.gz'))
        .map(f => {
          const filePath = path.join(fullBackupDir, f);
          return { name: f, path: filePath, stats: fs.statSync(filePath) };
        })
        .sort((a, b) => b.stats.mtimeMs - a.stats.mtimeMs);

      stats.fullBackups.count = files.length;
      stats.fullBackups.totalSize = files.reduce((sum, f) => sum + f.stats.size, 0);
      stats.fullBackups.latest = files.length > 0 ? files[0].stats.mtime : null;
    }

    // 统计增量备份
    const incrementalBackupDir = path.join(this.backupDir, 'incremental');
    if (fs.existsSync(incrementalBackupDir)) {
      const files = fs.readdirSync(incrementalBackupDir)
        .filter(f => f.startsWith('inc_') && f.endsWith('.tar.gz'))
        .map(f => {
          const filePath = path.join(incrementalBackupDir, f);
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
   * 清理资源
   */
  async cleanup(): Promise<void> {
    await this.prisma.$disconnect();
  }
}

