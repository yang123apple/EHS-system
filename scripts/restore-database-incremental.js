/**
 * 数据库增量备份恢复脚本
 * 用于恢复数据库增量备份（WAL 文件）
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const DB_PATH = path.join(__dirname, '../prisma/dev.db');
const BACKUP_DIR = path.join(__dirname, '../data/backups/database');

/**
 * 获取用户输入
 */
function getUserInput(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * 列出可用的数据库备份
 */
function listDatabaseBackups() {
  const fullBackupDir = path.join(BACKUP_DIR, 'full');
  const incrementalBackupDir = path.join(BACKUP_DIR, 'incremental');
  
  const backups = {
    full: [],
    incremental: []
  };
  
  // 列出全量备份
  if (fs.existsSync(fullBackupDir)) {
    backups.full = fs.readdirSync(fullBackupDir)
      .filter(file => file.endsWith('.db'))
      .map(file => {
        const filePath = path.join(fullBackupDir, file);
        const stat = fs.statSync(filePath);
        return {
          name: file,
          path: filePath,
          size: stat.size,
          mtime: stat.mtime
        };
      })
      .sort((a, b) => b.mtime - a.mtime);
  }
  
  // 列出增量备份
  if (fs.existsSync(incrementalBackupDir)) {
    backups.incremental = fs.readdirSync(incrementalBackupDir)
      .filter(file => file.endsWith('.db-wal'))
      .map(file => {
        const filePath = path.join(incrementalBackupDir, file);
        const stat = fs.statSync(filePath);
        return {
          name: file,
          path: filePath,
          size: stat.size,
          mtime: stat.mtime
        };
      })
      .sort((a, b) => a.mtime - b.mtime); // 按时间正序（先应用旧的）
  }
  
  return backups;
}

/**
 * 恢复数据库全量备份
 */
function restoreFullBackup(backupPath) {
  console.log('\n📊 恢复数据库全量备份...');
  
  // 备份当前数据库
  if (fs.existsSync(DB_PATH)) {
    const backupPath_current = DB_PATH + '.backup.' + Date.now();
    fs.copyFileSync(DB_PATH, backupPath_current);
    console.log(`  ✓ 当前数据库已备份到: ${path.basename(backupPath_current)}`);
  }
  
  // 删除现有数据库文件
  if (fs.existsSync(DB_PATH)) {
    fs.unlinkSync(DB_PATH);
  }
  
  // 删除 WAL 和 SHM 文件
  const walPath = DB_PATH + '-wal';
  const shmPath = DB_PATH + '-shm';
  if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
  if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
  
  // 复制备份文件
  fs.copyFileSync(backupPath, DB_PATH);
  console.log(`  ✓ 数据库全量备份已恢复: ${path.basename(backupPath)}`);
  
  return true;
}

/**
 * 应用增量备份（WAL 文件）
 */
function applyIncrementalBackup(walPath) {
  console.log('\n📝 应用增量备份...');
  
  const targetWalPath = DB_PATH + '-wal';
  
  // 如果已有 WAL 文件，先备份
  if (fs.existsSync(targetWalPath)) {
    const backupWalPath = targetWalPath + '.backup.' + Date.now();
    fs.copyFileSync(targetWalPath, backupWalPath);
    console.log(`  ℹ️  现有 WAL 文件已备份到: ${path.basename(backupWalPath)}`);
  }
  
  // 复制 WAL 文件
  fs.copyFileSync(walPath, targetWalPath);
  console.log(`  ✓ 增量备份已应用: ${path.basename(walPath)}`);
  console.log(`  ⚠️  注意: 需要重启应用并执行 checkpoint 才能合并到主数据库`);
  
  return true;
}

/**
 * 主函数
 */
async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('🔄 数据库增量备份恢复工具');
  console.log('='.repeat(60));
  
  // 列出可用备份
  const backups = listDatabaseBackups();
  
  console.log('\n📋 可用的数据库备份:\n');
  
  if (backups.full.length === 0 && backups.incremental.length === 0) {
    console.log('❌ 没有找到任何数据库备份');
    console.log(`   备份目录: ${BACKUP_DIR}`);
    return;
  }
  
  // 显示全量备份
  if (backups.full.length > 0) {
    console.log('📦 全量备份:');
    backups.full.forEach((backup, index) => {
      const sizeMB = (backup.size / 1024 / 1024).toFixed(2);
      console.log(`  ${index + 1}. ${backup.name}`);
      console.log(`     大小: ${sizeMB} MB`);
      console.log(`     时间: ${backup.mtime.toLocaleString('zh-CN')}\n`);
    });
  }
  
  // 显示增量备份
  if (backups.incremental.length > 0) {
    console.log('📝 增量备份:');
    backups.incremental.forEach((backup, index) => {
      const sizeKB = (backup.size / 1024).toFixed(2);
      console.log(`  ${index + 1}. ${backup.name}`);
      console.log(`     大小: ${sizeKB} KB`);
      console.log(`     时间: ${backup.mtime.toLocaleString('zh-CN')}\n`);
    });
  }
  
  // 选择恢复方式
  console.log('恢复选项:');
  console.log('  1. 恢复全量备份');
  console.log('  2. 应用增量备份（需要先有全量备份）');
  console.log('  3. 恢复全量备份 + 应用所有增量备份');
  console.log('  4. 退出\n');
  
  const choice = await getUserInput('请选择 (1-4): ');
  
  if (choice === '4') {
    console.log('已取消');
    return;
  }
  
  if (choice === '1') {
    // 恢复全量备份
    if (backups.full.length === 0) {
      console.log('❌ 没有可用的全量备份');
      return;
    }
    
    const index = parseInt(await getUserInput(`选择全量备份 (1-${backups.full.length}): `)) - 1;
    if (index < 0 || index >= backups.full.length) {
      console.log('❌ 无效的选择');
      return;
    }
    
    const backup = backups.full[index];
    const confirmed = await getUserInput(`确定要恢复 ${backup.name} 吗？(yes/no): `);
    
    if (confirmed.toLowerCase() === 'yes' || confirmed.toLowerCase() === 'y') {
      restoreFullBackup(backup.path);
      console.log('\n✅ 恢复完成！');
      console.log('   下一步: 重启应用以使用恢复的数据库');
    } else {
      console.log('已取消');
    }
    
  } else if (choice === '2') {
    // 应用增量备份
    if (backups.incremental.length === 0) {
      console.log('❌ 没有可用的增量备份');
      return;
    }
    
    if (!fs.existsSync(DB_PATH)) {
      console.log('❌ 数据库文件不存在，请先恢复全量备份');
      return;
    }
    
    const index = parseInt(await getUserInput(`选择增量备份 (1-${backups.incremental.length}): `)) - 1;
    if (index < 0 || index >= backups.incremental.length) {
      console.log('❌ 无效的选择');
      return;
    }
    
    const backup = backups.incremental[index];
    const confirmed = await getUserInput(`确定要应用 ${backup.name} 吗？(yes/no): `);
    
    if (confirmed.toLowerCase() === 'yes' || confirmed.toLowerCase() === 'y') {
      applyIncrementalBackup(backup.path);
      console.log('\n✅ 增量备份已应用！');
      console.log('   下一步: 重启应用并执行 checkpoint 以合并到主数据库');
      console.log('   命令: node db-repair-tool.js checkpoint');
    } else {
      console.log('已取消');
    }
    
  } else if (choice === '3') {
    // 恢复全量备份 + 应用所有增量备份
    if (backups.full.length === 0) {
      console.log('❌ 没有可用的全量备份');
      return;
    }
    
    const index = parseInt(await getUserInput(`选择全量备份 (1-${backups.full.length}): `)) - 1;
    if (index < 0 || index >= backups.full.length) {
      console.log('❌ 无效的选择');
      return;
    }
    
    const fullBackup = backups.full[index];
    const confirmed = await getUserInput(`确定要恢复 ${fullBackup.name} 并应用所有增量备份吗？(yes/no): `);
    
    if (confirmed.toLowerCase() === 'yes' || confirmed.toLowerCase() === 'y') {
      // 恢复全量备份
      restoreFullBackup(fullBackup.path);
      
      // 应用所有增量备份（按时间顺序）
      if (backups.incremental.length > 0) {
        console.log(`\n📝 应用 ${backups.incremental.length} 个增量备份...`);
        backups.incremental.forEach((backup, idx) => {
          console.log(`\n  [${idx + 1}/${backups.incremental.length}] 应用: ${backup.name}`);
          applyIncrementalBackup(backup.path);
        });
      }
      
      console.log('\n✅ 恢复完成！');
      console.log('   下一步: 重启应用并执行 checkpoint 以合并所有增量数据');
      console.log('   命令: node db-repair-tool.js checkpoint');
    } else {
      console.log('已取消');
    }
    
  } else {
    console.log('❌ 无效的选择');
  }
}

// 运行主函数
if (require.main === module) {
  main().catch(error => {
    console.error('❌ 恢复失败:', error.message);
    process.exit(1);
  });
}

module.exports = { restoreFullBackup, applyIncrementalBackup, listDatabaseBackups };

