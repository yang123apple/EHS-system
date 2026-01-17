// src/middleware/auth.ts
/**
 * API 认证和权限中间件
 * 提供统一的用户认证和权限验证功能
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { PermissionManager, PermissionError, User } from '@/lib/permissions';
import { SystemLogService } from '@/services/systemLog.service';
import { logError, extractErrorContext } from '@/utils/errorLogger';

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
        // 解析权限数据，确保格式正确
        let permissions: Record<string, string[]> = {};
        if (user.permissions) {
          try {
            const parsed = typeof user.permissions === 'string' 
              ? JSON.parse(user.permissions as string)
              : user.permissions;
            // 确保解析后的数据是对象格式
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
              permissions = parsed;
            }
          } catch (error) {
            console.error('[Auth Middleware] 解析权限数据失败:', error, '原始数据:', user.permissions);
            permissions = {};
          }
        }
        
        return {
          ...user,
          permissions,
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
 * 要求用户拥有资源操作权限（支持创建人检查）
 * @param req 请求对象
 * @param module 模块名
 * @param permissionBase 权限基础名称（如 'edit_material'）
 * @param getCreatorId 获取资源创建人ID的函数
 * @returns 用户对象或错误响应
 */
export async function requireResourcePermission(
  req: NextRequest,
  module: string,
  permissionBase: string,
  getCreatorId: () => Promise<string | null | undefined>
): Promise<{ user: User } | NextResponse> {
  const authResult = await requireAuth(req);
  
  if (authResult instanceof NextResponse) {
    return authResult;
  }
  
  const { user } = authResult;
  
  // 获取资源创建人ID
  const creatorId = await getCreatorId();
  
  // 检查权限
  if (!PermissionManager.canOperateResource(
    user,
    module,
    permissionBase,
    creatorId,
    user.id
  )) {
    return NextResponse.json(
      { 
        error: '权限不足',
        details: `需要 ${module}.${permissionBase}_self 或 ${module}.${permissionBase}_all 权限`,
        module,
        permissionBase,
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
    // 模块名到 targetType 和 LogModule 的映射
    const moduleToTargetType: Record<string, string> = {
      'hidden_danger': 'hazard',
      'doc_sys': 'document',
      'work_permit': 'permit',
      'training': 'training',
      'archive': 'archive_file',
    };
    
    const moduleToLogModule: Record<string, string> = {
      'hidden_danger': 'HAZARD',
      'doc_sys': 'DOCUMENT',
      'work_permit': 'WORK_PERMIT',
      'training': 'TRAINING',
      'archive': 'ARCHIVE',
    };
    
    const targetType = (moduleToTargetType[module] || module) as any;
    const logModule = moduleToLogModule[module] || 'SYSTEM';
    
    // 操作类型映射（将 action 转换为标准操作类型）
    const actionMap: Record<string, string> = {
      'upload': 'UPLOAD',
      'create': 'CREATE',
      'update': 'UPDATE',
      'delete': 'DELETE',
      'edit': 'UPDATE',
      'remove': 'DELETE',
    };
    
    const standardAction = actionMap[action.toLowerCase()] || action.toUpperCase();
    
    // 操作标签映射
    const actionLabelMap: Record<string, string> = {
      'upload': '上传',
      'create': '创建',
      'update': '更新',
      'delete': '删除',
      'edit': '编辑',
      'remove': '移除',
    };
    
    const actionLabel = actionLabelMap[action.toLowerCase()] || action;
    
    // 从 details 中提取 targetId 和 targetLabel
    // 对于文档，优先使用 fullNum（业务编号），否则使用 documentId
    // 对于作业票，使用 permitId
    const targetId = details?.fullNum || details?.documentId || details?.permitId || details?.targetId || null;
    const targetLabel = details?.fileName || details?.name || details?.targetLabel || null;
    
    // 提取 details 字段（如果存在），否则使用完整的 details 对象转为 JSON
    const detailsText = details?.details || (details ? JSON.stringify({
      ...details,
      userRole: user.role,
      timestamp: new Date().toISOString(),
    }) : null);
    
    // 获取用户部门信息
    // 注意：department 可能是对象（包含 name 属性）或字符串，需要兼容处理
    const userDepartment = (user.department && typeof user.department === 'object' && 'name' in user.department) 
      ? (user.department as any).name 
      : (typeof user.department === 'string' ? user.department : null);
    const userDepartmentId = user.departmentId || null;
    
    await SystemLogService.createLog({
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      userDepartment,
      userDepartmentId,
      userJobTitle: user.jobTitle || null,
      action: standardAction,
      actionLabel: `${actionLabel}${targetType === 'document' ? '文档' : targetType === 'hazard' ? '隐患' : targetType === 'permit' ? '作业票' : targetType === 'archive_file' ? '档案' : ''}`,
      module: logModule,
      targetId,
      targetType,
      targetLabel,
      details: detailsText,
    });
  } catch (error) {
    console.error('[API Log] 记录操作日志失败:', error);
  }
}

/**
 * 包装API处理函数，自动处理认证和权限
 * Next.js 16: context 参数现在是必需的
 */
export function withAuth<T extends { params: Promise<any> } = { params: Promise<{}> }>(
  handler: (req: NextRequest, context: T, user: User) => Promise<NextResponse>
) {
  return async (req: NextRequest, context: T): Promise<NextResponse> => {
    const authResult = await requireAuth(req);
    
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    
    return handler(req, context, authResult.user);
  };
}

/**
 * 包装API处理函数，自动处理权限检查
 * Next.js 16: context 参数现在是必需的
 */
export function withPermission<T extends { params: Promise<any> } = { params: Promise<{}> }>(
  module: string,
  permission: string,
  handler: (req: NextRequest, context: T, user: User) => Promise<NextResponse>
) {
  return async (req: NextRequest, context: T): Promise<NextResponse> => {
    const permResult = await requirePermission(req, module, permission);
    
    if (permResult instanceof NextResponse) {
      return permResult;
    }
    
    return handler(req, context, permResult.user);
  };
}

/**
 * 包装API处理函数，自动处理资源权限检查（支持创建人检查）
 * Next.js 16: context 参数现在是必需的
 * @param module 模块名
 * @param permissionBase 权限基础名称（如 'edit_material'）
 * @param getCreatorId 获取资源创建人ID的函数
 * @param handler API处理函数
 */
export function withResourcePermission<T extends { params: Promise<any> } = { params: Promise<{}> }>(
  module: string,
  permissionBase: string,
  getCreatorId: (req: NextRequest, context: T) => Promise<string | null | undefined>,
  handler: (req: NextRequest, context: T, user: User) => Promise<NextResponse>
) {
  return async (req: NextRequest, context: T): Promise<NextResponse> => {
    const permResult = await requireResourcePermission(
      req,
      module,
      permissionBase,
      () => getCreatorId(req, context)
    );
    
    if (permResult instanceof NextResponse) {
      return permResult;
    }
    
    return handler(req, context, permResult.user);
  };
}

/**
 * 包装API处理函数，要求管理员权限
 * Next.js 16: context 参数现在是必需的
 */
export function withAdmin<T extends { params: Promise<any> } = { params: Promise<{}> }>(
  handler: (req: NextRequest, context: T, user: User) => Promise<NextResponse>
) {
  return async (req: NextRequest, context: T): Promise<NextResponse> => {
    const adminResult = await requireAdmin(req);
    
    if (adminResult instanceof NextResponse) {
      return adminResult;
    }
    
    return handler(req, context, adminResult.user);
  };
}

/**
 * 统一错误处理包装器
 * Next.js 16: context 参数现在是必需的，即使路由没有动态参数，也会包含 params: Promise<{}>
 */
export function withErrorHandling<T extends { params: Promise<any> } = { params: Promise<{}> }>(
  handler: (req: NextRequest, context: T) => Promise<NextResponse>
) {
  return async (req: NextRequest, context: T): Promise<NextResponse> => {
    try {
      return await handler(req, context);
    } catch (error) {
      // ✅ 修复问题10：使用统一的错误日志记录
      try {
        // 尝试从请求中提取用户信息（如果可用）
        const user = await getUserFromRequest(req).catch(() => null);
        const errorContext = await extractErrorContext(req, user || undefined);
        await logError(error, errorContext);
      } catch (logErr) {
        // 如果日志记录失败，至少输出到控制台
        console.error('[ErrorHandler] 记录错误日志失败:', logErr);
      }
      
      // 详细的错误日志（保留原有逻辑用于调试）
      console.error('[API Error] 请求失败:', {
        url: req.url,
        method: req.method,
        error: error instanceof Error ? {
          name: error.name,
          message: error.message,
          stack: error.stack
        } : error
      });
      
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
      
      // 处理 Prisma 错误
      if (error && typeof error === 'object' && 'code' in error) {
        const prismaError = error as any;
        console.error('[Prisma Error]:', {
          code: prismaError.code,
          meta: prismaError.meta,
          message: prismaError.message
        });
        
        return NextResponse.json(
          { 
            error: '数据库操作失败',
            details: prismaError.message || '未知数据库错误',
            code: prismaError.code
          },
          { status: 500 }
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
