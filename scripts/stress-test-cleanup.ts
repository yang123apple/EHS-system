/**
 * 隐患可见性表压力测试 - 数据清理脚本
 * 
 * 目标：清理压力测试生成的 100 万条隐患数据和 110 个测试用户
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanup() {
  console.log('🧹 开始清理压力测试数据...');
  const startTime = Date.now();

  try {
    // 1. 清理可见性记录
    console.log('⏳ 正在删除可见性记录 (HazardVisibility)...');
    const visibilityResult = await (prisma as any).hazardVisibility.deleteMany({
      where: { hazardId: { startsWith: 'stress_test_' } }
    });
    console.log(`✅ 已删除 ${visibilityResult.count.toLocaleString()} 条可见性记录`);

    // 2. 清理其他可能关联的表（如果有的话，虽然脚本没生成，但为了保险）
    // HazardCC, HazardCandidateHandler 等在 stress test 中未生成，但检查一下也无妨
    // 由于是 deleteMany，如果没数据会返回 0，不会报错
    
    // 3. 清理隐患记录
    console.log('⏳ 正在删除隐患记录 (HazardRecord)...');
    const hazardResult = await prisma.hazardRecord.deleteMany({
      where: { id: { startsWith: 'stress_test_' } }
    });
    console.log(`✅ 已删除 ${hazardResult.count.toLocaleString()} 条隐患记录`);

    // 4. 清理测试用户
    console.log('⏳ 正在删除测试用户 (User)...');
    const userResult = await prisma.user.deleteMany({
      where: { 
        OR: [
          { username: { startsWith: 'test_user_' } },
          { username: { startsWith: 'test_admin_' } }
        ]
      }
    });
    console.log(`✅ 已删除 ${userResult.count.toLocaleString()} 个测试用户`);

    const totalTime = (Date.now() - startTime) / 1000;
    console.log('\n' + '='.repeat(40));
    console.log(`🎉 清理完成！总耗时：${totalTime.toFixed(2)} 秒`);

  } catch (error) {
    console.error('❌ 清理失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanup();
