/**
 * 备份调度服务
 * 统一调度所有备份任务
 * 
 * 调度计划：
 * - 每15天 - 日志归档（归档过去15天的日志）
 * - 02:00 - 数据库全量备份（每日）
 * - 02:30 - 文件增量备份（每日）
 * - 每小时 - 数据库增量备份（WAL）
 */

import { DatabaseBackupService } from './databaseBackup.service';
import { FileBackupService } from './fileBackup.service';
import { LogArchiveService } from './logArchive.service';
import AuditService from '@/services/audit.service';
import { LogModule, LogAction } from '@/types/audit';

interface BackupSchedule {
  name: string;
  cron: string; // 简单的 cron 表达式或时间间隔
  handler: () => Promise<void>;
  enabled: boolean;
}

export class BackupSchedulerService {
  private databaseBackup: DatabaseBackupService;
  private fileBackup: FileBackupService;
  private logArchive: LogArchiveService;
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private isRunning: boolean = false;

  constructor() {
    this.databaseBackup = new DatabaseBackupService();
    this.fileBackup = new FileBackupService();
    this.logArchive = new LogArchiveService();
  }

  /**
   * 启动所有备份任务调度
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠ 备份调度服务已在运行');
      return;
    }

    console.log('🚀 启动备份调度服务...');

    // 计算到下一个整点的时间
    const now = new Date();
    const nextHour = new Date(now);
    nextHour.setHours(now.getHours() + 1, 0, 0, 0);
    const msUntilNextHour = nextHour.getTime() - now.getTime();

    // 每15天任务：日志归档（00:00）
    this.schedulePeriodicTask('log-archive', 15, async () => {
      console.log('========================================');
      console.log('📋 执行日志归档任务（每15天）');
      console.log('========================================');
      const results = await this.logArchive.archiveLast15DaysLogs();
      console.log(`✅ 归档完成，共处理 ${results.length} 天的日志`);
      await this.logArchive.cleanupDatabaseLogs(90);
      // 不再自动清理归档文件，保留10年
      // await this.logArchive.cleanupOldArchives(3650);
    });

    // 每日任务：数据库全量备份（02:00）
    this.scheduleDailyTask('database-full', 2, 0, async () => {
      console.log('========================================');
      console.log('📋 执行数据库全量备份任务');
      console.log('========================================');
      await this.databaseBackup.performFullBackup();
      await this.databaseBackup.cleanupOldBackups(30, 7);
    });

    // 每日任务：MinIO 增量同步备份（02:30）
    // 使用系统级 mc mirror 命令，避免阻塞 Node.js Event Loop
    this.scheduleDailyTask('minio-sync', 2, 30, async () => {
      console.log('========================================');
      console.log('📋 执行 MinIO 增量同步备份任务');
      console.log('========================================');
      await this.performMinIOSync('incremental');
    });

    // 每小时任务：数据库增量备份（WAL）
    setTimeout(() => {
      // 立即执行一次
      this.performIncrementalDatabaseBackup();
      
      // 之后每小时执行
      const interval = setInterval(() => {
        this.performIncrementalDatabaseBackup();
      }, 60 * 60 * 1000); // 每小时

      this.intervals.set('database-incremental', interval);
    }, msUntilNextHour);

    this.isRunning = true;
    console.log('✅ 备份调度服务已启动');
    console.log('   - 日志归档: 每15天（归档过去15天的日志）');
    console.log('   - 数据库全量备份: 每日 02:00');
    console.log('   - MinIO 增量同步: 每日 02:30（使用 mc mirror）');
    console.log('   - 数据库增量备份: 每小时');
  }

  /**
   * 停止所有备份任务调度
   */
  stop(): void {
    console.log('🛑 停止备份调度服务...');
    
    this.intervals.forEach((interval, name) => {
      clearInterval(interval);
      console.log(`   - 已停止: ${name}`);
    });
    
    this.intervals.clear();
    this.isRunning = false;
    console.log('✅ 备份调度服务已停止');
  }

  /**
   * 调度每日任务
   */
  private scheduleDailyTask(
    name: string,
    hour: number,
    minute: number,
    handler: () => Promise<void>
  ): void {
    const now = new Date();
    const scheduledTime = new Date();
    scheduledTime.setHours(hour, minute, 0, 0);

    // 如果今天的执行时间已过，设置为明天
    if (scheduledTime <= now) {
      scheduledTime.setDate(scheduledTime.getDate() + 1);
    }

    const msUntilScheduled = scheduledTime.getTime() - now.getTime();

    // 设置首次执行
    setTimeout(async () => {
      try {
        await handler();
      } catch (error) {
        console.error(`❌ 备份任务执行失败 [${name}]:`, error);
      }

      // 之后每天执行一次
      const interval = setInterval(async () => {
        try {
          await handler();
        } catch (error) {
          console.error(`❌ 备份任务执行失败 [${name}]:`, error);
        }
      }, 24 * 60 * 60 * 1000); // 24小时

      this.intervals.set(name, interval);
    }, msUntilScheduled);

    console.log(`   - 已调度: ${name} (每日 ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')})`);
  }

  /**
   * 调度周期性任务（每N天执行一次）
   */
  private schedulePeriodicTask(
    name: string,
    days: number,
    handler: () => Promise<void>
  ): void {
    const now = new Date();
    const scheduledTime = new Date();
    scheduledTime.setHours(0, 0, 0, 0); // 每天 00:00

    // 如果今天的执行时间已过，设置为明天
    if (scheduledTime <= now) {
      scheduledTime.setDate(scheduledTime.getDate() + 1);
    }

    const msUntilScheduled = scheduledTime.getTime() - now.getTime();

    // 设置首次执行
    setTimeout(async () => {
      try {
        await handler();
      } catch (error) {
        console.error(`❌ 备份任务执行失败 [${name}]:`, error);
      }

      // 之后每N天执行一次
      const interval = setInterval(async () => {
        try {
          await handler();
        } catch (error) {
          console.error(`❌ 备份任务执行失败 [${name}]:`, error);
        }
      }, days * 24 * 60 * 60 * 1000); // N天

      this.intervals.set(name, interval);
    }, msUntilScheduled);

    console.log(`   - 已调度: ${name} (每${days}天执行一次)`);
  }

  /**
   * 执行数据库增量备份
   */
  private async performIncrementalDatabaseBackup(): Promise<void> {
    try {
      await this.databaseBackup.performIncrementalBackup();
    } catch (error) {
      console.error('❌ 数据库增量备份失败:', error);
    }
  }

  /**
   * 执行 MinIO 同步备份（使用系统级 mc mirror 命令）
   * 
   * 为什么使用 child_process.spawn 而不是直接调用 Node.js 代码？
   * 1. 解耦执行：备份脚本在独立进程中运行，不会阻塞 Node.js Event Loop
   * 2. 性能优势：mc mirror 是 C++ 实现，比 Node.js 流式处理快 10-100 倍
   * 3. 内存效率：mc 使用流式传输，不会将整个文件加载到内存
   * 4. 增量同步：mc 自动检测文件变化，只传输变化的部分
   * 5. 断点续传：支持中断后继续传输，适合 GB 级大文件
   * 
   * @param mode 'full' | 'incremental'
   */
  private async performMinIOSync(mode: 'full' | 'incremental' = 'incremental'): Promise<void> {
    const { spawn } = await import('child_process');
    const path = await import('path');
    const os = await import('os');
    
    return new Promise((resolve, reject) => {
      const isWindows = os.platform() === 'win32';
      const scriptName = isWindows ? 'sync-minio.ps1' : 'sync-minio.sh';
      const scriptPath = path.join(process.cwd(), 'scripts', scriptName);
      
      let command: string;
      let args: string[];
      
      if (isWindows) {
        // Windows: 使用 PowerShell
        command = 'powershell';
        args = [
          '-ExecutionPolicy', 'Bypass',
          '-File', scriptPath,
          mode
        ];
      } else {
        // Linux/Mac: 使用 Bash
        command = 'bash';
        args = [scriptPath, mode];
      }
      
      console.log(`🚀 启动 MinIO 同步备份 (${mode})...`);
      console.log(`   命令: ${command} ${args.join(' ')}`);
      
      const child = spawn(command, args, {
        stdio: ['ignore', 'pipe', 'pipe'], // 忽略 stdin，捕获 stdout 和 stderr
        shell: false,
        cwd: process.cwd(),
      });
      
      let stdout = '';
      let stderr = '';
      
      // 捕获输出
      child.stdout?.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        // 实时输出到控制台
        process.stdout.write(output);
      });
      
      child.stderr?.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        // 实时输出到控制台
        process.stderr.write(output);
      });
      
      // 处理进程退出
      child.on('close', async (code) => {
        if (code === 0) {
          console.log(`✅ MinIO 同步备份完成 (${mode})`);
          resolve();
        } else {
          const errorMessage = `MinIO 同步备份失败，退出码: ${code}`;
          const errorDetails = stderr || stdout || '无详细错误信息';
          
          console.error(`❌ ${errorMessage}`);
          console.error(`   错误详情: ${errorDetails}`);
          
          // 写入系统日志
          try {
            await AuditService.recordLog({
              module: LogModule.SYSTEM,
              action: LogAction.BACKUP_FAILED,
              targetType: 'backup',
              targetLabel: `MinIO ${mode} 同步备份`,
              operator: { id: 'system', name: 'System', role: 'system' },
              description: 'MinIO 同步备份失败',
              oldData: {
                mode,
                exitCode: code,
                error: errorDetails.substring(0, 1000),
                timestamp: new Date().toISOString(),
              },
            });
          } catch (logError: any) {
            console.error('❌ 写入系统日志失败:', logError);
          }
          
          reject(new Error(`${errorMessage}\n${errorDetails}`));
        }
      });
      
      // 处理进程错误
      child.on('error', async (error) => {
        const errorMessage = `启动 MinIO 同步备份进程失败: ${error.message}`;
        console.error(`❌ ${errorMessage}`);
        
        // 写入系统日志
        try {
          await AuditService.recordLog({
            module: LogModule.SYSTEM,
            action: LogAction.BACKUP_ERROR,
            targetType: 'backup',
            targetLabel: `MinIO ${mode} 同步备份`,
            operator: { id: 'system', name: 'System', role: 'system' },
            description: 'MinIO 同步备份进程启动失败',
            oldData: {
              mode,
              error: error.message,
              stack: error.stack?.substring(0, 1000),
              timestamp: new Date().toISOString(),
            },
          });
        } catch (logError: any) {
          console.error('❌ 写入系统日志失败:', logError);
        }
        
        reject(error);
      });
      
      // 设置超时（2小时，适合大文件同步）
      const timeout = setTimeout(() => {
        child.kill();
        const timeoutError = new Error('MinIO 同步备份超时（2小时）');
        
        // 写入系统日志
        AuditService.recordLog({
          module: LogModule.SYSTEM,
          action: LogAction.BACKUP_TIMEOUT,
          targetType: 'backup',
          targetLabel: `MinIO ${mode} 同步备份`,
          operator: { id: 'system', name: 'System', role: 'system' },
          description: 'MinIO 同步备份超时',
          oldData: {
            mode,
            timeout: '2小时',
            timestamp: new Date().toISOString(),
          },
        }).catch((logError: any) => {
          console.error('❌ 写入系统日志失败:', logError);
        });
        
        reject(timeoutError);
      }, 2 * 60 * 60 * 1000);
      
      child.on('close', () => {
        clearTimeout(timeout);
      });
    });
  }

  /**
   * 手动触发数据库全量备份
   */
  async triggerDatabaseFullBackup(): Promise<void> {
    console.log('🔄 手动触发数据库全量备份...');
    await this.databaseBackup.performFullBackup();
  }

  /**
   * 手动触发 MinIO 全量同步备份
   */
  async triggerMinIOFullSync(): Promise<void> {
    console.log('🔄 手动触发 MinIO 全量同步备份...');
    await this.performMinIOSync('full');
  }

  /**
   * 手动触发 MinIO 增量同步备份
   */
  async triggerMinIOIncrementalSync(): Promise<void> {
    console.log('🔄 手动触发 MinIO 增量同步备份...');
    await this.performMinIOSync('incremental');
  }

  /**
   * 兼容旧接口：文件全量备份（已废弃，使用 MinIO 同步）
   * @deprecated 使用 triggerMinIOFullSync 代替
   */
  async triggerFileFullBackup(): Promise<void> {
    console.log('⚠️  triggerFileFullBackup 已废弃，使用 MinIO 同步代替');
    await this.triggerMinIOFullSync();
  }

  /**
   * 兼容旧接口：文件增量备份（已废弃，使用 MinIO 同步）
   * @deprecated 使用 triggerMinIOIncrementalSync 代替
   */
  async triggerFileIncrementalBackup(): Promise<void> {
    console.log('⚠️  triggerFileIncrementalBackup 已废弃，使用 MinIO 同步代替');
    await this.triggerMinIOIncrementalSync();
  }

  /**
   * 手动触发日志归档
   */
  async triggerLogArchive(): Promise<void> {
    console.log('🔄 手动触发日志归档...');
    await this.logArchive.archiveYesterdayLogs();
  }

  /**
   * 获取备份状态
   */
  async getBackupStatus(): Promise<{
    scheduler: { isRunning: boolean; activeTasks: number };
    database: {
      fullBackups: { count: number; totalSize: number; latest: Date | null };
      incrementalBackups: { count: number; totalSize: number; latest: Date | null };
    };
    files: {
      fullBackups: { count: number; totalSize: number; latest: Date | null };
      incrementalBackups: { count: number; totalSize: number; latest: Date | null };
    };
    logs: {
      totalFiles: number;
      totalSize: number;
      oldestArchive: Date | null;
      newestArchive: Date | null;
    };
  }> {
    const [dbStats, fileStats, logStats] = await Promise.all([
      this.databaseBackup.getBackupStats(),
      this.fileBackup.getBackupStats(),
      this.logArchive.getArchiveStats(),
    ]);

    return {
      scheduler: {
        isRunning: this.isRunning,
        activeTasks: this.intervals.size,
      },
      database: dbStats,
      files: fileStats,
      logs: logStats,
    };
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    this.stop();
    await Promise.all([
      this.databaseBackup.cleanup(),
      this.fileBackup.cleanup(),
      this.logArchive.cleanup(),
    ]);
  }
}
