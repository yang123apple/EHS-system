// scripts/restore-from-backup.js
// 从全量备份 ZIP 文件恢复系统

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
 * 用户确认提示
 */
function askConfirmation(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

/**
 * 列出所有可用的备份文件
 */
function listBackups() {
  const backupDir = path.join(__dirname, '../data/backups');
  
  if (!fs.existsSync(backupDir)) {
    console.log('❌ 备份目录不存在');
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
    .sort((a, b) => b.mtime - a.mtime); // 按时间倒序
  
  return files;
}

/**
 * 从 ZIP 备份恢复系统
 */
async function restoreFromBackup(backupFilePath) {
  try {
    console.log('\n' + '='.repeat(60));
    console.log('🔄 开始从备份恢复系统');
    console.log('='.repeat(60));
    
    if (!fs.existsSync(backupFilePath)) {
      throw new Error('备份文件不存在: ' + backupFilePath);
    }
    
    const stat = fs.statSync(backupFilePath);
    console.log(`\n📦 备份文件: ${path.basename(backupFilePath)}`);
    console.log(`📊 文件大小: ${formatBytes(stat.size)}`);
    console.log(`📅 创建时间: ${stat.mtime.toLocaleString('zh-CN')}`);
    
    // 显示警告
    console.log('\n⚠️  警告：恢复操作将覆盖以下内容：');
    console.log('   - 数据库文件 (prisma/dev.db)');
    console.log('   - 用户上传文件 (public/uploads)');
    console.log('   - 数据文件 (data/*.json)');
    
    const confirmed = await askConfirmation('\n是否继续? (y/n): ');
    
    if (!confirmed) {
      console.log('\n❌ 恢复操作已取消');
      return;
    }
    
    console.log('\n🔄 开始解压备份文件...');
    
    // 解压到临时目录
    const tempDir = path.join(__dirname, '../.restore-temp');
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tempDir, { recursive: true });
    
    // 解压 ZIP 文件
    await fs.createReadStream(backupFilePath)
      .pipe(unzipper.Extract({ path: tempDir }))
      .promise();
    
    console.log('✓ 备份文件解压完成');
    
    let restoredItems = [];
    
    // 1. 恢复数据库
    const dbBackupPath = path.join(tempDir, 'database/dev.db');
    if (fs.existsSync(dbBackupPath)) {
      const dbPath = path.join(__dirname, '../prisma/dev.db');
      
      // 备份当前数据库
      if (fs.existsSync(dbPath)) {
        const backupDbPath = dbPath + '.before-restore';
        fs.copyFileSync(dbPath, backupDbPath);
        console.log(`✓ 当前数据库已备份到: dev.db.before-restore`);
      }
      
      // 恢复数据库
      fs.copyFileSync(dbBackupPath, dbPath);
      console.log('✓ 数据库文件已恢复');
      restoredItems.push('数据库');
      
      // 恢复 WAL 和 SHM 文件（如果存在）
      const walBackupPath = path.join(tempDir, 'database/dev.db-wal');
      const shmBackupPath = path.join(tempDir, 'database/dev.db-shm');
      
      if (fs.existsSync(walBackupPath)) {
        fs.copyFileSync(walBackupPath, dbPath + '-wal');
        console.log('✓ WAL 文件已恢复');
      }
      if (fs.existsSync(shmBackupPath)) {
        fs.copyFileSync(shmBackupPath, dbPath + '-shm');
        console.log('✓ SHM 文件已恢复');
      }
    }
    
    // 2. 恢复上传文件
    const uploadsBackupPath = path.join(tempDir, 'uploads');
    if (fs.existsSync(uploadsBackupPath)) {
      const uploadsPath = path.join(__dirname, '../public/uploads');
      
      // 备份当前上传目录
      if (fs.existsSync(uploadsPath)) {
        const backupUploadsPath = uploadsPath + '.before-restore';
        if (fs.existsSync(backupUploadsPath)) {
          fs.rmSync(backupUploadsPath, { recursive: true, force: true });
        }
        fs.renameSync(uploadsPath, backupUploadsPath);
        console.log(`✓ 当前上传目录已备份到: uploads.before-restore`);
      }
      
      // 恢复上传目录
      fs.cpSync(uploadsBackupPath, uploadsPath, { recursive: true });
      console.log('✓ 上传文件已恢复');
      restoredItems.push('上传文件');
    }
    
    // 3. 恢复数据文件
    const dataBackupPath = path.join(tempDir, 'data');
    if (fs.existsSync(dataBackupPath)) {
      const dataPath = path.join(__dirname, '../data');
      const jsonFiles = fs.readdirSync(dataBackupPath).filter(f => f.endsWith('.json'));
      
      jsonFiles.forEach(file => {
        const sourcePath = path.join(dataBackupPath, file);
        const targetPath = path.join(dataPath, file);
        fs.copyFileSync(sourcePath, targetPath);
        console.log(`✓ 恢复数据文件: ${file}`);
      });
      
      if (jsonFiles.length > 0) {
        restoredItems.push(`${jsonFiles.length} 个数据文件`);
      }
    }
    
    // 4. 显示备份元数据
    const metadataPath = path.join(tempDir, 'backup_metadata.json');
    if (fs.existsSync(metadataPath)) {
      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
      console.log('\n📋 备份信息:');
      console.log(`   备份时间: ${new Date(metadata.backupTime).toLocaleString('zh-CN')}`);
      console.log(`   备份类型: ${metadata.backupType}`);
      console.log(`   平台: ${metadata.platform}`);
    }
    
    // 清理临时目录
    fs.rmSync(tempDir, { recursive: true, force: true });
    console.log('\n✓ 临时文件已清理');
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ 恢复完成！');
    console.log(`📦 已恢复: ${restoredItems.join(', ')}`);
    console.log('\n💡 提示：');
    console.log('   - 原数据已备份到 .before-restore 后缀的文件/目录');
    console.log('   - 建议重启应用以确保所有更改生效');
    console.log('='.repeat(60) + '\n');
    
  } catch (error) {
    console.error('\n❌ 恢复失败:', error.message);
    throw error;
  }
}

/**
 * 主函数
 */
async function main() {
  try {
    // 获取命令行参数
    const args = process.argv.slice(2);
    let backupFilePath = args[0];
    
    // 如果没有指定备份文件，列出可用备份
    if (!backupFilePath) {
      console.log('\n📦 可用的备份文件：\n');
      const backups = listBackups();
      
      if (backups.length === 0) {
        console.log('❌ 没有找到可用的备份文件');
        console.log('\n💡 使用方法:');
        console.log('   node scripts/restore-from-backup.js [备份文件路径]');
        console.log('\n   或先运行备份命令:');
        console.log('   npm run db:backup\n');
        process.exit(1);
      }
      
      backups.forEach((backup, index) => {
        console.log(`${index + 1}. ${backup.name}`);
        console.log(`   大小: ${formatBytes(backup.size)}`);
        console.log(`   时间: ${backup.mtime.toLocaleString('zh-CN')}`);
        console.log('');
      });
      
      // 使用最新的备份
      console.log(`🔄 将使用最新备份: ${backups[0].name}\n`);
      backupFilePath = backups[0].path;
    }
    
    // 执行恢复
    await restoreFromBackup(backupFilePath);
    
  } catch (error) {
    console.error('❌ 执行失败:', error.message);
    process.exit(1);
  }
}

// 运行主函数
if (require.main === module) {
  main();
}

module.exports = { restoreFromBackup, listBackups };
