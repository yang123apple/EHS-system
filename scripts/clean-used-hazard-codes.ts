/**
 * 定期清理编号池中已使用的记录
 *
 * 功能：删除超过指定天数的 USED 状态记录，防止编号池表无限增长
 *
 * 使用方法：
 * 1. 手动执行：
 *    ```bash
 *    npx ts-node scripts/clean-used-hazard-codes.ts
 *    ```
 *
 * 2. 定时任务（使用 node-cron）：
 *    ```typescript
 *    import cron from 'node-cron';
 *    import { cleanUsedCodes } from './scripts/clean-used-hazard-codes';
 *
 *    // 每周日凌晨3点执行
 *    cron.schedule('0 3 * * 0', cleanUsedCodes);
 *    ```
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 清理已使用编号的主函数
 *
 * @param retentionDays 保留天数，默认90天（3个月）
 */
export async function cleanUsedCodes(retentionDays: number = 90) {
  console.log(`\n🧹 [${new Date().toISOString()}] 开始清理已使用的编号记录...\n`);

  try {
    // 计算截止时间
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    console.log(`📅 保留策略: ${retentionDays} 天`);
    console.log(`🔪 截止时间: ${cutoffDate.toISOString()}\n`);

    // 1. 查询统计信息（删除前）
    const [totalBefore, usedBefore, availableBefore] = await Promise.all([
      prisma.hazardCodePool.count(),
      prisma.hazardCodePool.count({ where: { status: 'used' } }),
      prisma.hazardCodePool.count({ where: { status: 'available' } })
    ]);

    console.log('📊 删除前统计:');
    console.log(`   - 总记录数: ${totalBefore}`);
    console.log(`   - USED 状态: ${usedBefore}`);
    console.log(`   - AVAILABLE 状态: ${availableBefore}\n`);

    // 2. 删除过期的 USED 记录
    const result = await prisma.hazardCodePool.deleteMany({
      where: {
        status: 'used',
        usedAt: {
          lt: cutoffDate
        }
      }
    });

    const deletedCount = result.count;

    console.log(`✅ 已删除 ${deletedCount} 条 USED 记录\n`);

    // 3. 查询统计信息（删除后）
    const [totalAfter, usedAfter, availableAfter] = await Promise.all([
      prisma.hazardCodePool.count(),
      prisma.hazardCodePool.count({ where: { status: 'used' } }),
      prisma.hazardCodePool.count({ where: { status: 'available' } })
    ]);

    console.log('📊 删除后统计:');
    console.log(`   - 总记录数: ${totalAfter} (减少 ${totalBefore - totalAfter})`);
    console.log(`   - USED 状态: ${usedAfter} (减少 ${usedBefore - usedAfter})`);
    console.log(`   - AVAILABLE 状态: ${availableAfter}\n`);

    // 4. 计算释放的存储空间（估算）
    // SQLite: 假设每条记录约 200 字节
    const savedSpace = deletedCount * 200;
    const savedSpaceKB = (savedSpace / 1024).toFixed(2);
    const savedSpaceMB = (savedSpace / 1024 / 1024).toFixed(2);

    if (deletedCount > 0) {
      console.log('💾 估算释放空间:');
      console.log(`   - 约 ${savedSpaceKB} KB (${savedSpaceMB} MB)\n`);
    }

    console.log(`✅ [${new Date().toISOString()}] 清理完成！\n`);

    return {
      success: true,
      deletedCount,
      totalBefore,
      totalAfter,
      usedBefore,
      usedAfter
    };
  } catch (error: any) {
    console.error(`\n❌ [${new Date().toISOString()}] 清理失败:`, error);
    throw error;
  }
}

// 如果直接运行此脚本，则执行清理任务
const isMainModule = import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
  // 从命令行参数读取保留天数
  const retentionDays = parseInt(process.argv[2] || '90', 10);

  if (isNaN(retentionDays) || retentionDays < 1) {
    console.error('❌ 错误：保留天数必须是大于0的整数');
    console.log('用法: npx ts-node scripts/clean-used-hazard-codes.ts [保留天数]');
    console.log('示例: npx ts-node scripts/clean-used-hazard-codes.ts 90  # 保留90天内的记录');
    process.exit(1);
  }

  cleanUsedCodes(retentionDays)
    .then((result) => {
      console.log('🎉 脚本执行成功！');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 脚本执行失败:', error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
