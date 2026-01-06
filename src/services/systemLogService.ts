// src/services/systemLogService.ts
/**
 * ⚠️ 兼容层：保留旧 API，底层统一调用新的 AuditService
 * 
 * 建议新代码直接使用：import AuditService from '@/services/audit.service';
 */
import { createSystemLog as createLog, logUserLogin as loginLog, logUserLogout as logoutLog, getClientIP } from '@/services/audit-compat.service';

export interface CreateLogParams {
  userId?: string;
  userName?: string;
  action: string;
  targetId?: string;
  targetType?: string;
  details?: string;
  snapshot?: string;
  ip?: string;
}

/**
 * 记录系统日志
 * @deprecated 建议使用 AuditService.recordLog()
 */
export async function createSystemLog(params: CreateLogParams) {
  return createLog(params);
}

/**
 * 记录用户登录日志
 * @deprecated 建议使用 AuditService.logLogin()
 */
export async function logUserLogin(userId: string, userName: string, ip?: string) {
  return loginLog(userId, userName, ip);
}

/**
 * 记录用户退出日志
 * @deprecated 建议使用 AuditService.recordLog({ action: LogAction.LOGOUT })
 */
export async function logUserLogout(userId: string, userName: string, ip?: string) {
  return logoutLog(userId, userName, ip);
}

/**
 * 从 Request 对象中获取客户端 IP 地址
 */
export { getClientIP };
