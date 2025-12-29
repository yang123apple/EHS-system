/**
 * 数据保护服务
 * 负责核心数据（组织架构和用户账号）的自动备份和恢复
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

export class DataProtectionService {
  private static instance: DataProtectionService;
  private prisma: PrismaClient;
  private backupInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.prisma = new PrismaClient();
  }

  /**
   * 获取单例实例
   */
  static getInstance(): DataProtectionService {
    if (!DataProtectionService.instance) {
      DataProtectionService.instance = new DataProtectionService();
    }
    return DataProtectionService.instance;
  }

  /**
   * 启动时检查数据完整性并恢复
   */
  async checkAndRestore(): Promise<void> {
    console.log('🔍 检查核心数据完整性...');

    try {
      const deptCount = await this.prisma.department.count();
      const userCount = await this.prisma.user.count();

      console.log(`   - 部门数量: ${deptCount}`);
      console.log(`   - 用户数量: ${userCount}`);

      if (deptCount === 0 || userCount === 0) {
        console.warn('⚠️  检测到核心数据缺失！');
        console.log('🔄 开始自动恢复...');
        await this.autoRestore();
      } else {
        console.log('✅ 核心数据完整');
      }
    } catch (error) {
      console.error('❌ 检查数据完整性失败:', error);
      throw error;
    }
  }

  /**
   * 自动恢复数据
   * 优先级：主JSON文件 > 最新备份
   */
  private async autoRestore(): Promise<void> {
    try {
      // 1. 尝试从主JSON文件恢复
      if (this.hasValidJsonFiles()) {
        console.log('📂 从主JSON文件恢复...');
        const orgPath = path.join(process.cwd(), 'data', 'org.json');
        const usersPath = path.join(process.cwd(), 'data', 'users.json');
        await this.restoreFromJson(orgPath, usersPath);
        console.log('✅ 从主JSON文件恢复成功');
        return;
      }

      // 2. 尝试从最新备份恢复
      const latestBackup = this.getLatestBackup();
      if (latestBackup) {
        console.log(`📂 从备份恢复: ${latestBackup.timestamp}`);
        await this.restoreFromJson(latestBackup.orgPath, latestBackup.usersPath);
        console.log('✅ 从备份恢复成功');
        return;
      }

      // 3. 无可用数据源
      console.error('❌ 无可用的恢复数据源！');
      throw new Error('无法找到有效的备份数据');
    } catch (error) {
      console.error('❌ 自动恢复失败:', error);
      throw error;
    }
  }

  /**
   * 检查主JSON文件是否有效
   */
  private hasValidJsonFiles(): boolean {
    const orgPath = path.join(process.cwd(), 'data', 'org.json');
    const usersPath = path.join(process.cwd(), 'data', 'users.json');

    if (!fs.existsSync(orgPath) || !fs.existsSync(usersPath)) {
      return false;
    }

    try {
      const orgData = JSON.parse(fs.readFileSync(orgPath, 'utf-8'));
      const usersData = JSON.parse(fs.readFileSync(usersPath, 'utf-8'));
      return Array.isArray(orgData) && Array.isArray(usersData) && 
             orgData.length > 0 && usersData.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * 获取最新的备份
   */
  private getLatestBackup(): { orgPath: string; usersPath: string; timestamp: string } | null {
    const backupDir = path.join(process.cwd(), 'data', 'backups');
    
    if (!fs.existsSync(backupDir)) {
      return null;
    }

    const files = fs.readdirSync(backupDir);
    const backupFiles = files.filter(f => f.startsWith('org_') || f.startsWith('users_'));
    
    if (backupFiles.length === 0) {
      return null;
    }

    // 按时间戳排序，获取最新的
    const timestamps = new Set<string>();
    backupFiles.forEach(f => {
      const match = f.match(/_([\d-T:.]+)\.json$/);
      if (match) timestamps.add(match[1]);
    });

    const sortedTimestamps = Array.from(timestamps).sort().reverse();
    const latestTimestamp = sortedTimestamps[0];

    if (!latestTimestamp) {
      return null;
    }

    const orgPath = path.join(backupDir, `org_${latestTimestamp}.json`);
    const usersPath = path.join(backupDir, `users_${latestTimestamp}.json`);

    if (fs.existsSync(orgPath) && fs.existsSync(usersPath)) {
      return { orgPath, usersPath, timestamp: latestTimestamp };
    }

    return null;
  }

  /**
   * 从JSON文件恢复数据到数据库
   */
  private async restoreFromJson(orgPath: string, usersPath: string): Promise<void> {
    try {
      // 读取JSON数据
      const orgData = JSON.parse(fs.readFileSync(orgPath, 'utf-8'));
      const usersData = JSON.parse(fs.readFileSync(usersPath, 'utf-8'));

      console.log(`   - 准备恢复 ${orgData.length} 个部门`);
      console.log(`   - 准备恢复 ${usersData.length} 个用户`);

      // 使用事务恢复数据
      await this.prisma.$transaction(async (tx) => {
        // 恢复部门
        for (const dept of orgData) {
          await tx.department.upsert({
            where: { id: dept.id },
            update: dept,
            create: dept,
          });
        }

        // 恢复用户
        for (const user of usersData) {
          await tx.user.upsert({
            where: { id: user.id },
            update: user,
            create: user,
          });
        }
      });

      console.log('✅ 数据恢复完成');
    } catch (error) {
      console.error('❌ 恢复数据失败:', error);
      throw error;
    }
  }

  /**
   * 启动每日自动备份定时任务
   * 每天凌晨2点执行备份
   */
  async startDailyBackupSchedule(): Promise<void> {
    // 如果已经有定时任务，先清除
    if (this.backupInterval) {
      clearInterval(this.backupInterval);
    }

    // 计算到下一个凌晨2点的时间
    const now = new Date();
    const nextBackup = new Date();
    nextBackup.setHours(2, 0, 0, 0);
    
    // 如果今天的2点已经过了，设置为明天的2点
    if (nextBackup <= now) {
      nextBackup.setDate(nextBackup.getDate() + 1);
    }

    const msUntilNextBackup = nextBackup.getTime() - now.getTime();

    console.log(`   - 首次备份时间: ${nextBackup.toLocaleString('zh-CN')}`);
    console.log(`   - 距离首次备份: ${Math.round(msUntilNextBackup / 1000 / 60)} 分钟`);

    // 设置首次备份
    setTimeout(async () => {
      await this.performDailyBackup();
      
      // 之后每24小时执行一次
      this.backupInterval = setInterval(async () => {
        await this.performDailyBackup();
      }, 24 * 60 * 60 * 1000);
    }, msUntilNextBackup);

    console.log('✅ 每日备份任务已启动');
  }

  /**
   * 执行每日备份
   */
  async performDailyBackup(): Promise<void> {
    console.log('========================================');
    console.log(`🔄 开始执行每日备份 [${new Date().toLocaleString('zh-CN')}]`);
    console.log('========================================');

    try {
      // 调用备份脚本
      const { autoBackup } = require('../../scripts/auto-backup.js');
      await autoBackup();
      
      console.log('✅ 每日备份完成');
      console.log('========================================');
    } catch (error) {
      console.error('❌ 每日备份失败:', error);
      console.error('========================================');
    }
  }

  /**
   * 手动触发备份（供API调用）
   */
  async manualBackup(): Promise<{ success: boolean; message: string }> {
    try {
      await this.performDailyBackup();
      return { success: true, message: '备份成功' };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  /**
   * 获取备份状态
   */
  async getBackupStatus(): Promise<{
    hasMainFiles: boolean;
    latestBackup: string | null;
    backupCount: number;
    databaseStatus: { departments: number; users: number };
  }> {
    const hasMainFiles = this.hasValidJsonFiles();
    const latestBackup = this.getLatestBackup();
    
    const backupDir = path.join(process.cwd(), 'data', 'backups');
    let backupCount = 0;
    if (fs.existsSync(backupDir)) {
      const files = fs.readdirSync(backupDir);
      const timestamps = new Set<string>();
      files.forEach(f => {
        const match = f.match(/_([\d-T:.]+)\.json$/);
        if (match) timestamps.add(match[1]);
      });
      backupCount = timestamps.size;
    }

    const deptCount = await this.prisma.department.count();
    const userCount = await this.prisma.user.count();

    return {
      hasMainFiles,
      latestBackup: latestBackup?.timestamp || null,
      backupCount,
      databaseStatus: {
        departments: deptCount,
        users: userCount,
      },
    };
  }

  /**
   * 清理服务（关闭数据库连接等）
   */
  async cleanup(): Promise<void> {
    if (this.backupInterval) {
      clearInterval(this.backupInterval);
    }
    await this.prisma.$disconnect();
  }
}
