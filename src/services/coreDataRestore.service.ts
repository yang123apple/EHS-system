/**
 * 核心数据恢复服务
 * 从 data/core_data 文件夹恢复 JSON 数据到数据库
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();
const CORE_DATA_DIR = path.join(process.cwd(), 'data', 'core_data');

interface RestoreResult {
  success: boolean;
  message: string;
  restoredFiles: string[];
  errors: string[];
}

export class CoreDataRestoreService {
  /**
   * 检查 admin 用户是否存在
   */
  static async hasAdminUser(): Promise<boolean> {
    try {
      // 先检查数据库表是否存在
      await prisma.$queryRaw`SELECT 1 FROM User LIMIT 1`;
      
      const admin = await prisma.user.findUnique({
        where: { username: 'admin' }
      });
      return !!admin;
    } catch (error: any) {
      // 如果表不存在，返回 false（需要恢复数据）
      if (error.code === 'P2021' || error.message?.includes('does not exist')) {
        console.log('[CoreDataRestore] 数据库表不存在，需要初始化数据库');
        return false;
      }
      console.error('[CoreDataRestore] 检查 admin 用户失败:', error);
      return false;
    }
  }

  /**
   * 读取并解析 JSON 文件
   */
  private static readJsonFile(filePath: string): any {
    try {
      let content = fs.readFileSync(filePath, 'utf-8');
      // 移除 BOM
      if (content.charCodeAt(0) === 0xFEFF) {
        content = content.slice(1);
      }
      return JSON.parse(content);
    } catch (error: any) {
      throw new Error(`读取文件失败 ${filePath}: ${error.message}`);
    }
  }

  /**
   * 恢复用户数据
   */
  private static async restoreUsers(filePath: string): Promise<{ created: number; updated: number }> {
    const users = CoreDataRestoreService.readJsonFile(filePath);
    if (!Array.isArray(users)) {
      throw new Error('用户数据格式错误：应为数组');
    }

    let created = 0;
    let updated = 0;

    for (const userData of users) {
      try {
        // 处理日期字段
        const data: any = {
          id: userData.id,
          username: userData.username,
          name: userData.name,
          password: userData.password,
          role: userData.role || 'user',
          avatar: userData.avatar || '/image/default_avatar.jpg',
          departmentId: userData.departmentId || null,
          jobTitle: userData.jobTitle || null,
          directManagerId: userData.directManagerId || null,
          permissions: userData.permissions || '{}',
          isActive: userData.isActive !== undefined ? userData.isActive : true,
        };

        if (userData.createdAt) {
          data.createdAt = new Date(userData.createdAt);
        }
        if (userData.updatedAt) {
          data.updatedAt = new Date(userData.updatedAt);
        }

        await prisma.user.upsert({
          where: { id: userData.id },
          update: data,
          create: data,
        });

        // 检查是创建还是更新
        const existing = await prisma.user.findUnique({ where: { id: userData.id } });
        if (existing && existing.createdAt.getTime() === data.createdAt?.getTime()) {
          created++;
        } else {
          updated++;
        }
      } catch (error: any) {
        console.warn(`[CoreDataRestore] 恢复用户失败 ${userData.id}: ${error.message}`);
      }
    }

    return { created, updated };
  }

  /**
   * 恢复部门数据
   */
  private static async restoreDepartments(filePath: string): Promise<{ created: number; updated: number }> {
    const departments = CoreDataRestoreService.readJsonFile(filePath);
    if (!Array.isArray(departments)) {
      throw new Error('部门数据格式错误：应为数组');
    }

    // 按 level 排序，确保父部门先创建
    const sortedDepts = departments.sort((a, b) => (a.level || 0) - (b.level || 0));

    let created = 0;
    let updated = 0;

    for (const deptData of sortedDepts) {
      try {
        const data: any = {
          id: deptData.id,
          name: deptData.name,
          parentId: deptData.parentId || null,
          managerId: deptData.managerId || null,
          level: deptData.level || 1,
        };

        if (deptData.createdAt) {
          data.createdAt = new Date(deptData.createdAt);
        }
        if (deptData.updatedAt) {
          data.updatedAt = new Date(deptData.updatedAt);
        }

        await prisma.department.upsert({
          where: { id: deptData.id },
          update: data,
          create: data,
        });

        const existing = await prisma.department.findUnique({ where: { id: deptData.id } });
        if (existing && existing.createdAt.getTime() === data.createdAt?.getTime()) {
          created++;
        } else {
          updated++;
        }
      } catch (error: any) {
        console.warn(`[CoreDataRestore] 恢复部门失败 ${deptData.id}: ${error.message}`);
      }
    }

    return { created, updated };
  }

  /**
   * 恢复文件元数据
   */
  private static async restoreFileMetadata(filePath: string): Promise<{ created: number; updated: number }> {
    const files = CoreDataRestoreService.readJsonFile(filePath);
    if (!Array.isArray(files)) {
      throw new Error('文件元数据格式错误：应为数组');
    }

    let created = 0;
    let updated = 0;

    for (const fileData of files) {
      try {
        const data: any = {
          id: fileData.id,
          fileName: fileData.fileName || fileData.filename || fileData.originalFilename || 'unknown',
          filePath: fileData.filePath,
          fileType: fileData.fileType || fileData.mimeType?.split('/')[1] || 'unknown',
          fileSize: fileData.fileSize || 0,
          md5Hash: fileData.md5Hash || '',
          category: fileData.category || 'other',
          uploaderId: fileData.uploaderId || null,
        };

        if (fileData.createdAt) {
          data.createdAt = new Date(fileData.createdAt);
        }
        if (fileData.updatedAt) {
          data.updatedAt = new Date(fileData.updatedAt);
        }

        // FileMetadata 使用 filePath 作为唯一键
        const whereClause = fileData.filePath 
          ? { filePath: fileData.filePath }
          : { id: fileData.id };
        
        await prisma.fileMetadata.upsert({
          where: whereClause,
          update: data,
          create: data,
        });

        const existing = await prisma.fileMetadata.findUnique({ 
          where: fileData.filePath ? { filePath: fileData.filePath } : { id: fileData.id }
        });
        if (existing && existing.createdAt.getTime() === data.createdAt?.getTime()) {
          created++;
        } else {
          updated++;
        }
      } catch (error: any) {
        console.warn(`[CoreDataRestore] 恢复文件元数据失败 ${fileData.id}: ${error.message}`);
      }
    }

    return { created, updated };
  }

  /**
   * 恢复通知模板
   */
  private static async restoreNotificationTemplates(filePath: string): Promise<{ created: number; updated: number }> {
    const templates = CoreDataRestoreService.readJsonFile(filePath);
    if (!Array.isArray(templates)) {
      throw new Error('通知模板数据格式错误：应为数组');
    }

    let created = 0;
    let updated = 0;

    for (const templateData of templates) {
      try {
        const data: any = {
          id: templateData.id,
          name: templateData.name,
          type: templateData.type,
          title: templateData.title || templateData.subject || '',
          content: templateData.content || '',
          triggerEvent: templateData.triggerEvent || templateData.type || 'system',
          triggerCondition: templateData.triggerCondition ? JSON.stringify(templateData.triggerCondition) : null,
          variables: templateData.variables ? JSON.stringify(templateData.variables) : '[]',
          isActive: templateData.isActive !== undefined ? templateData.isActive : true,
        };

        if (templateData.createdAt) {
          data.createdAt = new Date(templateData.createdAt);
        }
        if (templateData.updatedAt) {
          data.updatedAt = new Date(templateData.updatedAt);
        }

        // NotificationTemplate 使用 name 作为唯一键
        await prisma.notificationTemplate.upsert({
          where: { name: templateData.name },
          update: data,
          create: data,
        });

        const existing = await prisma.notificationTemplate.findUnique({ where: { name: templateData.name } });
        if (existing && existing.createdAt.getTime() === data.createdAt?.getTime()) {
          created++;
        } else {
          updated++;
        }
      } catch (error: any) {
        console.warn(`[CoreDataRestore] 恢复通知模板失败 ${templateData.id}: ${error.message}`);
      }
    }

    return { created, updated };
  }

  /**
   * 恢复系统日志（可选，通常日志不需要恢复）
   */
  private static async restoreSystemLogs(filePath: string): Promise<{ created: number; skipped: number }> {
    const logs = CoreDataRestoreService.readJsonFile(filePath);
    if (!Array.isArray(logs)) {
      throw new Error('系统日志数据格式错误：应为数组');
    }

    let created = 0;
    let skipped = 0;

    // 系统日志通常不需要恢复，但如果有需要可以恢复
    // 这里只恢复最近的日志，避免数据过多
    const recentLogs = logs.slice(-1000); // 只恢复最近1000条

    for (const logData of recentLogs) {
      try {
        const data: any = {
          id: logData.id,
          userId: logData.userId || null,
          userName: logData.userName || 'System',
          action: logData.action,
          actionLabel: logData.actionLabel || logData.action,
          module: logData.module || 'SYSTEM',
          targetType: logData.targetType || null,
          targetId: logData.targetId || null,
          targetLabel: logData.targetLabel || null,
          details: logData.details ? JSON.stringify(logData.details) : null,
          ipAddress: logData.ipAddress || null,
          userAgent: logData.userAgent || null,
          snapshot: logData.snapshot ? JSON.stringify(logData.snapshot) : null,
        };

        if (logData.createdAt) {
          data.createdAt = new Date(logData.createdAt);
        }

        // 检查是否已存在
        const existing = await prisma.systemLog.findUnique({ where: { id: logData.id } });
        if (existing) {
          skipped++;
          continue;
        }

        await prisma.systemLog.create({ data });
        created++;
      } catch (error: any) {
        skipped++;
        console.warn(`[CoreDataRestore] 恢复系统日志失败 ${logData.id}: ${error.message}`);
      }
    }

    return { created, skipped };
  }

  /**
   * 恢复所有核心数据
   */
  static async restoreAll(): Promise<RestoreResult> {
    const result: RestoreResult = {
      success: true,
      message: '',
      restoredFiles: [],
      errors: [],
    };

    // 检查 core_data 目录是否存在
    if (!fs.existsSync(CORE_DATA_DIR)) {
      result.success = false;
      result.message = `核心数据目录不存在: ${CORE_DATA_DIR}`;
      return result;
    }

    console.log('[CoreDataRestore] 开始恢复核心数据...');
    console.log(`[CoreDataRestore] 数据目录: ${CORE_DATA_DIR}`);

    // 定义要恢复的文件映射（直接引用静态方法）
    const restoreMap: Array<{ filename: string; restoreFn: (filePath: string) => Promise<any> }> = [
      { filename: 'department.json', restoreFn: CoreDataRestoreService.restoreDepartments },
      { filename: 'user.json', restoreFn: CoreDataRestoreService.restoreUsers },
      { filename: 'fileMetadata.json', restoreFn: CoreDataRestoreService.restoreFileMetadata },
      { filename: 'notificationTemplate.json', restoreFn: CoreDataRestoreService.restoreNotificationTemplates },
      { filename: 'systemLog.json', restoreFn: CoreDataRestoreService.restoreSystemLogs },
    ];
    
    // 按顺序恢复文件（先恢复部门，再恢复用户，确保外键关系正确）
    for (const { filename, restoreFn } of restoreMap) {
      const filePath = path.join(CORE_DATA_DIR, filename);
      
      if (!fs.existsSync(filePath)) {
        console.log(`[CoreDataRestore] ⚠ 文件不存在，跳过: ${filename}`);
        continue;
      }

      try {
        console.log(`[CoreDataRestore] 正在恢复: ${filename}...`);
        const stats = await restoreFn(filePath);
        result.restoredFiles.push(filename);
        console.log(`[CoreDataRestore] ✅ ${filename} 恢复完成:`, stats);
      } catch (error: any) {
        result.errors.push(`${filename}: ${error.message}`);
        console.error(`[CoreDataRestore] ❌ ${filename} 恢复失败:`, error.message);
        // 打印详细错误信息用于调试
        if (error.stack) {
          console.error(`[CoreDataRestore] 错误堆栈:`, error.stack);
        }
      }
    }

    if (result.errors.length > 0) {
      result.success = false;
      result.message = `部分文件恢复失败: ${result.errors.join('; ')}`;
    } else {
      result.message = `成功恢复 ${result.restoredFiles.length} 个文件`;
    }

    return result;
  }

  /**
   * 清理资源
   */
  static async cleanup(): Promise<void> {
    await prisma.$disconnect();
  }
}
