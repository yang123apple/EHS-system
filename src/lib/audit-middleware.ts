/**
 * Prisma 中间件：保护审计日志不可篡改
 * 
 * 拦截对 SystemLog 表的 DELETE 和 UPDATE 操作，确保日志的 Append-only 特性
 */

import { Prisma } from '@prisma/client';

/**
 * 创建日志保护中间件
 * 
 * 使用方法：
 * ```typescript
 * import { prisma } from '@/lib/prisma';
 * import { createAuditLogProtectionMiddleware } from '@/lib/audit-middleware';
 * 
 * prisma.$use(createAuditLogProtectionMiddleware());
 * ```
 */
export function createAuditLogProtectionMiddleware(): Prisma.Middleware {
  return async (params, next) => {
    // 只拦截 SystemLog 模型的操作
    if (params.model === 'SystemLog') {
      // 拦截 DELETE 操作
      if (params.action === 'delete' || params.action === 'deleteMany') {
        throw new Error(
          '🚫 [审计日志保护] SystemLog 表的数据不可删除，这是为了满足审计合规要求。如需清理旧数据，请使用归档功能。'
        );
      }

      // 拦截 UPDATE 操作
      if (params.action === 'update' || params.action === 'updateMany') {
        throw new Error(
          '🚫 [审计日志保护] SystemLog 表的数据不可修改，这是为了满足审计合规要求。日志记录是 Append-only 的。'
        );
      }

      // 拦截 UPSERT 操作
      if (params.action === 'upsert') {
        throw new Error(
          '🚫 [审计日志保护] SystemLog 表不支持 UPSERT 操作，请使用 create 方法。'
        );
      }
    }

    // 允许其他操作通过
    return next(params);
  };
}

/**
 * 日志归档功能（可选实现）
 * 
 * 用于将超过一定时间的日志移动到归档表，而不是直接删除
 */
export async function archiveOldLogs(
  prisma: any,
  beforeDate: Date
): Promise<{ archived: number; error?: string }> {
  try {
    // 注意：由于中间件会拦截 DELETE，这里需要特殊处理
    // 方案1：直接使用原始 SQL（绕过 Prisma）
    // 方案2：临时禁用中间件（不推荐）
    // 方案3：移动到归档表而不是删除

    // 示例：使用原始 SQL 移动到归档表
    const result = await prisma.$executeRaw`
      INSERT INTO SystemLogArchive 
      SELECT * FROM SystemLog 
      WHERE createdAt < ${beforeDate}
    `;

    // 如果需要删除，可以使用原始 SQL（绕过中间件）
    const deleted = await prisma.$executeRaw`
      DELETE FROM SystemLog 
      WHERE createdAt < ${beforeDate}
    `;

    return { archived: deleted };
  } catch (error) {
    console.error('归档日志失败:', error);
    return {
      archived: 0,
      error: error instanceof Error ? error.message : '未知错误',
    };
  }
}

/**
 * 在 prisma 实例上注册中间件
 * 
 * 在 lib/prisma.ts 中使用：
 * ```typescript
 * import { registerAuditProtection } from '@/lib/audit-middleware';
 * 
 * const prisma = new PrismaClient();
 * registerAuditProtection(prisma);
 * ```
 */
export function registerAuditProtection(prisma: any) {
  prisma.$use(createAuditLogProtectionMiddleware());
  console.log('✅ [审计系统] 日志保护中间件已启用');
}
