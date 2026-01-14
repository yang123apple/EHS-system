/**
 * 数据库全量恢复脚本
 * 从 database_full.json 文件恢复整个数据库
 * 用于极端情况下的数据恢复
 * 
 * 注意：此脚本位于 data/core_data 目录，会读取当前目录的备份文件
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

// 定义表的恢复顺序（考虑外键依赖关系）
// 先恢复没有依赖的表，再恢复有依赖的表
const TABLE_RESTORE_ORDER = [
  // 第一层：无依赖的表
  'department',
  'tag',
  'hazardConfig',
  'archiveConfig',
  'notificationTemplate',
  'aIApiConfig',
  'aIApiRateLimit',
  'equipment',
  'project',
  'workPermitTemplate',
  
  // 第二层：依赖第一层的表
  'user', // 依赖 department
  'document', // 自引用，先创建父级
  
  // 第三层：依赖第二层的表
  'workPermitRecord', // 依赖 project, workPermitTemplate
  'hazardRecord', // 依赖 user
  'incident', // 依赖 user, department
  'trainingMaterial', // 依赖 user
  'systemLog',
  'notification',
  'fileMetadata', // 依赖 user
  
  // 第四层：依赖第三层的表
  'hazardExtension', // 依赖 hazardRecord
  'examQuestion', // 依赖 trainingMaterial
  'trainingTask', // 依赖 trainingMaterial, user
  'documentHistory', // 依赖 document
  'signatureRecord', // 依赖 workPermitRecord/incident/hazardRecord
  'subPermit', // 依赖 workPermitRecord
  'archiveFile', // 依赖 equipment, user
  
  // 第五层：依赖第四层的表
  'autoAssignRule', // 依赖 trainingTask
  'trainingAssignment', // 依赖 trainingTask, user
  'materialLearnedRecord', // 依赖 trainingMaterial, user
  'aIApiLog', // 依赖 aIApiConfig
];

/**
 * 将ISO日期字符串转换为Date对象
 */
function parseDate(dateValue) {
  if (!dateValue) return null;
  if (dateValue instanceof Date) return dateValue;
  if (typeof dateValue === 'string') {
    const date = new Date(dateValue);
    return isNaN(date.getTime()) ? null : date;
  }
  return dateValue;
}

/**
 * 递归处理对象，将所有日期字符串转换为Date对象
 */
function parseDates(obj) {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(obj)) {
    // 可能是日期字符串
    const date = parseDate(obj);
    return date !== null ? date : obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => parseDates(item));
  }
  
  if (typeof obj === 'object') {
    const result = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        result[key] = parseDates(obj[key]);
      }
    }
    return result;
  }
  
  return obj;
}

/**
 * 恢复单个表的数据
 */
async function restoreTable(tableName, data, clearExisting = false) {
  try {
    const model = prisma[tableName];
    if (!model) {
      console.warn(`  ⚠️  表 ${tableName} 不存在，跳过`);
      return { tableName, created: 0, updated: 0, errors: [] };
    }
    
    if (!data || data.length === 0) {
      console.log(`  ⏭️  ${tableName}: 无数据，跳过`);
      return { tableName, created: 0, updated: 0, errors: [] };
    }
    
    // 清空现有数据（如果需要）
    if (clearExisting) {
      await model.deleteMany({});
    }
    
    let created = 0;
    let updated = 0;
    const errors = [];
    
    // 处理日期字段
    const processedData = parseDates(data);
    
    // 批量恢复数据
    // 对于有唯一约束的表，使用 upsert；对于没有唯一约束的表，使用 createMany
    for (const record of processedData) {
      try {
        // 尝试查找现有记录（通过id）
        const existing = await model.findUnique({
          where: { id: record.id }
        });
        
        if (existing) {
          // 更新现有记录
          await model.update({
            where: { id: record.id },
            data: record
          });
          updated++;
        } else {
          // 创建新记录
          await model.create({
            data: record
          });
          created++;
        }
      } catch (error) {
        errors.push({
          id: record.id,
          error: error.message
        });
        console.error(`    ✗ ${tableName} ID ${record.id} 恢复失败: ${error.message}`);
      }
    }
    
    console.log(`  ✓ ${tableName}: ${created} 条新建, ${updated} 条更新${errors.length > 0 ? `, ${errors.length} 条失败` : ''}`);
    
    return { tableName, created, updated, errors };
  } catch (error) {
    console.error(`  ❌ 恢复表 ${tableName} 失败:`, error.message);
    return { tableName, created: 0, updated: 0, errors: [{ error: error.message }] };
  }
}

/**
 * 主函数
 */
async function main() {
  const startTime = Date.now();
  
  console.log('\n' + '='.repeat(60));
  console.log('🔄 数据库全量恢复');
  console.log('='.repeat(60));
  
  // 确定备份文件路径
  let backupFile;
  if (__dirname.includes('core_data')) {
    // 脚本在 core_data 目录中
    backupFile = path.join(__dirname, 'database_full.json');
  } else {
    // 脚本在其他位置
    backupFile = path.join(__dirname, '../data/core_data/database_full.json');
  }
  
  // 检查备份文件是否存在
  if (!fs.existsSync(backupFile)) {
    console.error(`\n❌ 错误: 找不到备份文件: ${backupFile}`);
    console.error('请先运行备份脚本生成备份文件。');
    process.exit(1);
  }
  
  console.log(`📁 备份文件: ${backupFile}\n`);
  
  // 读取备份文件
  console.log('📖 读取备份文件...');
  let backupContent;
  try {
    backupContent = fs.readFileSync(backupFile, 'utf-8');
    // 移除 BOM
    if (backupContent.charCodeAt(0) === 0xFEFF) {
      backupContent = backupContent.slice(1);
    }
  } catch (error) {
    console.error(`\n❌ 读取备份文件失败: ${error.message}`);
    process.exit(1);
  }
  
  let backupData;
  try {
    backupData = JSON.parse(backupContent);
  } catch (error) {
    console.error(`\n❌ 解析备份文件失败: ${error.message}`);
    process.exit(1);
  }
  
  if (!backupData.data || !backupData.metadata) {
    console.error('\n❌ 备份文件格式不正确，缺少 data 或 metadata 字段');
    process.exit(1);
  }
  
  // 显示备份信息
  console.log('📋 备份信息:');
  console.log(`  备份时间: ${backupData.metadata.backupTime}`);
  console.log(`  数据库类型: ${backupData.metadata.databaseType}`);
  console.log(`  总表数: ${backupData.metadata.summary.totalTables}`);
  console.log(`  总记录数: ${backupData.metadata.summary.totalRecords}`);
  console.log(`  成功表数: ${backupData.metadata.summary.successTables}`);
  console.log(`  失败表数: ${backupData.metadata.summary.failedTables}\n`);
  
  // 询问用户是否清空现有数据
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  const answer = await new Promise((resolve) => {
    readline.question('⚠️  是否清空现有数据后恢复？(y/N): ', (ans) => {
      readline.close();
      resolve(ans.toLowerCase());
    });
  });
  
  const clearExisting = answer === 'y' || answer === 'yes';
  
  if (clearExisting) {
    console.log('\n🗑️  将清空现有数据后恢复...\n');
  } else {
    console.log('\n📝 将以合并模式恢复（保留现有数据，更新重复记录）...\n');
  }
  
  // 开始恢复
  console.log('📊 开始恢复数据...\n');
  
  const restoreStats = {
    totalCreated: 0,
    totalUpdated: 0,
    totalErrors: 0,
    tables: []
  };
  
  // 按照依赖顺序恢复表
  for (const tableName of TABLE_RESTORE_ORDER) {
    const tableData = backupData.data[tableName] || [];
    const result = await restoreTable(tableName, tableData, clearExisting);
    
    restoreStats.tables.push(result);
    restoreStats.totalCreated += result.created;
    restoreStats.totalUpdated += result.updated;
    restoreStats.totalErrors += result.errors.length;
  }
  
  // 计算耗时
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  
  // 输出统计信息
  console.log('\n' + '='.repeat(60));
  console.log('✅ 恢复完成！');
  console.log('='.repeat(60));
  console.log(`\n📊 恢复统计:`);
  console.log(`  - 总新建记录: ${restoreStats.totalCreated.toLocaleString()}`);
  console.log(`  - 总更新记录: ${restoreStats.totalUpdated.toLocaleString()}`);
  console.log(`  - 失败记录数: ${restoreStats.totalErrors}`);
  console.log(`  - 耗时: ${duration} 秒`);
  
  // 验证关键数据
  console.log(`\n🔍 数据验证:`);
  try {
    const userCount = await prisma.user.count();
    const deptCount = await prisma.department.count();
    console.log(`  - 用户数: ${userCount}`);
    console.log(`  - 部门数: ${deptCount}`);
  } catch (error) {
    console.log(`  ⚠️  验证失败: ${error.message}`);
  }
  
  // 如果有错误，显示详细信息
  if (restoreStats.totalErrors > 0) {
    console.log(`\n⚠️  警告: 有 ${restoreStats.totalErrors} 条记录恢复失败`);
    console.log('请查看上面的错误信息了解详情。');
  }
  
  console.log('\n' + '='.repeat(60) + '\n');
}

// 执行恢复
main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('\n❌ 恢复失败:', error);
    console.error(error.stack);
    await prisma.$disconnect();
    process.exit(1);
  });

