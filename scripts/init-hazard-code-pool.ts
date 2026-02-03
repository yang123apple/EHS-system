/**
 * 初始化隐患编号池
 *
 * 功能：将所有已作废的隐患编号加入编号池，供后续创建隐患时重用
 *
 * 使用方法：
 * ```bash
 * npx ts-node scripts/init-hazard-code-pool.ts
 * ```
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function initCodePool() {
  console.log('🚀 开始初始化隐患编号池...\n');

  try {
    // 1. 查询所有已作废的隐患
    const voidedHazards = await prisma.hazardRecord.findMany({
      where: { isVoided: true },
      select: {
        code: true,
        voidedBy: true,
        voidedAt: true
      },
      orderBy: { voidedAt: 'asc' }
    });

    console.log(`📊 找到 ${voidedHazards.length} 条已作废隐患\n`);

    if (voidedHazards.length === 0) {
      console.log('✅ 没有已作废的隐患，无需初始化编号池');
      return;
    }

    // 2. 统计各日期的编号数量
    const dateStats: Record<string, number> = {};
    let successCount = 0;
    let skipCount = 0;

    // 3. 批量插入到编号池
    for (const hazard of voidedHazards) {
      if (!hazard.code) {
        skipCount++;
        continue;
      }

      // 提取日期前缀和序号
      const match = hazard.code.match(/^Hazard(\d{8})(\d{3})$/);
      if (!match) {
        console.warn(`⚠️  跳过无效编号: ${hazard.code}`);
        skipCount++;
        continue;
      }

      const datePrefix = match[1];
      const sequence = parseInt(match[2], 10);

      // 统计
      dateStats[datePrefix] = (dateStats[datePrefix] || 0) + 1;

      // 解析作废操作人
      let operatorId = null;
      try {
        if (hazard.voidedBy) {
          const voidedByObj = JSON.parse(hazard.voidedBy);
          operatorId = voidedByObj.id;
        }
      } catch {
        // 忽略解析错误
      }

      // 设置过期时间（30天后）
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      try {
        // 使用 upsert 避免重复插入
        await prisma.hazardCodePool.upsert({
          where: { code: hazard.code },
          update: {
            status: 'available',
            releasedAt: hazard.voidedAt || new Date(),
            expiresAt
          },
          create: {
            code: hazard.code,
            datePrefix,
            sequence,
            status: 'available',
            releasedBy: operatorId,
            releasedAt: hazard.voidedAt || new Date(),
            expiresAt
          }
        });

        successCount++;
      } catch (error: any) {
        console.error(`❌ 插入编号 ${hazard.code} 失败:`, error.message);
        skipCount++;
      }
    }

    // 4. 输出统计信息
    console.log(`\n✅ 编号池初始化完成！\n`);
    console.log(`📈 统计信息：`);
    console.log(`   - 成功添加: ${successCount} 条`);
    console.log(`   - 跳过: ${skipCount} 条`);
    console.log(`\n📅 按日期分布：`);

    const sortedDates = Object.keys(dateStats).sort();
    for (const date of sortedDates) {
      const formattedDate = `${date.substring(0, 4)}-${date.substring(4, 6)}-${date.substring(6, 8)}`;
      console.log(`   - ${formattedDate}: ${dateStats[date]} 个编号`);
    }

    // 5. 验证结果
    const totalInPool = await prisma.hazardCodePool.count({
      where: { status: 'available' }
    });
    console.log(`\n🎯 编号池当前可用编号总数: ${totalInPool}\n`);

  } catch (error: any) {
    console.error('❌ 初始化失败:', error);
    throw error;
  }
}

// 执行脚本
initCodePool()
  .then(() => {
    console.log('🎉 脚本执行成功！');
  })
  .catch((error) => {
    console.error('💥 脚本执行失败:', error);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
