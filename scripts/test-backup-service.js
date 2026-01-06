// scripts/test-backup-service.js
// 测试新的数据保护服务功能

async function testBackupService() {
  console.log('========================================');
  console.log('🧪 测试数据保护服务');
  console.log('========================================\n');

  try {
    // 动态导入（避免编译时问题）
    const { DataProtectionService } = require('../src/services/dataProtection.service.ts');
    const service = DataProtectionService.getInstance();

    // 测试 1: 获取备份列表
    console.log('📋 测试 1: 获取备份列表');
    console.log('-'.repeat(40));
    const backups = await service.getBackupsList();
    console.log(`找到 ${backups.length} 个备份文件:\n`);
    
    backups.forEach((backup, index) => {
      console.log(`  ${index + 1}. ${backup.filename}`);
      console.log(`     大小: ${backup.sizeMB} MB`);
      console.log(`     时间: ${backup.createdAt.toLocaleString('zh-CN')}`);
      console.log(`     年龄: ${backup.age}\n`);
    });

    // 测试 2: 验证最新备份
    if (backups.length > 0) {
      console.log('\n🔍 测试 2: 验证最新备份');
      console.log('-'.repeat(40));
      const latestBackup = backups[0];
      const verification = await service.verifyBackup(latestBackup.filename);
      
      console.log(`文件: ${latestBackup.filename}`);
      console.log(`验证结果: ${verification.valid ? '✅ 有效' : '❌ 无效'}`);
      console.log(`消息: ${verification.message}`);
      
      if (verification.details) {
        console.log(`详情:`);
        console.log(`  - 存在: ${verification.details.exists ? '是' : '否'}`);
        console.log(`  - 大小: ${verification.details.sizeMB} MB`);
        if (verification.details.createdAt) {
          console.log(`  - 创建: ${verification.details.createdAt.toLocaleString('zh-CN')}`);
        }
      }
    }

    // 测试 3: 获取备份状态
    console.log('\n\n📊 测试 3: 获取系统状态');
    console.log('-'.repeat(40));
    const status = await service.getBackupStatus();
    
    console.log('备份统计:');
    console.log(`  - 备份数量: ${status.backupCount}`);
    console.log(`  - 总大小: ${status.totalSizeMB} MB`);
    
    if (status.latestBackup) {
      console.log(`  - 最新备份: ${status.latestBackup.filename}`);
      console.log(`  - 备份时间: ${status.latestBackup.createdAt.toLocaleString('zh-CN')}`);
    }
    
    if (status.oldestBackup) {
      console.log(`  - 最旧备份: ${status.oldestBackup.filename}`);
      console.log(`  - 备份时间: ${status.oldestBackup.createdAt.toLocaleString('zh-CN')}`);
    }
    
    console.log('\n数据库统计:');
    console.log(`  - 部门: ${status.databaseStatus.departments}`);
    console.log(`  - 用户: ${status.databaseStatus.users}`);
    if (status.databaseStatus.hazards !== undefined) {
      console.log(`  - 隐患: ${status.databaseStatus.hazards}`);
    }
    if (status.databaseStatus.trainings !== undefined) {
      console.log(`  - 培训: ${status.databaseStatus.trainings}`);
    }

    // 测试 4: 验证不存在的文件
    console.log('\n\n🔍 测试 4: 验证不存在的文件');
    console.log('-'.repeat(40));
    const invalidVerification = await service.verifyBackup('nonexistent_backup.zip');
    console.log(`验证结果: ${invalidVerification.valid ? '✅ 有效' : '❌ 无效'}`);
    console.log(`消息: ${invalidVerification.message}`);

    console.log('\n\n========================================');
    console.log('✅ 所有测试完成！');
    console.log('========================================\n');

    // 清理
    await service.cleanup();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ 测试失败:', error);
    process.exit(1);
  }
}

// 运行测试
if (require.main === module) {
  testBackupService();
}

module.exports = { testBackupService };
