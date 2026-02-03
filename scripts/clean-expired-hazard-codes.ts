/**
 * 定时任务：清理过期的隐患编号池记录
 *
 * 功能：删除已过期且状态为 available 的编号池记录，避免编号池无限增长
 *
 * 使用方法：
 * 1. 手动执行：
 *    ```bash
 *    npx ts-node scripts/clean-expired-hazard-codes.ts
 *    ```
 *
 * 2. 定时任务（使用 node-cron）：
 *    ```typescript
 *    import cron from 'node-cron';
 *    import { cleanExpiredCodes } from './scripts/clean-expired-hazard-codes';
 *
 *    // 每天凌晨2点执行
 *    cron.schedule('0 2 * * *', cleanExpiredCodes);
 *    ```
 *
 * 3. 系统级定时任务（Linux/Unix）：
 *    ```bash
 *    # 添加到 crontab
 *    0 2 * * * cd /path/to/project && npx ts-node scripts/clean-expired-hazard-codes.ts
 *    ```
 */

// 注意：此脚本需要在服务启动后通过 API 调用，不能直接运行
// 因为 HazardCodePoolService 依赖于应用上下文

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 清理过期编号的主函数
 */
export async function cleanExpiredCodes() {
  console.log(`🧹 [${new Date().toISOString()}] 开始清理过期编号...`);

  try {
    // 直接使用 Prisma 清理过期编号
    const result = await prisma.hazardCodePool.deleteMany({
      where: {
        status: 'available',
        expiresAt: {
          lt: new Date()
        }
      }
    });

    const count = result.count;

    if (count > 0) {
      console.log(`✅ [${new Date().toISOString()}] 清理完成，删除 ${count} 条过期记录`);
    } else {
      console.log(`ℹ️ [${new Date().toISOString()}] 没有过期记录需要清理`);
    }

    // 获取当前统计信息
    const [total, available, used] = await Promise.all([
      prisma.hazardCodePool.count(),
      prisma.hazardCodePool.count({ where: { status: 'available' } }),
      prisma.hazardCodePool.count({ where: { status: 'used' } })
    ]);

    const stats = { total, available, used };
    console.log(`📊 编号池统计: 总计 ${stats.total} 条，可用 ${stats.available} 条，已使用 ${stats.used} 条`);

    return {
      success: true,
      deletedCount: count,
      stats
    };
  } catch (error: any) {
    console.error(`❌ [${new Date().toISOString()}] 清理失败:`, error);
    throw error;
  }
}

// 如果直接运行此脚本，则执行清理任务
// 在 ES 模块中检测是否为主模块
const isMainModule = import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
  cleanExpiredCodes()
    .then((result) => {
      console.log('🎉 脚本执行成功！');
    })
    .catch((error) => {
      console.error('💥 脚本执行失败:', error);
    })
    .finally(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
}
