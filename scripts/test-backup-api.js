// scripts/test-backup-api.js
// 测试数据保护 API 端点

const BASE_URL = 'http://localhost:3000';

/**
 * 测试 API 端点
 */
async function testAPIs() {
  console.log('========================================');
  console.log('🧪 测试数据保护 API');
  console.log('========================================\n');

  try {
    // 测试 1: 获取备份列表
    console.log('📋 测试 1: GET /api/data-protection');
    console.log('-'.repeat(40));
    
    const listResponse = await fetch(`${BASE_URL}/api/data-protection`);
    const listData = await listResponse.json();
    
    console.log('状态:', listResponse.status);
    console.log('成功:', listData.success);
    console.log('备份数量:', listData.count || 0);
    
    if (listData.data && listData.data.length > 0) {
      console.log('\n备份文件:');
      listData.data.slice(0, 3).forEach((backup, index) => {
        console.log(`  ${index + 1}. ${backup.filename}`);
        console.log(`     大小: ${backup.sizeMB} MB`);
        console.log(`     时间: ${backup.age}\n`);
      });
    }

    // 测试 2: 获取备份状态
    console.log('\n📊 测试 2: GET /api/data-protection?action=status');
    console.log('-'.repeat(40));
    
    const statusResponse = await fetch(`${BASE_URL}/api/data-protection?action=status`);
    const statusData = await statusResponse.json();
    
    console.log('状态:', statusResponse.status);
    console.log('成功:', statusData.success);
    
    if (statusData.data) {
      console.log('\n统计信息:');
      console.log('  - 备份数量:', statusData.data.backupCount);
      console.log('  - 总大小:', statusData.data.totalSizeMB, 'MB');
      
      if (statusData.data.latestBackup) {
        console.log('  - 最新备份:', statusData.data.latestBackup.filename);
      }
      
      if (statusData.data.databaseStatus) {
        console.log('\n数据库状态:');
        console.log('  - 部门:', statusData.data.databaseStatus.departments);
        console.log('  - 用户:', statusData.data.databaseStatus.users);
      }
    }

    // 测试 3: 验证备份文件
    if (listData.data && listData.data.length > 0) {
      const firstBackup = listData.data[0];
      
      console.log('\n\n🔍 测试 3: POST /api/data-protection/verify');
      console.log('-'.repeat(40));
      
      const verifyResponse = await fetch(`${BASE_URL}/api/data-protection/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filename: firstBackup.filename,
        }),
      });
      
      const verifyData = await verifyResponse.json();
      
      console.log('状态:', verifyResponse.status);
      console.log('成功:', verifyData.success);
      
      if (verifyData.data) {
        console.log('\n验证结果:');
        console.log('  - 有效:', verifyData.data.valid ? '✅' : '❌');
        console.log('  - 消息:', verifyData.data.message);
        
        if (verifyData.data.details) {
          console.log('  - 文件存在:', verifyData.data.details.exists ? '是' : '否');
          console.log('  - 文件大小:', verifyData.data.details.sizeMB, 'MB');
        }
      }

      // 测试 4: 下载备份文件（只测试 URL，不实际下载）
      console.log('\n\n📦 测试 4: GET /api/data-protection/download');
      console.log('-'.repeat(40));
      
      const downloadUrl = `${BASE_URL}/api/data-protection/download?filename=${encodeURIComponent(firstBackup.filename)}`;
      console.log('下载 URL:', downloadUrl);
      
      // HEAD 请求检查文件是否可下载
      const headResponse = await fetch(downloadUrl, { method: 'HEAD' });
      console.log('状态:', headResponse.status);
      console.log('Content-Type:', headResponse.headers.get('Content-Type'));
      console.log('Content-Length:', headResponse.headers.get('Content-Length'));
      console.log('Content-Disposition:', headResponse.headers.get('Content-Disposition'));
      
      if (headResponse.ok) {
        console.log('✅ 文件可以下载');
      } else {
        console.log('❌ 文件无法下载');
      }
    }

    // 测试 5: 安全性测试（路径遍历）
    console.log('\n\n🔐 测试 5: 安全性测试（路径遍历攻击）');
    console.log('-'.repeat(40));
    
    const maliciousFilenames = [
      '../../../etc/passwd',
      '..\\..\\..\\windows\\system32\\config\\sam',
      'full_backup_../../secret.txt',
    ];
    
    for (const maliciousFilename of maliciousFilenames) {
      const testUrl = `${BASE_URL}/api/data-protection/download?filename=${encodeURIComponent(maliciousFilename)}`;
      const testResponse = await fetch(testUrl);
      const testData = await testResponse.json();
      
      console.log(`\n尝试: ${maliciousFilename}`);
      console.log('状态:', testResponse.status);
      console.log('被拦截:', testResponse.status === 400 || testResponse.status === 403 ? '✅' : '❌');
      console.log('消息:', testData.error);
    }

    // 测试 6: 手动备份（可选，会创建新备份）
    const shouldTestBackup = process.argv.includes('--with-backup');
    
    if (shouldTestBackup) {
      console.log('\n\n💾 测试 6: POST /api/data-protection (手动备份)');
      console.log('-'.repeat(40));
      console.log('⚠️  警告: 此操作将创建新的备份文件\n');
      
      const backupResponse = await fetch(`${BASE_URL}/api/data-protection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const backupData = await backupResponse.json();
      
      console.log('状态:', backupResponse.status);
      console.log('成功:', backupData.success);
      console.log('消息:', backupData.message);
      
      if (backupData.backupFile) {
        console.log('备份文件:', backupData.backupFile);
      }
    } else {
      console.log('\n\n💾 测试 6: 跳过手动备份测试');
      console.log('-'.repeat(40));
      console.log('提示: 使用 --with-backup 参数来测试手动备份功能');
    }

    console.log('\n\n========================================');
    console.log('✅ 所有测试完成！');
    console.log('========================================\n');

  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    console.error('\n确保开发服务器正在运行: npm run dev');
    process.exit(1);
  }
}

// 检查服务器是否运行
async function checkServer() {
  try {
    const response = await fetch(BASE_URL);
    return response.ok || response.status === 404; // 404 也表示服务器在运行
  } catch {
    return false;
  }
}

// 主函数
async function main() {
  console.log('🔍 检查开发服务器...\n');
  
  const serverRunning = await checkServer();
  
  if (!serverRunning) {
    console.error('❌ 开发服务器未运行！');
    console.error('请先启动: npm run dev\n');
    process.exit(1);
  }
  
  console.log('✅ 服务器正在运行\n');
  
  await testAPIs();
}

// 运行测试
if (require.main === module) {
  main();
}

module.exports = { testAPIs };
