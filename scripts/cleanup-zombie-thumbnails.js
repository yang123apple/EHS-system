/**
 * 清理僵尸锁和失败删除队列脚本
 *
 * 问题1：缩略图生成进程崩溃后 PENDING 状态永久卡住
 * 问题2：MinIO 删除失败导致文件孤立，需要重试
 *
 * 策略：
 * 1. 扫描 TrainingMaterial 中超过 TTL 的 PENDING 缩略图，重置为 null
 * 2. 扫描 FileDeletionQueue 中 pending/retrying 记录，重试 MinIO 删除
 * 3. 超过最大重试次数的记录标记为 failed
 *
 * 使用方法：
 *   node scripts/cleanup-zombie-thumbnails.js [--dry-run] [--ttl-minutes=10] [--max-retries=5]
 */

const { PrismaClient } = require('@prisma/client');
const { Client } = require('minio');

const prisma = new PrismaClient();

// 默认配置
const DEFAULTS = {
  ttlMinutes: 5,       // 僵尸锁超时时间（分钟）
  maxRetries: 5,        // FileDeletionQueue 最大重试次数
  retryDelay: 2000,     // 重试间隔（ms）
};

// 解析命令行参数
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const ttlMinutes = parseInt(
  (args.find(a => a.startsWith('--ttl-minutes=')) || '').split('=')[1] || String(DEFAULTS.ttlMinutes)
);
const maxRetries = parseInt(
  (args.find(a => a.startsWith('--max-retries=')) || '').split('=')[1] || String(DEFAULTS.maxRetries)
);

// MinIO 配置
const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || 'localhost';
const MINIO_PORT = parseInt(process.env.MINIO_PORT || '9000', 10);
const MINIO_USE_SSL = process.env.MINIO_USE_SSL === 'true';
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY || process.env.MINIO_ROOT_USER || 'admin';
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY || process.env.MINIO_ROOT_PASSWORD || 'admin123456';

let minioClient;

function getMinioClient() {
  if (!minioClient) {
    minioClient = new Client({
      endPoint: MINIO_ENDPOINT,
      port: MINIO_PORT,
      useSSL: MINIO_USE_SSL,
      accessKey: MINIO_ACCESS_KEY,
      secretKey: MINIO_SECRET_KEY,
    });
  }
  return minioClient;
}

async function deleteFromMinio(bucket, objectName) {
  return new Promise((resolve, reject) => {
    getMinioClient().removeObject(bucket, objectName, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

/**
 * 阶段1：清理僵尸锁（PENDING 超时的缩略图）
 */
async function cleanupZombieLocks() {
  console.log('\n=== 阶段1：清理僵尸锁 ===');
  console.log(`TTL 配置: ${ttlMinutes} 分钟`);

  const cutoffTime = new Date(Date.now() - ttlMinutes * 60 * 1000);

  // 查找超过 TTL 的 PENDING 记录
  const zombies = await prisma.trainingMaterial.findMany({
    where: {
      thumbnail: 'PENDING',
      thumbnailPendingSince: {
        lt: cutoffTime
      }
    },
    select: {
      id: true,
      title: true,
      thumbnailPendingSince: true
    }
  });

  // 同时查找没有时间戳的旧 PENDING（兼容迁移前数据）
  const legacyZombies = await prisma.trainingMaterial.findMany({
    where: {
      thumbnail: 'PENDING',
      thumbnailPendingSince: null
    },
    select: {
      id: true,
      title: true,
      thumbnailPendingSince: true
    }
  });

  const allZombies = [...zombies, ...legacyZombies];

  if (allZombies.length === 0) {
    console.log('  无僵尸锁记录');
    return 0;
  }

  console.log(`  发现 ${allZombies.length} 个僵尸锁记录:`);
  allZombies.forEach(z => {
    const since = z.thumbnailPendingSince
      ? `自 ${z.thumbnailPendingSince.toISOString()}`
      : '无时间戳（旧数据）';
    console.log(`    - [${z.id}] "${z.title}" ${since}`);
  });

  if (dryRun) {
    console.log('  [dry-run] 跳过重置');
    return allZombies.length;
  }

  // 批量重置
  const result = await prisma.trainingMaterial.updateMany({
    where: {
      id: { in: allZombies.map(z => z.id) }
    },
    data: {
      thumbnail: null,
      thumbnailPendingSince: null
    }
  });

  console.log(`  已重置 ${result.count} 个僵尸锁`);
  return result.count;
}

/**
 * 阶段2：重试失败的 MinIO 删除
 */
async function retryFailedDeletions() {
  console.log('\n=== 阶段2：重试 MinIO 删除队列 ===');
  console.log(`最大重试次数: ${maxRetries}`);

  // 查找需要重试的记录
  const pendingItems = await prisma.fileDeletionQueue.findMany({
    where: {
      status: { in: ['pending', 'retrying'] },
      retryCount: { lt: maxRetries }
    },
    orderBy: { createdAt: 'asc' }
  });

  // 查找超过重试次数的记录 → 标记为 failed
  const expiredItems = await prisma.fileDeletionQueue.findMany({
    where: {
      status: { in: ['pending', 'retrying'] },
      retryCount: { gte: maxRetries }
    }
  });

  if (expiredItems.length > 0) {
    console.log(`  将 ${expiredItems.length} 个超限重试记录标记为 failed`);
    if (!dryRun) {
      await prisma.fileDeletionQueue.updateMany({
        where: { id: { in: expiredItems.map(i => i.id) } },
        data: { status: 'failed', updatedAt: new Date() }
      });
    }
  }

  if (pendingItems.length === 0) {
    console.log('  无待重试记录');
    return 0;
  }

  console.log(`  发现 ${pendingItems.length} 个待重试记录:`);
  pendingItems.forEach(item => {
    console.log(`    - [${item.id}] ${item.filePath} (重试 ${item.retryCount}/${maxRetries})`);
  });

  if (dryRun) {
    console.log('  [dry-run] 跳过重试');
    return pendingItems.length;
  }

  let successCount = 0;
  let failCount = 0;

  for (const item of pendingItems) {
    // ✅ 修复并发问题：先用乐观锁原子性地 claim 这个 item
    const claimed = await prisma.fileDeletionQueue.updateMany({
      where: {
        id: item.id,
        status: { in: ['pending', 'retrying'] },
        retryCount: item.retryCount // 乐观锁：仅当 retryCount 未变时更新
      },
      data: {
        status: 'retrying',
        retryCount: item.retryCount + 1,
        lastTriedAt: new Date()
      }
    });

    if (claimed.count === 0) {
      // 另一个 cron 实例已经 claim 了这个 item，跳过
      console.log(`    ⏭ [${item.id}] 已被其他实例处理，跳过`);
      continue;
    }

    // Claim 成功，现在尝试 MinIO 删除
    try {
      console.log(`  正在删除: ${item.bucket}/${item.objectName}`);
      await deleteFromMinio(item.bucket, item.objectName);

      // 删除成功 → 标记 completed
      await prisma.fileDeletionQueue.update({
        where: { id: item.id },
        data: {
          status: 'completed',
          lastTriedAt: new Date(),
          errorMsg: null,
          updatedAt: new Date()
        }
      });
      console.log(`    ✅ 删除成功`);
      successCount++;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      const newRetryCount = item.retryCount + 1; // 已经在 claim 时 +1 了

      await prisma.fileDeletionQueue.update({
        where: { id: item.id },
        data: {
          status: newRetryCount >= maxRetries ? 'failed' : 'retrying',
          errorMsg,
          updatedAt: new Date()
        }
      });
      console.log(`    ❌ 删除失败 (${newRetryCount}/${maxRetries}): ${errorMsg}`);
      failCount++;
    }

    // 重试间隔（避免轰炸 MinIO）
    if (pendingItems.length > 1) {
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }

  console.log(`  结果: 成功 ${successCount}, 失败 ${failCount}`);
  return successCount;
}

async function main() {
  console.log('================================================');
  console.log('  清理僵尸锁和 MinIO 删除队列');
  console.log('================================================');
  console.log(`模式: ${dryRun ? 'dry-run (仅报告)' : '执行'}`);

  try {
    const zombieCount = await cleanupZombieLocks();
    const retrySuccess = await retryFailedDeletions();

    console.log('\n=== 汇总 ===');
    console.log(`  清理僵尸锁: ${zombieCount} 个`);
    console.log(`  重试删除成功: ${retrySuccess} 个`);

    // 报告当前队列状态
    const queueStats = await prisma.fileDeletionQueue.groupBy({
      by: ['status'],
      _count: { id: true }
    });
    if (queueStats.length > 0) {
      console.log('\n  FileDeletionQueue 当前状态:');
      queueStats.forEach(s => {
        console.log(`    ${s.status}: ${s._count.id} 个`);
      });
    }
  } catch (error) {
    console.error('\n严重错误:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
