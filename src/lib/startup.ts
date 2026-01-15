/**
 * 应用启动初始化脚本
 * 在服务器启动时执行备份任务调度和 MinIO 初始化
 */

import { BackupSchedulerService } from '@/services/backup/backupScheduler.service';
import { DatabaseBackupService } from '@/services/backup/databaseBackup.service';
import { FileBackupService } from '@/services/backup/fileBackup.service';
import { CoreDataRestoreService } from '@/services/coreDataRestore.service';

let isInitialized = false;
let backupScheduler: BackupSchedulerService | null = null;
let minioInitialized = false;

/**
 * 初始化 MinIO 服务
 */
async function initializeMinIO(): Promise<boolean> {
  try {
    console.log('📦 初始化 MinIO 对象存储服务...');
    
    // 动态导入 MinIO 服务（避免循环依赖）
    const { minioService } = await import('@/lib/minio');
    
    /**
     * 兼容性说明：
     * - `npm run dev` 的 predev 会在独立进程中启动 MinIO，但它设置的 env 不会传递给后续的 next dev 进程。
     * - `src/lib/minio.ts` 已内置默认值（localhost:9000 + admin/change-me-now），因此开发环境应直接尝试初始化。
     * - 生产环境为了安全起见：若没有显式配置，则跳过初始化。
     */
    const isProd = process.env.NODE_ENV === 'production';
    const hasExplicitConfig = Boolean(
      process.env.MINIO_ENDPOINT ||
        process.env.MINIO_PORT ||
        process.env.MINIO_USE_SSL ||
        process.env.MINIO_ACCESS_KEY ||
        process.env.MINIO_SECRET_KEY ||
        process.env.MINIO_ROOT_USER ||
        process.env.MINIO_ROOT_PASSWORD
    );

    if (isProd && !hasExplicitConfig) {
      console.log('⚠️  生产环境未检测到 MinIO 显式配置，跳过初始化');
      console.log('   提示: 请配置环境变量 MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY（或 MINIO_ROOT_USER/MINIO_ROOT_PASSWORD）');
      return false;
    }
    
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    // 初始化 MinIO（开发环境增加重试，避免 predev 刚启动服务尚未就绪）
    const maxAttempts = isProd ? 1 : 3;
    let lastError: any = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        if (attempt > 1) {
          console.log(`⏳ MinIO 初始化重试 (${attempt}/${maxAttempts})...`);
        }

        await minioService.initialize();

        // 验证连接
        const client = minioService.getClient();
        const buckets = await client.listBuckets();
    
        minioInitialized = true;
        console.log('✅ MinIO 初始化成功');
        console.log(`   • 端点: ${process.env.MINIO_ENDPOINT || 'localhost'}:${process.env.MINIO_PORT || '9000'}`);
        console.log(`   • Buckets: ${buckets.map(b => b.name).join(', ')}`);
        console.log(`   • 私有存储: ehs-private`);
        console.log(`   • 公开存储: ehs-public`);

        return true;
      } catch (err: any) {
        lastError = err;
        minioInitialized = false;

        // 生产环境不重试；开发环境稍等再试
        if (attempt < maxAttempts) {
          await sleep(1000);
          continue;
        }
      }
    }

    // 所有尝试失败
    throw lastError ?? new Error('MinIO 初始化失败');
  } catch (error: any) {
    console.error('❌ MinIO 初始化失败:', error.message);
    console.error('   提示: 请检查 MinIO 服务是否运行，或配置是否正确');
    console.error('   启动命令: docker-compose -f docker-compose.minio.yml up -d');
    minioInitialized = false;
    return false;
  }
}

/**
 * 检查并恢复核心数据
 * 如果数据库中没有 admin 用户，自动从 core_data 文件夹恢复所有 JSON 数据
 */
async function checkAndRestoreCoreData(): Promise<void> {
  try {
    console.log('🔍 检查核心数据状态...');
    
    // 先检查数据库表是否存在，如果不存在需要先运行迁移
    try {
      const { PrismaClient } = await import('@prisma/client');
      const testPrisma = new PrismaClient();
      await testPrisma.$queryRaw`SELECT 1 FROM User LIMIT 1`;
      await testPrisma.$disconnect();
    } catch (error: any) {
      if (error.code === 'P2021' || error.message?.includes('does not exist')) {
        console.log('⚠️  数据库表不存在，需要先运行 Prisma 迁移');
        console.log('   提示: 请运行 npx prisma migrate deploy 或 npx prisma db push');
        console.log('   或者运行 npm run postinstall 来初始化数据库');
        console.log('');
        return; // 表不存在时，无法恢复数据，直接返回
      }
      throw error;
    }
    
    // 检查是否存在 admin 用户
    const hasAdmin = await CoreDataRestoreService.hasAdminUser();
    
    if (hasAdmin) {
      console.log('✅ 检测到 admin 用户，核心数据完整，跳过恢复');
      console.log('');
      return;
    }
    
    console.log('⚠️  未检测到 admin 用户，开始自动恢复核心数据...');
    console.log('📦 从 data/core_data 文件夹恢复 JSON 数据...');
    console.log('');
    
    // 执行恢复
    const result = await CoreDataRestoreService.restoreAll();
    
    if (result.success) {
      console.log('✅ 核心数据恢复成功');
      console.log(`   • 已恢复文件: ${result.restoredFiles.join(', ')}`);
      console.log(`   • ${result.message}`);
      
      // 再次检查 admin 用户
      const adminAfterRestore = await CoreDataRestoreService.hasAdminUser();
      if (adminAfterRestore) {
        console.log('✅ Admin 用户已恢复');
      } else {
        console.warn('⚠️  警告: 恢复后仍未找到 admin 用户，请检查 user.json 文件');
      }
    } else {
      console.error('❌ 核心数据恢复失败');
      console.error(`   • 错误: ${result.message}`);
      if (result.errors.length > 0) {
        console.error(`   • 详细错误: ${result.errors.join('; ')}`);
      }
      console.error('   提示: 应用将继续启动，但建议手动检查并恢复数据');
    }
    
    console.log('');
    
    // 清理资源
    await CoreDataRestoreService.cleanup();
  } catch (error: any) {
    console.error('❌ 检查核心数据失败:', error.message);
    console.error('   提示: 应用将继续启动，但建议手动检查数据状态');
    console.error('   恢复命令: 请检查 data/core_data 文件夹中的 JSON 文件');
    console.log('');
    // 不抛出错误，允许应用继续启动
  }
}

/**
 * 检查并执行初始全量备份
 * 如果检测不到全量备份，将自动执行一次全量备份
 */
async function checkAndPerformInitialBackup(): Promise<void> {
  try {
    console.log('🔍 检查全量备份状态...');
    
    const dbService = new DatabaseBackupService();
    const fileService = new FileBackupService();
    
    // 检查数据库和文件备份状态
    const [dbStats, fileStats] = await Promise.all([
      dbService.getBackupStats(),
      fileService.getBackupStats(),
    ]);
    
    const hasDbBackup = dbStats.fullBackups.count > 0;
    const hasFileBackup = fileStats.fullBackups.count > 0;
    
    console.log(`   • 数据库全量备份: ${hasDbBackup ? '✅ 已存在' : '❌ 未找到'}`);
    console.log(`   • 文件全量备份: ${hasFileBackup ? '✅ 已存在' : '❌ 未找到'}`);
    
    // 如果都没有全量备份，执行一次全量备份
    if (!hasDbBackup || !hasFileBackup) {
      console.log('');
      console.log('📦 检测到缺少全量备份，开始执行初始全量备份...');
      console.log('=' .repeat(50));
      
      const backupResults = {
        database: { success: false, message: '' },
        files: { success: false, message: '' },
      };
      
      // 执行数据库全量备份
      if (!hasDbBackup) {
        try {
          console.log('📦 执行数据库全量备份...');
          const dbResult = await dbService.performFullBackup();
          backupResults.database.success = dbResult.success;
          backupResults.database.message = dbResult.success 
            ? `✅ 数据库全量备份完成: ${dbResult.sizeBytes} 字节`
            : `❌ 数据库全量备份失败: ${dbResult.message || '未知错误'}`;
          console.log(backupResults.database.message);
        } catch (error: any) {
          backupResults.database.message = `❌ 数据库全量备份异常: ${error.message}`;
          console.error(backupResults.database.message);
        }
      } else {
        backupResults.database.success = true;
        backupResults.database.message = '✓ 数据库已有全量备份，跳过';
      }
      
      // 执行文件全量备份
      if (!hasFileBackup) {
        try {
          console.log('📦 执行文件全量备份...');
          const fileResult = await fileService.performFullBackup();
          backupResults.files.success = fileResult.success;
          backupResults.files.message = fileResult.success
            ? `✅ 文件全量备份完成: ${fileResult.sizeBytes} 字节，${fileResult.filesCount} 个文件`
            : `❌ 文件全量备份失败: ${fileResult.message || '未知错误'}`;
          console.log(backupResults.files.message);
        } catch (error: any) {
          backupResults.files.message = `❌ 文件全量备份异常: ${error.message}`;
          console.error(backupResults.files.message);
        }
      } else {
        backupResults.files.success = true;
        backupResults.files.message = '✓ 文件已有全量备份，跳过';
      }
      
      console.log('=' .repeat(50));
      console.log('📊 初始全量备份结果:');
      console.log(`   ${backupResults.database.success ? '✅' : '❌'} ${backupResults.database.message}`);
      console.log(`   ${backupResults.files.success ? '✅' : '❌'} ${backupResults.files.message}`);
      console.log('');
    } else {
      console.log('✅ 全量备份检查通过，无需执行初始备份');
      console.log('');
    }
    
    // 清理资源
    await Promise.all([
      dbService.cleanup(),
      fileService.cleanup(),
    ]);
  } catch (error: any) {
    console.error('❌ 检查全量备份失败:', error.message);
    console.error('   提示: 应用将继续启动，但建议手动检查备份状态');
    // 不抛出错误，允许应用继续启动
  }
}

/**
 * 初始化应用程序
 * 在服务器启动时调用一次
 */
export async function initializeApp() {
  // 防止重复初始化
  if (isInitialized) {
    console.log('✓ 应用已初始化，跳过重复初始化');
    return;
  }

  console.log('========================================');
  console.log('🚀 正在初始化应用程序...');
  console.log('========================================');

  const initResults = {
    backup: false,
    minio: false,
  };

  try {
    // 0. 检查并恢复核心数据（如果 admin 用户不存在）
    await checkAndRestoreCoreData();
    
    // 1. 检查并执行初始全量备份（如果不存在）
    await checkAndPerformInitialBackup();
    
    // 2. 启动备份调度服务（存算分离架构）
    console.log('⏰ 启动备份调度服务（存算分离架构）...');
    try {
      backupScheduler = new BackupSchedulerService();
      await backupScheduler.start();
      initResults.backup = true;
      console.log('✅ 备份调度服务已启动');
    } catch (error: any) {
      console.error('❌ 备份调度服务启动失败:', error.message);
      // 备份服务失败不影响应用启动
    }

    // 3. 初始化 MinIO 对象存储服务
    initResults.minio = await initializeMinIO();

    isInitialized = true;
    
    // 输出初始化总结
    console.log('========================================');
    console.log('✅ 应用初始化完成');
    console.log('========================================');
    console.log('服务状态:');
    console.log(`  ${initResults.backup ? '✅' : '❌'} 备份调度服务: ${initResults.backup ? '已启动' : '未启动'}`);
    console.log(`  ${initResults.minio ? '✅' : '⚠️ '} MinIO 对象存储: ${initResults.minio ? '已启动' : '未启动'}`);
    console.log('');
    
    if (initResults.backup) {
      console.log('备份调度计划:');
      console.log('  • 日志归档: 每15天（归档过去15天的日志，保留10年）');
      console.log('  • 数据库全量备份: 每日 02:00');
      console.log('  • 文件增量备份: 每日 02:30');
      console.log('  • 数据库增量备份: 每小时');
      console.log('');
    }
    
    if (initResults.minio) {
      console.log('MinIO 存储:');
      console.log('  • 私有存储 (ehs-private): 隐患排查报告、敏感文件');
      console.log('  • 公开存储 (ehs-public): 学习资料、培训视频');
      console.log('');
    }
    
    if (!initResults.minio) {
      console.log('⚠️  MinIO 未启动，文件上传功能可能不可用');
      console.log('   启动 MinIO: docker-compose -f docker-compose.minio.yml up -d');
      console.log('');
    }
    
    console.log('========================================');
  } catch (error) {
    console.error('========================================');
    console.error('❌ 应用初始化失败:', error);
    console.error('========================================');
    // 不抛出错误，允许服务器继续启动（部分服务失败不应阻止应用启动）
  }
}

/**
 * 获取备份调度服务实例（用于API调用）
 */
export function getBackupScheduler(): BackupSchedulerService | null {
  return backupScheduler;
}

/**
 * 获取初始化状态
 */
export function isAppInitialized(): boolean {
  return isInitialized;
}

/**
 * 获取 MinIO 初始化状态
 */
export function isMinIOInitialized(): boolean {
  return minioInitialized;
}
