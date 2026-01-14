/**
 * 检查数据库状态脚本
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('正在检查数据库状态...\n');
    
    const userCount = await prisma.user.count();
    const deptCount = await prisma.department.count();
    const hazardCount = await prisma.hazardRecord.count();
    const projectCount = await prisma.project.count();
    const permitCount = await prisma.workPermitRecord.count();
    const incidentCount = await prisma.incident.count();
    
    console.log('数据库统计:');
    console.log(`  用户数: ${userCount}`);
    console.log(`  部门数: ${deptCount}`);
    console.log(`  隐患记录数: ${hazardCount}`);
    console.log(`  项目数: ${projectCount}`);
    console.log(`  作业票数: ${permitCount}`);
    console.log(`  事故记录数: ${incidentCount}\n`);
    
    if (userCount === 0 && deptCount === 0) {
      console.log('⚠️  警告: 数据库看起来是空的！');
      console.log('   建议运行: npm run db:import 从 JSON 文件导入数据\n');
    } else {
      console.log('✓ 数据库包含数据，恢复成功！\n');
    }
    
    // 检查 admin 用户
    const admin = await prisma.user.findUnique({
      where: { username: 'admin' }
    });
    
    if (admin) {
      console.log('✓ Admin 用户存在');
    } else {
      console.log('⚠️  警告: Admin 用户不存在');
    }
    
  } catch (error) {
    console.error('错误:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

