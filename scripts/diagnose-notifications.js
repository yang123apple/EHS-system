const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function diagnose() {
  console.log('\n========================================');
  console.log('通知模块诊断工具');
  console.log('========================================\n');

  // 1. 检查数据库表
  console.log('1️⃣  检查数据库表...');
  try {
    const tables = await prisma.$queryRaw`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name LIKE '%Notification%';
    `;
    console.log('   找到的表:', tables.map(t => t.name).join(', '));
  } catch (error) {
    console.log('   ❌ 查询失败:', error.message);
  }

  // 2. 检查 NotificationTemplate 数据
  console.log('\n2️⃣  检查 NotificationTemplate 数据...');
  try {
    const count = await prisma.notificationTemplate.count();
    console.log(`   模板总数: ${count}`);
    
    if (count > 0) {
      const templates = await prisma.notificationTemplate.findMany({
        select: {
          id: true,
          name: true,
          title: true,
          type: true,
          triggerEvent: true,
          isActive: true,
        }
      });
      
      console.log('\n   模板列表:');
      templates.forEach((t, i) => {
        console.log(`   ${i + 1}. ${t.name}`);
        console.log(`      ID: ${t.id}`);
        console.log(`      标题: ${t.title}`);
        console.log(`      类型: ${t.type}`);
        console.log(`      事件: ${t.triggerEvent}`);
        console.log(`      状态: ${t.isActive ? '✅ 启用' : '❌ 禁用'}`);
      });
    }
  } catch (error) {
    console.log('   ❌ 查询失败:', error.message);
  }

  // 3. 检查 Notification 数据
  console.log('\n3️⃣  检查 Notification 消息记录...');
  try {
    const notifCount = await prisma.notification.count();
    console.log(`   消息总数: ${notifCount}`);
  } catch (error) {
    console.log('   ❌ 查询失败:', error.message);
  }

  // 4. 测试 notificationTemplate 访问
  console.log('\n4️⃣  测试 Prisma Client...');
  try {
    if (prisma.notificationTemplate) {
      console.log('   ✅ prisma.notificationTemplate 可用');
    } else {
      console.log('   ❌ prisma.notificationTemplate 不可用');
    }
  } catch (error) {
    console.log('   ❌ 访问失败:', error.message);
  }

  console.log('\n========================================');
  console.log('诊断完成');
  console.log('========================================\n');

  // 建议
  console.log('📋 建议操作:');
  const count = await prisma.notificationTemplate.count();
  if (count === 0) {
    console.log('   运行: node scripts/check-and-init-templates.js');
  } else {
    console.log('   ✅ 数据库中有模板');
    console.log('   🔍 如果前端看不到:');
    console.log('      1. 刷新浏览器页面（硬刷新: Ctrl+Shift+R）');
    console.log('      2. 清除浏览器缓存');
    console.log('      3. 检查浏览器控制台是否有错误');
    console.log('      4. 检查服务器日志');
  }
  console.log('');

  await prisma.$disconnect();
}

diagnose().catch(console.error);
