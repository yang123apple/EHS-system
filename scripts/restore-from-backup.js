// scripts/restore-from-backup.js
// 从 ZIP 备份文件恢复数据库和文件
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const exec = promisify(require('child_process').exec);

async function restoreFromBackup(backupFilePath) {
  const backupPath = path.resolve(backupFilePath);
  
  if (!fs.existsSync(backupPath)) {
    console.error(`错误: 备份文件不存在: ${backupPath}`);
    process.exit(1);
  }

  console.log('========================================');
  console.log('从备份恢复数据库');
  console.log('========================================');
  console.log(`备份文件: ${path.basename(backupPath)}\n`);

  // 1. 停止 Node.js 进程（如果正在运行）
  console.log('[1/4] 停止 Node.js 进程...');
  try {
    await exec('taskkill /F /IM node.exe 2>nul');
    await new Promise(resolve => setTimeout(resolve, 2000));
  } catch (e) {
    // 进程可能不存在，继续
  }
  console.log('✓ Node.js 进程已停止\n');

  // 2. 备份当前数据库文件（如果存在）
  console.log('[2/4] 备份当前数据库文件...');
  const dbFiles = ['prisma/dev.db', 'prisma/dev.db-wal', 'prisma/dev.db-shm'];
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const backupDir = path.join(__dirname, '../data/backups/pre_restore');

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  for (const dbFile of dbFiles) {
    const fullPath = path.join(__dirname, '..', dbFile);
    if (fs.existsSync(fullPath)) {
      const backupPath = path.join(backupDir, `${path.basename(dbFile)}.${timestamp}`);
      fs.copyFileSync(fullPath, backupPath);
      console.log(`  ✓ 已备份: ${dbFile}`);
    }
  }
  console.log('✓ 当前数据库已备份\n');

  // 3. 解压备份文件
  console.log('[3/4] 解压备份文件...');
  const tempDir = path.join(__dirname, '../temp_backup_restore');
  
  // 清理临时目录
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  fs.mkdirSync(tempDir, { recursive: true });

  // 使用 PowerShell 解压 ZIP 文件
  const zipPath = backupPath.replace(/\\/g, '/').replace(/:/g, ':/');
  const extractCmd = `powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${tempDir}' -Force"`;
  
  try {
    await exec(extractCmd);
    console.log('✓ 备份文件已解压\n');
  } catch (error) {
    console.error('✗ 解压失败:', error.message);
    process.exit(1);
  }

  // 4. 恢复数据库文件
  console.log('[4/4] 恢复数据库文件...');
  const sourceDbPath = path.join(tempDir, 'prisma', 'dev.db');
  
  if (!fs.existsSync(sourceDbPath)) {
    // 尝试在根目录查找
    const altDbPath = path.join(tempDir, 'dev.db');
    if (fs.existsSync(altDbPath)) {
      const targetDir = path.join(__dirname, '../prisma');
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      fs.copyFileSync(altDbPath, path.join(targetDir, 'dev.db'));
      console.log('✓ 数据库文件已恢复（从根目录）\n');
    } else {
      console.error('✗ 错误: 备份文件中未找到数据库文件');
      process.exit(1);
    }
  } else {
    // 确保 prisma 目录存在
    const targetDir = path.join(__dirname, '../prisma');
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    
    // 复制数据库文件
    fs.copyFileSync(sourceDbPath, path.join(targetDir, 'dev.db'));
    
    // 如果存在 WAL 和 SHM 文件，也复制
    const walPath = path.join(tempDir, 'prisma', 'dev.db-wal');
    const shmPath = path.join(tempDir, 'prisma', 'dev.db-shm');
    
    if (fs.existsSync(walPath)) {
      fs.copyFileSync(walPath, path.join(targetDir, 'dev.db-wal'));
    }
    if (fs.existsSync(shmPath)) {
      fs.copyFileSync(shmPath, path.join(targetDir, 'dev.db-shm'));
    }
    
    console.log('✓ 数据库文件已恢复\n');
  }

  // 清理临时目录
  fs.rmSync(tempDir, { recursive: true, force: true });

  // 5. 重新生成 Prisma 客户端
  console.log('[5/5] 重新生成 Prisma 客户端...');
  try {
    await exec('npx prisma generate', { cwd: path.join(__dirname, '..') });
    console.log('✓ Prisma 客户端已生成\n');
  } catch (error) {
    console.warn('⚠ Prisma 客户端生成失败（可能不影响使用）:', error.message);
  }

  console.log('========================================');
  console.log('✅ 数据库恢复完成！');
  console.log('现在可以运行: npm run dev');
  console.log('========================================');
}

// 主函数
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    // 查找最新的备份文件
    const backupsDir = path.join(__dirname, '../data/backups');
    const backupFiles = fs.readdirSync(backupsDir)
      .filter(f => f.startsWith('full_backup_') && f.endsWith('.zip'))
      .map(f => path.join(backupsDir, f))
      .filter(f => fs.statSync(f).isFile())
      .sort((a, b) => fs.statSync(b).mtime - fs.statSync(a).mtime);

    if (backupFiles.length === 0) {
      console.error('错误: 未找到备份文件');
      console.log('请确保 data/backups/ 目录中有 full_backup_*.zip 文件');
      process.exit(1);
    }

    const latestBackup = backupFiles[0];
    console.log(`使用最新的备份文件: ${path.basename(latestBackup)}\n`);
    await restoreFromBackup(latestBackup);
  } else {
    await restoreFromBackup(args[0]);
  }
}

main().catch(error => {
  console.error('恢复失败:', error);
  process.exit(1);
});
