const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyTemplates() {
  try {
    const templates = await prisma.notificationTemplate.findMany({
      orderBy: { createdAt: 'asc' }
    });

    console.log('\n📋 数据库中的通知模板列表:\n');
    templates.forEach((t, i) => {
      console.log(`${i+1}. ${t.name} (${t.type})`);
      console.log(`   标题: ${t.title}`);
      console.log(`   触发事件: ${t.triggerEvent}`);
      console.log(`   状态: ${t.isActive ? '✅ 启用' : '❌ 禁用'}`);
      console.log('');
    });

    console.log(`\n总计: ${templates.length} 个模板`);
    
    // 按类型分组统计
    const byType = templates.reduce((acc, t) => {
      acc[t.type] = (acc[t.type] || 0) + 1;
      return acc;
    }, {});
    
    console.log('\n按类型统计:');
    Object.entries(byType).forEach(([type, count]) => {
      console.log(`  ${type}: ${count} 个`);
    });
    
  } catch (error) {
    console.error('验证失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyTemplates();
