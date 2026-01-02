// src/utils/activityLogger.ts
/**
 * 用户活动日志记录工具
 * 提供便捷的日志记录方法，自动处理用户快照和数据变更对比
 */

import { SystemLogService, SystemLogData, FieldChange } from '@/services/systemLog.service';
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
 */
export class ActivityLogger {
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
    roleInAction?: string; // 用户在本次操作中的业务角色
    request?: NextRequest;
  }) {
    const userSnapshot = await SystemLogService.getUserSnapshot(params.userId);
    
    await SystemLogService.createLog({
      userSnapshot: userSnapshot || undefined,
      userRoleInAction: params.roleInAction,
      action: ActionTypes.CREATE,
      actionLabel: ActionLabels[ActionTypes.CREATE],
      module: params.module,
      targetType: params.targetType as any,
      targetId: params.targetId,
      targetLabel: params.targetLabel,
      details: `创建了${params.targetLabel || params.targetType}`,
      afterData: params.data,
      ip: params.request ? getClientIp(params.request) : undefined,
      userAgent: params.request ? getUserAgent(params.request) : undefined,
    });
  }

  /**
   * 记录更新操作（自动对比变更）
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
    roleInAction?: string; // 用户在本次操作中的业务角色
    request?: NextRequest;
  }) {
    const userSnapshot = await SystemLogService.getUserSnapshot(params.userId);
    const changes = SystemLogService.compareObjects(
      params.beforeData,
      params.afterData,
      params.fieldLabels
    );

    await SystemLogService.createLog({
      userSnapshot: userSnapshot || undefined,
      userRoleInAction: params.roleInAction,
      action: ActionTypes.UPDATE,
      actionLabel: ActionLabels[ActionTypes.UPDATE],
      module: params.module,
      targetType: params.targetType as any,
      targetId: params.targetId,
      targetLabel: params.targetLabel,
      details: `修改了${params.targetLabel || params.targetType}，变更了${changes.length}个字段`,
      beforeData: params.beforeData,
      afterData: params.afterData,
      changes,
      ip: params.request ? getClientIp(params.request) : undefined,
      userAgent: params.request ? getUserAgent(params.request) : undefined,
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
    roleInAction?: string; // 用户在本次操作中的业务角色
    request?: NextRequest;
  }) {
    const userSnapshot = await SystemLogService.getUserSnapshot(params.userId);
    
    await SystemLogService.createLog({
      userSnapshot: userSnapshot || undefined,
      userRoleInAction: params.roleInAction,
      action: ActionTypes.DELETE,
      actionLabel: ActionLabels[ActionTypes.DELETE],
      module: params.module,
      targetType: params.targetType as any,
      targetId: params.targetId,
      targetLabel: params.targetLabel,
      details: `删除了${params.targetLabel || params.targetType}`,
      beforeData: params.data,
      ip: params.request ? getClientIp(params.request) : undefined,
      userAgent: params.request ? getUserAgent(params.request) : undefined,
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
    roleInAction?: string; // 用户在本次操作中的业务角色（如：审批人/验收人）
    request?: NextRequest;
  }) {
    const userSnapshot = await SystemLogService.getUserSnapshot(params.userId);
    const actionType = params.action === 'APPROVE' ? ActionTypes.APPROVE : ActionTypes.REJECT;
    
    await SystemLogService.createLog({
      userSnapshot: userSnapshot || undefined,
      userRoleInAction: params.roleInAction,
      action: actionType,
      actionLabel: ActionLabels[actionType],
      module: params.module,
      targetType: params.targetType as any,
      targetId: params.targetId,
      targetLabel: params.targetLabel,
      details: `${ActionLabels[actionType]}${params.targetLabel || params.targetType}${params.comment ? `，意见：${params.comment}` : ''}`,
      beforeData: params.beforeStatus ? { status: params.beforeStatus } : undefined,
      afterData: params.afterStatus ? { status: params.afterStatus } : undefined,
      changes: params.beforeStatus && params.afterStatus ? [
        {
          field: 'status',
          fieldLabel: '状态',
          oldValue: params.beforeStatus,
          newValue: params.afterStatus,
          changeType: 'modified',
        }
      ] : undefined,
      ip: params.request ? getClientIp(params.request) : undefined,
      userAgent: params.request ? getUserAgent(params.request) : undefined,
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
    roleInAction?: string; // 用户在本次操作中的业务角色
    request?: NextRequest;
  }) {
    const userSnapshot = await SystemLogService.getUserSnapshot(params.userId);
    
    await SystemLogService.createLog({
      userSnapshot: userSnapshot || undefined,
      userRoleInAction: params.roleInAction,
      action: ActionTypes.EXPORT,
      actionLabel: ActionLabels[ActionTypes.EXPORT],
      module: params.module,
      targetType: params.targetType as any,
      details: `导出${params.description}${params.count ? `，共${params.count}条` : ''}`,
      ip: params.request ? getClientIp(params.request) : undefined,
      userAgent: params.request ? getUserAgent(params.request) : undefined,
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
    count?: number;
    roleInAction?: string; // 用户在本次操作中的业务角色
    request?: NextRequest;
  }) {
    const userSnapshot = await SystemLogService.getUserSnapshot(params.userId);
    
    await SystemLogService.createLog({
      userSnapshot: userSnapshot || undefined,
      userRoleInAction: params.roleInAction,
      action: ActionTypes.IMPORT,
      actionLabel: ActionLabels[ActionTypes.IMPORT],
      module: params.module,
      targetType: params.targetType as any,
      details: `导入${params.description}${params.count ? `，共${params.count}条` : ''}`,
      ip: params.request ? getClientIp(params.request) : undefined,
      userAgent: params.request ? getUserAgent(params.request) : undefined,
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
    const userSnapshot = params.success 
      ? await SystemLogService.getUserSnapshot(params.userId)
      : null;
    
    await SystemLogService.createLog({
      userSnapshot: userSnapshot || undefined,
      userId: params.userId,
      userName: params.userName,
      action: ActionTypes.LOGIN,
      actionLabel: ActionLabels[ActionTypes.LOGIN],
      module: Modules.SYSTEM,
      targetType: 'user',
      details: params.success ? '用户登录成功' : '用户登录失败',
      ip: params.request ? getClientIp(params.request) : undefined,
      userAgent: params.request ? getUserAgent(params.request) : undefined,
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
    targetType?: string;
    targetId?: string;
    targetLabel?: string;
    details?: string;
    beforeData?: any;
    afterData?: any;
    changes?: FieldChange[];
    roleInAction?: string; // 用户在本次操作中的业务角色
    request?: NextRequest;
  }) {
    const userSnapshot = await SystemLogService.getUserSnapshot(params.userId);
    
    await SystemLogService.createLog({
      userSnapshot: userSnapshot || undefined,
      userRoleInAction: params.roleInAction,
      action: params.action,
      actionLabel: params.actionLabel || ActionLabels[params.action] || params.action,
      module: params.module,
      targetType: params.targetType as any,
      targetId: params.targetId,
      targetLabel: params.targetLabel,
      details: params.details,
      beforeData: params.beforeData,
      afterData: params.afterData,
      changes: params.changes,
      ip: params.request ? getClientIp(params.request) : undefined,
      userAgent: params.request ? getUserAgent(params.request) : undefined,
    });
  }
}
