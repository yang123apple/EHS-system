/**
 * 备份系统测试脚本
 * 测试各种备份功能是否正常工作
 */

// 使用 Node.js 内置的 fetch（Node.js 18+）
// 如果 Node.js 版本 < 18，需要安装 node-fetch
const fetch = globalThis.fetch || require('node-fetch');

const API_BASE = process.env.API_BASE || 'http://localhost:3000';

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'cyan');
  console.log('='.repeat(60));
}

function logTest(name) {
  log(`\n[测试] ${name}`, 'blue');
}

function logSuccess(message) {
  log(`✓ ${message}`, 'green');
}

function logError(message) {
  log(`✗ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠ ${message}`, 'yellow');
}

/**
 * 测试 API 请求
 */
async function testAPI(endpoint, method = 'GET', body = null) {
  try {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`${API_BASE}${endpoint}`, options);
    const data = await response.json();

    return {
      success: response.ok && data.success !== false,
      status: response.status,
      data: data.data || data,
      error: data.error || (response.ok ? null : '请求失败'),
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * 等待一段时间
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 测试备份状态
 */
async function testBackupStatus() {
  logSection('1. 测试备份状态查询');

  logTest('获取总体备份状态');
  const statusResult = await testAPI('/api/backup');
  
  if (statusResult.success) {
    logSuccess('备份状态查询成功');
    console.log('  调度服务状态:', statusResult.data.scheduler?.running ? '运行中' : '未运行');
    console.log('  数据库备份:', statusResult.data.database ? '已配置' : '未配置');
    console.log('  文件备份:', statusResult.data.files ? '已配置' : '未配置');
    console.log('  日志归档:', statusResult.data.logs ? '已配置' : '未配置');
  } else {
    logError(`备份状态查询失败: ${statusResult.error}`);
    return false;
  }

  logTest('获取数据库备份状态');
  const dbStatusResult = await testAPI('/api/backup?type=database');
  if (dbStatusResult.success) {
    logSuccess('数据库备份状态查询成功');
    if (dbStatusResult.data.database) {
      const db = dbStatusResult.data.database;
      console.log('  全量备份数量:', db.fullBackups?.count || 0);
      console.log('  增量备份数量:', db.incrementalBackups?.count || 0);
      console.log('  最新全量备份:', db.fullBackups?.latest || '无');
      console.log('  最新增量备份:', db.incrementalBackups?.latest || '无');
    }
  } else {
    logWarning(`数据库备份状态查询失败: ${dbStatusResult.error}`);
  }

  logTest('获取文件备份状态');
  const fileStatusResult = await testAPI('/api/backup?type=files');
  if (fileStatusResult.success) {
    logSuccess('文件备份状态查询成功');
    if (fileStatusResult.data.files) {
      const files = fileStatusResult.data.files;
      console.log('  全量备份数量:', files.fullBackups?.count || 0);
      console.log('  增量备份数量:', files.incrementalBackups?.count || 0);
      console.log('  最新全量备份:', files.fullBackups?.latest || '无');
      console.log('  最新增量备份:', files.incrementalBackups?.latest || '无');
    }
  } else {
    logWarning(`文件备份状态查询失败: ${fileStatusResult.error}`);
  }

  logTest('获取日志归档状态');
  const logStatusResult = await testAPI('/api/backup?type=logs');
  if (logStatusResult.success) {
    logSuccess('日志归档状态查询成功');
    if (logStatusResult.data.logs) {
      const logs = logStatusResult.data.logs;
      console.log('  归档数量:', logs.archives?.count || 0);
      console.log('  最新归档:', logs.archives?.latest || '无');
    }
  } else {
    logWarning(`日志归档状态查询失败: ${logStatusResult.error}`);
  }

  return true;
}

/**
 * 测试一键全量备份
 */
async function testFullBackupAll() {
  logSection('2. 测试一键全量备份');

  logTest('触发一键全量备份（数据库全量 + 文件全量 + 日志归档）');
  const result = await testAPI('/api/backup', 'POST', {
    action: 'full-backup-all',
  });

  if (result.success) {
    logSuccess('一键全量备份已触发');
    if (result.data.details) {
      console.log('  数据库备份:', result.data.details.database?.success ? '✓' : '✗', result.data.details.database?.message || '');
      console.log('  文件备份:', result.data.details.files?.success ? '✓' : '✗', result.data.details.files?.message || '');
      console.log('  日志归档:', result.data.details.logs?.success ? '✓' : '✗', result.data.details.logs?.message || '');
    }
    
    logWarning('等待备份任务完成（10秒）...');
    await sleep(10000);
    
    return true;
  } else {
    logError(`一键全量备份失败: ${result.error}`);
    return false;
  }
}

/**
 * 测试数据库备份
 */
async function testDatabaseBackup() {
  logSection('3. 测试数据库备份');

  logTest('触发数据库全量备份');
  const fullResult = await testAPI('/api/backup', 'POST', {
    action: 'database-full',
  });

  if (fullResult.success) {
    logSuccess('数据库全量备份已触发');
    logWarning('等待备份完成（5秒）...');
    await sleep(5000);
  } else {
    logError(`数据库全量备份失败: ${fullResult.error}`);
  }

  logTest('触发数据库增量备份');
  const incResult = await testAPI('/api/backup', 'POST', {
    action: 'database-incremental',
  });

  if (incResult.success) {
    if (incResult.data.message === '无需更新备份') {
      logWarning(`数据库增量备份: ${incResult.data.message}`);
      console.log('  原因:', incResult.data.reason || '无新数据');
    } else {
      logSuccess('数据库增量备份已触发');
      logWarning('等待备份完成（5秒）...');
      await sleep(5000);
    }
  } else {
    logError(`数据库增量备份失败: ${incResult.error}`);
  }

  return true;
}

/**
 * 测试文件备份
 */
async function testFileBackup() {
  logSection('4. 测试文件备份');

  logTest('触发文件全量备份');
  const fullResult = await testAPI('/api/backup', 'POST', {
    action: 'file-full',
  });

  if (fullResult.success) {
    logSuccess('文件全量备份已触发');
    logWarning('等待备份完成（5秒）...');
    await sleep(5000);
  } else {
    logError(`文件全量备份失败: ${fullResult.error}`);
  }

  logTest('触发文件增量备份');
  const incResult = await testAPI('/api/backup', 'POST', {
    action: 'file-incremental',
  });

  if (incResult.success) {
    if (incResult.data.message === '无需更新备份') {
      logWarning(`文件增量备份: ${incResult.data.message}`);
      console.log('  原因:', incResult.data.reason || '无新文件');
    } else {
      logSuccess('文件增量备份已触发');
      console.log('  备份文件数:', incResult.data.filesCount || 0);
      console.log('  备份大小:', incResult.data.sizeMB ? `${incResult.data.sizeMB} MB` : '未知');
      logWarning('等待备份完成（5秒）...');
      await sleep(5000);
    }
  } else {
    logError(`文件增量备份失败: ${incResult.error}`);
  }

  return true;
}

/**
 * 测试日志归档
 */
async function testLogArchive() {
  logSection('5. 测试日志归档');

  logTest('触发日志归档');
  const result = await testAPI('/api/backup', 'POST', {
    action: 'log-archive',
  });

  if (result.success) {
    logSuccess('日志归档已触发');
    logWarning('等待归档完成（5秒）...');
    await sleep(5000);
  } else {
    logError(`日志归档失败: ${result.error}`);
    return false;
  }

  return true;
}

/**
 * 测试备份调度服务
 */
async function testScheduler() {
  logSection('6. 测试备份调度服务');

  logTest('检查调度服务状态');
  const statusResult = await testAPI('/api/backup');
  
  if (statusResult.success && statusResult.data.scheduler) {
    const scheduler = statusResult.data.scheduler;
    logSuccess('调度服务状态查询成功');
    console.log('  运行状态:', scheduler.running ? '运行中' : '未运行');
    console.log('  下次数据库全量备份:', scheduler.nextDatabaseFullBackup || '未计划');
    console.log('  下次文件全量备份:', scheduler.nextFileFullBackup || '未计划');
    console.log('  下次数据库增量备份:', scheduler.nextDatabaseIncrementalBackup || '未计划');
    console.log('  下次日志归档:', scheduler.nextLogArchive || '未计划');
  } else {
    logError('调度服务状态查询失败');
    return false;
  }

  return true;
}

/**
 * 主测试函数
 */
async function main() {
  console.log('\n');
  log('╔═══════════════════════════════════════════════════════════╗', 'cyan');
  log('║           备份系统功能测试                               ║', 'cyan');
  log('╚═══════════════════════════════════════════════════════════╝', 'cyan');
  console.log(`\nAPI 地址: ${API_BASE}\n`);

  const results = {
    status: false,
    fullBackup: false,
    database: false,
    files: false,
    logs: false,
    scheduler: false,
  };

  try {
    // 1. 测试备份状态
    results.status = await testBackupStatus();

    // 2. 测试一键全量备份
    results.fullBackup = await testFullBackupAll();

    // 3. 测试数据库备份
    results.database = await testDatabaseBackup();

    // 4. 测试文件备份
    results.files = await testFileBackup();

    // 5. 测试日志归档
    results.logs = await testLogArchive();

    // 6. 测试调度服务
    results.scheduler = await testScheduler();

  } catch (error) {
    logError(`测试过程中发生错误: ${error.message}`);
    console.error(error);
  }

  // 输出测试总结
  logSection('测试总结');
  
  const allPassed = Object.values(results).every(r => r === true);
  
  console.log('测试结果:');
  console.log(`  ${results.status ? '✓' : '✗'} 备份状态查询`);
  console.log(`  ${results.fullBackup ? '✓' : '✗'} 一键全量备份`);
  console.log(`  ${results.database ? '✓' : '✗'} 数据库备份`);
  console.log(`  ${results.files ? '✓' : '✗'} 文件备份`);
  console.log(`  ${results.logs ? '✓' : '✗'} 日志归档`);
  console.log(`  ${results.scheduler ? '✓' : '✗'} 调度服务`);

  console.log('\n');
  if (allPassed) {
    log('✓ 所有测试通过！', 'green');
  } else {
    log('✗ 部分测试失败，请检查上述错误信息', 'red');
  }
  console.log('\n');
}

// 运行测试
main().catch(error => {
  logError(`测试失败: ${error.message}`);
  console.error(error);
  process.exit(1);
});

