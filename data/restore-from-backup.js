/**
 * 从自动备份ZIP文件中恢复所有数据
 * 支持恢复数据库、上传文件、配置文件等
 * 
 * 备份文件格式：full_backup_YYYY-MM-DD_HH-MM-SS.zip
 * 包含内容：
 *   - database/dev.db (数据库文件)
 *   - database/dev.db-wal, database/dev.db-shm (WAL文件，如果存在)
 *   - uploads/ (上传文件目录)
 *   - data/ (JSON数据文件)
 *   - config/.env.sample (配置文件，已脱敏)
 *   - config/schema.prisma (Prisma schema)
 *   - backup_metadata.json (备份元数据)
 */

const fs = require('fs');
const path = require('path');
const unzipper = require('unzipper');

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
 * 备份当前数据库文件
 */
function backupCurrentDatabase() {
  const dbPath = path.join(__dirname, '../prisma/dev.db');
  const backupDir = path.join(__dirname, 'backups/pre_restore');
  
  if (!fs.existsSync(dbPath)) {
    console.log('⚠️  当前数据库文件不存在，跳过备份');
    return null;
  }
  
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDir, `dev.db.${timestamp}`);
  
  try {
    fs.copyFileSync(dbPath, backupPath);
    console.log(`✓ 已备份当前数据库到: ${path.relative(__dirname, backupPath)}`);
    return backupPath;
  } catch (error) {
    console.error(`❌ 备份当前数据库失败: ${error.message}`);
    return null;
  }
}

/**
 * 从ZIP文件恢复数据
 */
async function restoreFromZip(zipFilePath) {
  const startTime = Date.now();
  
  console.log('\n' + '='.repeat(60));
  console.log('🔄 从备份ZIP文件恢复数据');
  console.log('='.repeat(60));
  console.log(`📁 备份文件: ${zipFilePath}\n`);
  
  // 检查文件是否存在
  if (!fs.existsSync(zipFilePath)) {
    console.error(`❌ 错误: 备份文件不存在: ${zipFilePath}`);
    process.exit(1);
  }
  
  // 检查文件大小
  const stats = fs.statSync(zipFilePath);
  console.log(`📊 备份文件大小: ${formatBytes(stats.size)}\n`);
  
  // 备份当前数据库
  console.log('📦 备份当前数据库...');
  backupCurrentDatabase();
  console.log();
  
  // 读取ZIP文件
  const projectRoot = path.join(__dirname, '..');
  let metadata = null;
  let filesRestored = 0;
  let errors = [];
  
  try {
    const directory = await unzipper.Open.file(zipFilePath);
    
    console.log('📖 读取备份元数据...');
    const metadataEntry = directory.files.find(f => f.path === 'backup_metadata.json');
    if (metadataEntry) {
      const metadataContent = await metadataEntry.buffer();
      metadata = JSON.parse(metadataContent.toString('utf-8'));
      console.log(`✓ 备份时间: ${metadata.backupTime}`);
      console.log(`✓ 备份类型: ${metadata.backupType}`);
      console.log(`✓ 描述: ${metadata.description || 'N/A'}\n`);
    } else {
      console.warn('⚠️  未找到备份元数据文件\n');
    }
    
    console.log('📥 开始恢复文件...\n');
    
    // 恢复数据库文件
    console.log('💾 恢复数据库文件...');
    const dbEntry = directory.files.find(f => f.path === 'database/dev.db');
    if (dbEntry) {
      const dbPath = path.join(projectRoot, 'prisma/dev.db');
      const dbDir = path.dirname(dbPath);
      
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }
      
      // 删除旧的数据库文件
      if (fs.existsSync(dbPath)) {
        fs.unlinkSync(dbPath);
      }
      
      const dbBuffer = await dbEntry.buffer();
      fs.writeFileSync(dbPath, dbBuffer);
      console.log(`  ✓ 数据库文件: prisma/dev.db`);
      filesRestored++;
      
      // 恢复WAL文件（如果存在）
      const walEntry = directory.files.find(f => f.path === 'database/dev.db-wal');
      if (walEntry) {
        const walPath = dbPath + '-wal';
        const walBuffer = await walEntry.buffer();
        fs.writeFileSync(walPath, walBuffer);
        console.log(`  ✓ WAL文件: prisma/dev.db-wal`);
        filesRestored++;
      }
      
      // 恢复SHM文件（如果存在）
      const shmEntry = directory.files.find(f => f.path === 'database/dev.db-shm');
      if (shmEntry) {
        const shmPath = dbPath + '-shm';
        const shmBuffer = await shmEntry.buffer();
        fs.writeFileSync(shmPath, shmBuffer);
        console.log(`  ✓ SHM文件: prisma/dev.db-shm`);
        filesRestored++;
      }
    } else {
      console.warn('  ⚠️  未找到数据库文件');
      errors.push('数据库文件不存在');
    }
    console.log();
    
    // 恢复上传文件目录
    console.log('📁 恢复上传文件目录...');
    const uploadsDir = path.join(projectRoot, 'public/uploads');
    const uploadsEntries = directory.files.filter(f => f.path.startsWith('uploads/') && !f.path.endsWith('/'));
    
    if (uploadsEntries.length > 0) {
      // 如果uploads目录存在，先备份
      if (fs.existsSync(uploadsDir)) {
        const backupUploadsDir = uploadsDir + '.backup.' + Date.now();
        try {
          fs.renameSync(uploadsDir, backupUploadsDir);
          console.log(`  ✓ 已备份现有上传目录到: ${path.basename(backupUploadsDir)}`);
        } catch (error) {
          console.warn(`  ⚠️  备份上传目录失败: ${error.message}`);
        }
      }
      
      // 创建uploads目录
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      
      let uploadFilesCount = 0;
      for (const entry of uploadsEntries) {
        try {
          const filePath = path.join(projectRoot, 'public', entry.path);
          const fileDir = path.dirname(filePath);
          
          if (!fs.existsSync(fileDir)) {
            fs.mkdirSync(fileDir, { recursive: true });
          }
          
          const buffer = await entry.buffer();
          fs.writeFileSync(filePath, buffer);
          uploadFilesCount++;
        } catch (error) {
          console.error(`  ✗ 恢复文件失败: ${entry.path} - ${error.message}`);
          errors.push(`上传文件 ${entry.path}: ${error.message}`);
        }
      }
      
      console.log(`  ✓ 恢复 ${uploadFilesCount} 个上传文件`);
      filesRestored += uploadFilesCount;
    } else {
      console.warn('  ⚠️  未找到上传文件');
    }
    console.log();
    
    // 恢复JSON数据文件
    console.log('📄 恢复JSON数据文件...');
    const dataDir = path.join(projectRoot, 'data');
    const dataEntries = directory.files.filter(f => f.path.startsWith('data/') && f.path.endsWith('.json'));
    
    if (dataEntries.length > 0) {
      let dataFilesCount = 0;
      for (const entry of dataEntries) {
        try {
          const fileName = path.basename(entry.path);
          const filePath = path.join(dataDir, fileName);
          
          const buffer = await entry.buffer();
          fs.writeFileSync(filePath, buffer, 'utf-8');
          console.log(`  ✓ ${fileName}`);
          dataFilesCount++;
          filesRestored++;
        } catch (error) {
          console.error(`  ✗ 恢复文件失败: ${entry.path} - ${error.message}`);
          errors.push(`数据文件 ${entry.path}: ${error.message}`);
        }
      }
      console.log(`  ✓ 恢复 ${dataFilesCount} 个JSON数据文件`);
    } else {
      console.warn('  ⚠️  未找到JSON数据文件');
    }
    console.log();
    
    // 恢复配置文件（可选）
    console.log('⚙️  恢复配置文件...');
    const configSchemaEntry = directory.files.find(f => f.path === 'config/schema.prisma');
    if (configSchemaEntry) {
      const schemaPath = path.join(projectRoot, 'prisma/schema.prisma');
      const schemaBuffer = await configSchemaEntry.buffer();
      fs.writeFileSync(schemaPath, schemaBuffer, 'utf-8');
      console.log(`  ✓ Prisma Schema: prisma/schema.prisma`);
      filesRestored++;
    }
    
    const configEnvEntry = directory.files.find(f => f.path === 'config/.env.sample');
    if (configEnvEntry) {
      const envSamplePath = path.join(projectRoot, '.env.sample');
      const envBuffer = await configEnvEntry.buffer();
      fs.writeFileSync(envSamplePath, envBuffer, 'utf-8');
      console.log(`  ✓ 环境配置示例: .env.sample (注意：这是脱敏版本)`);
      filesRestored++;
    }
    console.log();
    
    // 计算耗时
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    // 输出摘要
    console.log('='.repeat(60));
    console.log('✅ 恢复完成！');
    console.log('='.repeat(60));
    console.log(`📊 恢复统计:`);
    console.log(`  - 恢复文件数: ${filesRestored}`);
    console.log(`  - 耗时: ${duration} 秒`);
    
    if (errors.length > 0) {
      console.log(`\n⚠️  警告: 有 ${errors.length} 个错误`);
      errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    }
    
    console.log('\n💡 提示:');
    console.log('  - 数据库文件已恢复，请重启应用程序');
    console.log('  - 当前数据库已备份到 data/backups/pre_restore/ 目录');
    console.log('  - 如果恢复有问题，可以从备份目录恢复');
    console.log('='.repeat(60) + '\n');
    
  } catch (error) {
    console.error('\n❌ 恢复失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

/**
 * 列出可用的备份文件
 */
function listBackups() {
  const backupDir = path.join(__dirname, 'backups');
  
  if (!fs.existsSync(backupDir)) {
    console.log('备份目录不存在');
    return;
  }
  
  const files = fs.readdirSync(backupDir)
    .filter(f => f.startsWith('full_backup_') && f.endsWith('.zip'))
    .map(f => {
      const filePath = path.join(backupDir, f);
      const stats = fs.statSync(filePath);
      return {
        name: f,
        path: filePath,
        size: stats.size,
        mtime: stats.mtime
      };
    })
    .sort((a, b) => b.mtime - a.mtime); // 按时间倒序
  
  if (files.length === 0) {
    console.log('未找到备份文件');
    return;
  }
  
  console.log('\n可用的备份文件:\n');
  files.forEach((file, index) => {
    console.log(`${index + 1}. ${file.name}`);
    console.log(`   大小: ${formatBytes(file.size)}`);
    console.log(`   时间: ${file.mtime.toLocaleString('zh-CN')}`);
    console.log();
  });
}

/**
 * 主函数
 */
function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(`
用法: node restore-from-backup.js <备份文件路径> [选项]

选项:
  --list, -l              列出所有可用的备份文件
  --help, -h              显示帮助信息

示例:
  node restore-from-backup.js data/backups/full_backup_2026-01-13_12-00-00.zip
  node restore-from-backup.js --list
    `);
    process.exit(0);
  }
  
  if (args[0] === '--list' || args[0] === '-l') {
    listBackups();
    process.exit(0);
  }
  
  const zipFilePath = args[0];
  
  // 如果是相对路径，转换为绝对路径
  const absolutePath = path.isAbsolute(zipFilePath)
    ? zipFilePath
    : path.join(__dirname, '..', zipFilePath);
  
  restoreFromZip(absolutePath)
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ 恢复过程出错:', error);
      process.exit(1);
    });
}

// 运行
if (require.main === module) {
  main();
}

module.exports = { restoreFromZip, listBackups };

