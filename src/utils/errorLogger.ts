/**
 * 统一错误日志记录工具
 * 将错误信息写入数据库或文件，包含用户、请求上下文等信息
 */

import { prisma } from '@/lib/prisma';
import AuditService from '@/services/audit.service';
import { LogModule } from '@/types/audit';
import { extractClientInfo } from '@/lib/audit-utils';
import type { NextRequest } from 'next/server';

export interface ErrorLogContext {
  userId?: string;
  userName?: string;
  userRole?: string;
  url?: string;
  method?: string;
  ip?: string;
  userAgent?: string;
  requestBody?: any;
  queryParams?: any;
  stack?: string;
}

/**
 * 记录错误到系统日志
 * @param error 错误对象
 * @param context 错误上下文信息
 */
export async function logError(
  error: Error | unknown,
  context: ErrorLogContext = {}
): Promise<void> {
  try {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    // 记录到系统日志
    await AuditService.recordLog({
      module: LogModule.SYSTEM,
      action: 'ERROR' as any,
      businessId: context.userId,
      targetType: 'error',
      operator: context.userId ? {
        id: context.userId,
        name: context.userName || '未知用户',
        role: (context.userRole || 'user') as any,
      } : undefined,
      description: `错误: ${errorMessage}${context.url ? ` | URL: ${context.url}` : ''}${context.method ? ` | Method: ${context.method}` : ''}`,
      oldData: {
        url: context.url,
        method: context.method,
        queryParams: context.queryParams,
        requestBody: sanitizeRequestBody(context.requestBody),
        stack: errorStack,
      },
      clientInfo: {
        ip: context.ip,
        userAgent: context.userAgent,
      },
    });

    // 同时输出到控制台（用于开发调试）
    console.error('[ErrorLogger] 错误已记录:', {
      error: errorMessage,
      context,
      stack: errorStack,
    });
  } catch (logError) {
    // 如果日志记录失败，至少输出到控制台
    console.error('[ErrorLogger] 记录错误日志失败:', logError);
    console.error('[ErrorLogger] 原始错误:', error);
  }
}

/**
 * 从 NextRequest 提取错误上下文
 * @param request NextRequest 对象
 * @param user 当前用户（可选）
 * @returns 错误上下文
 */
export async function extractErrorContext(
  request: NextRequest,
  user?: { id?: string; name?: string; role?: string }
): Promise<ErrorLogContext> {
  const clientInfo = extractClientInfo(request);

  return {
    userId: user?.id,
    userName: user?.name,
    userRole: user?.role,
    url: request.url,
    method: request.method,
    ip: clientInfo.ip,
    userAgent: clientInfo.userAgent,
  };
}

/**
 * 清洗请求体中的敏感信息
 * @param body 请求体
 * @returns 清洗后的请求体
 */
function sanitizeRequestBody(body: any): any {
  if (!body || typeof body !== 'object') {
    return body;
  }

  const sensitiveFields = [
    'password',
    'passwordHash',
    'oldPassword',
    'newPassword',
    'apiKey',
    'secret',
    'token',
    'accessToken',
    'refreshToken',
    'privateKey',
    'credential',
    'idCard',
    'phone',
    'email',
  ];

  const sanitized = { ...body };

  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '***REDACTED***';
    }
  }

  return sanitized;
}

/**
 * 包装异步函数，自动捕获并记录错误
 * @param fn 异步函数
 * @param context 错误上下文
 * @returns 包装后的函数
 */
export function withErrorLogging<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context?: ErrorLogContext
): T {
  return (async (...args: any[]) => {
    try {
      return await fn(...args);
    } catch (error) {
      await logError(error, context);
      throw error; // 重新抛出错误，让调用者处理
    }
  }) as T;
}
