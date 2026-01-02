/**
 * EHS 系统审计日志服务
 * 
 * 统一的日志记录服务，提供类型安全、自动化的审计日志记录功能
 * 
 * @example
 * ```typescript
 * // 记录创建操作
 * await AuditService.recordLog({
 *   module: LogModule.HAZARD,
 *   action: LogAction.CREATE,
 *   businessId: hazard.code,
 *   newData: hazard,
 *   operator: currentUser,
 *   request,
 * });
 * 
 * // 记录更新操作（自动计算 Diff）
 * await AuditService.recordLog({
 *   module: LogModule.HAZARD,
 *   action: LogAction.UPDATE,
 *   businessId: hazard.code,
 *   oldData: oldHazard,
 *   newData: updatedHazard,
 *   operator: currentUser,
 *   request,
 * });
 * ```
 */

import { prisma } from '@/lib/prisma';
import {
  generateSnapshot,
  compareObjects,
  extractClientInfo,
  safeStringify,
} from '@/lib/audit-utils';
import {
  getBusinessCode,
  generateActionDescription,
  generateActionLabel,
} from '@/constants/audit';
import type {
  LogRecordParams,
  LogModule,
  LogAction,
  OperatorInfo,
  ClientInfo,
  DiffResult,
} from '@/types/audit';

/**
 * 审计日志服务类
 */
export class AuditService {
  /**
   * 记录审计日志
   * 
   * 这是核心方法，所有日志记录都应通过此方法完成
   * 
   * @param params 日志记录参数
   * @returns 创建的日志记录，如果失败返回 null
   */
  static async recordLog(params: LogRecordParams): Promise<any | null> {
    try {
      const {
        module,
        action,
        businessCode: customBusinessCode,
        businessId,
        targetType,
        targetLabel,
        targetLink,
        oldData,
        newData,
        operator,
        businessRole,
        request,
        description: customDescription,
        clientInfo: customClientInfo,
      } = params;

      // ========== 1. 计算业务编码 ==========
      let businessCode = customBusinessCode;
      if (!businessCode && module && action) {
        // 尝试从注册表自动获取
        businessCode = getBusinessCode(module, action) || undefined;
      }

      // ========== 2. 生成快照和差异 ==========
      let snapshot: any = null;
      let diff: DiffResult | null = null;

      if (newData) {
        snapshot = generateSnapshot(newData);
      }

      if (oldData && newData) {
        diff = compareObjects(oldData, newData);
      }

      // ========== 3. 提取客户端信息 ==========
      const clientInfo: ClientInfo = {
        ...extractClientInfo(request),
        ...customClientInfo,
      };

      // ========== 4. 生成操作描述 ==========
      let description = customDescription;
      if (!description && operator?.name) {
        description = generateActionDescription(
          operator.name,
          module,
          action,
          targetLabel || businessId
        );
      }

      // ========== 5. 生成操作标签 ==========
      const actionLabel = generateActionLabel(module, action);

      // ========== 6. 构建日志数据 ==========
      const logData: any = {
        // 用户信息
        userId: operator?.id,
        userName: operator?.name,
        userRole: operator?.role,
        userDepartment: operator?.departmentName,
        userDepartmentId: operator?.departmentId,
        userJobTitle: operator?.jobTitle,
        userRoleInAction: businessRole,

        // 操作信息
        module: module as string,
        action: action as string,
        actionLabel,
        businessCode,

        // 操作对象
        targetId: businessId,
        targetType,
        targetLabel,
        targetLink,

        // 审计细节
        snapshot: snapshot ? safeStringify(snapshot) : null,
        diff: diff ? safeStringify(diff) : null,

        // 客户端信息
        clientInfo: safeStringify(clientInfo),

        // 描述
        details: description,

        // 向下兼容字段（保留）
        beforeData: oldData ? safeStringify(oldData) : null,
        afterData: newData ? safeStringify(newData) : null,
        ip: clientInfo.ip,
        userAgent: clientInfo.userAgent,
      };

      // ========== 7. 写入数据库 ==========
      const log = await prisma.systemLog.create({
        data: logData,
      });

      return log;

    } catch (error) {
      // 日志写入失败不应阻断主业务流程
      // 仅在控制台输出错误
      console.error('❌ [AuditService] Failed to record log:', error);
      console.error('   Params:', {
        module: params.module,
        action: params.action,
        businessId: params.businessId,
      });
      
      return null;
    }
  }

  // ========== 便捷方法：常用操作的快捷方式 ==========

  /**
   * 记录创建操作
   */
  static async logCreate(params: Omit<LogRecordParams, 'action'>): Promise<any | null> {
    return this.recordLog({
      ...params,
      action: 'CREATE' as LogAction,
    });
  }

  /**
   * 记录更新操作
   */
  static async logUpdate(params: Omit<LogRecordParams, 'action'>): Promise<any | null> {
    return this.recordLog({
      ...params,
      action: 'UPDATE' as LogAction,
    });
  }

  /**
   * 记录删除操作
   */
  static async logDelete(params: Omit<LogRecordParams, 'action'>): Promise<any | null> {
    return this.recordLog({
      ...params,
      action: 'DELETE' as LogAction,
    });
  }

  /**
   * 记录审批通过操作
   */
  static async logApprove(params: Omit<LogRecordParams, 'action'>): Promise<any | null> {
    return this.recordLog({
      ...params,
      action: 'APPROVE' as LogAction,
    });
  }

  /**
   * 记录审批驳回操作
   */
  static async logReject(params: Omit<LogRecordParams, 'action'>): Promise<any | null> {
    return this.recordLog({
      ...params,
      action: 'REJECT' as LogAction,
    });
  }

  /**
   * 记录分配操作
   */
  static async logAssign(params: Omit<LogRecordParams, 'action'>): Promise<any | null> {
    return this.recordLog({
      ...params,
      action: 'ASSIGN' as LogAction,
    });
  }

  /**
   * 记录导出操作
   */
  static async logExport(params: Omit<LogRecordParams, 'action'>): Promise<any | null> {
    return this.recordLog({
      ...params,
      action: 'EXPORT' as LogAction,
    });
  }

  /**
   * 记录登录操作
   */
  static async logLogin(params: Omit<LogRecordParams, 'action'>): Promise<any | null> {
    return this.recordLog({
      ...params,
      action: 'LOGIN' as LogAction,
    });
  }

  // ========== 查询方法 ==========

  /**
   * 获取特定业务对象的完整操作时间线
   * 
   * @param module 模块
   * @param businessId 业务对象ID
   * @returns 日志列表，按时间降序排列
   */
  static async getBusinessTimeline(
    module: LogModule,
    businessId: string
  ): Promise<any[]> {
    try {
      const logs = await prisma.systemLog.findMany({
        where: {
          module: module as string,
          targetId: businessId,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return logs;
    } catch (error) {
      console.error('❌ [AuditService] Failed to get business timeline:', error);
      return [];
    }
  }

  /**
   * 获取用户的操作历史
   * 
   * @param userId 用户ID
   * @param limit 返回数量限制
   * @returns 日志列表
   */
  static async getUserHistory(
    userId: string,
    limit: number = 50
  ): Promise<any[]> {
    try {
      const logs = await prisma.systemLog.findMany({
        where: {
          userId,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: limit,
      });

      return logs;
    } catch (error) {
      console.error('❌ [AuditService] Failed to get user history:', error);
      return [];
    }
  }

  /**
   * 统计某个模块的操作数量
   * 
   * @param module 模块
   * @param startDate 开始日期（可选）
   * @param endDate 结束日期（可选）
   * @returns 操作数量统计
   */
  static async countByAction(
    module: LogModule,
    startDate?: Date,
    endDate?: Date
  ): Promise<Record<string, number>> {
    try {
      const where: any = {
        module: module as string,
      };

      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = startDate;
        if (endDate) where.createdAt.lte = endDate;
      }

      const logs = await prisma.systemLog.findMany({
        where,
        select: {
          action: true,
        },
      });

      // 统计各操作类型的数量
      const counts: Record<string, number> = {};
      for (const log of logs) {
        counts[log.action] = (counts[log.action] || 0) + 1;
      }

      return counts;
    } catch (error) {
      console.error('❌ [AuditService] Failed to count by action:', error);
      return {};
    }
  }
}

// ========== 导出单例实例（兼容旧代码） ==========
export const auditService = AuditService;

// ========== 默认导出 ==========
export default AuditService;
