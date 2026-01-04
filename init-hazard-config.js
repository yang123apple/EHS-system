const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function initHazardConfig() {
  try {
    console.log('🔧 初始化隐患分类配置...\n');
    
    // 检查是否已存在
    const existing = await prisma.hazardConfig.findUnique({
      where: { key: 'hazard_types' }
    });
    
    if (existing) {
      console.log('⚠️  隐患分类配置已存在:');
      console.log('当前配置:', JSON.parse(existing.value));
      console.log('\n如需修改，请删除此记录后重新运行本脚本');
      console.log('或者通过管理页面进行修改');
      return;
    }
    
    // 默认隐患分类
    const defaultTypes = ['火灾', '爆炸', '中毒', '窒息', '触电', '机械伤害'];
    
    // 创建配置
    await prisma.hazardConfig.create({
      data: {
        key: 'hazard_types',
        value: JSON.stringify(defaultTypes),
        description: '隐患分类配置'
      }
    });
    
    console.log('✅ 隐患分类配置已初始化:');
    console.log(defaultTypes);
    console.log('\n📝 提示: 您可以在系统设置页面修改这些分类');
    
  } catch (error) {
    console.error('❌ 初始化失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

initHazardConfig();
