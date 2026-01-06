// 检查数据库中日志的module字段值
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkLogs() {
  try {
    console.log('正在查询日志...\n');
    
    // 查询所有不同的module值
    const allLogs = await prisma.systemLog.findMany({
      select: { module: true }
    });
    
    const moduleCount = {};
    allLogs.forEach(log => {
      const module = log.module || '(null)';
      moduleCount[module] = (moduleCount[module] || 0) + 1;
    });
    
    console.log('数据库中的module值统计：');
    Object.entries(moduleCount)
      .sort((a, b) => b[1] - a[1])
      .forEach(([module, count]) => {
        console.log(`  ${module}: ${count} 条`);
      });
    
    console.log('\n最近10条日志的module值：');
    const recentLogs = await prisma.systemLog.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        module: true,
        action: true,
        targetType: true,
        createdAt: true
      }
    });
    
    recentLogs.forEach(log => {
      console.log(`  [${log.createdAt.toISOString().slice(0, 19)}] module=${log.module || 'null'}, action=${log.action}, targetType=${log.targetType || 'null'}`);
    });
    
    // 查询作业许可相关的日志
    console.log('\n\n查询作业许可相关日志 (module包含PERMIT或WORK_PERMIT)：');
    const permitLogs = await prisma.systemLog.findMany({
      where: {
        OR: [
          { module: { contains: 'PERMIT' } },
          { module: { contains: 'permit' } },
          { targetType: { contains: 'permit' } },
        ]
      },
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        module: true,
        action: true,
        targetType: true,
        createdAt: true
      }
    });
    
    console.log(`找到 ${permitLogs.length} 条相关日志：`);
    permitLogs.forEach(log => {
      console.log(`  [${log.createdAt.toISOString().slice(0, 19)}] module=${log.module || 'null'}, action=${log.action}, targetType=${log.targetType || 'null'}`);
    });
    
  } catch (error) {
    console.error('错误:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkLogs();
