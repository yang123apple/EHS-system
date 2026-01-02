// scripts/auto-backup.js
// 全量备份：数据库 + 上传文件 + 配置文件
// 使用 ZIP 压缩，保留最近 30 天的备份

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const { promisify } = require('util');
const exec = promisify(require('child_process').exec);

const prisma = new PrismaClient();

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
 * 确保数据库 WAL 日志完全落盘
 */
async function checkpointDatabase() {
  try {
    // 执行 WAL checkpoint，确保所有数据写入主数据库文件
    // 使用 TRUNCATE 模式会将 WAL 文件截断为 0，确保备份时不需要包含 .wal 文件
    const result = await prisma.$queryRaw`PRAGMA wal_checkpoint(TRUNCATE)`;
    console.log('✓ 数据库 WAL checkpoint 完成:', result);
  } catch (error) {
    console.warn('⚠ WAL checkpoint 失败 (可能不是 WAL 模式):', error.message);
  }
}

/**
 * 递归计算目录中的文件数量
 */
function countFiles(dirPath) {
  let count = 0;
  if (!fs.existsSync(dirPath)) return 0;
  
  const items = fs.readdirSync(dirPath);
  for (const item of items) {
    const fullPath = path.join(dirPath, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      count += countFiles(fullPath);
    } else {
      count++;
    }
  }
  return count;
}

/**
 * 创建全量备份 ZIP 文件
 */
async function createFullBackup() {
  const startTime = Date.now();
  
  // 生成时间戳和备份文件名
  const now = new Date();
  const timestamp = now.toISOString()
    .replace(/T/, '_')
    .replace(/\..+/, '')
    .replace(/:/g, '-');
  
  const backupDir = path.join(__dirname, '../data/backups');
  const backupFileName = `full_backup_${timestamp}.zip`;
  const backupFilePath = path.join(backupDir, backupFileName);
  
  // 确保备份目录存在
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  
  console.log(`\n📦 开始创建全量备份: ${backupFileName}`);
  console.log('=' .repeat(60));
  
  // 创建写入流和 archiver 实例
  const output = fs.createWriteStream(backupFilePath);
  const archive = archiver('zip', {
    zlib: { level: 9 } // 最高压缩级别
  });
  
  let filesAdded = 0;
  
  // 监听归档完成事件
  return new Promise((resolve, reject) => {
    output.on('close', () => {
      const endTime = Date.now();
      const duration = ((endTime - startTime) / 1000).toFixed(2);
      const fileSize = archive.pointer();
      
      console.log('=' .repeat(60));
      console.log('✅ 备份完成！');
      console.log(`📁 备份文件: ${backupFileName}`);
      console.log(`📊 文件大小: ${formatBytes(fileSize)}`);
      console.log(`📄 包含文件: ${filesAdded} 个`);
      console.log(`⏱️  耗时: ${duration} 秒`);
      console.log('=' .repeat(60));
      
      resolve({ backupFilePath, fileSize, filesAdded, duration });
    });
    
    archive.on('error', (err) => {
      console.error('❌ 归档错误:', err);
      reject(err);
    });
    
    archive.on('entry', () => {
      filesAdded++;
    });
    
    // 管道输出
    archive.pipe(output);
    
    // 1. 添加数据库文件
    const dbPath = path.join(__dirname, '../prisma/dev.db');
    if (fs.existsSync(dbPath)) {
      archive.file(dbPath, { name: 'database/dev.db' });
      console.log('✓ 添加数据库文件: prisma/dev.db');
      
      // 同时备份 WAL 和 SHM 文件（如果存在）
      const walPath = dbPath + '-wal';
      const shmPath = dbPath + '-shm';
      if (fs.existsSync(walPath)) {
        archive.file(walPath, { name: 'database/dev.db-wal' });
        console.log('✓ 添加 WAL 文件: prisma/dev.db-wal');
      }
      if (fs.existsSync(shmPath)) {
        archive.file(shmPath, { name: 'database/dev.db-shm' });
        console.log('✓ 添加 SHM 文件: prisma/dev.db-shm');
      }
    } else {
      console.warn('⚠ 数据库文件不存在，跳过');
    }
    
    // 2. 添加用户上传文件目录
    const uploadsPath = path.join(__dirname, '../public/uploads');
    if (fs.existsSync(uploadsPath)) {
      const uploadFileCount = countFiles(uploadsPath);
      archive.directory(uploadsPath, 'uploads');
      console.log(`✓ 添加上传文件目录: public/uploads (${uploadFileCount} 个文件)`);
    } else {
      console.warn('⚠ 上传目录不存在，跳过');
    }
    
    // 3. 添加 JSON 数据文件（可选，作为额外的数据备份）
    const dataPath = path.join(__dirname, '../data');
    const jsonFiles = ['org.json', 'users.json', 'docs.json', 'hazard-workflow.json'];
    jsonFiles.forEach(file => {
      const filePath = path.join(dataPath, file);
      if (fs.existsSync(filePath)) {
        archive.file(filePath, { name: `data/${file}` });
        console.log(`✓ 添加数据文件: data/${file}`);
      }
    });
    
    // 4. 添加配置文件（脱敏处理）
    const envPath = path.join(__dirname, '../.env');
    if (fs.existsSync(envPath)) {
      let envContent = fs.readFileSync(envPath, 'utf-8');
      
      // 脱敏：隐藏敏感信息
      envContent = envContent.replace(
        /(DATABASE_URL|SECRET|PASSWORD|KEY|TOKEN)=.*/gi,
        '$1=***REDACTED***'
      );
      
      archive.append(envContent, { name: 'config/.env.sample' });
      console.log('✓ 添加配置文件: .env (已脱敏)');
    }
    
    // 5. 添加 Prisma schema
    const schemaPath = path.join(__dirname, '../prisma/schema.prisma');
    if (fs.existsSync(schemaPath)) {
      archive.file(schemaPath, { name: 'config/schema.prisma' });
      console.log('✓ 添加 Prisma schema: prisma/schema.prisma');
    }
    
    // 6. 添加备份元数据
    const metadata = {
      backupType: 'full',
      backupTime: now.toISOString(),
      backupTimestamp: timestamp,
      nodeVersion: process.version,
      platform: process.platform,
      description: 'EHS System Full Backup - Database + Uploads + Config'
    };
    
    archive.append(JSON.stringify(metadata, null, 2), { name: 'backup_metadata.json' });
    console.log('✓ 添加备份元数据');
    
    console.log('\n🔄 正在压缩...');
    
    // 完成归档
    archive.finalize();
  });
}

/**
 * 清理超过 30 天的旧备份文件
 */
function cleanupOldBackups() {
  const backupDir = path.join(__dirname, '../data/backups');
  
  if (!fs.existsSync(backupDir)) {
    return;
  }
  
  console.log('\n🧹 开始清理旧备份...');
  
  const now = Date.now();
  const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000); // 30 天
  
  let deletedCount = 0;
  let deletedSize = 0;
  
  const files = fs.readdirSync(backupDir);
  
  files.forEach(file => {
    // 只处理全量备份 ZIP 文件
    if (!file.startsWith('full_backup_') || !file.endsWith('.zip')) {
      return;
    }
    
    const filePath = path.join(backupDir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.mtimeMs < thirtyDaysAgo) {
      const fileSize = stat.size;
      fs.unlinkSync(filePath);
      deletedCount++;
      deletedSize += fileSize;
      console.log(`  🗑️  删除: ${file} (${formatBytes(fileSize)})`);
    }
  });
  
  if (deletedCount > 0) {
    console.log(`✓ 已删除 ${deletedCount} 个旧备份，释放 ${formatBytes(deletedSize)} 空间`);
  } else {
    console.log('✓ 没有需要清理的旧备份');
  }
}
/**
 * 主备份函数
 */
async function autoBackup() {
  try {
    console.log('\n' + '='.repeat(60));
    console.log('🚀 EHS 系统全量备份任务');
    console.log('='.repeat(60));
    console.log(`⏰ 开始时间: ${new Date().toLocaleString('zh-CN')}\n`);
    
    // 步骤 1: 执行数据库 checkpoint
    console.log('📋 步骤 1/3: 数据库预处理');
    await checkpointDatabase();
    
    // 步骤 2: 创建全量备份
    console.log('\n📋 步骤 2/3: 创建全量备份');
    const backupResult = await createFullBackup();
    
    // 步骤 3: 清理旧备份
    console.log('\n📋 步骤 3/3: 清理旧备份');
    cleanupOldBackups();
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 全量备份任务完成！');
    console.log(`⏰ 结束时间: ${new Date().toLocaleString('zh-CN')}`);
    console.log('='.repeat(60) + '\n');
    
    return backupResult;
    
  } catch (error) {
    console.error('\n❌ 备份任务失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * 当脚本直接运行时执行
 */
if (require.main === module) {
  autoBackup()
    .then((result) => {
      console.log('✅ 备份任务执行成功！');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ 备份任务执行失败:', error.message);
      process.exit(1);
    });
}

module.exports = { autoBackup, createFullBackup, cleanupOldBackups };

