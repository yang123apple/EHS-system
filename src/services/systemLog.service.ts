// src/services/systemLog.service.ts
import { prisma } from '@/lib/prisma';
import { setStartOfDay, setEndOfDay, extractDatePart, addDays } from '@/utils/dateUtils';

export interface SystemLogData {
  userId?: string;
  userName?: string;
  action: string;
  targetId?: string;
  targetType?: 'hazard' | 'document' | 'permit' | 'config' | 'user' | 'org' | 'training';
  details?: string;
  snapshot?: any; // 流程快照对象，将自动序列化
  ip?: string;
}

export class SystemLogService {
  /**
   * 创建系统日志
   */
  static async createLog(data: SystemLogData) {
    try {
      const log = await prisma.systemLog.create({
        data: {
          userId: data.userId,
          userName: data.userName,
          action: data.action,
          targetId: data.targetId,
          targetType: data.targetType,
          details: data.details,
          snapshot: data.snapshot ? JSON.stringify(data.snapshot) : null,
          ip: data.ip,
        },
      });
      return log;
    } catch (error) {
      console.error('创建系统日志失败:', error);
      // 日志失败不应影响主流程，只记录错误
      return null;
    }
  }

  /**
   * 批量创建日志（用于批量操作）
   */
  static async createBatchLogs(logs: SystemLogData[]) {
    try {
      const result = await prisma.systemLog.createMany({
        data: logs.map(log => ({
          userId: log.userId,
          userName: log.userName,
          action: log.action,
          targetId: log.targetId,
          targetType: log.targetType,
          details: log.details,
          snapshot: log.snapshot ? JSON.stringify(log.snapshot) : null,
          ip: log.ip,
        })),
      });
      return result;
    } catch (error) {
      console.error('批量创建系统日志失败:', error);
      return null;
    }
  }

  /**
   * 获取日志列表（支持分页和筛选）
   */
  static async getLogs(options: {
    page?: number;
    limit?: number;
    targetType?: string;
    action?: string;
    userId?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const {
      page = 1,
      limit = 50,
      targetType,
      action,
      userId,
      startDate,
      endDate,
    } = options;

    const skip = (page - 1) * limit;

    const where: any = {};
    if (targetType) where.targetType = targetType;
    if (action) where.action = { contains: action };
    if (userId) where.userId = userId;
    if (startDate || endDate) {
      where.createdAt = {};
      // 开始时间设置为当天的 00:00:00，结束时间设置为当天的 23:59:59.999
      if (startDate) where.createdAt.gte = setStartOfDay(extractDatePart(startDate));
      if (endDate) where.createdAt.lte = setEndOfDay(extractDatePart(endDate));
    }

    try {
      const [logs, total] = await Promise.all([
        prisma.systemLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.systemLog.count({ where }),
      ]);

      return {
        data: logs,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      console.error('获取系统日志失败:', error);
      throw error;
    }
  }

  /**
   * 删除旧日志（数据清理，保留最近N天）
   */
  static async cleanOldLogs(daysToKeep: number = 90) {
    try {
      const cutoffDate = addDays(new Date(), -daysToKeep);

      const result = await prisma.systemLog.deleteMany({
        where: {
          createdAt: {
            lt: cutoffDate,
          },
        },
      });

      return result;
    } catch (error) {
      console.error('清理旧日志失败:', error);
      throw error;
    }
  }
}

/**
 * 快捷日志记录函数
 */
export const logSystemAction = (data: SystemLogData) => {
  return SystemLogService.createLog(data);
};
