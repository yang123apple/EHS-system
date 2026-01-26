// src/app/api/hazards/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/mockDb';
import { HazardRecord } from '@/types/hidden-danger';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

// Prisma 类型定义 - 包含关联数据
type PrismaHazardWithRelations = Prisma.HazardRecordGetPayload<{
  include: {
    reporter: true;
    responsible: {
      include: {
        department: true;
      };
    };
  };
}>;

// 基础类型（不包含关联数据）
type PrismaHazardRecord = Prisma.HazardRecordGetPayload<{}>;
import { withErrorHandling, withAuth, withPermission, logApiOperation } from '@/middleware/auth';
import { setEndOfDay, extractDatePart, normalizeDate } from '@/utils/dateUtils';
import { safeJsonParse, safeJsonParseArray } from '@/utils/jsonUtils';
import { maskUserSensitiveFields } from '@/utils/dataMasking';
import { logError, extractErrorContext } from '@/utils/errorLogger';
import { canViewHazard } from '@/app/hidden-danger/_utils/permissions';
import { syncHazardVisibility } from '@/services/hazardVisibility.service';

// 辅助：生成变更描述
const generateChanges = (oldData: HazardRecord, newData: Partial<HazardRecord>) => {
  const changes: string[] = [];
  if (newData.status && newData.status !== oldData.status) {
    changes.push(`状态变更: ${oldData.status} -> ${newData.status}`);
  }
  if (newData.deadline && newData.deadline !== oldData.deadline) {
    changes.push(`截止日期: ${oldData.deadline} -> ${newData.deadline}`);
  }
  if (newData.responsibleName && newData.responsibleName !== oldData.responsibleName) {
    changes.push(`责任人: ${oldData.responsibleName || '无'} -> ${newData.responsibleName}`);
  }
  return changes.join('; ');
};

/**
 * 🔒 生成隐患编号（后端生成，确保唯一性）
 * 格式：Hazard + YYYYMMDD + 序号（3位，从001开始）
 * 例如：Hazard20250112001
 */
async function generateHazardCode(): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;
  const prefix = `Hazard${dateStr}`;

  // 查询当天已存在的最大编号
  const todayStart = new Date(year, now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  // 查找当天所有以prefix开头的编号
  const existingRecords = await prisma.hazardRecord.findMany({
    where: {
      code: {
        startsWith: prefix
      },
      createdAt: {
        gte: todayStart,
        lt: todayEnd
      }
    },
    select: { code: true },
    orderBy: { code: 'desc' }
  });

  // 计算最大序号
  let maxSeq = 0;
  for (const record of existingRecords) {
    if (record.code) {
      // 提取编号中的序号部分（最后3位）
      const seqStr = record.code.slice(-3);
      const seq = parseInt(seqStr, 10);
      if (!isNaN(seq) && seq > maxSeq) {
        maxSeq = seq;
      }
    }
  }

  // 生成新序号（最大序号+1）
  const newSeq = String(maxSeq + 1).padStart(3, '0');
  const newCode = `${prefix}${newSeq}`;

  // 双重检查：确保编号唯一（防止并发）
  const existing = await prisma.hazardRecord.findUnique({
    where: { code: newCode }
  });

  if (existing) {
    // 如果编号已存在，继续递增查找可用编号
    let seq = maxSeq + 1;
    while (seq < 999) {
      seq++;
      const testCode = `${prefix}${String(seq).padStart(3, '0')}`;
      const testExisting = await prisma.hazardRecord.findUnique({
        where: { code: testCode }
      });
      if (!testExisting) {
        console.log(`✅ [编号生成] 发现冲突，使用新编号: ${testCode}`);
        return testCode;
      }
    }
    // 如果999个编号都用完了，使用时间戳后缀
    const timestamp = Date.now().toString().slice(-3);
    return `${prefix}${timestamp}`;
  }

  return newCode;
}

// 转换 Prisma HazardRecord 到前端 HazardRecord 类型
async function mapHazard(pHazard: PrismaHazardWithRelations | PrismaHazardRecord): Promise<HazardRecord> {
  try {
    // ✅ 修复问题9：使用统一的 safeJsonParse 替代直接 JSON.parse
    const parseJsonField = (field: string | null): string[] => {
      return safeJsonParseArray(field);
    };

    // 🟢 从关联表读取抄送用户（如果关联表查询失败，回退到 JSON 字段）
    let ccUserIds: string[] = [];
    let ccUserNames: string[] = [];
    try {
      const { getCCUsers } = await import('@/services/hazardCC.service');
      const ccUsersRel = await getCCUsers(pHazard.id);
      ccUserIds = ccUsersRel.map(u => u.userId);
      ccUserNames = ccUsersRel.map(u => u.userName || '').filter(Boolean);
    } catch (error) {
      console.warn('[mapHazard] 关联表查询失败，使用 JSON 字段:', error);
      // 回退到 JSON 字段
      ccUserIds = parseJsonField(pHazard.ccUsers);
    }

    // 🟢 从关联表读取候选处理人（当前步骤）（如果关联表查询失败，回退到 JSON 字段）
    let candidateHandlers: Array<{ userId: string; userName: string; hasOperated: boolean }> | undefined = undefined;
    try {
      const { getCandidateHandlers } = await import('@/services/hazardCandidateHandler.service');
      const stepIndex = pHazard.currentStepIndex ?? 0;
      const candidateHandlersRel = await getCandidateHandlers(pHazard.id, stepIndex);
      if (candidateHandlersRel.length > 0) {
        candidateHandlers = candidateHandlersRel.map(ch => ({
          userId: ch.userId,
          userName: ch.userName,
          hasOperated: ch.hasOperated
        }));
      }
    } catch (error) {
      console.warn('[mapHazard] 关联表查询失败，使用 JSON 字段:', error);
      // 回退到 JSON 字段
      if (pHazard.candidateHandlers) {
        // ✅ 修复问题9：使用 safeJsonParse
        const parsed = safeJsonParseArray<{ userId: string; userName: string; hasOperated: boolean }>(pHazard.candidateHandlers);
        candidateHandlers = parsed.length > 0 ? parsed : undefined;
      }
    }

    return {
      id: pHazard.id,
      code: pHazard.code,
      status: pHazard.status,
      riskLevel: pHazard.riskLevel,
      type: pHazard.type,
      location: pHazard.location,
      desc: pHazard.desc,
      checkType: (pHazard as any).checkType ?? undefined,
      rectificationType: (pHazard as any).rectificationType ?? undefined,
      reporterId: pHazard.reporterId,
      reporterName: pHazard.reporterName,
      // 🟢 新增：上报人部门ID（用于处理人匹配，如"上报人主管"策略）
      reporterDepartmentId: ('reporter' in pHazard && pHazard.reporter?.departmentId) ?? undefined,
      responsibleId: pHazard.responsibleId ?? undefined,
      responsibleName: pHazard.responsibleName ?? undefined,
      // ✅ 优先从关联的User.department获取部门名称，回退到responsibleDept字段
      responsibleDept: ('responsible' in pHazard && pHazard.responsible?.department?.name) ?? pHazard.responsibleDept ?? undefined,
      responsibleDeptName: ('responsible' in pHazard && pHazard.responsible?.department?.name) ?? pHazard.responsibleDept ?? undefined,
      // 🟢 新增：责任部门ID（用于处理人匹配，确保与流程预览一致）
      responsibleDeptId: ('responsible' in pHazard && pHazard.responsible?.departmentId) ?? undefined,
      // 🟢 新增：指派部门ID（用于处理人匹配，如"责任部门主管"策略）
      assignedDepartmentId: ('responsible' in pHazard && pHazard.responsible?.departmentId) ?? undefined,
      verifierId: pHazard.verifierId ?? undefined,
      verifierName: pHazard.verifierName ?? undefined,
      rectifyDesc: pHazard.rectifyDesc ?? undefined,
      rectifyRequirement: pHazard.rectifyRequirement ?? undefined,
      requireEmergencyPlan: pHazard.requireEmergencyPlan ?? false,
      emergencyPlanContent: pHazard.emergencyPlanContent ?? undefined,
      approvalMode: pHazard.approvalMode ?? undefined,
      currentStepIndex: pHazard.currentStepIndex ?? undefined,
      currentStepId: pHazard.currentStepId ?? undefined,
      photos: parseJsonField(pHazard.photos),
      rectifyPhotos: parseJsonField(pHazard.rectifyPhotos),
      verifyPhotos: parseJsonField(pHazard.verifyPhotos),
      verifyDesc: pHazard.verifyDesc ?? undefined,
      rootCause: pHazard.rootCause ?? undefined,
      logs: safeJsonParseArray(pHazard.logs),
      ccDepts: parseJsonField(pHazard.ccDepts),
      ccUsers: ccUserIds.length > 0 ? ccUserIds : parseJsonField(pHazard.ccUsers), // 🟢 优先使用关联表数据
      ccUserNames: ccUserNames.length > 0 ? ccUserNames : (parseJsonField(pHazard.ccUsers).length > 0 ? undefined : undefined),
      old_personal_ID: parseJsonField(pHazard.old_personal_ID),
      candidateHandlers, // 🟢 使用关联表数据
      reportTime: normalizeDate(pHazard.reportTime) ?? new Date().toISOString(),
      rectifyTime: normalizeDate(pHazard.rectifyTime) ?? undefined,
      verifyTime: normalizeDate(pHazard.verifyTime) ?? undefined,
      deadline: normalizeDate(pHazard.deadline) ?? undefined,
      emergencyPlanDeadline: normalizeDate(pHazard.emergencyPlanDeadline) ?? undefined,
      emergencyPlanSubmitTime: normalizeDate(pHazard.emergencyPlanSubmitTime) ?? undefined,
      createdAt: normalizeDate(pHazard.createdAt) ?? new Date().toISOString(),
      updatedAt: normalizeDate(pHazard.updatedAt) ?? new Date().toISOString(),
      // 🟢 软删除字段
      isVoided: (pHazard as any).isVoided ?? false,
      voidReason: (pHazard as any).voidReason ?? undefined,
      voidedAt: normalizeDate((pHazard as any).voidedAt) ?? undefined,
      voidedBy: (pHazard as any).voidedBy ?? undefined,
      // 延期记录通过独立的 API 获取，这里不包含
      extensions: undefined,
    } as HazardRecord;
  } catch (error) {
    console.error('[mapHazard] 转换失败:', error, pHazard);
    // 如果解析失败，返回基本数据结构
    return {
      id: pHazard.id,
      code: pHazard.code,
      status: pHazard.status,
      riskLevel: pHazard.riskLevel,
      type: pHazard.type,
      location: pHazard.location,
      desc: pHazard.desc,
      reporterId: pHazard.reporterId,
      reporterName: pHazard.reporterName,
      reportTime: new Date().toISOString(),
      photos: [],
      rectifyPhotos: [],
      logs: [],
      ccDepts: [],
      ccUsers: [],
      old_personal_ID: [],
    } as HazardRecord;
  }
}

export const GET = withErrorHandling(
  withAuth(async (request: NextRequest, context, user) => {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;
    const isPaginated = searchParams.has('page');

    // Filters
    const filterType = searchParams.get('filterType');
    const area = searchParams.get('area');
    const status = searchParams.get('status');
    const risk = searchParams.get('risk');
    const userId = searchParams.get('userId');
    const viewMode = searchParams.get('viewMode');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const responsibleDept = searchParams.get('responsibleDept'); // ✅ 添加责任部门筛选参数

    // ✅ 修复问题6：使用数据库聚合查询替代全表扫描
    if (type === 'stats') {
      // 1. 风险占比统计 - 使用数据库 groupBy 聚合
      const riskStatsResult = await prisma.hazardRecord.groupBy({
        by: ['riskLevel'],
        _count: {
          id: true,
        },
      });

      // 转换为前端需要的格式
      const riskStats = {
        low: 0,
        medium: 0,
        high: 0,
        major: 0,
      };
      riskStatsResult.forEach((item) => {
        const level = item.riskLevel.toLowerCase();
        if (level in riskStats) {
          riskStats[level as keyof typeof riskStats] = item._count.id;
        }
      });

      // 2. 计算近30天同一区域同类隐患重复率 - 使用数据库聚合查询
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // 使用原始 SQL 进行分组统计（SQLite 支持）
      const recurringIssuesRaw = await prisma.$queryRaw<Array<{ location: string; type: string; count: bigint }>>`
        SELECT location, type, COUNT(*) as count
        FROM HazardRecord
        WHERE reportTime >= ${thirtyDaysAgo.toISOString()}
        GROUP BY location, type
        HAVING COUNT(*) > 1
        ORDER BY count DESC
        LIMIT 50
      `;

      // 转换为前端需要的格式
      const recurringIssues = recurringIssuesRaw.map((item) => ({
        key: `${item.location}-${item.type}`,
        count: Number(item.count),
      }));

      return NextResponse.json({ riskStats, recurringIssues });
    }

    // ✅ 修复问题7：后端强制权限校验，防止IDOR
    // 管理员可以查看所有隐患，普通用户只能查看与自己相关的隐患
    const isAdmin = user.role === 'admin';
    
    // 普通列表查询
    const where: Prisma.HazardRecordWhereInput = {};

    if (filterType) where.type = filterType;
    else if (type && type !== 'stats') where.type = type;

    if (area) where.location = area;
    if (status) where.status = status;
    if (risk) where.riskLevel = risk;
    
    // ✅ 责任部门筛选：通过关联的用户部门ID筛选
    if (responsibleDept) {
      where.responsible = {
        departmentId: responsibleDept
      };
    }
    
    // 日期范围筛选：上报时间在startDate和endDate之间
    if (startDate || endDate) {
      where.reportTime = {};
      if (startDate) {
        // startDate已经是00:00:00
        where.reportTime.gte = new Date(startDate);
      }
      if (endDate) {
        // endDate已经是23:59:59.999
        where.reportTime.lte = new Date(endDate);
      }
    }

    // 🟢 软删除过滤：根据用户角色决定是否显示已作废数据
    if (isAdmin) {
      // 管理员：显示所有数据（包括已作废的），不添加过滤条件
      console.log('[Hazard GET] 管理员模式：显示所有隐患（包括已作废）');
    } else {
      // 普通用户：只显示未作废的数据
      where.isVoided = false;
      console.log('[Hazard GET] 普通用户模式：只显示未作废的隐患');
    }

    // 非管理员用户：添加权限过滤条件
    if (!isAdmin) {
      // 获取用户相关的隐患ID列表
      const ccHazards = await prisma.hazardCC.findMany({
        where: { userId: user.id },
        select: { hazardId: true }
      });
      const ccHazardIds = ccHazards.map(h => h.hazardId);

      const candidateHazards = await prisma.hazardCandidateHandler.findMany({
        where: { userId: user.id },
        select: { hazardId: true }
      });
      const candidateHazardIds = candidateHazards.map(h => h.hazardId);

      // 获取历史经手人相关的隐患（从 old_personal_ID JSON 字段中查询）
      // 注意：这里使用 contains 查询，性能可能不如关联表，但为了兼容现有数据
      const allRelatedHazardIds = [
        ...ccHazardIds,
        ...candidateHazardIds
      ];

      // 构建权限过滤条件：用户必须是上报人、责任人、验收人、当前执行人、抄送人或候选处理人
      const permissionConditions: Prisma.HazardRecordWhereInput[] = [
        { reporterId: user.id },
        { responsibleId: user.id },
        { verifierId: user.id },
        { dopersonal_ID: user.id },
      ];

      // 如果有关联的隐患ID，添加ID过滤条件
      if (allRelatedHazardIds.length > 0) {
        permissionConditions.push({ id: { in: allRelatedHazardIds } });
      }

      // 合并权限条件：如果已有 OR 条件，需要合并
      if (where.OR) {
        // 如果已有 OR 条件，需要与权限条件做 AND 组合
        where.AND = [
          { OR: where.OR },
          { OR: permissionConditions }
        ];
        delete where.OR;
      } else {
        where.OR = permissionConditions;
      }
    }

    // Handle 'My Tasks' logic server-side
    // 🟢 优化："我的任务"模式只显示当前用户需要操作的隐患
    if (viewMode === 'my_tasks' && userId) {
      // 确保使用当前登录用户的ID，而不是请求参数中的userId（防止IDOR）
      const actualUserId = user.id;
      
      // 🟢 使用关联表查询，提升性能和准确性
      // 查询未操作的候选处理人相关的隐患（或签/会签模式下等待该用户操作）
      const candidateHazards = await prisma.hazardCandidateHandler.findMany({
        where: {
          userId: actualUserId,
          hasOperated: false // ✅ 只查询未操作的候选处理人
        },
        select: { hazardId: true }
      });
      const candidateHazardIds = candidateHazards.map(h => h.hazardId);

      // 构建"我的任务"的特定查询条件
      // ✅ 修复：不仅检查候选处理人表，也要检查 dopersonal_ID 字段
      // 因为某些情况下可能只设置了 dopersonal_ID 而没有创建候选处理人记录
      const myTasksConditions: Prisma.HazardRecordWhereInput[] = [
        { 
          responsibleId: actualUserId,
          status: { in: ['reported', 'rectifying'] } // 只显示需要整改的状态
        },
        { 
          verifierId: actualUserId,
          status: { in: ['rectified', 'accepted'] } // 只显示需要验收的状态
        },
        { 
          dopersonal_ID: actualUserId,
          status: { not: 'closed' } // ✅ 当前执行人且未关闭（这是最重要的条件）
        }
      ];

      // 如果有候选处理人记录，也加入条件（或签/会签模式）
      if (candidateHazardIds.length > 0) {
        myTasksConditions.push({ 
          id: { in: candidateHazardIds },
          status: { not: 'closed' } // 候选人且未关闭
        });
      }

      // 与现有权限条件合并
      if (where.OR) {
        // 如果已有权限条件，需要与"我的任务"条件做 AND 组合
        where.AND = [
          { OR: where.OR },
          { OR: myTasksConditions }
        ];
        delete where.OR;
      } else {
        where.OR = myTasksConditions;
      }
      
      console.log('[Hazard GET] 我的任务模式筛选条件:', {
        userId: actualUserId,
        candidateHazardsCount: candidateHazardIds.length,
        conditionsCount: myTasksConditions.length,
        conditions: myTasksConditions.map(c => Object.keys(c))
      });
    }

    // 🔍 诊断日志：输出完整的where条件
    console.log('[Hazard GET - 诊断] 完整查询条件:', JSON.stringify(where, null, 2));

    if (isPaginated) {
      try {
        const [hazards, total] = await Promise.all([
          prisma.hazardRecord.findMany({
            where,
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' },
            include: { 
              reporter: true, 
              responsible: {
                include: {
                  department: true
                }
              }
            }
          }),
          prisma.hazardRecord.count({ where })
        ]);

        // 🔍 诊断日志：输出查询结果
        console.log('[Hazard GET - 诊断] 数据库查询返回:', {
          hazardsCount: hazards.length,
          totalCount: total,
          viewMode,
          userId: viewMode === 'my_tasks' ? user.id : undefined,
          sampleHazard: hazards[0] ? {
            id: hazards[0].id,
            code: hazards[0].code,
            status: hazards[0].status,
            dopersonal_ID: hazards[0].dopersonal_ID,
            dopersonal_Name: hazards[0].dopersonal_Name,
            responsibleId: hazards[0].responsibleId,
            verifierId: hazards[0].verifierId
          } : null
        });

        // ✅ 修复问题7：在返回数据前再次进行权限校验（双重保障）
        const mappedHazards = await Promise.all(hazards.map(mapHazard));
        const filteredHazards = isAdmin 
          ? mappedHazards 
          : mappedHazards.filter(h => canViewHazard(h, user));

        // 🔍 诊断日志：输出权限过滤结果
        console.log('[Hazard GET - 诊断] 权限过滤后结果:', {
          mappedCount: mappedHazards.length,
          filteredCount: filteredHazards.length,
          isAdmin,
          userId: user.id,
          droppedCount: mappedHazards.length - filteredHazards.length
        });

        return NextResponse.json({
          data: filteredHazards,
          meta: {
            total: filteredHazards.length, // 使用过滤后的数量
            page,
            limit,
            totalPages: Math.ceil(filteredHazards.length / limit)
          }
        });
      } catch (dbError: any) {
        // ✅ 修复问题10：使用统一的错误日志记录
        const errorContext = await extractErrorContext(request, user);
        await logError(dbError, {
          ...errorContext,
          queryParams: { page, limit, type, filterType, area, status, risk, userId, viewMode },
        });
        
        console.error('[Hazard GET] 数据库查询失败:', {
          error: dbError,
          code: dbError?.code,
          message: dbError?.message,
          meta: dbError?.meta,
          where,
          page,
          limit,
          stack: dbError?.stack
        });

        // 如果是列不存在错误（P2022），说明数据库 schema 未同步，使用原始 SQL 查询
        if (dbError?.code === 'P2022' || dbError?.message?.includes('does not exist in the current database')) {
          console.warn('[Hazard GET] 检测到字段不存在错误，可能是数据库迁移未完成，使用原始 SQL 查询');
          try {
            // 使用原始 SQL 查询，只选择确实存在的字段
            const hazardsRaw = await prisma.$queryRaw<any[]>`
              SELECT id, code, status, "riskLevel", type, location, desc, photos, 
                     "reporterId", "reporterName", "reportTime",
                     "responsibleId", "responsibleName", "responsibleDept",
                     deadline, "rectifyDesc", "rectifyPhotos", "rectifyTime",
                     "verifierId", "verifierName", "verifyTime",
                     "rectifyRequirement", "requireEmergencyPlan", 
                     "emergencyPlanDeadline", "emergencyPlanContent", 
                     "emergencyPlanSubmitTime", "ccDepts", "ccUsers", logs,
                     "createdAt", "updatedAt"
              FROM HazardRecord
              ORDER BY "createdAt" DESC
              LIMIT ${limit} OFFSET ${skip}
            `;

            const total = await prisma.hazardRecord.count({ where });

      return NextResponse.json({
        data: await Promise.all(hazardsRaw.map(mapHazard)),
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      });
          } catch (fallbackError: any) {
            console.error('[Hazard GET] 原始 SQL 查询也失败:', fallbackError);
            // 返回一个友好的错误提示
            throw new Error('数据库 schema 未同步，请运行: npx prisma migrate deploy');
          }
        }

        // 如果是关联查询错误（如用户不存在），尝试不包含关联数据
        if (dbError?.code === 'P2025' || dbError?.message?.includes('foreign key') || dbError?.message?.includes('relation')) {
          console.warn('[Hazard GET] 检测到关联查询错误，尝试不包含关联数据重新查询');
          try {
            const [hazardsWithoutRelations, total] = await Promise.all([
              prisma.hazardRecord.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' }
                // 不包含关联数据
              }),
              prisma.hazardRecord.count({ where })
            ]);

            return NextResponse.json({
              data: await Promise.all(hazardsWithoutRelations.map(mapHazard)),
              meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
              }
            });
          } catch (fallbackError: any) {
            console.error('[Hazard GET] 备用查询也失败:', fallbackError);
            throw fallbackError;
          }
        }

        // 重新抛出错误，让 withErrorHandling 处理
        throw dbError;
      }
    }

    // Fallback to fetching all if no pagination params
    try {
      const data = await prisma.hazardRecord.findMany({
        where, // ✅ 修复问题7：应用权限过滤条件
        orderBy: { createdAt: 'desc' },
        include: { 
          reporter: true, 
          responsible: {
            include: {
              department: true
            }
          }
        }
      });
      
      // ✅ 修复问题7：在返回数据前再次进行权限校验
      const mappedData = await Promise.all(data.map(mapHazard));
      const filteredData = isAdmin 
        ? mappedData 
        : mappedData.filter(h => canViewHazard(h, user));
      
      return NextResponse.json(filteredData);
    } catch (dbError: any) {
      console.error('[Hazard GET] 数据库查询失败（无分页）:', {
        error: dbError,
        code: dbError?.code,
        message: dbError?.message,
        meta: dbError?.meta,
        stack: dbError?.stack
      });

      // 如果是列不存在错误（P2022），说明数据库 schema 未同步，使用原始 SQL 查询
      if (dbError?.code === 'P2022' || dbError?.message?.includes('does not exist in the current database')) {
        console.warn('[Hazard GET] 检测到字段不存在错误，可能是数据库迁移未完成，使用原始 SQL 查询');
        try {
          // 使用原始 SQL 查询，只选择确实存在的字段
          const dataRaw = await prisma.$queryRaw<any[]>`
            SELECT id, code, status, "riskLevel", type, location, desc, photos, 
                   "reporterId", "reporterName", "reportTime",
                   "responsibleId", "responsibleName", "responsibleDept",
                   deadline, "rectifyDesc", "rectifyPhotos", "rectifyTime",
                   "verifierId", "verifierName", "verifyTime",
                   "rectifyRequirement", "requireEmergencyPlan", 
                   "emergencyPlanDeadline", "emergencyPlanContent", 
                   "emergencyPlanSubmitTime", "ccDepts", "ccUsers", logs,
                   "createdAt", "updatedAt"
            FROM HazardRecord
            ORDER BY "createdAt" DESC
          `;

          return NextResponse.json(dataRaw.map(mapHazard));
        } catch (fallbackError: any) {
          console.error('[Hazard GET] 原始 SQL 查询也失败:', fallbackError);
          throw new Error('数据库 schema 未同步，请运行: npx prisma migrate deploy');
        }
      }

      // 如果是关联查询错误，尝试不包含关联数据
      if (dbError?.code === 'P2025' || dbError?.message?.includes('foreign key') || dbError?.message?.includes('relation')) {
        console.warn('[Hazard GET] 检测到关联查询错误，尝试不包含关联数据重新查询');
        try {
          const dataWithoutRelations = await prisma.hazardRecord.findMany({
            orderBy: { createdAt: 'desc' }
            // 不包含关联数据
          });
          return NextResponse.json(await Promise.all(dataWithoutRelations.map(mapHazard)));
        } catch (fallbackError: any) {
          console.error('[Hazard GET] 备用查询也失败:', fallbackError);
          throw fallbackError;
        }
      }

      // 重新抛出错误，让 withErrorHandling 处理
      throw dbError;
    }
  })
);

export const POST = withErrorHandling(
  withPermission('hidden_danger', 'report', async (request: NextRequest, context, user) => {
    const body = await request.json();

    // 过滤掉 Prisma schema 中不存在的字段（但保留 currentStepIndex 和 currentStepId）
    const {
      dopersonal_ID,
      dopersonal_Name,
      responsibleDeptId,
      responsibleDeptName,
      reporterDepartmentId,
      reporterDepartment,
      isExtensionRequested,
      rejectReason,
      ccUserNames,
      photos: photosInput,
      ccDepts: ccDeptsInput,
      ccUsers: ccUsersInput,
      logs: logsInput,
      old_personal_ID: oldPersonalIdInput,
      ...validData
    } = body;

    // 🔐 构造初始日志记录（上报操作）
    const initialLog = {
      operatorId: user.id,
      operatorName: user.name,
      action: '上报隐患',
      time: new Date().toISOString(),
      changes: `创建隐患记录 - 类型: ${validData.type}, 位置: ${validData.location}, 风险等级: ${validData.riskLevel}`
    };

    // 处理数组字段：转换为 JSON 字符串
    // 处理日期字段：转换为 Date 对象
    const processedData: any = {
      ...validData,
      photos: photosInput ? (Array.isArray(photosInput) ? JSON.stringify(photosInput) : photosInput) : null,
      ccDepts: ccDeptsInput ? (Array.isArray(ccDeptsInput) ? JSON.stringify(ccDeptsInput) : ccDeptsInput) : null,
      ccUsers: ccUsersInput ? (Array.isArray(ccUsersInput) ? JSON.stringify(ccUsersInput) : ccUsersInput) : null,
      logs: logsInput && Array.isArray(logsInput) && logsInput.length > 0 
        ? JSON.stringify([initialLog, ...logsInput])  // 如果有传入日志，添加初始日志到前面
        : JSON.stringify([initialLog]),  // 否则只包含初始日志
      old_personal_ID: oldPersonalIdInput ? (Array.isArray(oldPersonalIdInput) ? JSON.stringify(oldPersonalIdInput) : oldPersonalIdInput) : null,
    };

    // 处理日期字段
    if (processedData.reportTime && typeof processedData.reportTime === 'string') {
      processedData.reportTime = new Date(processedData.reportTime);
    }
    // 整改期限设置为当天的结束时间（23:59:59.999）
    if (processedData.deadline && typeof processedData.deadline === 'string') {
      processedData.deadline = setEndOfDay(extractDatePart(processedData.deadline));
    }

    // 🔒 如果未提供编号，由后端自动生成（确保唯一性）
    if (!processedData.code || processedData.code.trim() === '') {
      processedData.code = await generateHazardCode();
      console.log(`✅ [隐患创建] 自动生成编号: ${processedData.code}`);
    } else {
      // 如果前端提供了编号，检查是否已存在（防止重复）
      const existing = await prisma.hazardRecord.findUnique({
        where: { code: processedData.code }
      });
      if (existing) {
        // 如果编号已存在，自动生成新编号
        console.warn(`⚠️ [隐患创建] 编号 ${processedData.code} 已存在，自动生成新编号`);
        processedData.code = await generateHazardCode();
      }
    }

    try {
      // 🔄 Step 1: 创建隐患记录
      const res = await prisma.hazardRecord.create({
        data: processedData
      });

      console.log(`✅ [隐患创建] 隐患记录创建成功: ${res.code}`);

      // 🔄 Step 2: 初始化工作流 - 加载工作流配置并调用派发引擎
      try {
        // 加载工作流配置（直接从文件读取）
        const fs = await import('fs/promises');
        const path = await import('path');
        const WORKFLOW_FILE = path.join(process.cwd(), 'data', 'hazard-workflow.json');
        
        let workflowConfig: any = null;
        try {
          const data = await fs.readFile(WORKFLOW_FILE, 'utf-8');
          workflowConfig = JSON.parse(data);
        } catch (fileError) {
          console.warn('⚠️ [隐患创建] 无法读取工作流配置文件:', fileError);
        }
        
        if (!workflowConfig || !workflowConfig.steps || workflowConfig.steps.length === 0) {
          console.warn('⚠️ [隐患创建] 未找到工作流配置，跳过初始化');
        } else {
          // 加载所有用户和部门数据
          const [allUsers, departments] = await Promise.all([
            prisma.user.findMany({
              where: { isActive: true },
              select: {
                id: true,
                name: true,
                jobTitle: true,
                departmentId: true  // ✅ 只查询 departmentId，不查询 department 关联对象
              }
            }),
            prisma.department.findMany({
              select: {
                id: true,
                name: true,
                parentId: true,
                level: true,
                managerId: true
              }
            })
          ]);

          console.log('[隐患创建] 已加载用户和部门数据:', {
            usersCount: allUsers.length,
            departmentsCount: departments.length,
            sampleUser: allUsers[0] ? {
              id: allUsers[0].id,
              name: allUsers[0].name,
              departmentId: allUsers[0].departmentId
            } : null
          });

          // 🟢 在调用派发引擎之前，先加载隐患的关联数据（确保 assignedDepartmentId 等字段可用）
          const hazardWithRelations = await prisma.hazardRecord.findUnique({
            where: { id: res.id },
            include: {
              reporter: true,
              responsible: {
                include: {
                  department: true
                }
              }
            }
          });

          const mappedHazard = await mapHazard(hazardWithRelations || res);

          // 🟢 第一步：使用统一服务解析所有步骤的执行人和抄送人，并保存到数据库
          const { HazardHandlerResolverService } = await import('@/services/hazardHandlerResolver.service');
          const { saveWorkflowSteps } = await import('@/services/hazardWorkflowStep.service');
          
          const reporterUser = allUsers.find(u => u.id === mappedHazard.reporterId);
          const reporter = reporterUser ? {
            id: reporterUser.id,
            name: reporterUser.name,
            departmentId: reporterUser.departmentId ?? undefined,
            jobTitle: reporterUser.jobTitle ?? undefined
          } as any : undefined;
          
          const workflowResolution = await HazardHandlerResolverService.resolveWorkflow({
            hazard: mappedHazard,
            workflowSteps: workflowConfig.steps,
            allUsers: allUsers as any[],
            departments: departments as any[],
            reporter
          });

          // 保存所有步骤信息到数据库（即使部分步骤解析失败，也要保存所有步骤，包括失败的）
          if (workflowResolution.steps.length > 0) {
            await saveWorkflowSteps(res.id, workflowResolution.steps);
            console.log(`✅ [隐患创建] 已保存所有步骤信息到数据库:`, {
              hazardId: res.id,
              stepsCount: workflowResolution.steps.length,
              successfulSteps: workflowResolution.steps.filter(s => s.success).length,
              failedSteps: workflowResolution.steps.filter(s => !s.success).length
            });
          } else {
            console.warn(`⚠️ [隐患创建] 没有步骤需要保存:`, {
              hazardId: res.id,
              workflowStepsCount: workflowConfig.steps.length
            });
          }

          // 🟢 第二步：调用派发引擎初始化工作流（第一步：上报并指派）
          const { HazardDispatchEngine, DispatchAction } = await import('@/services/hazardDispatchEngine');
          
          const dispatchResult = await HazardDispatchEngine.dispatch({
            hazard: mappedHazard,
            action: DispatchAction.SUBMIT,
            operator: {
              id: user.id,
              name: user.name
            },
            workflowSteps: workflowConfig.steps,
            allUsers: allUsers as any[],
            departments: departments as any[],
            currentStepIndex: 0 // 初始化为第一步
          });

          console.log(`🎯 [隐患创建] 工作流初始化结果:`, {
            success: dispatchResult.success,
            newStatus: dispatchResult.newStatus,
            nextStepIndex: dispatchResult.nextStepIndex,
            handlers: dispatchResult.handlers.userNames,
            ccUsers: dispatchResult.ccUsers.userNames
          });

          if (dispatchResult.success) {
            // 更新隐患记录的工作流字段
            const workflowUpdates: any = {
              status: dispatchResult.newStatus,
              currentStepIndex: dispatchResult.nextStepIndex,
              currentStepId: dispatchResult.currentStep,
              dopersonal_ID: dispatchResult.handlers.userIds[0] || null,
              dopersonal_Name: dispatchResult.handlers.userNames[0] || null,
              // 更新日志
              logs: JSON.stringify([
                ...safeJsonParseArray(res.logs),
                dispatchResult.log
              ])
            };

            // 如果有审批模式，保存
            const firstStep = workflowConfig.steps[dispatchResult.nextStepIndex || 0];
            if (firstStep?.handlerStrategy?.approvalMode) {
              workflowUpdates.approvalMode = firstStep.handlerStrategy.approvalMode;
            }

            // 如果有候选处理人，保存到 JSON 字段（同时会创建关联表记录）
            if (dispatchResult.candidateHandlers && dispatchResult.candidateHandlers.length > 0) {
              workflowUpdates.candidateHandlers = JSON.stringify(
                dispatchResult.candidateHandlers.map(ch => ({
                  userId: ch.userId,
                  userName: ch.userName,
                  hasOperated: false
                }))
              );
            }

            // 更新抄送用户（JSON 字段，同时会创建关联表记录）
            if (dispatchResult.ccUsers.userIds.length > 0) {
              workflowUpdates.ccUsers = JSON.stringify(dispatchResult.ccUsers.userIds);
            }

            // 在事务中更新隐患记录和创建关联表记录
            await prisma.$transaction(async (tx) => {
              // 更新隐患记录
              await tx.hazardRecord.update({
                where: { id: res.id },
                data: workflowUpdates
              });

              // ✅ P1修复：在同一事务中同步可见性表
              await syncHazardVisibility(res.id, tx);

              // 创建候选处理人关联表记录
              if (dispatchResult.candidateHandlers && dispatchResult.candidateHandlers.length > 0) {
                await tx.hazardCandidateHandler.createMany({
                  data: dispatchResult.candidateHandlers.map(ch => ({
                    hazardId: res.id,
                    userId: ch.userId,
                    userName: ch.userName,
                    stepIndex: ch.stepIndex,
                    stepId: ch.stepId,
                    hasOperated: false
                  }))
                });
              }

              // 创建抄送用户关联表记录
              if (dispatchResult.ccUsers.userIds.length > 0) {
                await tx.hazardCC.createMany({
                  data: dispatchResult.ccUsers.userIds.map((userId, idx) => ({
                    hazardId: res.id,
                    userId,
                    userName: dispatchResult.ccUsers.userNames[idx] || null
                  }))
                });
              }

              // 创建通知
              if (dispatchResult.notifications && dispatchResult.notifications.length > 0) {
                await tx.notification.createMany({
                  data: dispatchResult.notifications.map(n => ({
                    userId: n.userId,
                    type: n.type,
                    title: n.title,
                    content: n.content,
                    relatedType: n.relatedType || 'hazard',
                    relatedId: n.relatedId || res.id,
                    isRead: false
                  }))
                });
              }
            });

            console.log(`✅ [隐患创建] 工作流初始化完成，已设置处理人: ${dispatchResult.handlers.userNames.join('、')}`);
            
            // 🔄 修复：派发引擎执行后，更新步骤信息中当前步骤的处理人信息
            // 因为派发引擎解析的是下一步骤的处理人，需要更新到步骤信息中
            if (dispatchResult.nextStepIndex !== undefined && dispatchResult.nextStepIndex >= 0) {
              try {
                const workflowStepService = await import('@/services/hazardWorkflowStep.service') as any;
                const currentStepInfo = await workflowStepService.getWorkflowStep(res.id, dispatchResult.nextStepIndex);
                
                if (currentStepInfo && workflowStepService.updateWorkflowStep) {
                  // 更新当前步骤的处理人信息（使用派发引擎解析的结果）
                  await workflowStepService.updateWorkflowStep(res.id, dispatchResult.nextStepIndex, {
                    handlers: {
                      userIds: dispatchResult.handlers.userIds,
                      userNames: dispatchResult.handlers.userNames,
                      matchedBy: dispatchResult.handlers.matchedBy
                    },
                    success: dispatchResult.handlers.userIds.length > 0,
                    error: dispatchResult.handlers.userIds.length === 0 ? '派发引擎解析处理人失败' : undefined
                  });
                  
                  console.log(`✅ [隐患创建] 已更新步骤 ${dispatchResult.nextStepIndex} 的处理人信息`);
                }
              } catch (stepUpdateError) {
                console.error('❌ [隐患创建] 更新步骤信息失败:', stepUpdateError);
                // 不影响主流程，继续执行
              }
            }
          } else {
            console.error(`❌ [隐患创建] 工作流初始化失败:`, dispatchResult.error);
          }
        }
      } catch (workflowError) {
        console.error('❌ [隐患创建] 工作流初始化异常:', workflowError);
        // 不影响隐患创建，继续返回
      }

      // 🚀 Step 3: 同步可见性表（✅ P1修复：在工作流初始化的事务中执行）
      // 注意：这里不需要额外调用，因为工作流初始化已经在事务中处理了
      // 如果需要额外同步，应该在工作流事务中调用

      // 记录操作日志 - 保存完整的隐患信息快照
      await logApiOperation(user, 'hidden_danger', 'report', {
        hazardId: res.code || res.id,           // 保留向后兼容
        code: res.code,                          // 隐患编号
        id: res.id,                              // 数据库主键
        type: res.type,                          // 隐患类型
        location: res.location,                  // 位置
        riskLevel: res.riskLevel,                // 风险等级
        desc: res.desc,                          // 描述
        checkType: res.checkType,                // 检查类型
        rectificationType: res.rectificationType, // 整改类型
        reporterId: res.reporterId,              // 上报人ID
        reporterName: res.reporterName,          // 上报人姓名
        reportTime: res.reportTime,              // 上报时间
        responsibleId: res.responsibleId,        // 责任人ID
        responsibleName: res.responsibleName,    // 责任人姓名
        responsibleDept: res.responsibleDept,    // 责任部门
        deadline: res.deadline,                  // 整改期限
        rectifyRequirement: res.rectifyRequirement, // 整改要求
        requireEmergencyPlan: res.requireEmergencyPlan, // 是否需要应急预案
        status: res.status                       // 状态
      });

      // 重新读取更新后的隐患记录（包含工作流字段）
      const updatedHazard = await prisma.hazardRecord.findUnique({
        where: { id: res.id },
        include: {
          reporter: true,
          responsible: {
            include: {
              department: true
            }
          }
        }
      });

      return NextResponse.json(await mapHazard(updatedHazard || res));
    } catch (error: any) {
      console.error('[Hazard POST] 创建隐患记录失败:', error);
      console.error('[Hazard POST] 错误详情:', {
        message: error.message,
        code: error.code,
        meta: error.meta,
        processedData: Object.keys(processedData)
      });
      throw error;
    }
  })
);

export const PATCH = withErrorHandling(
  withAuth(async (request: NextRequest, context, user) => {
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error('[Hazard PATCH] JSON解析失败:', parseError);
      throw new Error('请求体JSON格式错误');
    }

    console.log('[Hazard PATCH] 收到请求:', {
      id: body.id,
      action: body.actionName,
      hasNotifications: !!body.notifications,
      notificationCount: body.notifications?.length,
      hasDispatchResult: !!body.dispatchResult,
      candidateHandlersCount: body.dispatchResult?.candidateHandlers?.length
    });

    const {
      id,
      operatorId,
      operatorName,
      actionName,
      // 🔴 关键修复：过滤掉不应该更新到 HazardRecord 的字段
      notifications, // ❌ 通知数据（单独处理）
      dispatchResult, // ❌ 派发结果（单独处理）
      // 过滤掉 Prisma schema 中不存在的字段
      responsibleDeptId,
      responsibleDeptName,
      isExtensionRequested,
      rejectReason,
      photos: photosInput,
      ccDepts: ccDeptsInput,
      ccUsers: ccUsersInput,
      rectifyPhotos: rectifyPhotosInput, // 🟢 新增：整改照片
      logs: logsInput,
      old_personal_ID: oldPersonalIdInput,
      ccUserNames,
      candidateHandlers: candidateHandlersInput, // 🟢 新增：或签候选人列表
      approvalMode: approvalModeInput, // 🟢 新增：审批模式
      // 🔐 签名相关字段
      signature,
      signerId,
      signerName,
      verifyDesc,
      verifyPhotos,
      rootCause,
      // ✅ 关键修复：显式提取 dopersonal_ID 和 dopersonal_Name 并立即转换类型
      dopersonal_ID: dopersonal_ID_raw,
      dopersonal_Name: dopersonal_Name_raw,
      ...updates
    } = body;

    // ✅ 立即进行类型转换，确保类型安全
    if (dopersonal_ID_raw !== undefined) {
      updates.dopersonal_ID = dopersonal_ID_raw === null 
        ? null 
        : String(dopersonal_ID_raw);
    }
    if (dopersonal_Name_raw !== undefined) {
      updates.dopersonal_Name = dopersonal_Name_raw === null 
        ? null 
        : String(dopersonal_Name_raw);
    }

    // 🔒 使用事务保护，避免并发覆盖
    let oldRecord: any = null; // 用于事务外访问
    const res = await prisma.$transaction(async (tx) => {
      try {
        // 1. 在事务中重新读取当前状态（避免并发覆盖）
        oldRecord = await tx.hazardRecord.findUnique({ where: { id } });

        if (!oldRecord) {
          console.error('[Hazard PATCH] 隐患记录不存在:', id);
          throw new Error('隐患记录不存在');
        }

        console.log('[Hazard PATCH] 事务开始，当前记录状态:', {
          id: oldRecord.id,
          status: oldRecord.status,
          currentStepIndex: oldRecord.currentStepIndex,
          dopersonal_ID: oldRecord.dopersonal_ID
        });

        // 🚀 权限检查：从 HazardWorkflowStep 表读取当前步骤信息并验证权限
        if (actionName && ['提交整改', 'rectify', '验收通过', 'verify_pass', '验收驳回', 'verify_reject', '驳回', 'reject'].includes(actionName)) {
          const { getWorkflowStep } = await import('@/services/hazardWorkflowStep.service');
          const currentStepIndex = oldRecord.currentStepIndex ?? 0;
          const currentStepInfo = await getWorkflowStep(id, currentStepIndex);
          
          console.log('[Hazard PATCH] 权限检查开始:', {
            userId: user.id,
            userName: user.name,
            actionName,
            currentStepIndex,
            hasStepInfo: !!currentStepInfo,
            dopersonal_ID: oldRecord.dopersonal_ID,
            responsibleId: oldRecord.responsibleId
          });
          
          if (currentStepInfo) {
            // 使用步骤信息进行权限检查
            const { handlers, candidateHandlers, approvalMode, stepName } = currentStepInfo;
            let hasPermission = false;
            
            console.log('[Hazard PATCH] 步骤信息详情:', {
              stepName,
              handlerUserIds: handlers.userIds,
              handlerUserNames: handlers.userNames,
              candidateHandlers: candidateHandlers?.map(h => ({ userId: h.userId, userName: h.userName })),
              approvalMode,
              candidateHandlersCount: candidateHandlers?.length || 0
            });
            
            // Admin 总是有权限
            if (user.role === 'admin') {
              hasPermission = true;
              console.log('[Hazard PATCH] Admin 用户，权限检查通过');
            } else {
              // 多人模式：检查是否在候选处理人列表中
              if (candidateHandlers && candidateHandlers.length > 0 && approvalMode) {
                console.log('[Hazard PATCH] 进入多人模式权限检查');
                // 检查是否在候选人列表中
                const isCandidate = candidateHandlers.some(h => h.userId === user.id);
                console.log('[Hazard PATCH] 是否在候选人列表中:', isCandidate);
                
                if (isCandidate) {
                  // 对于或签模式，检查是否已有人操作
                  if (approvalMode === 'OR') {
                    // 需要从 HazardCandidateHandler 表读取 hasOperated 状态
                    const candidateHandlerRecord = await tx.hazardCandidateHandler.findFirst({
                      where: {
                        hazardId: id,
                        stepIndex: currentStepIndex,
                        userId: user.id
                      }
                    });
                    // 如果当前用户已操作，则无权限
                    if (candidateHandlerRecord?.hasOperated) {
                      hasPermission = false;
                      console.log('[Hazard PATCH] 或签模式：当前用户已操作，无权限');
                    } else {
                      // 检查是否有其他人已操作（或签模式）
                      const someoneOperated = await tx.hazardCandidateHandler.findFirst({
                        where: {
                          hazardId: id,
                          stepIndex: currentStepIndex,
                          hasOperated: true
                        }
                      });
                      hasPermission = !someoneOperated;
                      console.log('[Hazard PATCH] 或签模式：其他人是否已操作:', !!someoneOperated, '权限:', hasPermission);
                    }
                  } else if (approvalMode === 'AND') {
                    // 会签模式：检查当前用户是否已操作
                    const candidateHandlerRecord = await tx.hazardCandidateHandler.findFirst({
                      where: {
                        hazardId: id,
                        stepIndex: currentStepIndex,
                        userId: user.id
                      }
                    });
                    hasPermission = !candidateHandlerRecord?.hasOperated;
                    console.log('[Hazard PATCH] 会签模式：当前用户是否已操作:', !!candidateHandlerRecord?.hasOperated, '权限:', hasPermission);
                  } else {
                    hasPermission = isCandidate;
                    console.log('[Hazard PATCH] 其他审批模式，权限:', hasPermission);
                  }
                } else {
                  console.log('[Hazard PATCH] 用户不在候选人列表中');
                }
              } else {
                // 单人模式：检查当前用户是否在处理人列表中
                console.log('[Hazard PATCH] 进入单人模式权限检查');
                if (handlers.userIds && handlers.userIds.length > 0) {
                  hasPermission = handlers.userIds.includes(user.id);
                  console.log('[Hazard PATCH] 单人模式：检查处理人列表', {
                    handlerUserIds: handlers.userIds,
                    userId: user.id,
                    hasPermission
                  });
                  
                  // 🔧 如果处理人列表中没有，但用户是责任人，也应该授予权限（修复匹配逻辑错误的情况）
                  if (!hasPermission && oldRecord.responsibleId === user.id) {
                    hasPermission = true;
                    console.log('[Hazard PATCH] 单人模式：处理人列表中不包含用户，但用户是责任人，授予权限');
                  }
                } else {
                  // 向后兼容：从 hazard 对象读取
                  hasPermission = oldRecord.dopersonal_ID === user.id;
                  console.log('[Hazard PATCH] 单人模式：handlers.userIds 为空，回退到检查 dopersonal_ID', {
                    dopersonal_ID: oldRecord.dopersonal_ID,
                    userId: user.id,
                    hasPermission
                  });
                  
                  // 🔧 额外检查：如果 dopersonal_ID 也不匹配，检查是否是责任人
                  if (!hasPermission && oldRecord.responsibleId === user.id) {
                    hasPermission = true;
                    console.log('[Hazard PATCH] 单人模式：dopersonal_ID 不匹配，但用户是责任人，授予权限');
                  }
                }
              }
            }
            
            if (!hasPermission) {
              console.warn('[Hazard PATCH] 权限检查失败:', {
                userId: user.id,
                userName: user.name,
                actionName,
                currentStepIndex,
                stepName,
                handlerUserIds: handlers.userIds,
                handlerUserNames: handlers.userNames,
                candidateUserIds: candidateHandlers?.map(h => h.userId),
                candidateUserNames: candidateHandlers?.map(h => h.userName),
                approvalMode,
                dopersonal_ID: oldRecord.dopersonal_ID,
                responsibleId: oldRecord.responsibleId
              });
              throw new Error('权限不足：您没有权限执行此操作');
            }
            
            console.log('[Hazard PATCH] 权限检查通过:', {
              userId: user.id,
              actionName,
              currentStepIndex,
              stepName
            });
          } else {
            // 如果没有步骤信息，使用向后兼容的权限检查
            console.log('[Hazard PATCH] 未找到步骤信息，使用向后兼容的权限检查');
            if (user.role !== 'admin' && oldRecord.dopersonal_ID !== user.id) {
              // 检查是否是候选处理人
              const isCandidate = await tx.hazardCandidateHandler.findFirst({
                where: {
                  hazardId: id,
                  userId: user.id,
                  stepIndex: currentStepIndex
                }
              });
              
              if (!isCandidate) {
                // 🔧 额外检查：如果都不是，检查是否是责任人
                if (oldRecord.responsibleId === user.id) {
                  console.log('[Hazard PATCH] 向后兼容：用户是责任人，授予权限');
                } else {
                  console.warn('[Hazard PATCH] 向后兼容权限检查失败:', {
                    userId: user.id,
                    dopersonal_ID: oldRecord.dopersonal_ID,
                    responsibleId: oldRecord.responsibleId,
                    isCandidate: !!isCandidate
                  });
                  throw new Error('权限不足：您没有权限执行此操作');
                }
              }
            }
          }
        }

      // 2. 并发一致性校验：检查关键字段是否被其他操作修改
      if (updates.status !== undefined && oldRecord.status !== updates.status) {
        // 如果状态不一致，检查是否是预期的状态流转
        // 这里不直接拒绝，因为可能是正常的状态流转
      }

      // 校验 currentStepIndex 一致性（如果传入）
      if (updates.currentStepIndex !== undefined) {
        const expectedStepIndex = oldRecord.currentStepIndex ?? 0;
        // 允许向前流转（步骤索引增加），但不允许回退（除非是驳回操作）
        if (updates.currentStepIndex < expectedStepIndex && actionName !== '驳回') {
          throw new Error(
            `并发冲突：当前步骤索引已变更为 ${expectedStepIndex}，无法回退到 ${updates.currentStepIndex}。请刷新页面后重试。`
          );
        }
      }

      // 校验 dopersonal_ID 一致性（如果传入且当前状态需要执行人）
      if (updates.dopersonal_ID !== undefined && oldRecord.dopersonal_ID && oldRecord.dopersonal_ID !== updates.dopersonal_ID) {
        // 如果当前执行人已被其他操作修改，且不是预期的更新，则拒绝
        // 注意：这里允许更新为新的执行人（正常流转），但不允许覆盖已变更的执行人
        console.warn(`[并发检测] dopersonal_ID 不一致: 数据库=${oldRecord.dopersonal_ID}, 传入=${updates.dopersonal_ID}`);
        // 不直接拒绝，因为可能是正常的流转更新
      }

      // 构造日志
      const changeDesc = generateChanges(oldRecord as HazardRecord, updates);
      const newLog: any = {
        operatorId: operatorId || 'system',
        operatorName: operatorName || '系统',
        action: actionName || '更新记录',
        time: new Date().toISOString(),
        changes: changeDesc || updates.extensionReason || '无关键字段变更'
      };

      // 如果有抄送信息，也记录到日志中
      if (ccUsersInput && Array.isArray(ccUsersInput) && ccUsersInput.length > 0) {
        newLog.ccUsers = ccUsersInput;
        newLog.ccUserNames = ccUserNames || [];
      }

      // ✅ 修复问题9：使用 safeJsonParse
      const currentLogs = safeJsonParseArray(oldRecord.logs || '[]');

      const updatedLogs = [newLog, ...currentLogs];

      // 处理数组字段：转换为 JSON 字符串
      const finalUpdates: any = {
        ...updates,
        logs: JSON.stringify(updatedLogs)
      };

      // ✅ dopersonal_ID 和 dopersonal_Name 已在解构时转换，这里不需要再次处理

      // 处理数组字段
      if (photosInput !== undefined) {
        finalUpdates.photos = Array.isArray(photosInput) ? JSON.stringify(photosInput) : photosInput;
      }
      if (ccDeptsInput !== undefined) {
        finalUpdates.ccDepts = Array.isArray(ccDeptsInput) ? JSON.stringify(ccDeptsInput) : ccDeptsInput;
      }
      if (ccUsersInput !== undefined) {
        finalUpdates.ccUsers = Array.isArray(ccUsersInput) ? JSON.stringify(ccUsersInput) : ccUsersInput;
      }
      if (oldPersonalIdInput !== undefined) {
        finalUpdates.old_personal_ID = Array.isArray(oldPersonalIdInput) ? JSON.stringify(oldPersonalIdInput) : oldPersonalIdInput;
      }
      if (rectifyPhotosInput !== undefined) {
        finalUpdates.rectifyPhotos = Array.isArray(rectifyPhotosInput) ? JSON.stringify(rectifyPhotosInput) : rectifyPhotosInput;
      }
      // 🔐 处理验收相关字段
      if (verifyDesc !== undefined) {
        finalUpdates.verifyDesc = verifyDesc;
      }
      if (verifyPhotos !== undefined) {
        finalUpdates.verifyPhotos = Array.isArray(verifyPhotos) ? JSON.stringify(verifyPhotos) : verifyPhotos;
      }
      if (rootCause !== undefined) {
        finalUpdates.rootCause = rootCause;
      }
      // 🟢 新增：处理候选处理人列表（或签/会签模式）
      if (candidateHandlersInput !== undefined) {
        if (candidateHandlersInput === null || candidateHandlersInput === undefined) {
          finalUpdates.candidateHandlers = null;
        } else {
          finalUpdates.candidateHandlers = Array.isArray(candidateHandlersInput)
            ? JSON.stringify(candidateHandlersInput)
            : candidateHandlersInput;
        }
      }
      // 🟢 新增：处理审批模式
      if (approvalModeInput !== undefined) {
        finalUpdates.approvalMode = approvalModeInput === undefined ? null : approvalModeInput;
      }

      // 处理日期字段：整改期限设置为当天的结束时间（23:59:59.999）
      if (finalUpdates.deadline && typeof finalUpdates.deadline === 'string') {
        finalUpdates.deadline = setEndOfDay(extractDatePart(finalUpdates.deadline));
      }

        // 3. 在同一事务中更新隐患记录
        console.log('[Hazard PATCH] 准备更新记录，字段数量:', Object.keys(finalUpdates).length);
        const updatedRecord = await tx.hazardRecord.update({
          where: { id },
          data: finalUpdates
        });
        console.log('[Hazard PATCH] 记录更新成功');

        // 🟢 4. 在同一事务中更新候选处理人关联表（如果提供了派发结果）
        if (body.dispatchResult?.candidateHandlers && Array.isArray(body.dispatchResult.candidateHandlers)) {
          console.log('[Hazard PATCH] 开始更新候选处理人关联表:', {
            count: body.dispatchResult.candidateHandlers.length,
            handlers: body.dispatchResult.candidateHandlers
          });

          const stepIndex = finalUpdates.currentStepIndex ?? oldRecord.currentStepIndex ?? 0;
          const stepId = finalUpdates.currentStepId ?? oldRecord.currentStepId ?? undefined;
          
          // 删除该步骤的旧记录
          await tx.hazardCandidateHandler.deleteMany({
            where: {
              hazardId: id,
              stepIndex
            }
          });
          console.log('[Hazard PATCH] 已删除旧的候选处理人记录');

          // 创建新的候选处理人记录
          if (body.dispatchResult.candidateHandlers.length > 0) {
            await tx.hazardCandidateHandler.createMany({
              data: body.dispatchResult.candidateHandlers.map((ch: any) => ({
                hazardId: id,
                userId: ch.userId,
                userName: ch.userName,
                stepIndex,
                stepId: stepId || null,
                hasOperated: false
              }))
            });
            console.log('[Hazard PATCH] 已创建新的候选处理人记录');
          }
        }

        // 🟢 5. 在同一事务中更新候选处理人操作状态（如果用户执行了操作）
        // 扩展支持的操作类型：包括审批通过、提交整改、验收通过、驳回等
        const supportedActions = ['提交整改', '验收通过', '驳回', '指派整改', '提交上报', '审批通过', '通过'];
        if (operatorId && (supportedActions.includes(actionName) || actionName?.includes('审批') || actionName?.includes('通过'))) {
          const stepIndex = finalUpdates.currentStepIndex ?? oldRecord.currentStepIndex ?? 0;
          const approvalMode = finalUpdates.approvalMode ?? oldRecord.approvalMode;
          
          console.log('[Hazard PATCH] 检查是否需要更新候选人操作状态:', {
            operatorId,
            actionName,
            stepIndex,
            approvalMode
          });

          if (approvalMode && (approvalMode === 'OR' || approvalMode === 'AND')) {
            // 更新操作状态
            const updateResult = await tx.hazardCandidateHandler.updateMany({
              where: {
                hazardId: id,
                userId: operatorId,
                stepIndex
              },
              data: {
                hasOperated: true,
                operatedAt: new Date(),
                opinion: (actionName === '驳回' || actionName?.includes('驳回')) ? rejectReason || null : null
              }
            });
            console.log('[Hazard PATCH] 已更新候选人操作状态，影响行数:', updateResult.count);
          }
        }

        // 🟢 6. 在同一事务中更新抄送用户关联表（如果提供了抄送用户）
        if (ccUsersInput && Array.isArray(ccUsersInput) && ccUsersInput.length > 0) {
          console.log('[Hazard PATCH] 开始更新抄送用户关联表:', {
            count: ccUsersInput.length,
            userIds: ccUsersInput
          });

          // 删除旧的抄送记录
          await tx.hazardCC.deleteMany({
            where: { hazardId: id }
          });
          console.log('[Hazard PATCH] 已删除旧的抄送记录');

          // 获取用户信息
          const users = await tx.user.findMany({
            where: { id: { in: ccUsersInput } },
            select: { id: true, name: true }
          });
          const userMap = new Map(users.map(u => [u.id, u.name]));
          console.log('[Hazard PATCH] 已获取用户信息，找到:', users.length, '个用户');

          // 创建新的抄送记录
          await tx.hazardCC.createMany({
            data: ccUsersInput.map((userId: string) => ({
              hazardId: id,
              userId,
              userName: userMap.get(userId) || null
            }))
          });
          console.log('[Hazard PATCH] 已创建新的抄送记录');
        }

        // 7. 在同一事务中创建通知（如果提供了通知数据）
        if (body.notifications && Array.isArray(body.notifications) && body.notifications.length > 0) {
          const notifications = body.notifications;
          
          console.log('[Hazard PATCH] 开始创建通知:', {
            count: notifications.length,
            notifications: notifications.map((n: any) => ({
              userId: n.userId,
              type: n.type,
              title: n.title,
              hasContent: !!n.content
            }))
          });

          // 验证每个通知都有必要字段
          const invalidNotification = notifications.find(
            (n: any) => !n.userId || !n.type || !n.title || !n.content
          );

          if (invalidNotification) {
            console.error('[Hazard PATCH] 通知数据验证失败:', invalidNotification);
            throw new Error(`通知数据缺少必要字段: ${JSON.stringify(invalidNotification)}`);
          }

          // 批量创建通知（在同一事务中）
          await Promise.all(notifications.map(async (n: any, index: number) => {
            try {
              await tx.notification.create({
                data: {
                  userId: n.userId,
                  type: n.type,
                  title: n.title,
                  content: n.content,
                  relatedType: n.relatedType || 'hazard',
                  relatedId: n.relatedId || id,
                  isRead: false,
                }
              });
              console.log(`[Hazard PATCH] 通知 ${index + 1}/${notifications.length} 创建成功`);
            } catch (notifError) {
              console.error(`[Hazard PATCH] 通知 ${index + 1} 创建失败:`, notifError);
              throw notifError;
            }
          }));

          console.log(`✅ [事务] 已创建 ${notifications.length} 条通知（事务内）`);
        }

        // ✅ P1修复：在同一事务中同步可见性表（如果需要）
        // ✅ P2修复：检测关键字段变化，触发可见性同步
        const needsVisibilitySync = 
          finalUpdates.responsibleId !== undefined ||
          finalUpdates.verifierId !== undefined ||
          finalUpdates.dopersonal_ID !== undefined ||
          finalUpdates.status !== undefined ||
          ccUsersInput !== undefined ||
          candidateHandlersInput !== undefined;

        if (needsVisibilitySync) {
          console.log('[Hazard PATCH] 检测到关键字段变化，同步可见性表');
          await syncHazardVisibility(id, tx);
        }

        console.log('[Hazard PATCH] 事务即将提交');
        return updatedRecord;
      } catch (txError) {
        console.error('[Hazard PATCH] 事务执行失败:', {
          error: txError,
          message: txError instanceof Error ? txError.message : String(txError),
          stack: txError instanceof Error ? txError.stack : undefined,
          hazardId: id,
          actionName
        });
        // ✅ 确保错误消息被正确传递，如果是已知错误类型，保持原消息；否则添加上下文
        if (txError instanceof Error) {
          // 如果错误消息已经足够详细，直接抛出
          if (txError.message && txError.message.length > 0) {
            throw txError;
          }
          // 否则创建一个包含上下文的新错误
          throw new Error(`更新隐患记录失败: ${txError.message || '未知错误'}`);
        }
        throw txError;
      }
    }).catch(txError => {
      console.error('[Hazard PATCH] 事务回滚:', {
        error: txError,
        message: txError instanceof Error ? txError.message : String(txError),
        hazardId: id
      });
      // ✅ 确保错误消息被正确传递
      if (txError instanceof Error && txError.message) {
        throw txError;
      }
      throw new Error(`事务执行失败: ${txError instanceof Error ? txError.message : String(txError)}`);
    });

    console.log('[Hazard PATCH] 事务提交成功');

    // ✅ P1修复：可见性同步已在事务中完成，这里不再需要

    // 🔐 处理电子签名：如果是验收通过操作且提供了签名数据，创建签名记录
    // 判断条件：1. actionName 是验收相关 2. 状态变为 closed 且提供了签名 3. 提供了签名数据
    const isVerifyAction = actionName === '验收通过' || actionName === 'verify_pass' || 
                           (res.status === 'closed' && oldRecord.status !== 'closed');
    if (isVerifyAction && signature && signerId && signerName) {
      try {
        // 导入签名服务
        const { createSignature, extractClientInfo } = await import('@/services/signatureService');
        
        // 准备签名数据（将隐患数据序列化为 JSON）
        const hazardDataJson = JSON.stringify({
          id: res.id,
          code: res.code,
          status: res.status,
          verifyDesc: res.verifyDesc || updates.verifyDesc,
          verifyPhotos: res.verifyPhotos || updates.verifyPhotos,
          rootCause: res.rootCause || updates.rootCause,
          updatedAt: new Date().toISOString()
        });

        // 获取客户端信息
        const clientInfo = extractClientInfo(request);

        // 创建签名记录
        await createSignature({
          hazardId: id,
          signerId,
          signerName,
          action: 'pass', // 验收通过
          comment: verifyDesc || null,
          stepIndex: res.currentStepIndex ?? (oldRecord.currentStepIndex ?? 3), // 验收步骤索引（通常是最后一步）
          stepName: '隐患验收',
          clientInfo
        }, hazardDataJson, false); // 不保存完整快照，仅保存 Hash

        console.log(`✅ [隐患验收] 已创建签名记录，隐患ID: ${id}, 签字人: ${signerName}`);
      } catch (signatureError) {
        console.error('[隐患验收] 创建签名记录失败:', signatureError);
        // 签名创建失败不影响主流程，但记录错误
      }
    }

    // 生成变更描述（用于日志记录）
    const changeDesc = generateChanges(oldRecord as HazardRecord, updates);

    // 记录操作日志 - 同时保存编号和数据库ID
    await logApiOperation(user, 'hidden_danger', actionName || 'update', {
      hazardId: res.code || id,  // 保留向后兼容
      code: res.code,            // 隐患编号
      id: res.id || id,          // 数据库主键
      action: actionName,
      changes: changeDesc || updates.extensionReason || '无关键字段变更'
    });

    return NextResponse.json(mapHazard(res));
  })
);

export const DELETE = withErrorHandling(
  withPermission('hidden_danger', 'delete', async (request: NextRequest, context, user) => {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing ID' }, { status: 400 });
    }

    // 获取隐患信息用于日志
    const hazard = await prisma.hazardRecord.findUnique({
      where: { id },
      select: { code: true, type: true, location: true }
    });

    await prisma.hazardRecord.delete({ where: { id } });

    // 记录操作日志 - 同时保存编号和数据库ID
    await logApiOperation(user, 'hidden_danger', 'delete', {
      hazardId: hazard?.code || id, // 保留向后兼容
      code: hazard?.code,           // 隐患编号
      id: id,                       // 数据库主键
      type: hazard?.type,
      location: hazard?.location
    });

    return NextResponse.json({ success: true });
  })
);
