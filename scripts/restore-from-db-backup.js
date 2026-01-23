/**
 * 从 .db 备份文件恢复数据库
 * 此脚本用于从完整的 SQLite 数据库备份文件恢复数据
 */

const fs = require('fs');
const path = require('path');

// 配置
const BACKUP_FILE = process.argv[2] || '/Users/yangguang/Desktop/EHS/EHS-system/data/backups/database/full/full_2026-01-23_14-58-53.db';
const DB_PATH = path.join(__dirname, '../prisma/dev.db');
const DB_WAL_PATH = path.join(__dirname, '../prisma/dev.db-wal');
const DB_SHM_PATH = path.join(__dirname, '../prisma/dev.db-shm');
const DB_JOURNAL_PATH = path.join(__dirname, '../prisma/dev.db-journal');

/**
 * 检查文件是否被占用
 */
function checkFileLock(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return false;
    }
    // 尝试以独占模式打开文件
    const fd = fs.openSync(filePath, 'r+');
    fs.closeSync(fd);
    return false;
  } catch (error) {
    if (error.code === 'EBUSY' || error.code === 'EPERM') {
      return true;
    }
    return false;
  }
}

/**
 * 备份当前损坏的数据库
 */
function backupCorruptedDb() {
  const timestamp = Date.now();
  const backupPath = `${DB_PATH}.corrupted.${timestamp}`;
  
  if (fs.existsSync(DB_PATH)) {
    console.log(`📦 备份损坏的数据库到: ${path.basename(backupPath)}`);
    fs.copyFileSync(DB_PATH, backupPath);
    return backupPath;
  }
  return null;
}

/**
 * 删除数据库相关文件
 */
function cleanupDatabaseFiles() {
  const files = [DB_PATH, DB_WAL_PATH, DB_SHM_PATH, DB_JOURNAL_PATH];
  
  console.log('\n🧹 清理现有数据库文件...');
  
  for (const file of files) {
    if (fs.existsSync(file)) {
      try {
        fs.unlinkSync(file);
        console.log(`  ✓ 删除: ${path.basename(file)}`);
      } catch (error) {
        console.error(`  ❌ 无法删除 ${path.basename(file)}: ${error.message}`);
        throw error;
      }
    }
  }
}

/**
 * 恢复数据库
 */
function restoreDatabase() {
  console.log('\n📥 从备份文件恢复数据库...');
  console.log(`  源文件: ${BACKUP_FILE}`);
  console.log(`  目标位置: ${DB_PATH}`);
  
  // 复制备份文件到数据库位置
  fs.copyFileSync(BACKUP_FILE, DB_PATH);
  
  // 获取文件大小
  const stats = fs.statSync(DB_PATH);
  const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
  
  console.log(`  ✓ 恢复完成！文件大小: ${fileSizeMB} MB`);
}

/**
 * 验证数据库
 */
async function verifyDatabase() {
  console.log('\n🔍 验证数据库完整性...');
  
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    // 测试基本查询
    const userCount = await prisma.user.count();
    const deptCount = await prisma.department.count();
    const hazardCount = await prisma.hazardRecord.count();
    
    console.log('\n📊 数据库统计:');
    console.log(`  - 用户数: ${userCount}`);
    console.log(`  - 部门数: ${deptCount}`);
    console.log(`  - 隐患记录数: ${hazardCount}`);
    
    await prisma.$disconnect();
    
    if (userCount > 0 && deptCount > 0) {
      console.log('\n✅ 数据库验证成功！');
      return true;
    } else {
      console.warn('\n⚠️  数据库验证警告: 数据可能不完整');
      return false;
    }
  } catch (error) {
    console.error('\n❌ 数据库验证失败:', error.message);
    return false;
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('🔄 数据库恢复工具');
  console.log('='.repeat(60));
  
  // 检查备份文件是否存在
  if (!fs.existsSync(BACKUP_FILE)) {
    console.error(`\n❌ 错误: 备份文件不存在`);
    console.error(`   文件路径: ${BACKUP_FILE}`);
    console.error('\n💡 用法: node scripts/restore-from-db-backup.js [备份文件路径]');
    process.exit(1);
  }
  
  // 显示备份文件信息
  const backupStats = fs.statSync(BACKUP_FILE);
  const backupSizeMB = (backupStats.size / (1024 * 1024)).toFixed(2);
  const backupDate = backupStats.mtime.toLocaleString('zh-CN');
  
  console.log('\n📋 备份文件信息:');
  console.log(`  文件: ${path.basename(BACKUP_FILE)}`);
  console.log(`  大小: ${backupSizeMB} MB`);
  console.log(`  修改时间: ${backupDate}`);
  
  // 检查数据库文件是否被占用
  console.log('\n🔒 检查文件锁定状态...');
  if (checkFileLock(DB_PATH)) {
    console.error('\n❌ 错误: 数据库文件被其他进程占用');
    console.error('\n请执行以下操作:');
    console.error('  1. 关闭所有 Next.js 开发服务器');
    console.error('  2. 关闭所有使用数据库的程序');
    console.error('  3. 确保没有 Node.js 进程在运行');
    console.error('\n然后重新运行此脚本。');
    process.exit(1);
  }
  console.log('  ✓ 数据库文件未被锁定');
  
  try {
    // 备份损坏的数据库
    const corruptedBackup = backupCorruptedDb();
    if (corruptedBackup) {
      console.log('  ✓ 已保存损坏的数据库备份');
    }
    
    // 清理现有数据库文件
    cleanupDatabaseFiles();
    
    // 恢复数据库
    restoreDatabase();
    
    // 验证数据库
    const isValid = await verifyDatabase();
    
    // 输出总结
    console.log('\n' + '='.repeat(60));
    if (isValid) {
      console.log('✅ 数据库恢复成功！');
      console.log('='.repeat(60));
      console.log('\n💡 后续步骤:');
      console.log('  1. 运行 npm run dev 启动开发服务器');
      console.log('  2. 检查应用程序是否正常运行');
      console.log('  3. 验证数据是否完整');
    } else {
      console.log('⚠️  数据库恢复完成，但验证时发现问题');
      console.log('='.repeat(60));
      console.log('\n💡 建议:');
      console.log('  1. 检查备份文件是否正确');
      console.log('  2. 尝试使用其他备份文件');
      console.log('  3. 运行 node scripts/check-db-status.js 检查详细状态');
    }
    console.log('='.repeat(60) + '\n');
    
  } catch (error) {
    console.error('\n❌ 恢复失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// 执行恢复
main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 发生未预期的错误:', error);
    process.exit(1);
  });
