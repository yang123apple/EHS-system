/**
 * 应用启动初始化脚本
 * 在服务器启动时执行数据完整性检查和恢复
 */

import { DataProtectionService } from '@/services/dataProtection.service';

let isInitialized = false;

/**
 * 初始化应用程序
 * 在服务器启动时调用一次
 */
export async function initializeApp() {
  // 防止重复初始化
  if (isInitialized) {
    console.log('✓ 应用已初始化，跳过重复初始化');
    return;
  }

  console.log('========================================');
  console.log('🚀 正在初始化应用程序...');
  console.log('========================================');

  try {
    // 1. 检查核心数据完整性
    console.log('📊 检查核心数据完整性...');
    const dataProtection = DataProtectionService.getInstance();
    await dataProtection.checkAndRestore();

    // 2. 启动每日备份任务
    console.log('⏰ 启动每日自动备份任务...');
    await dataProtection.startDailyBackupSchedule();

    isInitialized = true;
    console.log('========================================');
    console.log('✅ 应用初始化完成');
    console.log('========================================');
  } catch (error) {
    console.error('========================================');
    console.error('❌ 应用初始化失败:', error);
    console.error('========================================');
    throw error;
  }
}

/**
 * 获取初始化状态
 */
export function isAppInitialized(): boolean {
  return isInitialized;
}
