// src/utils/logMiddleware.ts
/**
 * API日志记录中间件
 * 自动记录API操作日志
 */

import { NextRequest, NextResponse } from 'next/server';
import { ActivityLogger, Modules } from './activityLogger';

/**
 * 从请求中获取当前用户
 * 需要根据您的认证系统进行调整
 */
async function getCurrentUser(request: NextRequest) {
  // 方法1：从cookie中获取用户信息
  // const session = await getSession(request);
  // return session?.user;

  // 方法2：从自定义header中获取
  const userHeader = request.headers.get('x-user-info');
  if (userHeader) {
    try {
      return JSON.parse(userHeader);
    } catch {
      return null;
    }
  }

  // 方法3：从token中解析
  // const token = request.headers.get('authorization')?.replace('Bearer ', '');
  // return await verifyAndDecodeToken(token);

  return null;
}

/**
 * 日志记录中间件工厂函数
 */
export function withActivityLog(options: {
  module: string;
  targetType: string;
  action: string;
  getTargetId?: (request: NextRequest, body: any) => string | undefined;
  getTargetLabel?: (request: NextRequest, body: any, result: any) => string | undefined;
  getBeforeData?: (request: NextRequest, body: any) => Promise<any>;
  getAfterData?: (request: NextRequest, body: any, result: any) => any;
}) {
  return function <T extends (...args: any[]) => Promise<NextResponse>>(
    handler: T
  ): T {
    return (async (request: NextRequest, ...args: any[]) => {
      const user = await getCurrentUser(request);
      if (!user) {
        // 如果没有用户信息，直接执行原处理器
        return handler(request, ...args);
      }

      let body: any = null;
      try {
        if (request.method !== 'GET') {
          body = await request.json();
        }
      } catch {
        // 无法解析body，继续执行
      }

      // 获取操作前数据（用于UPDATE/DELETE）
      let beforeData: any = undefined;
      if (options.getBeforeData) {
        try {
          beforeData = await options.getBeforeData(request, body);
        } catch (error) {
          console.error('获取操作前数据失败:', error);
        }
      }

      // 执行原处理器
      const response = await handler(request, ...args);

      // 记录日志
      try {
        const responseData = await response.json();
        const targetId = options.getTargetId?.(request, body);
        const targetLabel = options.getTargetLabel?.(request, body, responseData);
        const afterData = options.getAfterData?.(request, body, responseData);

        // 根据操作类型记录不同的日志
        switch (options.action) {
          case 'CREATE':
            await ActivityLogger.logCreate({
              userId: user.id,
              module: options.module,
              targetType: options.targetType,
              targetId: targetId || responseData?.data?.id,
              targetLabel,
              data: afterData || responseData?.data,
              request,
            });
            break;

          case 'UPDATE':
            if (beforeData && afterData) {
              await ActivityLogger.logUpdate({
                userId: user.id,
                module: options.module,
                targetType: options.targetType,
                targetId: targetId!,
                targetLabel,
                beforeData,
                afterData,
                request,
              });
            }
            break;

          case 'DELETE':
            await ActivityLogger.logDelete({
              userId: user.id,
              module: options.module,
              targetType: options.targetType,
              targetId: targetId!,
              targetLabel,
              data: beforeData,
              request,
            });
            break;

          default:
            // 其他操作类型
            await ActivityLogger.logAction({
              userId: user.id,
              action: options.action,
              module: options.module,
              targetType: options.targetType,
              targetId,
              targetLabel,
              beforeData,
              afterData,
              request,
            });
        }

        // 返回响应（重新创建，因为已经读取过了）
        return NextResponse.json(responseData, {
          status: response.status,
          headers: response.headers,
        });
      } catch (error) {
        console.error('记录日志失败:', error);
        // 日志失败不影响主流程，返回原响应
        return response;
      }
    }) as T;
  };
}

/**
 * 简化的日志装饰器
 */
export const LogCreate = (module: string, targetType: string) =>
  withActivityLog({ module, targetType, action: 'CREATE' });

export const LogUpdate = (module: string, targetType: string, getBeforeData: any) =>
  withActivityLog({ module, targetType, action: 'UPDATE', getBeforeData });

export const LogDelete = (module: string, targetType: string, getBeforeData: any) =>
  withActivityLog({ module, targetType, action: 'DELETE', getBeforeData });
