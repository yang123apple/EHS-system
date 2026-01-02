// src/services/systemLogService.ts
import { prisma } from '@/lib/prisma';

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
 */
export async function createSystemLog(params: CreateLogParams) {
  try {
    await prisma.systemLog.create({
      data: {
        userId: params.userId || null,
        userName: params.userName || null,
        action: params.action,
        targetId: params.targetId || null,
        targetType: params.targetType || null,
        details: params.details || null,
        snapshot: params.snapshot || null,
        ip: params.ip || null,
      },
    });
  } catch (error) {
    console.error('记录系统日志失败:', error);
    // 不影响主流程，仅记录错误
  }
}

/**
 * 记录用户登录日志
 */
export async function logUserLogin(userId: string, userName: string, ip?: string) {
  return createSystemLog({
    userId,
    userName,
    action: 'login',
    targetType: 'auth',
    details: `用户 ${userName} 登录系统`,
    ip,
  });
}

/**
 * 记录用户退出日志
 */
export async function logUserLogout(userId: string, userName: string, ip?: string) {
  return createSystemLog({
    userId,
    userName,
    action: 'logout',
    targetType: 'auth',
    details: `用户 ${userName} 退出系统`,
    ip,
  });
}

/**
 * 从 Request 对象中获取客户端 IP 地址
 */
export function getClientIP(request: Request): string | undefined {
  // 尝试从各种请求头中获取真实 IP
  const headers = request.headers;
  
  const forwardedFor = headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  
  const realIP = headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }
  
  const cfConnectingIP = headers.get('cf-connecting-ip'); // Cloudflare
  if (cfConnectingIP) {
    return cfConnectingIP;
  }
  
  return undefined;
}
