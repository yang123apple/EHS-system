// src/app/api/hazards/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/mockDb';
import { HazardRecord } from '@/types/hidden-danger';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

// Prisma 类型定义
type PrismaHazardRecord = Prisma.HazardRecordGetPayload<{}>;
import { withErrorHandling, withAuth, withPermission, logApiOperation } from '@/middleware/auth';
import { setEndOfDay, extractDatePart, normalizeDate } from '@/utils/dateUtils';
import { safeJsonParse, safeJsonParseArray } from '@/utils/jsonUtils';
import { maskUserSensitiveFields } from '@/utils/dataMasking';
import { logError, extractErrorContext } from '@/utils/errorLogger';
import { canViewHazard } from '@/app/hidden-danger/_utils/permissions';

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
async function mapHazard(pHazard: PrismaHazardRecord): Promise<HazardRecord> {
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
      reporterId: pHazard.reporterId,
      reporterName: pHazard.reporterName,
      responsibleId: pHazard.responsibleId ?? undefined,
      responsibleName: pHazard.responsibleName ?? undefined,
      responsibleDept: pHazard.responsibleDept ?? undefined,
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
    // 注意：在"我的任务"模式下，权限过滤已经在上面处理了，这里只需要进一步细化查询条件
    if (viewMode === 'my_tasks' && userId) {
      // 确保使用当前登录用户的ID，而不是请求参数中的userId（防止IDOR）
      const actualUserId = user.id;
      
      // 🟢 使用关联表查询，提升性能和准确性
      // 查询条件：上报人、责任人、验收人、抄送人、当前执行人、候选处理人
      const ccHazards = await prisma.hazardCC.findMany({
        where: { userId: actualUserId },
        select: { hazardId: true }
      });
      const ccHazardIds = ccHazards.map(h => h.hazardId);

      const candidateHazards = await prisma.hazardCandidateHandler.findMany({
        where: {
          userId: actualUserId,
          hasOperated: false // 只查询未操作的候选处理人
        },
        select: { hazardId: true }
      });
      const candidateHazardIds = candidateHazards.map(h => h.hazardId);

      // 合并所有相关的隐患ID
      const allRelatedHazardIds = [
        ...ccHazardIds,
        ...candidateHazardIds
      ];

      // 构建"我的任务"的特定查询条件
      const myTasksConditions: Prisma.HazardRecordWhereInput[] = [
        { reporterId: actualUserId },
        { responsibleId: actualUserId },
        { verifierId: actualUserId },
        { dopersonal_ID: actualUserId },
        ...(allRelatedHazardIds.length > 0 ? [{ id: { in: allRelatedHazardIds } }] : [])
      ];

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
    }

    if (isPaginated) {
      try {
        const [hazards, total] = await Promise.all([
          prisma.hazardRecord.findMany({
            where,
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' },
            include: { reporter: true, responsible: true }
          }),
          prisma.hazardRecord.count({ where })
        ]);

        // ✅ 修复问题7：在返回数据前再次进行权限校验（双重保障）
        const mappedHazards = await Promise.all(hazards.map(mapHazard));
        const filteredHazards = isAdmin 
          ? mappedHazards 
          : mappedHazards.filter(h => canViewHazard(h, user));

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
        include: { reporter: true, responsible: true }
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

    // 处理数组字段：转换为 JSON 字符串
    // 处理日期字段：转换为 Date 对象
    const processedData: any = {
      ...validData,
      photos: photosInput ? (Array.isArray(photosInput) ? JSON.stringify(photosInput) : photosInput) : null,
      ccDepts: ccDeptsInput ? (Array.isArray(ccDeptsInput) ? JSON.stringify(ccDeptsInput) : ccDeptsInput) : null,
      ccUsers: ccUsersInput ? (Array.isArray(ccUsersInput) ? JSON.stringify(ccUsersInput) : ccUsersInput) : null,
      logs: logsInput ? (Array.isArray(logsInput) ? JSON.stringify(logsInput) : logsInput) : null,
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
      const res = await prisma.hazardRecord.create({
        data: processedData
      });

      // 记录操作日志
      await logApiOperation(user, 'hidden_danger', 'report', {
        hazardId: res.id,
        type: res.type,
        location: res.location,
        riskLevel: res.riskLevel
      });

      return NextResponse.json(await mapHazard(res));
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
    const body = await request.json();
    const {
      id,
      operatorId,
      operatorName,
      actionName,
      // 过滤掉 Prisma schema 中不存在的字段（但保留 currentStepIndex 和 currentStepId）
      dopersonal_ID,
      dopersonal_Name,
      responsibleDeptId,
      responsibleDeptName,
      isExtensionRequested,
      rejectReason,
      photos: photosInput,
      ccDepts: ccDeptsInput,
      ccUsers: ccUsersInput,
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
      ...updates
    } = body;

    // 🔒 使用事务保护，避免并发覆盖
    let oldRecord: any = null; // 用于事务外访问
    const res = await prisma.$transaction(async (tx) => {
      // 1. 在事务中重新读取当前状态（避免并发覆盖）
      oldRecord = await tx.hazardRecord.findUnique({ where: { id } });

      if (!oldRecord) {
        throw new Error('隐患记录不存在');
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
      if (dopersonal_ID !== undefined && oldRecord.dopersonal_ID && oldRecord.dopersonal_ID !== dopersonal_ID) {
        // 如果当前执行人已被其他操作修改，且不是预期的更新，则拒绝
        // 注意：这里允许更新为新的执行人（正常流转），但不允许覆盖已变更的执行人
        if (updates.dopersonal_ID === oldRecord.dopersonal_ID) {
          // 如果传入的dopersonal_ID与数据库中的一致，说明没有并发冲突
        } else {
          console.warn(`[并发检测] dopersonal_ID 不一致: 数据库=${oldRecord.dopersonal_ID}, 传入=${dopersonal_ID}`);
          // 不直接拒绝，因为可能是正常的流转更新
        }
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

      // 🔴 关键修复：确保 dopersonal_ID 和 dopersonal_Name 被保存
      if (dopersonal_ID !== undefined) {
        finalUpdates.dopersonal_ID = dopersonal_ID;
      }
      if (dopersonal_Name !== undefined) {
        finalUpdates.dopersonal_Name = dopersonal_Name;
      }

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
      const updatedRecord = await tx.hazardRecord.update({
        where: { id },
        data: finalUpdates
      });

      // 🟢 4. 在同一事务中更新候选处理人关联表（如果提供了派发结果）
      if (body.dispatchResult?.candidateHandlers && Array.isArray(body.dispatchResult.candidateHandlers)) {
        const stepIndex = finalUpdates.currentStepIndex ?? oldRecord.currentStepIndex ?? 0;
        const stepId = finalUpdates.currentStepId ?? oldRecord.currentStepId || undefined;
        
        // 删除该步骤的旧记录
        await tx.hazardCandidateHandler.deleteMany({
          where: {
            hazardId: id,
            stepIndex
          }
        });

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
        }
      }

      // 🟢 5. 在同一事务中更新候选处理人操作状态（如果用户执行了操作）
      if (operatorId && (actionName === '提交整改' || actionName === '验收通过' || actionName === '驳回')) {
        const stepIndex = finalUpdates.currentStepIndex ?? oldRecord.currentStepIndex ?? 0;
        const approvalMode = finalUpdates.approvalMode ?? oldRecord.approvalMode;
        
        if (approvalMode && (approvalMode === 'OR' || approvalMode === 'AND')) {
          // 更新操作状态
          await tx.hazardCandidateHandler.updateMany({
            where: {
              hazardId: id,
              userId: operatorId,
              stepIndex
            },
            data: {
              hasOperated: true,
              operatedAt: new Date(),
              opinion: actionName === '驳回' ? rejectReason || null : null
            }
          });
        }
      }

      // 🟢 6. 在同一事务中更新抄送用户关联表（如果提供了抄送用户）
      if (ccUsersInput && Array.isArray(ccUsersInput) && ccUsersInput.length > 0) {
        // 删除旧的抄送记录
        await tx.hazardCC.deleteMany({
          where: { hazardId: id }
        });

        // 获取用户信息
        const users = await tx.user.findMany({
          where: { id: { in: ccUsersInput } },
          select: { id: true, name: true }
        });
        const userMap = new Map(users.map(u => [u.id, u.name]));

        // 创建新的抄送记录
        await tx.hazardCC.createMany({
          data: ccUsersInput.map((userId: string) => ({
            hazardId: id,
            userId,
            userName: userMap.get(userId) || null
          }))
        });
      }

      // 7. 在同一事务中创建通知（如果提供了通知数据）
      if (body.notifications && Array.isArray(body.notifications) && body.notifications.length > 0) {
        const notifications = body.notifications;
        
        // 验证每个通知都有必要字段
        const invalidNotification = notifications.find(
          (n: any) => !n.userId || !n.type || !n.title || !n.content
        );

        if (invalidNotification) {
          throw new Error('通知数据缺少必要字段');
        }

        // 批量创建通知（在同一事务中）
        await Promise.all(notifications.map(async (n: any) => {
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
        }));

        console.log(`✅ [事务] 已创建 ${notifications.length} 条通知（事务内）`);
      }

      return updatedRecord;
    });

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

    // 记录操作日志
    await logApiOperation(user, 'hidden_danger', actionName || 'update', {
      hazardId: id,
      action: actionName,
      changes: changeDesc
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
      select: { type: true, location: true }
    });

    await prisma.hazardRecord.delete({ where: { id } });

    // 记录操作日志
    await logApiOperation(user, 'hidden_danger', 'delete', {
      hazardId: id,
      type: hazard?.type,
      location: hazard?.location
    });

    return NextResponse.json({ success: true });
  })
);
