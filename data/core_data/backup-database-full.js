/**
 * 数据库全量备份脚本
 * 将所有数据库表的数据导出为JSON格式，保存到当前目录（core_data）
 * 用于极端情况下的数据恢复
 * 
 * 注意：此脚本位于 data/core_data 目录，运行时会在当前目录生成备份文件
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

// 定义所有需要备份的表（按照Prisma schema中的模型名称，使用小写首字母）
const TABLES = [
  'user',
  'department',
  'project',
  'workPermitTemplate',
  'workPermitRecord',
  'hazardRecord',
  'hazardExtension',
  'hazardConfig',
  'incident',
  'document',
  'tag',
  'documentHistory',
  'systemLog',
  'notification',
  'trainingMaterial',
  'examQuestion',
  'trainingTask',
  'autoAssignRule',
  'trainingAssignment',
  'materialLearnedRecord',
  'notificationTemplate',
  'aIApiConfig',
  'aIApiLog',
  'aIApiRateLimit',
  'fileMetadata',
  'signatureRecord',
  'subPermit',
  'equipment',
  'archiveFile',
  'archiveConfig',
];

/**
 * 将日期对象转换为ISO字符串（用于JSON序列化）
 */
function serializeDate(date) {
  if (date instanceof Date) {
    return date.toISOString();
  }
  return date;
}

/**
 * 递归处理对象，将所有Date对象转换为字符串
 */
function serializeDates(obj) {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (obj instanceof Date) {
    return obj.toISOString();
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => serializeDates(item));
  }
  
  if (typeof obj === 'object') {
    const result = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        result[key] = serializeDates(obj[key]);
      }
    }
    return result;
  }
  
  return obj;
}

/**
 * 导出单个表的数据
 */
async function exportTable(tableName) {
  try {
    console.log(`  📋 导出表: ${tableName}...`);
    
    // 使用动态属性访问Prisma模型
    const model = prisma[tableName];
    if (!model) {
      console.warn(`  ⚠️  表 ${tableName} 不存在，跳过`);
      return { tableName, count: 0, data: [] };
    }
    
    // 查询所有数据
    const data = await model.findMany({
      orderBy: { id: 'asc' } // 按ID排序，确保数据一致性
    });
    
    // 序列化日期
    const serializedData = serializeDates(data);
    
    const count = data.length;
    console.log(`  ✓ ${tableName}: ${count} 条记录`);
    
    return { tableName, count, data: serializedData };
  } catch (error) {
    console.error(`  ❌ 导出表 ${tableName} 失败:`, error.message);
    // 即使某个表导出失败，也继续导出其他表
    return { tableName, count: 0, data: [], error: error.message };
  }
}

/**
 * 主函数
 */
async function main() {
  const startTime = Date.now();
  
  console.log('\n' + '='.repeat(60));
  console.log('📦 数据库全量备份');
  console.log('='.repeat(60));
  
  // 备份目录：当前脚本所在的目录（core_data）
  // 如果从其他位置运行，使用相对于项目根目录的路径
  let backupDir;
  if (__dirname.includes('core_data')) {
    // 脚本在 core_data 目录中
    backupDir = __dirname;
  } else {
    // 脚本在其他位置，使用相对路径
    backupDir = path.join(__dirname, '../data/core_data');
  }
  
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
    console.log(`✓ 创建备份目录: ${backupDir}`);
  }
  
  // 备份元数据
  const backupMetadata = {
    version: '1.0.0',
    backupTime: new Date().toISOString(),
    backupTimestamp: Date.now(),
    databaseType: 'SQLite (Prisma)',
    tables: [],
    summary: {
      totalTables: TABLES.length,
      totalRecords: 0,
      successTables: 0,
      failedTables: 0,
    },
  };
  
  // 导出所有表的数据
  console.log('\n📊 开始导出表数据...\n');
  
  const allData = {};
  let totalRecords = 0;
  let successCount = 0;
  let failedCount = 0;
  
  for (const tableName of TABLES) {
    const result = await exportTable(tableName);
    
    allData[tableName] = result.data;
    
    backupMetadata.tables.push({
      name: result.tableName,
      recordCount: result.count,
      status: result.error ? 'failed' : 'success',
      error: result.error || null,
    });
    
    if (result.error) {
      failedCount++;
    } else {
      successCount++;
      totalRecords += result.count;
    }
    
    // 同时保存单个表的JSON文件（便于单独恢复）
    // 注意：每次运行都会覆盖同名文件
    if (!result.error && result.data.length > 0) {
      const tableFile = path.join(backupDir, `${result.tableName}.json`);
      fs.writeFileSync(
        tableFile,
        JSON.stringify(result.data, null, 2),
        'utf-8'
      );
    }
  }
  
  // 更新元数据
  backupMetadata.summary.totalRecords = totalRecords;
  backupMetadata.summary.successTables = successCount;
  backupMetadata.summary.failedTables = failedCount;
  
  // 保存完整的数据库备份（所有表在一个文件中）
  // 注意：每次运行都会覆盖同名文件
  const fullBackupFile = path.join(backupDir, 'database_full.json');
  const fullBackupData = {
    metadata: backupMetadata,
    data: allData,
  };
  
  fs.writeFileSync(
    fullBackupFile,
    JSON.stringify(fullBackupData, null, 2),
    'utf-8'
  );
  
  // 保存元数据文件
  // 注意：每次运行都会覆盖同名文件
  const metadataFile = path.join(backupDir, 'backup_metadata.json');
  fs.writeFileSync(
    metadataFile,
    JSON.stringify(backupMetadata, null, 2),
    'utf-8'
  );
  
  // 计算文件大小
  const fullBackupSize = fs.statSync(fullBackupFile).size;
  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  
  // 输出摘要
  console.log('\n' + '='.repeat(60));
  console.log('✅ 备份完成！');
  console.log('='.repeat(60));
  console.log(`📁 备份目录: ${backupDir}`);
  console.log(`📄 完整备份文件: database_full.json (${formatBytes(fullBackupSize)})`);
  console.log(`📋 元数据文件: backup_metadata.json`);
  console.log(`\n📊 备份统计:`);
  console.log(`  - 总表数: ${TABLES.length}`);
  console.log(`  - 成功导出: ${successCount} 个表`);
  console.log(`  - 失败: ${failedCount} 个表`);
  console.log(`  - 总记录数: ${totalRecords.toLocaleString()}`);
  console.log(`  - 耗时: ${duration} 秒`);
  console.log('\n💡 提示:');
  console.log('  - 每个表的数据已单独保存为 JSON 文件，便于单独恢复');
  console.log('  - database_full.json 包含所有表的数据，用于完整恢复');
  console.log('  - backup_metadata.json 包含备份元数据信息');
  console.log('  - 每次运行会覆盖之前的同名备份文件');
  console.log('='.repeat(60) + '\n');
}

// 执行备份
main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('\n❌ 备份失败:', error);
    console.error(error.stack);
    await prisma.$disconnect();
    process.exit(1);
  });

