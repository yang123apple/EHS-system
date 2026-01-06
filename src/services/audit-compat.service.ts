/**
 * 日志系统统一兼容层
 * 
 * 将旧的 ActivityLogger 和 SystemLogService API 统一到新的 AuditService
 * 保持向下兼容，同时逐步迁移到新API
 */

import AuditService from '@/services/audit.service';
import { LogModule, LogAction, BusinessRole } from '@/types/audit';
import type { NextRequest } from 'next/server';

/**
 * 旧模块名映射到新模块枚举
 */
const MODULE_MAPPING: Record<string, LogModule> = {
  'hazard': LogModule.HAZARD,
  'document': LogModule.DOCUMENT,
  'permit': LogModule.WORK_PERMIT,
  'training': LogModule.TRAINING,
  'user': LogModule.USER,
  'org': LogModule.ORGANIZATION,
  'config': LogModule.SYSTEM,
  'system': LogModule.SYSTEM,
};

/**
 * 旧操作类型映射到新操作枚举
 */
const ACTION_MAPPING: Record<string, LogAction> = {
  'CREATE': LogAction.CREATE,
  'UPDATE': LogAction.UPDATE,
  'DELETE': LogAction.DELETE,
  'VIEW': LogAction.VIEW,
  'EXPORT': LogAction.EXPORT,
  'IMPORT': LogAction.IMPORT,
  'SUBMIT': LogAction.SUBMIT,
  'APPROVE': LogAction.APPROVE,
  'REJECT': LogAction.REJECT,
  'REPORT': LogAction.CREATE,
  'DISPATCH': LogAction.ASSIGN,
  'RECTIFY': LogAction.SUBMIT,
  'VERIFY': LogAction.APPROVE,
  'CLOSE': LogAction.ARCHIVE,
  'REOPEN': LogAction.RESTORE,
  'LOGIN': LogAction.LOGIN,
  'LOGOUT': LogAction.LOGOUT,
  'CHANGE_PASSWORD': LogAction.UPDATE,
  'DOWNLOAD': LogAction.DOWNLOAD,
  'UPLOAD': LogAction.UPLOAD,
};

/**
 * 旧业务角色映射到新角色枚举
 */
const ROLE_MAPPING: Record<string, BusinessRole> = {
  '上报人': BusinessRole.REPORTER,
  '整改人': BusinessRole.RECTIFIER,
  '验收人': BusinessRole.VERIFIER,
  '审批人': BusinessRole.APPROVER,
  '抄送人': BusinessRole.CC_RECEIVER,
};

/**
 * 转换旧的用户快照格式到新的操作人格式
 */
function convertUserSnapshot(userSnapshot: any) {
  if (!userSnapshot) return undefined;
  
  return {
    id: userSnapshot.id,
    name: userSnapshot.name,
    role: userSnapshot.role,
    departmentId: userSnapshot.departmentId,
    departmentName: userSnapshot.departmentName,
    jobTitle: userSnapshot.jobTitle,
  };
}

/**
 * ActivityLogger 兼容层
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
    const module = MODULE_MAPPING[params.module] || LogModule.SYSTEM;
    const action = LogAction.CREATE;
    
    // 获取用户信息（如果没有提供完整的用户对象）
    const operator = await getUserOperator(params.userId);
    
    return AuditService.recordLog({
      module,
      action,
      businessId: params.targetId,
      targetType: params.targetType,
      targetLabel: params.targetLabel,
      newData: params.data,
      operator,
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
    const module = MODULE_MAPPING[params.module] || LogModule.SYSTEM;
    const action = LogAction.UPDATE;
    const operator = await getUserOperator(params.userId);
    
    return AuditService.recordLog({
      module,
      action,
      businessId: params.targetId,
      targetType: params.targetType,
      targetLabel: params.targetLabel,
      oldData: params.beforeData,
      newData: params.afterData,
      operator,
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
    const module = MODULE_MAPPING[params.module] || LogModule.SYSTEM;
    const operator = await getUserOperator(params.userId);
    
    return AuditService.logDelete({
      module,
      businessId: params.targetId,
      targetType: params.targetType,
      targetLabel: params.targetLabel,
      oldData: params.data,
      operator,
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
    action: string; // 'approve' or 'reject'
    comment?: string;
    roleInAction?: string;
    request?: NextRequest;
  }) {
    const module = MODULE_MAPPING[params.module] || LogModule.SYSTEM;
    const action = params.action === 'approve' ? LogAction.APPROVE : LogAction.REJECT;
    const operator = await getUserOperator(params.userId);
    
    return AuditService.recordLog({
      module,
      action,
      businessId: params.targetId,
      targetType: params.targetType,
      targetLabel: params.targetLabel,
      operator,
      businessRole: params.roleInAction || BusinessRole.APPROVER,
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
    count?: number;
    filters?: any;
    request?: NextRequest;
  }) {
    const module = MODULE_MAPPING[params.module] || LogModule.SYSTEM;
    const operator = await getUserOperator(params.userId);
    
    return AuditService.logExport({
      module,
      targetType: params.targetType,
      operator,
      description: `导出了 ${params.count || 0} 条${params.targetType}数据`,
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
    count: number;
    request?: NextRequest;
  }) {
    const module = MODULE_MAPPING[params.module] || LogModule.SYSTEM;
    const operator = await getUserOperator(params.userId);
    
    return AuditService.recordLog({
      module,
      action: LogAction.IMPORT,
      targetType: params.targetType,
      operator,
      description: `导入了 ${params.count} 条${params.targetType}数据`,
      request: params.request as any,
    });
  }

  /**
   * 记录登录操作
   */
  static async logLogin(params: {
    userId: string;
    userName?: string;
    request?: NextRequest;
  }) {
    const operator = await getUserOperator(params.userId);
    
    return AuditService.logLogin({
      module: LogModule.USER,
      businessId: params.userId,
      targetType: 'user',
      targetLabel: params.userName || operator?.name,
      operator,
      request: params.request as any,
    });
  }

  /**
   * 通用记录方法
   */
  static async logAction(params: {
    userId: string;
    action: string;
    module: string;
    targetType: string;
    targetId?: string;
    targetLabel?: string;
    details?: string;
    data?: any;
    roleInAction?: string;
    request?: NextRequest;
  }) {
    const module = MODULE_MAPPING[params.module] || LogModule.SYSTEM;
    const action = ACTION_MAPPING[params.action] || LogAction.UPDATE;
    const operator = await getUserOperator(params.userId);
    
    return AuditService.recordLog({
      module,
      action,
      businessId: params.targetId,
      targetType: params.targetType,
      targetLabel: params.targetLabel,
      operator,
      businessRole: params.roleInAction,
      description: params.details,
      newData: params.data,
      request: params.request as any,
    });
  }
}

/**
 * systemLogService 兼容层
 */
export async function createSystemLog(params: {
  userId?: string;
  userName?: string;
  action: string;
  targetId?: string;
  targetType?: string;
  details?: string;
  snapshot?: string;
  ip?: string;
}) {
  const action = ACTION_MAPPING[params.action.toUpperCase()] || LogAction.UPDATE;
  
  const operator = params.userId 
    ? await getUserOperator(params.userId)
    : { id: '', name: params.userName || '系统', role: 'system' };
  
  return AuditService.recordLog({
    module: LogModule.SYSTEM,
    action,
    businessId: params.targetId,
    targetType: params.targetType,
    operator,
    description: params.details,
    clientInfo: {
      ip: params.ip,
    },
  });
}

export async function logUserLogin(userId: string, userName: string, ip?: string) {
  const operator = { id: userId, name: userName, role: 'user' };
  
  return AuditService.logLogin({
    module: LogModule.USER,
    businessId: userId,
    targetType: 'user',
    targetLabel: userName,
    operator,
    clientInfo: { ip },
  });
}

export async function logUserLogout(userId: string, userName: string, ip?: string) {
  const operator = { id: userId, name: userName, role: 'user' };
  
  return AuditService.recordLog({
    module: LogModule.USER,
    action: LogAction.LOGOUT,
    businessId: userId,
    targetType: 'user',
    targetLabel: userName,
    operator,
    clientInfo: { ip },
  });
}

// ============ 辅助函数 ============

/**
 * 获取用户操作人信息
 */
async function getUserOperator(userId: string) {
  try {
    // 动态导入避免循环依赖
    const { prisma } = await import('@/lib/prisma');
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { department: true },
    });
    
    if (!user) {
      return { id: userId, name: '未知用户', role: 'user' };
    }
    
    return {
      id: user.id,
      name: user.name,
      role: user.role,
      departmentId: user.departmentId || undefined,
      departmentName: user.department?.name,
      jobTitle: user.jobTitle || undefined,
    };
  } catch (error) {
    console.error('获取用户信息失败:', error);
    return { id: userId, name: '未知用户', role: 'user' };
  }
}

export function getClientIP(request: Request): string | undefined {
  const headers = request.headers;
  
  const forwardedFor = headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  
  const realIP = headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }
  
  return undefined;
}
