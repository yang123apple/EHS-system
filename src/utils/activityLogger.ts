// src/utils/activityLogger.ts
/**
 * 用户活动日志记录工具
 * 提供便捷的日志记录方法，自动处理用户快照和数据变更对比
 * 
 * ⚠️ 兼容层：保留旧 API，底层统一调用新的 AuditService
 */

import { SystemLogService, SystemLogData, FieldChange } from '@/services/systemLog.service';
import AuditService from '@/services/audit.service';
import { LogModule, LogAction } from '@/types/audit';
import { NextRequest } from 'next/server';

/**
 * 从请求中提取用户信息
 */
export function extractUserFromRequest(request: NextRequest): any {
  // 这里需要根据您的认证系统提取用户信息
  // 假设用户信息存储在请求头或token中
  const userHeader = request.headers.get('x-user-info');
  if (userHeader) {
    try {
      return JSON.parse(userHeader);
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * 从请求中获取IP地址
 */
export function getClientIp(request: NextRequest): string | undefined {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    undefined
  );
}

/**
 * 获取User-Agent
 */
export function getUserAgent(request: NextRequest): string | undefined {
  return request.headers.get('user-agent') || undefined;
}

/**
 * 操作类型常量
 */
export const ActionTypes = {
  // 通用操作
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  VIEW: 'VIEW',
  EXPORT: 'EXPORT',
  IMPORT: 'IMPORT',
  
  // 审批相关
  SUBMIT: 'SUBMIT',
  APPROVE: 'APPROVE',
  REJECT: 'REJECT',
  REVOKE: 'REVOKE',
  
  // 隐患相关
  REPORT: 'REPORT',
  DISPATCH: 'DISPATCH',
  RECTIFY: 'RECTIFY',
  VERIFY: 'VERIFY',
  CLOSE: 'CLOSE',
  REOPEN: 'REOPEN',
  
  // 用户相关
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  CHANGE_PASSWORD: 'CHANGE_PASSWORD',
  
  // 其他
  DOWNLOAD: 'DOWNLOAD',
  UPLOAD: 'UPLOAD',
  SHARE: 'SHARE',
} as const;

/**
 * 操作类型的中文标签
 */
export const ActionLabels: Record<string, string> = {
  CREATE: '新增',
  UPDATE: '修改',
  DELETE: '删除',
  VIEW: '查看',
  EXPORT: '导出',
  IMPORT: '导入',
  SUBMIT: '提交',
  APPROVE: '审批通过',
  REJECT: '审批驳回',
  REVOKE: '撤销',
  REPORT: '上报',
  DISPATCH: '派发',
  RECTIFY: '整改',
  VERIFY: '验证',
  CLOSE: '关闭',
  REOPEN: '重新打开',
  LOGIN: '登录',
  LOGOUT: '退出',
  CHANGE_PASSWORD: '修改密码',
  DOWNLOAD: '下载',
  UPLOAD: '上传',
  SHARE: '分享',
};

/**
 * 模块类型常量
 */
export const Modules = {
  HAZARD: 'hazard',
  DOCUMENT: 'document',
  PERMIT: 'permit',
  TRAINING: 'training',
  USER: 'user',
  ORG: 'org',
  CONFIG: 'config',
  SYSTEM: 'system',
} as const;

/**
 * 活动日志记录器
 * 
 * ⚠️ 兼容层：保留旧 API，底层统一调用新的 AuditService
 * 建议新代码直接使用：import AuditService from '@/services/audit.service';
 */
export class ActivityLogger {
  /**
   * 记录创建操作
   * @deprecated 建议使用 AuditService.logCreate()
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
    const { ActivityLoggerCompat } = await import('@/services/audit-compat.service');
    return ActivityLoggerCompat.logCreate(params);
  }

  /**
   * 记录更新操作（自动对比变更）
   * @deprecated 建议使用 AuditService.logUpdate()
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
    const { ActivityLoggerCompat } = await import('@/services/audit-compat.service');
    return ActivityLoggerCompat.logUpdate(params);
  }

  /**
   * 记录删除操作
   * @deprecated 建议使用 AuditService.logDelete()
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
    const { ActivityLoggerCompat } = await import('@/services/audit-compat.service');
    return ActivityLoggerCompat.logDelete(params);
  }

  /**
   * 记录审批操作
   * @deprecated 建议使用 AuditService.logApprove() 或 AuditService.logReject()
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
    const { ActivityLoggerCompat } = await import('@/services/audit-compat.service');
    return ActivityLoggerCompat.logApproval(params);
  }

  /**
   * 记录导出操作
   * @deprecated 建议使用 AuditService.logExport()
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
    const { ActivityLoggerCompat } = await import('@/services/audit-compat.service');
    return ActivityLoggerCompat.logExport(params);
  }

  /**
   * 记录导入操作
   * @deprecated 建议使用 AuditService.recordLog({ action: LogAction.IMPORT })
   */
  static async logImport(params: {
    userId: string;
    module: string;
    targetType: string;
    description: string;
    count: number; // 改为必填
    roleInAction?: string;
    request?: NextRequest;
  }) {
    const { ActivityLoggerCompat } = await import('@/services/audit-compat.service');
    return ActivityLoggerCompat.logImport(params);
  }

  /**
   * 记录用户登录
   * @deprecated 建议使用 AuditService.logLogin()
   */
  static async logLogin(params: {
    userId: string;
    userName: string;
    success: boolean;
    request?: NextRequest;
  }) {
    const { ActivityLoggerCompat } = await import('@/services/audit-compat.service');
    return ActivityLoggerCompat.logLogin(params);
  }

  /**
   * 记录通用操作
   * @deprecated 建议使用 AuditService.recordLog()
   */
  static async logAction(params: {
    userId: string;
    action: string;
    actionLabel?: string;
    module: string;
    targetType: string; // 改为必填
    targetId?: string;
    targetLabel?: string;
    details?: string;
    beforeData?: any;
    afterData?: any;
    changes?: FieldChange[];
    roleInAction?: string;
    request?: NextRequest;
  }) {
    const { ActivityLoggerCompat } = await import('@/services/audit-compat.service');
    return ActivityLoggerCompat.logAction(params);
  }
}
