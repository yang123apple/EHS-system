/**
 * 审计服务兼容层
 * 
 * 提供向后兼容的API，内部调用新的AuditService
 * 这个文件用于支持旧代码平滑迁移到新的审计系统
 */

import AuditService from './audit.service';
import { LogModule, LogAction } from '@/types/audit';
import type { NextRequest } from 'next/server';

/**
 * ActivityLogger兼容类
 * @deprecated 请使用 AuditService
 */
export class ActivityLoggerCompat {
  /**
   * 记录创建操作
   */
  static async logCreate(params: {
    userId: string;
    module: string;
    targetType: string;
    targetId: string;
    targetLabel?: string;
    data: any;
    roleInAction?: string;
    request?: NextRequest;
  }) {
    return AuditService.logCreate({
      module: params.module.toUpperCase() as LogModule,
      businessId: params.targetId,
      targetType: params.targetType,
      targetLabel: params.targetLabel,
      newData: params.data,
      operator: {
        id: params.userId,
        name: params.data?.userName || 'Unknown',
        role: params.roleInAction || 'user',
      },
      businessRole: params.roleInAction,
      request: params.request as any,
    });
  }

  /**
   * 记录更新操作
   */
  static async logUpdate(params: {
    userId: string;
    module: string;
    targetType: string;
    targetId: string;
    targetLabel?: string;
    beforeData: any;
    afterData: any;
    fieldLabels?: Record<string, string>;
    roleInAction?: string;
    request?: NextRequest;
  }) {
    return AuditService.logUpdate({
      module: params.module.toUpperCase() as LogModule,
      businessId: params.targetId,
      targetType: params.targetType,
      targetLabel: params.targetLabel,
      oldData: params.beforeData,
      newData: params.afterData,
      operator: {
        id: params.userId,
        name: params.afterData?.userName || 'Unknown',
        role: params.roleInAction || 'user',
      },
      businessRole: params.roleInAction,
      request: params.request as any,
    });
  }

  /**
   * 记录删除操作
   */
  static async logDelete(params: {
    userId: string;
    module: string;
    targetType: string;
    targetId: string;
    targetLabel?: string;
    data: any;
    roleInAction?: string;
    request?: NextRequest;
  }) {
    return AuditService.logDelete({
      module: params.module.toUpperCase() as LogModule,
      businessId: params.targetId,
      targetType: params.targetType,
      targetLabel: params.targetLabel,
      oldData: params.data,
      operator: {
        id: params.userId,
        name: params.data?.userName || 'Unknown',
        role: params.roleInAction || 'user',
      },
      businessRole: params.roleInAction,
      request: params.request as any,
    });
  }

  /**
   * 记录审批操作
   */
  static async logApproval(params: {
    userId: string;
    module: string;
    targetType: string;
    targetId: string;
    targetLabel?: string;
    action: 'APPROVE' | 'REJECT';
    comment?: string;
    beforeStatus?: string;
    afterStatus?: string;
    roleInAction?: string;
    request?: NextRequest;
  }) {
    const logAction = params.action === 'APPROVE' ? LogAction.APPROVE : LogAction.REJECT;
    
    return AuditService.recordLog({
      module: params.module.toUpperCase() as LogModule,
      action: logAction,
      businessId: params.targetId,
      targetType: params.targetType,
      targetLabel: params.targetLabel,
      oldData: params.beforeStatus ? { status: params.beforeStatus } : undefined,
      newData: params.afterStatus ? { status: params.afterStatus, comment: params.comment } : undefined,
      operator: {
        id: params.userId,
        name: 'Unknown',
        role: params.roleInAction || 'user',
      },
      businessRole: params.roleInAction,
      description: params.comment,
      request: params.request as any,
    });
  }

  /**
   * 记录导出操作
   */
  static async logExport(params: {
    userId: string;
    module: string;
    targetType: string;
    description: string;
    count?: number;
    roleInAction?: string;
    request?: NextRequest;
  }) {
    return AuditService.logExport({
      module: params.module.toUpperCase() as LogModule,
      targetType: params.targetType,
      description: params.description,
      newData: { count: params.count },
      operator: {
        id: params.userId,
        name: 'Unknown',
        role: params.roleInAction || 'user',
      },
      businessRole: params.roleInAction,
      request: params.request as any,
    });
  }

  /**
   * 记录导入操作
   */
  static async logImport(params: {
    userId: string;
    module: string;
    targetType: string;
    description: string;
    count: number;
    roleInAction?: string;
    request?: NextRequest;
  }) {
    return AuditService.recordLog({
      module: params.module.toUpperCase() as LogModule,
      action: LogAction.IMPORT,
      targetType: params.targetType,
      description: params.description,
      newData: { count: params.count },
      operator: {
        id: params.userId,
        name: 'Unknown',
        role: params.roleInAction || 'user',
      },
      businessRole: params.roleInAction,
      request: params.request as any,
    });
  }

  /**
   * 记录用户登录
   */
  static async logLogin(params: {
    userId: string;
    userName: string;
    success: boolean;
    request?: NextRequest;
  }) {
    return AuditService.logLogin({
      module: LogModule.AUTH,
      businessId: params.userId,
      targetType: 'user',
      targetLabel: params.userName,
      operator: {
        id: params.userId,
        name: params.userName,
        role: 'user',
      },
      description: params.success ? '登录成功' : '登录失败',
      request: params.request as any,
    });
  }

  /**
   * 记录通用操作
   */
  static async logAction(params: {
    userId: string;
    action: string;
    actionLabel?: string;
    module: string;
    targetType: string;
    targetId?: string;
    targetLabel?: string;
    details?: string;
    beforeData?: any;
    afterData?: any;
    changes?: any[];
    roleInAction?: string;
    request?: NextRequest;
  }) {
    return AuditService.recordLog({
      module: params.module.toUpperCase() as LogModule,
      action: params.action as LogAction,
      businessId: params.targetId,
      targetType: params.targetType,
      targetLabel: params.targetLabel,
      oldData: params.beforeData,
      newData: params.afterData,
      operator: {
        id: params.userId,
        name: 'Unknown',
        role: params.roleInAction || 'user',
      },
      businessRole: params.roleInAction,
      description: params.details,
      request: params.request as any,
    });
  }
}

/**
 * 从请求中获取客户端IP
 * @deprecated 请使用 @/utils/requestAdapter 中的 getClientIP
 */
export function getClientIP(request?: Request): string | undefined {
  if (!request) return undefined;
  
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  
  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }
  
  return undefined;
}

/**
 * 记录用户登出
 * @deprecated 请直接使用 AuditService.recordLog
 */
export async function logUserLogout(
  userId: string,
  userName: string,
  clientIP?: string
): Promise<void> {
  await AuditService.recordLog({
    module: LogModule.AUTH,
    action: LogAction.LOGOUT,
    businessId: userId,
    targetType: 'user',
    targetLabel: userName,
    operator: {
      id: userId,
      name: userName,
      role: 'user',
    },
    description: `用户 ${userName} 退出系统`,
    clientInfo: {
      ip: clientIP,
    },
  });
}
