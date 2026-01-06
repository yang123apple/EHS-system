/**
 * 测试新的备份系统
 * 验证各个备份服务的功能
 */

const { PrismaClient } = require('@prisma/client');
const path = require('path');

// 注意：这个脚本需要在应用未运行时执行
// 因为备份服务需要在应用启动时初始化

console.log('========================================');
console.log('🧪 备份系统测试脚本');
console.log('========================================');
console.log('');
console.log('⚠️  注意：此脚本仅用于验证备份服务代码');
console.log('实际的备份功能需要在应用启动时测试');
console.log('');

async function testBackupServices() {
  const prisma = new PrismaClient();

  try {
    console.log('1️⃣  检查数据库连接...');
    await prisma.$connect();
    console.log('   ✅ 数据库连接成功');
    console.log('');

    console.log('2️⃣  检查 FileMetadata 表...');
    try {
      const count = await prisma.fileMetadata.count();
      console.log(`   ✅ FileMetadata 表存在，当前记录数: ${count}`);
    } catch (error) {
      console.log('   ❌ FileMetadata 表不存在，需要运行数据库迁移');
      console.log('   请执行: npx prisma migrate dev --name add_file_metadata');
      return;
    }
    console.log('');

    console.log('3️⃣  检查备份目录结构...');
    const backupDirs = [
      'data/backups/database/full',
      'data/backups/database/incremental',
      'data/backups/files/full',
      'data/backups/files/incremental',
      'data/backups/logs/archives',
      'data/file-index',
    ];

    const fs = require('fs');
    for (const dir of backupDirs) {
      const fullPath = path.join(process.cwd(), dir);
      if (!fs.existsSync(fullPath)) {
        console.log(`   ⚠️  目录不存在: ${dir}`);
        console.log(`   将自动创建...`);
        fs.mkdirSync(fullPath, { recursive: true });
        console.log(`   ✅ 已创建: ${dir}`);
      } else {
        console.log(`   ✅ 目录存在: ${dir}`);
      }
    }
    console.log('');

    console.log('4️⃣  检查 SQLite WAL 模式...');
    try {
      const result = await prisma.$queryRaw`PRAGMA journal_mode`;
      const mode = result[0]?.journal_mode;
      if (mode === 'wal') {
        console.log('   ✅ WAL 模式已启用');
      } else {
        console.log(`   ⚠️  当前模式: ${mode}`);
        console.log('   建议启用 WAL 模式以支持增量备份');
        console.log('   请执行: node scripts/enable-wal-mode.js');
      }
    } catch (error) {
      console.log('   ⚠️  无法检查 WAL 模式:', error.message);
    }
    console.log('');

    console.log('5️⃣  检查备份服务文件...');
    const serviceFiles = [
      'src/services/backup/databaseBackup.service.ts',
      'src/services/backup/fileBackup.service.ts',
      'src/services/backup/logArchive.service.ts',
      'src/services/backup/backupScheduler.service.ts',
    ];

    for (const file of serviceFiles) {
      const fullPath = path.join(process.cwd(), file);
      if (fs.existsSync(fullPath)) {
        console.log(`   ✅ ${file}`);
      } else {
        console.log(`   ❌ ${file} 不存在`);
      }
    }
    console.log('');

    console.log('6️⃣  检查 API 路由...');
    const apiFiles = [
      'src/app/api/backup/route.ts',
      'src/app/api/backup/stats/route.ts',
    ];

    for (const file of apiFiles) {
      const fullPath = path.join(process.cwd(), file);
      if (fs.existsSync(fullPath)) {
        console.log(`   ✅ ${file}`);
      } else {
        console.log(`   ❌ ${file} 不存在`);
      }
    }
    console.log('');

    console.log('========================================');
    console.log('✅ 基础检查完成');
    console.log('========================================');
    console.log('');
    console.log('📋 下一步操作：');
    console.log('1. 如果 FileMetadata 表不存在，运行数据库迁移');
    console.log('2. 如果 WAL 模式未启用，运行启用脚本');
    console.log('3. 启动应用测试备份功能');
    console.log('   npm run dev');
    console.log('4. 访问 API 测试备份功能');
    console.log('   GET /api/backup - 获取备份状态');
    console.log('   POST /api/backup - 触发备份');
    console.log('   GET /api/backup/stats - 获取统计信息');
    console.log('');

  } catch (error) {
    console.error('❌ 测试失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 运行测试
testBackupServices()
  .then(() => {
    console.log('✅ 测试脚本执行完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ 测试脚本执行失败:', error);
    process.exit(1);
  });

