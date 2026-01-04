// src/services/systemLog.service.ts
import { prisma } from '@/lib/prisma';
import { setStartOfDay, setEndOfDay, extractDatePart, addDays } from '@/utils/dateUtils';

// 字段变更记录
export interface FieldChange {
  field: string;       // 字段名
  fieldLabel?: string; // 字段中文名
  oldValue: any;       // 旧值
  newValue: any;       // 新值
  changeType: 'added' | 'modified' | 'deleted'; // 变更类型
}

// 用户快照信息
export interface UserSnapshot {
  id: string;
  username: string;
  name: string;
  role: string;
  roleLabel?: string;
  departmentId?: string;
  departmentName?: string;
  jobTitle?: string;
}

export interface SystemLogData {
  // 用户身份信息
  userId?: string;
  userName?: string;
  userRole?: string;
  userDepartment?: string;
  userDepartmentId?: string;
  userJobTitle?: string;
  userRoleInAction?: string; // 用户在本次操作中的业务角色（上报人/整改人/验收人/审批人等）
  userSnapshot?: UserSnapshot; // 完整的用户快照，会自动提取到各字段
  
  // 操作信息
  action: string;
  actionLabel?: string;
  module?: string;
  
  // 操作对象
  targetId?: string;
  targetType?: 'hazard' | 'document' | 'permit' | 'config' | 'user' | 'org' | 'training' | 'ai_api_rate_limit' | 'ai_api_call' | 'ai_api_config';
  targetLabel?: string;
  
  // 操作详情
  details?: string;
  beforeData?: any;    // 操作前的数据
  afterData?: any;     // 操作后的数据
  changes?: FieldChange[]; // 字段变更列表
  snapshot?: any;      // 其他快照信息（如流程快照）
  
  // 其他信息
  ip?: string;
  userAgent?: string;
}

export class SystemLogService {
  /**
   * 创建系统日志
   */
  static async createLog(data: SystemLogData) {
    try {
      // 如果提供了userSnapshot，自动提取用户信息
      let userData: any = {};
      if (data.userSnapshot) {
        userData = {
          userId: data.userSnapshot.id,
          userName: data.userSnapshot.name,
          userRole: data.userSnapshot.role,
          userDepartment: data.userSnapshot.departmentName,
          userDepartmentId: data.userSnapshot.departmentId,
          userJobTitle: data.userSnapshot.jobTitle,
          userRoleInAction: data.userRoleInAction,
        };
      } else {
        userData = {
          userId: data.userId,
          userName: data.userName,
          userRole: data.userRole,
          userDepartment: data.userDepartment,
          userDepartmentId: data.userDepartmentId,
          userJobTitle: data.userJobTitle,
          userRoleInAction: data.userRoleInAction,
        };
      }

      const log = await prisma.systemLog.create({
        data: {
          ...userData,
          action: data.action,
          actionLabel: data.actionLabel,
          module: data.module,
          targetId: data.targetId,
          targetType: data.targetType,
          targetLabel: data.targetLabel,
          details: data.details,
          beforeData: data.beforeData ? JSON.stringify(data.beforeData) : null,
          afterData: data.afterData ? JSON.stringify(data.afterData) : null,
          changes: data.changes ? JSON.stringify(data.changes) : null,
          snapshot: data.snapshot ? JSON.stringify(data.snapshot) : null,
          ip: data.ip,
          userAgent: data.userAgent,
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
   * 比较两个对象，生成字段变更列表
   */
  static compareObjects(
    before: Record<string, any>,
    after: Record<string, any>,
    fieldLabels?: Record<string, string>
  ): FieldChange[] {
    const changes: FieldChange[] = [];
    const allKeys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);

    for (const key of allKeys) {
      const oldValue = before?.[key];
      const newValue = after?.[key];

      // 跳过特定字段
      if (['id', 'createdAt', 'updatedAt'].includes(key)) continue;

      // 跳过相同值
      if (JSON.stringify(oldValue) === JSON.stringify(newValue)) continue;

      // 判断变更类型
      let changeType: 'added' | 'modified' | 'deleted';
      if (oldValue === undefined || oldValue === null) {
        changeType = 'added';
      } else if (newValue === undefined || newValue === null) {
        changeType = 'deleted';
      } else {
        changeType = 'modified';
      }

      changes.push({
        field: key,
        fieldLabel: fieldLabels?.[key] || key,
        oldValue,
        newValue,
        changeType,
      });
    }

    return changes;
  }

  /**
   * 获取用户快照（含部门信息）
   */
  static async getUserSnapshot(userId: string): Promise<UserSnapshot | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          department: true,
        },
      });

      if (!user) return null;

      return {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        roleLabel: this.getRoleLabel(user.role),
        departmentId: user.departmentId || undefined,
        departmentName: user.department?.name || undefined,
        jobTitle: user.jobTitle || undefined,
      };
    } catch (error) {
      console.error('获取用户快照失败:', error);
      return null;
    }
  }

  /**
   * 获取角色中文标签
   */
  static getRoleLabel(role: string): string {
    const roleMap: Record<string, string> = {
      admin: '管理员',
      user: '普通用户',
      manager: '管理者',
      viewer: '查看者',
    };
    return roleMap[role] || role;
  }

  /**
   * 批量创建日志（用于批量操作）
   */
  static async createBatchLogs(logs: SystemLogData[]) {
    try {
      const result = await prisma.systemLog.createMany({
        data: logs.map(log => {
          let userData: any = {};
          if (log.userSnapshot) {
            userData = {
              userId: log.userSnapshot.id,
              userName: log.userSnapshot.name,
              userRole: log.userSnapshot.role,
              userDepartment: log.userSnapshot.departmentName,
              userDepartmentId: log.userSnapshot.departmentId,
              userJobTitle: log.userSnapshot.jobTitle,
              userRoleInAction: log.userRoleInAction,
            };
          } else {
            userData = {
              userId: log.userId,
              userName: log.userName,
              userRole: log.userRole,
              userDepartment: log.userDepartment,
              userDepartmentId: log.userDepartmentId,
              userJobTitle: log.userJobTitle,
              userRoleInAction: log.userRoleInAction,
            };
          }

          return {
            ...userData,
            action: log.action,
            actionLabel: log.actionLabel,
            module: log.module,
            targetId: log.targetId,
            targetType: log.targetType,
            targetLabel: log.targetLabel,
            details: log.details,
            beforeData: log.beforeData ? JSON.stringify(log.beforeData) : null,
            afterData: log.afterData ? JSON.stringify(log.afterData) : null,
            changes: log.changes ? JSON.stringify(log.changes) : null,
            snapshot: log.snapshot ? JSON.stringify(log.snapshot) : null,
            ip: log.ip,
            userAgent: log.userAgent,
          };
        }),
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
    module?: string;
    startDate?: string;
    endDate?: string;
    excludeLoginLogs?: boolean; // 是否排除登录日志，默认为 true
  }) {
    const {
      page = 1,
      limit = 50,
      targetType,
      action,
      userId,
      module,
      startDate,
      endDate,
      excludeLoginLogs = true, // 默认排除登录日志
    } = options;

    const skip = (page - 1) * limit;

    // 登录日志的识别方式（新老双轨策略）
    const LOGIN_ACTIONS = ['login', 'logout', 'LOGIN', 'LOGOUT', '用户登录', '用户退出'];
    const AUTH_MODULE = 'AUTH';

    const where: any = {};
    
    // 构建基础筛选条件
    const baseConditions: any[] = [];
    
    if (targetType) {
      baseConditions.push({ targetType: { contains: targetType } });
    }
    if (action) {
      baseConditions.push({ action: { contains: action } });
    }
    if (userId) {
      baseConditions.push({ userId: userId });
    }
    if (module) {
      baseConditions.push({ module: { contains: module } });
    }
    if (startDate || endDate) {
      const dateCondition: any = {};
      // 开始时间设置为当天的 00:00:00，结束时间设置为当天的 23:59:59.999
      if (startDate) dateCondition.gte = setStartOfDay(extractDatePart(startDate));
      if (endDate) dateCondition.lte = setEndOfDay(extractDatePart(endDate));
      baseConditions.push({ createdAt: dateCondition });
    }

    // 排除登录日志：既不是 AUTH 模块，也不包含登录相关动作
    if (excludeLoginLogs) {
      baseConditions.push(
        { module: { not: AUTH_MODULE } },
        { action: { notIn: LOGIN_ACTIONS } }
      );
    }

    // 组合所有条件
    if (baseConditions.length > 0) {
      where.AND = baseConditions;
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
