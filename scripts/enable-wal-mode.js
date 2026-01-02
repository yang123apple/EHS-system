// scripts/enable-wal-mode.js
// 手动启用 SQLite WAL 模式

const { PrismaClient } = require('@prisma/client');

async function enableWalMode() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔧 正在启用 SQLite WAL 模式...\n');
    
    // 设置 WAL 模式（PRAGMA 返回结果，需要用 $queryRaw）
    const result = await prisma.$queryRaw`PRAGMA journal_mode = WAL`;
    console.log('执行结果:', result);
    
    // 验证设置
    const verification = await prisma.$queryRaw`PRAGMA journal_mode`;
    const mode = verification[0].journal_mode;
    
    console.log(`\n✅ WAL 模式已成功启用！`);
    console.log(`当前 journal_mode: ${mode}`);
    
    // 检查 WAL 文件
    const dbFiles = require('fs').readdirSync('./prisma');
    const walFiles = dbFiles.filter(f => f.endsWith('.db-wal') || f.endsWith('.db-shm'));
    
    if (walFiles.length > 0) {
      console.log('\n📁 发现 WAL 相关文件:');
      walFiles.forEach(f => console.log(`  - ${f}`));
    } else {
      console.log('\n💡 WAL 文件将在首次写入时创建');
    }
    
    console.log('\n🎉 配置完成！系统现在运行在 WAL 模式下。');
    console.log('📝 这将提供更好的并发性能和备份安全性。');
    
  } catch (error) {
    console.error('❌ 启用失败:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

enableWalMode();
