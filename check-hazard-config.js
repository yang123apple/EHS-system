const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkConfig() {
  try {
    const configs = await prisma.hazardConfig.findMany();
    console.log('当前隐患配置:');
    console.log(JSON.stringify(configs, null, 2));
    
    if (configs.length === 0) {
      console.log('\n⚠️ 数据库中没有隐患配置数据！');
    }
  } catch (error) {
    console.error('查询失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkConfig();
