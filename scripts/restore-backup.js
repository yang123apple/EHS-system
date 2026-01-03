// scripts/restore-backup.js
// 从全量备份 ZIP 恢复系统
// 恢复：数据库 + 上传文件 + 配置文件

const fs = require('fs');
const path = require('path');
const unzipper = require('unzipper');
const readline = require('readline');

/**
 * 格式化文件大小
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * 获取用户确认
 */
function getUserConfirmation(message) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    rl.question(`${message} (yes/no): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
}

/**
 * 列出所有可用的备份文件
 */
function listAvailableBackups() {
  const backupDir = path.join(__dirname, '../data/backups');
  
  if (!fs.existsSync(backupDir)) {
    console.log('❌ 备份目录不存在:', backupDir);
    return [];
  }
  
  const files = fs.readdirSync(backupDir)
    .filter(file => file.startsWith('full_backup_') && file.endsWith('.zip'))
    .map(file => {
      const filePath = path.join(backupDir, file);
      const stat = fs.statSync(filePath);
      return {
        name: file,
        path: filePath,
        size: stat.size,
        mtime: stat.mtime
      };
    })
    .sort((a, b) => b.mtime - a.mtime); // 最新的在前
  
  return files;
}

/**
 * 解压备份文件
 */
async function extractBackup(zipPath, extractTo) {
  return new Promise((resolve, reject) => {
    console.log('📦 解压备份文件...');
    
    const tempDir = path.join(extractTo, 'temp_restore');
    
    // 清理临时目录
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tempDir, { recursive: true });
    
    fs.createReadStream(zipPath)
      .pipe(unzipper.Extract({ path: tempDir }))
      .on('close', () => {
        console.log('✓ 解压完成');
        resolve(tempDir);
      })
      .on('error', (error) => {
        reject(new Error(`解压失败: ${error.message}`));
      });
  });
}

/**
 * 恢复数据库文件
 */
function restoreDatabase(tempDir) {
  console.log('\n📊 恢复数据库...');
  
  // 查找数据库文件（可能在 database/ 目录或根目录）
  let dbSource = path.join(tempDir, 'database', 'dev.db');
  if (!fs.existsSync(dbSource)) {
    dbSource = path.join(tempDir, 'dev.db');
  }
  if (!fs.existsSync(dbSource)) {
    dbSource = path.join(tempDir, 'prisma', 'dev.db');
  }
  
  const dbTarget = path.join(__dirname, '../prisma/dev.db');
  
  if (!fs.existsSync(dbSource)) {
    console.warn('⚠ 备份中没有找到数据库文件');
    console.log('  尝试过的路径:');
    console.log(`    - ${path.join(tempDir, 'database', 'dev.db')}`);
    console.log(`    - ${path.join(tempDir, 'dev.db')}`);
    console.log(`    - ${path.join(tempDir, 'prisma', 'dev.db')}`);
    return false;
  }
  
  // 备份当前数据库（如果存在）
  if (fs.existsSync(dbTarget)) {
    const backupDir = path.join(__dirname, '../data/backups/pre_restore');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const backupDbPath = path.join(backupDir, `dev.db.${timestamp}`);
    fs.copyFileSync(dbTarget, backupDbPath);
    console.log(`  ℹ️  当前数据库已备份到: data/backups/pre_restore/${path.basename(backupDbPath)}`);
  }
  
  // 确保目标目录存在
  const targetDir = path.dirname(dbTarget);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  
  // 删除现有数据库文件
  if (fs.existsSync(dbTarget)) {
    fs.unlinkSync(dbTarget);
  }
  const walTarget = dbTarget + '-wal';
  const shmTarget = dbTarget + '-shm';
  if (fs.existsSync(walTarget)) fs.unlinkSync(walTarget);
  if (fs.existsSync(shmTarget)) fs.unlinkSync(shmTarget);
  
  // 复制数据库文件
  fs.copyFileSync(dbSource, dbTarget);
  console.log(`  ✓ 数据库文件已恢复: ${path.relative(tempDir, dbSource)}`);
  
  // 复制 WAL 和 SHM 文件（如果存在）
  const walSource = dbSource + '-wal';
  const shmSource = dbSource + '-shm';
  if (fs.existsSync(walSource)) {
    fs.copyFileSync(walSource, walTarget);
    console.log('  ✓ WAL 文件已恢复');
  }
  if (fs.existsSync(shmSource)) {
    fs.copyFileSync(shmSource, shmTarget);
    console.log('  ✓ SHM 文件已恢复');
  }
  
  console.log('✓ 数据库恢复完成');
  return true;
}

/**
 * 恢复上传文件
 */
function restoreUploads(tempDir) {
  console.log('\n📁 恢复上传文件...');
  
  const uploadsSource = path.join(tempDir, 'uploads');
  const uploadsTarget = path.join(__dirname, '../public/uploads');
  
  if (!fs.existsSync(uploadsSource)) {
    console.warn('⚠ 备份中没有找到上传文件目录');
    return false;
  }
  
  // 备份当前上传目录（如果存在）
  if (fs.existsSync(uploadsTarget)) {
    const backupUploadsPath = path.join(__dirname, '../public', `uploads.before_restore_${Date.now()}`);
    fs.renameSync(uploadsTarget, backupUploadsPath);
    console.log(`  ℹ️  当前上传目录已备份到: ${path.basename(backupUploadsPath)}`);
  }
  
  // 复制上传文件目录
  copyRecursiveSync(uploadsSource, uploadsTarget);
  
  // 统计文件数量
  const fileCount = countFilesRecursive(uploadsTarget);
  console.log(`✓ 上传文件恢复完成 (${fileCount} 个文件)`);
  return true;
}

/**
 * 递归复制目录
 */
function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  
  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach(childItemName => {
      copyRecursiveSync(
        path.join(src, childItemName),
        path.join(dest, childItemName)
      );
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

/**
 * 递归计算文件数量
 */
function countFilesRecursive(dirPath) {
  let count = 0;
  if (!fs.existsSync(dirPath)) return 0;
  
  const items = fs.readdirSync(dirPath);
  for (const item of items) {
    const fullPath = path.join(dirPath, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      count += countFilesRecursive(fullPath);
    } else {
      count++;
    }
  }
  return count;
}

/**
 * 恢复配置文件
 */
function restoreConfig(tempDir) {
  console.log('\n⚙️  检查配置文件...');
  
  const envSource = path.join(tempDir, '.env.backup');
  const envTarget = path.join(__dirname, '../.env');
  
  if (!fs.existsSync(envSource)) {
    console.log('  ℹ️  备份中没有配置文件');
    return false;
  }
  
  console.log('  ⚠️  发现配置文件备份，但跳过恢复（需手动检查）');
  console.log(`     备份位置: ${envSource}`);
  return false;
}

/**
 * 主恢复函数
 */
async function restoreBackup(backupFile) {
  let tempDir = null;
  
  try {
    console.log('\n' + '='.repeat(60));
    console.log('🔄 EHS 系统全量恢复任务');
    console.log('='.repeat(60));
    console.log(`⏰ 开始时间: ${new Date().toLocaleString('zh-CN')}\n`);
    
    // 列出可用备份
    if (!backupFile) {
      console.log('📋 可用的备份文件:\n');
      const backups = listAvailableBackups();
      
      if (backups.length === 0) {
        console.log('❌ 没有找到任何备份文件');
        return;
      }
      
      backups.forEach((backup, index) => {
        console.log(`  ${index + 1}. ${backup.name}`);
        console.log(`     大小: ${formatBytes(backup.size)}`);
        console.log(`     时间: ${backup.mtime.toLocaleString('zh-CN')}\n`);
      });
      
      console.log('💡 使用方法: node scripts/restore-backup.js <备份文件名>');
      console.log('   示例: node scripts/restore-backup.js full_backup_2025-01-01_12-00-00.zip\n');
      return;
    }
    
    // 确定备份文件路径
    let zipPath = backupFile;
    if (!path.isAbsolute(zipPath)) {
      zipPath = path.join(__dirname, '../data/backups', backupFile);
    }
    
    if (!fs.existsSync(zipPath)) {
      console.log(`❌ 备份文件不存在: ${zipPath}`);
      return;
    }
    
    const stat = fs.statSync(zipPath);
    console.log('📦 备份文件信息:');
    console.log(`   文件: ${path.basename(zipPath)}`);
    console.log(`   大小: ${formatBytes(stat.size)}`);
    console.log(`   时间: ${stat.mtime.toLocaleString('zh-CN')}\n`);
    
    // 获取用户确认
    const confirmed = await getUserConfirmation('⚠️  确定要恢复此备份吗？这将覆盖当前数据！');
    if (!confirmed) {
      console.log('❌ 恢复已取消');
      return;
    }
    
    // 解压备份
    tempDir = await extractBackup(zipPath, path.join(__dirname, '..'));
    
    // 恢复数据库
    restoreDatabase(tempDir);
    
    // 恢复上传文件
    restoreUploads(tempDir);
    
    // 检查配置文件
    restoreConfig(tempDir);
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 系统恢复完成！');
    console.log('⏰ 结束时间: ' + new Date().toLocaleString('zh-CN'));
    console.log('\n⚠️  重要提示:');
    console.log('   1. 请重启应用程序以使用恢复的数据');
    console.log('   2. 原数据已自动备份，文件名包含时间戳');
    console.log('   3. 请检查 .env 配置文件是否需要更新');
    console.log('='.repeat(60) + '\n');
    
  } catch (error) {
    console.error('\n❌ 恢复失败:', error.message);
    throw error;
  } finally {
    // 清理临时目录
    if (tempDir && fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
        console.log('✓ 临时文件已清理');
      } catch (err) {
        console.warn('⚠ 清理临时文件失败:', err.message);
      }
    }
  }
}

/**
 * 当脚本直接运行时执行
 */
if (require.main === module) {
  const backupFile = process.argv[2];
  
  restoreBackup(backupFile)
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ 恢复失败:', error.message);
      process.exit(1);
    });
}

module.exports = { restoreBackup, listAvailableBackups };
