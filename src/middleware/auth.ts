// src/middleware/auth.ts
/**
 * API 认证和权限中间件
 * 提供统一的用户认证和权限验证功能
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { PermissionManager, PermissionError, User } from '@/lib/permissions';
import { SystemLogService } from '@/services/systemLog.service';

/**
 * 从请求中提取用户信息
 * 支持多种认证方式：
 * 1. Header: x-user-id (临时方案，用于过渡)
 * 2. Cookie: session (未来实现)
 * 3. Header: Authorization Bearer Token (未来实现)
 */
export async function getUserFromRequest(req: NextRequest): Promise<User | null> {
  try {
    // 方式1: 从 Header 获取用户ID (临时方案)
    const userId = req.headers.get('x-user-id');
    if (userId) {
      const user = await prisma.user.findUnique({ 
        where: { id: userId },
        select: {
          id: true,
          username: true,
          name: true,
          role: true,
          permissions: true,
          avatar: true,
          department: true,
          departmentId: true,
          jobTitle: true,
        }
      });
      
      if (user) {
        return {
          ...user,
          permissions: user.permissions ? JSON.parse(user.permissions as string) : {},
        } as User;
      }
    }

    // TODO: 方式2: 从 Cookie 中验证 Session
    // const sessionId = req.cookies.get('session')?.value;
    
    // TODO: 方式3: 从 Authorization Header 验证 JWT
    // const authHeader = req.headers.get('authorization');
    
    return null;
  } catch (error) {
    console.error('[Auth Middleware] 获取用户信息失败:', error);
    return null;
  }
}

/**
 * 要求用户已登录
 * 如果未登录，返回 401 错误
 */
export async function requireAuth(req: NextRequest): Promise<{ user: User } | NextResponse> {
  const user = await getUserFromRequest(req);
  
  if (!user) {
    return NextResponse.json(
      { error: '未授权访问，请先登录' },
      { status: 401 }
    );
  }
  
  return { user };
}

/**
 * 要求用户拥有指定权限
 * 如果无权限，返回 403 错误
 */
export async function requirePermission(
  req: NextRequest,
  module: string,
  permission: string
): Promise<{ user: User } | NextResponse> {
  const authResult = await requireAuth(req);
  
  // 如果认证失败，返回错误响应
  if (authResult instanceof NextResponse) {
    return authResult;
  }
  
  const { user } = authResult;
  
  // 检查权限
  if (!PermissionManager.hasPermission(user, module, permission)) {
    return NextResponse.json(
      { 
        error: '权限不足',
        details: `需要 ${module}.${permission} 权限`,
        module,
        permission,
      },
      { status: 403 }
    );
  }
  
  return { user };
}

/**
 * 要求用户拥有任一权限
 */
export async function requireAnyPermission(
  req: NextRequest,
  module: string,
  permissions: string[]
): Promise<{ user: User } | NextResponse> {
  const authResult = await requireAuth(req);
  
  if (authResult instanceof NextResponse) {
    return authResult;
  }
  
  const { user } = authResult;
  
  if (!PermissionManager.hasAnyPermission(user, module, permissions)) {
    return NextResponse.json(
      { 
        error: '权限不足',
        details: `需要以下任一权限: ${permissions.join(', ')}`,
        module,
        requiredPermissions: permissions,
      },
      { status: 403 }
    );
  }
  
  return { user };
}

/**
 * 要求用户是管理员
 */
export async function requireAdmin(req: NextRequest): Promise<{ user: User } | NextResponse> {
  const authResult = await requireAuth(req);
  
  if (authResult instanceof NextResponse) {
    return authResult;
  }
  
  const { user } = authResult;
  
  if (user.role !== 'admin') {
    return NextResponse.json(
      { error: '需要管理员权限' },
      { status: 403 }
    );
  }
  
  return { user };
}

/**
 * 可选认证：如果有用户信息则返回，没有也不报错
 */
export async function optionalAuth(req: NextRequest): Promise<{ user: User | null }> {
  const user = await getUserFromRequest(req);
  return { user };
}

/**
 * 记录API操作日志（带权限信息）
 */
export async function logApiOperation(
  user: User,
  module: string,
  action: string,
  details?: Record<string, any>
) {
  try {
    await SystemLogService.createLog({
      userId: user.id,
      userName: user.name,
      action: `${module}.${action}`,
      targetType: module as any,
      details: JSON.stringify({
        ...details,
        userRole: user.role,
        timestamp: new Date().toISOString(),
      }),
    });
  } catch (error) {
    console.error('[API Log] 记录操作日志失败:', error);
  }
}

/**
 * 包装API处理函数，自动处理认证和权限
 */
export function withAuth<T = any>(
  handler: (req: NextRequest, context: T, user: User) => Promise<NextResponse>
) {
  return async (req: NextRequest, context?: T): Promise<NextResponse> => {
    const authResult = await requireAuth(req);
    
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    
    return handler(req, context as T, authResult.user);
  };
}

/**
 * 包装API处理函数，自动处理权限检查
 */
export function withPermission<T = any>(
  module: string,
  permission: string,
  handler: (req: NextRequest, context: T, user: User) => Promise<NextResponse>
) {
  return async (req: NextRequest, context?: T): Promise<NextResponse> => {
    const permResult = await requirePermission(req, module, permission);
    
    if (permResult instanceof NextResponse) {
      return permResult;
    }
    
    return handler(req, context as T, permResult.user);
  };
}

/**
 * 包装API处理函数，要求管理员权限
 */
export function withAdmin<T = any>(
  handler: (req: NextRequest, context: T, user: User) => Promise<NextResponse>
) {
  return async (req: NextRequest, context?: T): Promise<NextResponse> => {
    const adminResult = await requireAdmin(req);
    
    if (adminResult instanceof NextResponse) {
      return adminResult;
    }
    
    return handler(req, context as T, adminResult.user);
  };
}

/**
 * 统一错误处理包装器
 */
export function withErrorHandling<T = any>(
  handler: (req: NextRequest, context?: T) => Promise<NextResponse>
) {
  return async (req: NextRequest, context?: T): Promise<NextResponse> => {
    try {
      return await handler(req, context);
    } catch (error) {
      console.error('[API Error]:', error);
      
      // 处理权限错误
      if (error instanceof PermissionError) {
        return NextResponse.json(
          { 
            error: error.message,
            module: error.module,
            permission: error.permission,
          },
          { status: 403 }
        );
      }
      
      // 处理其他错误
      return NextResponse.json(
        { 
          error: '服务器内部错误',
          details: error instanceof Error ? error.message : String(error),
        },
        { status: 500 }
      );
    }
  };
}
