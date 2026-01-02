// scripts/test-wal-mode.js
// 测试 SQLite WAL 模式是否已正确启用

const { PrismaClient } = require('@prisma/client');

async function testWalMode() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔍 检查 SQLite journal 模式...\n');
    
    // 查询当前 journal_mode
    const result = await prisma.$queryRaw`PRAGMA journal_mode`;
    
    console.log('📊 查询结果:', result);
    
    if (result && result.length > 0) {
      const mode = result[0].journal_mode;
      console.log(`\n当前 journal_mode: ${mode}`);
      
      if (mode === 'wal') {
        console.log('✅ WAL 模式已成功启用！');
        console.log('\n这意味着：');
        console.log('  • 写操作会先写入 .wal 文件');
        console.log('  • 读操作不会被写操作阻塞');
        console.log('  • 备份时可以安全复制 .db 文件');
        console.log('  • 配合 checkpoint 确保数据一致性');
      } else {
        console.log(`⚠️  当前使用 ${mode} 模式，不是 WAL 模式`);
        console.log('建议重启应用以应用 WAL 配置');
      }
    }
    
    // 查询 WAL 相关统计
    console.log('\n📈 WAL 状态统计:');
    const walStats = await prisma.$queryRaw`PRAGMA wal_checkpoint`;
    console.log(walStats);
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testWalMode();
