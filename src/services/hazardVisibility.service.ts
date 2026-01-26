/**
 * 隐患可见性服务
 * 
 * 用途：
 * - 维护 HazardVisibility 表，实现行级安全的高性能查询
 * - 预计算隐患的可见权限关系，支持百万级数据量
 * - 在隐患状态变更时同步更新可见性记录
 * 
 * 性能优化：
 * - 使用扁平化权限表 + 复合索引
 * - 避免运行时复杂的关联查询和权限计算
 * - 查询时直接JOIN可见性表，利用(userId, hazardId)索引
 */

import { prisma } from '@/lib/prisma';
import type { HazardRecord } from '@prisma/client';

export interface VisibilityRole {
  userId: string;
  role: 'creator' | 'executor' | 'cc' | 'responsible' | 'verifier' | 'candidate';
}

/**
 * 计算隐患的所有可见性角色
 * 
 * @param hazard - 隐患记录（包含所有关联字段）
 * @returns 可见性角色列表
 */
export function calculateVisibilityRoles(hazard: {
  reporterId: string;  // ✅ 修复：使用正确的字段名
  currentExecutorId?: string | null; // 新字段名
  dopersonal_ID?: string | null; // 旧字段名（向后兼容）
  ccUsers?: Array<{ userId: string }>;
  responsibleId?: string | null;  // ✅ 修复：使用正确的字段名
  verifierId?: string | null;     // ✅ 修复：使用正确的字段名
  candidateHandlers?: Array<{ userId: string }>;
  historicalHandlerIds?: string | null; // 🟢 新增：历史处理人ID列表（JSON字符串）
  old_personal_ID?: string | null; // 🟢 旧字段（向后兼容）
}): VisibilityRole[] {
  const roles: VisibilityRole[] = [];
  const addedUsers = new Set<string>(); // 去重

  // 1. 创建人（上报人）- 始终可见
  if (hazard.reporterId) {
    roles.push({ userId: hazard.reporterId, role: 'creator' });
    addedUsers.add(`${hazard.reporterId}-creator`);
  }

  // 2. 当前执行人（优先使用新字段名，向后兼容旧字段名）
  const currentExecutorId = hazard.currentExecutorId || hazard.dopersonal_ID;
  if (currentExecutorId) {
    const key = `${currentExecutorId}-executor`;
    if (!addedUsers.has(key)) {
      roles.push({ userId: currentExecutorId, role: 'executor' });
      addedUsers.add(key);
    }
  }

  // 🟢 2.5. 历史处理人（关键修复：确保历史参与人始终可见）
  const historicalIdsJson = hazard.historicalHandlerIds || hazard.old_personal_ID;
  if (historicalIdsJson) {
    try {
      const historicalIds: string[] = JSON.parse(historicalIdsJson);
      if (Array.isArray(historicalIds)) {
        historicalIds.forEach(userId => {
          if (userId) {
            const key = `${userId}-executor`;
            if (!addedUsers.has(key)) {
              roles.push({ userId, role: 'executor' });
              addedUsers.add(key);
            }
          }
        });
      }
    } catch (error) {
      console.warn('[calculateVisibilityRoles] 解析历史处理人ID失败:', error);
    }
  }

  // 3. 抄送人
  if (hazard.ccUsers && hazard.ccUsers.length > 0) {
    hazard.ccUsers.forEach(cc => {
      const key = `${cc.userId}-cc`;
      if (!addedUsers.has(key)) {
        roles.push({ userId: cc.userId, role: 'cc' });
        addedUsers.add(key);
      }
    });
  }

  // 4. 责任人
  if (hazard.responsibleId) {
    const key = `${hazard.responsibleId}-responsible`;
    if (!addedUsers.has(key)) {
      roles.push({ userId: hazard.responsibleId, role: 'responsible' });
      addedUsers.add(key);
    }
  }

  // 5. 验收人
  if (hazard.verifierId) {
    const key = `${hazard.verifierId}-verifier`;
    if (!addedUsers.has(key)) {
      roles.push({ userId: hazard.verifierId, role: 'verifier' });
      addedUsers.add(key);
    }
  }

  // 6. 候选处理人
  if (hazard.candidateHandlers && hazard.candidateHandlers.length > 0) {
    hazard.candidateHandlers.forEach(candidate => {
      const key = `${candidate.userId}-candidate`;
      if (!addedUsers.has(key)) {
        roles.push({ userId: candidate.userId, role: 'candidate' });
        addedUsers.add(key);
      }
    });
  }

  return roles;
}

/**
 * 同步隐患的可见性记录
 * 
 * 策略：
 * 1. 删除旧记录
 * 2. 根据当前状态重新计算可见性
 * 3. 批量插入新记录
 * 
 * ✅ P1修复：支持在已有事务中执行，避免嵌套事务
 * 
 * @param hazardId - 隐患ID
 * @param tx - Prisma事务客户端（可选，用于与其他操作组合）
 */
export async function syncHazardVisibility(
  hazardId: string,
  tx?: any // 使用 any 类型以兼容事务客户端
): Promise<void> {
  const client = tx || prisma;

  // 1. 查询隐患完整数据（包含所有关联）
  // ✅ 修复：使用正确的关系字段名 ccUsersRel 和 candidateHandlersRel
  // 🟢 新增：包含历史处理人ID字段
  const hazard = await client.hazardRecord.findUnique({
    where: { id: hazardId },
    include: {
      ccUsersRel: {
        select: { userId: true }
      },
      candidateHandlersRel: {
        select: { userId: true }
      }
    }
  });

  if (!hazard) {
    throw new Error(`隐患记录不存在: ${hazardId}`);
  }

  // 2. 转换关系数据为 calculateVisibilityRoles 期望的格式
  const ccUsers = hazard.ccUsersRel ? hazard.ccUsersRel.map((cc: { userId: string }) => ({ userId: cc.userId })) : [];
  const candidateHandlers = hazard.candidateHandlersRel ? hazard.candidateHandlersRel.map((ch: { userId: string }) => ({ userId: ch.userId })) : [];

  const hazardForCalculation = {
    reporterId: hazard.reporterId,
    currentExecutorId: hazard.currentExecutorId,
    dopersonal_ID: hazard.dopersonal_ID, // 向后兼容
    ccUsers,
    responsibleId: hazard.responsibleId,
    verifierId: hazard.verifierId,
    candidateHandlers,
    // 🟢 新增：传递历史处理人ID（关键修复）
    historicalHandlerIds: (hazard as any).historicalHandlerIds,
    old_personal_ID: (hazard as any).old_personal_ID
  };

  // 3. 计算可见性角色
  const roles = calculateVisibilityRoles(hazardForCalculation);

  console.log('[syncHazardVisibility] 计算可见性角色:', {
    hazardId,
    totalRoles: roles.length,
    uniqueUsers: new Set(roles.map(r => r.userId)).size,
    roleBreakdown: roles.reduce((acc, r) => {
      acc[r.role] = (acc[r.role] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  });

  // 3. ✅ P1修复：直接在当前事务中执行，不创建嵌套事务
  // 删除旧记录
  await client.hazardVisibility.deleteMany({
    where: { hazardId }
  });

  // 批量插入新记录
  // ✅ 修复：移除 skipDuplicates 参数（Prisma createMany 不支持此参数）
  // 由于已经先删除了所有旧记录，理论上不会有重复数据
  if (roles.length > 0) {
    try {
      await client.hazardVisibility.createMany({
        data: roles.map(r => ({
          hazardId,
          userId: r.userId,
          role: r.role
        }))
      });
      console.log('[syncHazardVisibility] 成功创建可见性记录:', {
        hazardId,
        recordCount: roles.length
      });
    } catch (error: any) {
      // 如果出现唯一约束冲突（P2002），说明有并发问题，记录日志但不抛出错误
      // 因为可见性记录已经存在，不影响功能
      if (error.code === 'P2002') {
        console.warn(`[syncHazardVisibility] 唯一约束冲突（可能由并发导致）: ${hazardId}`, error);
      } else {
        throw error;
      }
    }
  } else {
    console.warn('[syncHazardVisibility] 未计算到任何可见性角色:', {
      hazardId,
      reporterId: hazard.reporterId,
      currentExecutorId: hazard.currentExecutorId,
      responsibleId: hazard.responsibleId,
      verifierId: hazard.verifierId
    });
  }
}

/**
 * 批量同步多个隐患的可见性
 * 
 * 用于：
 * - 系统初始化
 * - 批量数据迁移
 * - 定期维护任务
 * 
 * @param hazardIds - 隐患ID列表
 * @param batchSize - 批次大小（默认100）
 */
export async function batchSyncVisibility(
  hazardIds: string[],
  batchSize: number = 100
): Promise<{ success: number; failed: number; errors: Array<{ id: string; error: string }> }> {
  const result = {
    success: 0,
    failed: 0,
    errors: [] as Array<{ id: string; error: string }>
  };

  // 分批处理
  for (let i = 0; i < hazardIds.length; i += batchSize) {
    const batch = hazardIds.slice(i, i + batchSize);
    
    await Promise.allSettled(
      batch.map(async (id) => {
        try {
          await syncHazardVisibility(id);
          result.success++;
        } catch (error) {
          result.failed++;
          result.errors.push({
            id,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      })
    );
  }

  return result;
}

/**
 * 全量重建可见性表
 * 
 * 警告：此操作耗时，仅用于：
 * - 首次启用可见性表功能
 * - 数据修复场景
 * 
 * @param options - 配置选项
 */
export async function rebuildAllVisibility(options?: {
  where?: any;
  batchSize?: number;
  onProgress?: (processed: number, total: number) => void;
}): Promise<{ total: number; success: number; failed: number }> {
  const { where = {}, batchSize = 100, onProgress } = options || {};

  // 1. 统计总数
  const total = await prisma.hazardRecord.count({
    where: { ...where, deletedAt: null }
  });

  // 2. 分批处理
  let processed = 0;
  let success = 0;
  let failed = 0;

  while (processed < total) {
    const hazards = await prisma.hazardRecord.findMany({
      where: { ...where, deletedAt: null },
      select: { id: true },
      skip: processed,
      take: batchSize,
      orderBy: { createdAt: 'asc' }
    });

    const result = await batchSyncVisibility(
      hazards.map(h => h.id),
      batchSize
    );

    success += result.success;
    failed += result.failed;
    processed += hazards.length;

    if (onProgress) {
      onProgress(processed, total);
    }
  }

  return { total, success, failed };
}

/**
 * 优化的"我的隐患"查询
 * 
 * 性能关键：
 * - 利用 HazardVisibility 的 (userId, hazardId) 索引
 * - 避免复杂的多表JOIN和OR条件
 * - 支持高效分页
 * 
 * ✅ P2修复：管理员跳过可见性检查
 * 
 * @param userId - 用户ID
 * @param options - 查询选项（分页、排序、筛选）
 */
export async function getMyHazards(
  userId: string,
  options?: {
    skip?: number;
    take?: number;
    orderBy?: any;
    where?: any;
    include?: any;
    isAdmin?: boolean; // ✅ P2修复：新增管理员标识
  }
) {
  const { skip = 0, take = 20, orderBy, where = {}, include, isAdmin = false } = options || {};

  // ✅ P2修复：管理员直接查询所有隐患，不使用可见性表
  const whereClause = isAdmin 
    ? { ...where, deletedAt: null }
    : {
        ...where,
        deletedAt: null,
        visibilityRecords: {
          some: { userId } // 普通用户利用索引的高效查询
        }
      };

  // 核心优化：通过可见性表JOIN（或管理员直接查询）
  const hazards = await prisma.hazardRecord.findMany({
    where: whereClause,
    include: include || {
      creator: {
        select: {
          id: true,
          username: true,
          realName: true,
          department: true
        }
      },
      department: {
        select: {
          id: true,
          name: true
        }
      },
      ccUsers: {
        where: { deletedAt: null },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              realName: true
            }
          }
        }
      },
      candidateHandlers: {
        where: { deletedAt: null },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              realName: true
            }
          }
        }
      }
    },
    skip,
    take,
    orderBy: orderBy || { createdAt: 'desc' }
  });

  // 统计总数（同样利用可见性表，管理员跳过）
  const total = await prisma.hazardRecord.count({
    where: whereClause
  });

  return {
    data: hazards,
    total,
    skip,
    take
  };
}

/**
 * 检查用户是否可以查看隐患
 * 
 * 高性能版本：直接查询可见性表
 * 
 * ✅ P2修复：管理员跳过可见性检查
 * 
 * @param userId - 用户ID
 * @param hazardId - 隐患ID
 * @param isAdmin - 是否为管理员（可选）
 */
export async function canUserViewHazard(
  userId: string,
  hazardId: string,
  isAdmin: boolean = false
): Promise<boolean> {
  // ✅ P2修复：管理员直接返回 true
  if (isAdmin) {
    return true;
  }

  const visibility = await prisma.hazardVisibility.findFirst({
    where: {
      userId,
      hazardId
    }
  });

  return !!visibility;
}
