// 测试各模块日志查询
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testQueries() {
  console.log('=== 日志查询测试 ===\n');
  
  try {
    // 1. 测试隐患模块查询
    console.log('1️⃣ 隐患模块查询 (targetType contains "hazard"):');
    const hazardLogs = await prisma.systemLog.findMany({
      where: {
        targetType: { contains: 'hazard' }
      },
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: { id: true, module: true, action: true, targetType: true, createdAt: true }
    });
    console.log(`   找到 ${hazardLogs.length} 条日志`);
    hazardLogs.forEach(log => {
      console.log(`   - [${log.createdAt.toISOString().slice(0, 19)}] module=${log.module}, action=${log.action}`);
    });
    
    // 2. 测试作业许可模块查询
    console.log('\n2️⃣ 作业许可模块查询 (targetType contains "permit"):');
    const permitLogs = await prisma.systemLog.findMany({
      where: {
        targetType: { contains: 'permit' }
      },
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: { id: true, module: true, action: true, targetType: true, createdAt: true }
    });
    console.log(`   找到 ${permitLogs.length} 条日志`);
    permitLogs.forEach(log => {
      console.log(`   - [${log.createdAt.toISOString().slice(0, 19)}] module=${log.module}, action=${log.action}`);
    });
    
    // 3. 测试文档模块查询
    console.log('\n3️⃣ 文档模块查询 (targetType contains "document"):');
    const docLogs = await prisma.systemLog.findMany({
      where: {
        targetType: { contains: 'document' }
      },
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: { id: true, module: true, action: true, targetType: true, createdAt: true }
    });
    console.log(`   找到 ${docLogs.length} 条日志`);
    docLogs.forEach(log => {
      console.log(`   - [${log.createdAt.toISOString().slice(0, 19)}] module=${log.module}, action=${log.action}`);
    });
    
    // 4. 测试培训模块查询
    console.log('\n4️⃣ 培训模块查询 (targetType contains "training"):');
    const trainingLogs = await prisma.systemLog.findMany({
      where: {
        targetType: { contains: 'training' }
      },
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: { id: true, module: true, action: true, targetType: true, createdAt: true }
    });
    console.log(`   找到 ${trainingLogs.length} 条日志`);
    trainingLogs.forEach(log => {
      console.log(`   - [${log.createdAt.toISOString().slice(0, 19)}] module=${log.module}, action=${log.action}`);
    });
    
    // 5. 显示所有不同的targetType值
    console.log('\n5️⃣ 数据库中所有的targetType值:');
    const allLogs = await prisma.systemLog.findMany({
      select: { targetType: true }
    });
    const targetTypes = new Set(allLogs.map(log => log.targetType || '(null)'));
    targetTypes.forEach(type => {
      const count = allLogs.filter(log => (log.targetType || '(null)') === type).length;
      console.log(`   ${type}: ${count} 条`);
    });
    
    console.log('\n=== 测试完成 ===');
    
  } catch (error) {
    console.error('错误:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testQueries();
