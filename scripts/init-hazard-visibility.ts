/**
 * 隐患可见性数据初始化脚本
 * 
 * 功能：为所有现有隐患重建可见性表记录
 * 使用场景：首次部署可见性表功能时，或需要修复可见性数据时
 * 
 * 执行方式：npm run init:visibility
 */

import { PrismaClient } from '@prisma/client';
import { rebuildAllVisibility } from '@/services/hazardVisibility.service';

const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

async function main() {
  console.log('========================================');
  console.log('🚀 隐患可见性数据初始化');
  console.log('========================================\n');

  try {
    // 统计现有隐患数量
    const totalHazards = await prisma.hazardRecord.count({
      where: {
        isVoided: false, // 只处理未作废的隐患
      },
    });

    console.log(`📊 发现 ${totalHazards} 条隐患记录\n`);

    if (totalHazards === 0) {
      console.log('✅ 无需初始化，系统中暂无隐患数据');
      return;
    }

    // 询问用户确认
    console.log('⚠️  即将为所有隐患重建可见性数据');
    console.log('   这可能需要一些时间，具体取决于数据量');
    console.log('   批量大小: 100条/批次\n');

    // 执行重建
    const startTime = Date.now();
    let lastProgress = 0;

    const result = await rebuildAllVisibility({
      batchSize: 100,
      onProgress: (current, total) => {
        const percentage = Math.round((current / total) * 100);
        
        // 每10%或最后一次才打印，避免刷屏
        if (percentage - lastProgress >= 10 || current === total) {
          const bar = '█'.repeat(Math.floor(percentage / 5)) + '░'.repeat(20 - Math.floor(percentage / 5));
          console.log(`⏳ 进度: [${bar}] ${percentage}% (${current}/${total})`);
          lastProgress = percentage;
        }
      },
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n========================================');
    console.log('✅ 初始化完成！');
    console.log('========================================');
    console.log(`📈 统计信息:`);
    console.log(`   - 总计: ${result.total} 条`);
    console.log(`   - 成功: ${result.success} 条`);
    console.log(`   - 失败: ${result.failed} 条`);
    console.log(`   - 耗时: ${duration}秒`);
    
    if (result.failed > 0) {
      console.log(`\n⚠️  ${result.failed} 条隐患处理失败`);
      console.log(`   请检查日志获取详细错误信息`);
    }

  } catch (error) {
    console.error('\n❌ 初始化失败:', error);
    throw error;
  }
}

main()
  .catch((error) => {
    console.error('执行出错:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    console.log('\n🔌 数据库连接已关闭');
  });
