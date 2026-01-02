/**
 * 应用启动初始化脚本
 * 在服务器启动时执行备份任务调度
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
    // 启动每日备份任务调度
    console.log('⏰ 启动每日自动备份任务...');
    const dataProtection = DataProtectionService.getInstance();
    await dataProtection.startDailyBackupSchedule();

    isInitialized = true;
    console.log('========================================');
    console.log('✅ 应用初始化完成');
    console.log('  • 每日备份任务已启动 (每天凌晨 2:00)');
    console.log('  • WAL 模式已启用');
    console.log('  • 数据保护服务就绪');
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
