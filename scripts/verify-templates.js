const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verify() {
  const templates = await prisma.notificationTemplate.findMany();
  console.log(`\n找到 ${templates.length} 个模板:\n`);
  templates.forEach(t => {
    console.log(`✅ ${t.name}`);
    console.log(`   标题: ${t.title}`);
    console.log(`   类型: ${t.type} | 事件: ${t.triggerEvent}`);
    console.log(`   状态: ${t.isActive ? '启用' : '禁用'}\n`);
  });
  await prisma.$disconnect();
}

verify();
