/**
 * 数据保护服务
 * 负责系统全量备份的管理和调度
 * 
 * v2.0 更新说明：
 * - 采用 ZIP 全量备份策略，包含数据库、上传文件、配置文件
 * - 废弃了基于 JSON 的部分恢复逻辑
 * - 恢复操作统一使用 scripts/restore-backup.js
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

interface BackupInfo {
  filename: string;
  filepath: string;
  sizeBytes: number;
  sizeMB: number;
  createdAt: Date;
  age: string;
}

export class DataProtectionService {
  private static instance: DataProtectionService;
  private prisma: PrismaClient;
  private backupInterval: NodeJS.Timeout | null = null;
  private backupDir: string;

  private constructor() {
    this.prisma = new PrismaClient();
    this.backupDir = path.join(process.cwd(), 'data', 'backups');
    
    // 确保备份目录存在
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  /**
   * 获取单例实例
   */
  static getInstance(): DataProtectionService {
    if (!DataProtectionService.instance) {
      DataProtectionService.instance = new DataProtectionService();
    }
    return DataProtectionService.instance;
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
   * 计算时间差描述
   */
  private getAgeDescription(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) {
      return `${diffMins} 分钟前`;
    } else if (diffHours < 24) {
      return `${diffHours} 小时前`;
    } else if (diffDays < 30) {
      return `${diffDays} 天前`;
    } else {
      return `${Math.floor(diffDays / 30)} 个月前`;
    }
  }

  /**
   * 获取备份列表
   * 扫描 data/backups/ 目录，返回所有 ZIP 备份文件的信息
   */
  async getBackupsList(): Promise<BackupInfo[]> {
    try {
      if (!fs.existsSync(this.backupDir)) {
        return [];
      }

      const files = fs.readdirSync(this.backupDir);
      const backupFiles = files.filter(f => 
        f.startsWith('full_backup_') && f.endsWith('.zip')
      );

      const backups: BackupInfo[] = backupFiles.map(filename => {
        const filepath = path.join(this.backupDir, filename);
        const stat = fs.statSync(filepath);
        
        return {
          filename,
          filepath,
          sizeBytes: stat.size,
          sizeMB: Math.round((stat.size / 1024 / 1024) * 100) / 100,
          createdAt: stat.mtime,
          age: this.getAgeDescription(stat.mtime),
        };
      });

      // 按创建时间倒序排列（最新的在前）
      backups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      return backups;
    } catch (error) {
      console.error('获取备份列表失败:', error);
      return [];
    }
  }

  /**
   * 验证备份文件
   * 检查指定 ZIP 文件是否存在且大小不为 0
   */
  async verifyBackup(filename: string): Promise<{
    valid: boolean;
    message: string;
    details?: {
      exists: boolean;
      sizeBytes: number;
      sizeMB: number;
      createdAt?: Date;
    };
  }> {
    try {
      // 确定文件路径
      let filepath = filename;
      if (!path.isAbsolute(filename)) {
        filepath = path.join(this.backupDir, filename);
      }

      // 检查文件是否存在
      if (!fs.existsSync(filepath)) {
        return {
          valid: false,
          message: '备份文件不存在',
          details: {
            exists: false,
            sizeBytes: 0,
            sizeMB: 0,
          },
        };
      }

      // 获取文件信息
      const stat = fs.statSync(filepath);

      // 检查文件大小
      if (stat.size === 0) {
        return {
          valid: false,
          message: '备份文件为空（0 字节）',
          details: {
            exists: true,
            sizeBytes: 0,
            sizeMB: 0,
            createdAt: stat.mtime,
          },
        };
      }

      // 检查是否是 ZIP 文件
      if (!filename.endsWith('.zip')) {
        return {
          valid: false,
          message: '不是有效的 ZIP 备份文件',
          details: {
            exists: true,
            sizeBytes: stat.size,
            sizeMB: Math.round((stat.size / 1024 / 1024) * 100) / 100,
            createdAt: stat.mtime,
          },
        };
      }

      // 验证通过
      return {
        valid: true,
        message: '备份文件有效',
        details: {
          exists: true,
          sizeBytes: stat.size,
          sizeMB: Math.round((stat.size / 1024 / 1024) * 100) / 100,
          createdAt: stat.mtime,
        },
      };
    } catch (error: any) {
      return {
        valid: false,
        message: `验证失败: ${error.message}`,
        details: {
          exists: false,
          sizeBytes: 0,
          sizeMB: 0,
        },
      };
    }
  }

  /**
   * 启动每日自动备份定时任务
   * 每天凌晨2点执行备份
   */
  async startDailyBackupSchedule(): Promise<void> {
    // 如果已经有定时任务，先清除
    if (this.backupInterval) {
      clearInterval(this.backupInterval);
    }

    // 计算到下一个凌晨2点的时间
    const now = new Date();
    const nextBackup = new Date();
    nextBackup.setHours(2, 0, 0, 0);
    
    // 如果今天的2点已经过了，设置为明天的2点
    if (nextBackup <= now) {
      nextBackup.setDate(nextBackup.getDate() + 1);
    }

    const msUntilNextBackup = nextBackup.getTime() - now.getTime();

    console.log(`   - 首次备份时间: ${nextBackup.toLocaleString('zh-CN')}`);
    console.log(`   - 距离首次备份: ${Math.round(msUntilNextBackup / 1000 / 60)} 分钟`);

    // 设置首次备份
    setTimeout(async () => {
      await this.performDailyBackup();
      
      // 之后每24小时执行一次
      this.backupInterval = setInterval(async () => {
        await this.performDailyBackup();
      }, 24 * 60 * 60 * 1000);
    }, msUntilNextBackup);

    console.log('✅ 每日备份任务已启动');
  }

  /**
   * 执行每日备份
   * 通过 child_process 调用 scripts/auto-backup.js
   */
  async performDailyBackup(): Promise<void> {
    console.log('========================================');
    console.log(`🔄 开始执行每日全量备份 [${new Date().toLocaleString('zh-CN')}]`);
    console.log('========================================');

    try {
      const autoBackupPath = path.join(process.cwd(), 'scripts', 'auto-backup.js');
      
      if (!fs.existsSync(autoBackupPath)) {
        throw new Error('备份脚本不存在: ' + autoBackupPath);
      }

      // 使用 child_process 执行备份脚本（避免 Next.js Turbopack 编译问题）
      const { execSync } = require('child_process');
      const output = execSync(`node "${autoBackupPath}"`, { 
        encoding: 'utf-8',
        cwd: process.cwd(),
      });
      
      console.log(output);
      console.log('✅ 每日备份完成');
      console.log('========================================');
    } catch (error: any) {
      console.error('❌ 每日备份失败:', error);
      console.error('stderr:', error.stderr?.toString());
      console.error('========================================');
      throw error;
    }
  }

  /**
   * 手动触发备份（供API调用）
   */
  async manualBackup(): Promise<{ 
    success: boolean; 
    message: string;
    backupFile?: string;
  }> {
    try {
      console.log('🔄 手动触发全量备份...');
      
      const autoBackupPath = path.join(process.cwd(), 'scripts', 'auto-backup.js');
      
      if (!fs.existsSync(autoBackupPath)) {
        throw new Error('备份脚本不存在');
      }

      // 使用 child_process 执行备份脚本
      const { execSync } = require('child_process');
      const output = execSync(`node "${autoBackupPath}"`, { 
        encoding: 'utf-8',
        cwd: process.cwd(),
      });
      
      console.log(output);
      
      // 从输出中提取备份文件名
      const match = output.match(/备份文件: (full_backup_[\w-]+\.zip)/);
      const backupFile = match ? match[1] : undefined;
      
      return { 
        success: true, 
        message: '全量备份成功',
        backupFile,
      };
    } catch (error: any) {
      console.error('手动备份失败:', error);
      console.error('stderr:', error.stderr?.toString());
      return { 
        success: false, 
        message: `备份失败: ${error.message}`,
      };
    }
  }

  /**
   * 获取备份状态和统计信息
   */
  async getBackupStatus(): Promise<{
    backupCount: number;
    latestBackup: BackupInfo | null;
    totalSizeMB: number;
    oldestBackup: BackupInfo | null;
    databaseStatus: { 
      departments: number; 
      users: number;
      hazards?: number;
      trainings?: number;
    };
  }> {
    try {
      // 获取所有备份文件
      const backups = await this.getBackupsList();
      
      // 计算总大小
      const totalSizeMB = backups.reduce((sum, backup) => sum + backup.sizeMB, 0);
      
      // 获取数据库统计
      const [deptCount, userCount, hazardCount, trainingCount] = await Promise.all([
        this.prisma.department.count().catch(() => 0),
        this.prisma.user.count().catch(() => 0),
        this.prisma.hazard.count().catch(() => 0),
        this.prisma.trainingTask.count().catch(() => 0),
      ]);

      return {
        backupCount: backups.length,
        latestBackup: backups[0] || null,
        oldestBackup: backups[backups.length - 1] || null,
        totalSizeMB: Math.round(totalSizeMB * 100) / 100,
        databaseStatus: {
          departments: deptCount,
          users: userCount,
          hazards: hazardCount,
          trainings: trainingCount,
        },
      };
    } catch (error) {
      console.error('获取备份状态失败:', error);
      throw error;
    }
  }

  /**
   * 清理服务（关闭数据库连接等）
   */
  async cleanup(): Promise<void> {
    if (this.backupInterval) {
      clearInterval(this.backupInterval);
    }
    await this.prisma.$disconnect();
  }
}
