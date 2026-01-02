// src/app/api/hazards/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/mockDb';
import { HazardRecord } from '@/types/hidden-danger';
import { prisma } from '@/lib/prisma';
import { withErrorHandling, withAuth, withPermission, logApiOperation } from '@/middleware/auth';
import { setEndOfDay, extractDatePart, normalizeDate } from '@/utils/dateUtils';

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

// 转换 Prisma HazardRecord 到前端 HazardRecord 类型
function mapHazard(pHazard: any): HazardRecord {
  try {
    return {
      ...pHazard,
      photos: pHazard.photos ? (typeof pHazard.photos === 'string' ? JSON.parse(pHazard.photos) : pHazard.photos) : [],
      rectifyPhotos: pHazard.rectifyPhotos ? (typeof pHazard.rectifyPhotos === 'string' ? JSON.parse(pHazard.rectifyPhotos) : pHazard.rectifyPhotos) : [],
      logs: pHazard.logs ? (typeof pHazard.logs === 'string' ? JSON.parse(pHazard.logs) : pHazard.logs) : [],
      ccDepts: pHazard.ccDepts ? (typeof pHazard.ccDepts === 'string' ? JSON.parse(pHazard.ccDepts) : pHazard.ccDepts) : [],
      ccUsers: pHazard.ccUsers ? (typeof pHazard.ccUsers === 'string' ? JSON.parse(pHazard.ccUsers) : pHazard.ccUsers) : [],
      old_personal_ID: pHazard.old_personal_ID ? (typeof pHazard.old_personal_ID === 'string' ? JSON.parse(pHazard.old_personal_ID) : pHazard.old_personal_ID) : [],
      // 🟢 新增：处理候选处理人列表（或签模式）
      candidateHandlers: pHazard.candidateHandlers ? (typeof pHazard.candidateHandlers === 'string' ? JSON.parse(pHazard.candidateHandlers) : pHazard.candidateHandlers) : undefined,
      reportTime: normalizeDate(pHazard.reportTime),
      rectifyTime: normalizeDate(pHazard.rectifyTime),
      verifyTime: normalizeDate(pHazard.verifyTime),
      deadline: normalizeDate(pHazard.deadline),
      emergencyPlanDeadline: normalizeDate(pHazard.emergencyPlanDeadline),
      emergencyPlanSubmitTime: normalizeDate(pHazard.emergencyPlanSubmitTime),
      createdAt: normalizeDate(pHazard.createdAt),
      updatedAt: normalizeDate(pHazard.updatedAt),
    };
  } catch (error) {
    console.error('[mapHazard] 转换失败:', error, pHazard);
    // 如果解析失败，返回原始数据但确保 photos 是数组
    return {
      ...pHazard,
      photos: Array.isArray(pHazard.photos) ? pHazard.photos : [],
      rectifyPhotos: Array.isArray(pHazard.rectifyPhotos) ? pHazard.rectifyPhotos : [],
      logs: Array.isArray(pHazard.logs) ? pHazard.logs : [],
      ccDepts: Array.isArray(pHazard.ccDepts) ? pHazard.ccDepts : [],
      ccUsers: Array.isArray(pHazard.ccUsers) ? pHazard.ccUsers : [],
      old_personal_ID: Array.isArray(pHazard.old_personal_ID) ? pHazard.old_personal_ID : [],
      candidateHandlers: Array.isArray(pHazard.candidateHandlers) ? pHazard.candidateHandlers : undefined,
    };
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

    // ✅ 新增：专门处理统计数据的请求
    if (type === 'stats') {
      const hazards = await prisma.hazardRecord.findMany();
      
      // 1. 风险占比
      const riskStats = {
        low: hazards.filter(h => h.riskLevel === 'low').length,
        medium: hazards.filter(h => h.riskLevel === 'medium').length,
        high: hazards.filter(h => h.riskLevel === 'high').length,
        major: hazards.filter(h => h.riskLevel === 'major').length,
      };

      // 2. 计算近30天同一区域同类隐患重复率
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      // 分组计数: "区域-类型"
      const recurrenceMap: Record<string, number> = {};
      hazards.forEach(h => {
        if (new Date(h.reportTime) >= thirtyDaysAgo) {
          const key = `${h.location}-${h.type}`;
          recurrenceMap[key] = (recurrenceMap[key] || 0) + 1;
        }
      });

      // 筛选出发生次数 > 1 的高频问题
      const recurringIssues = Object.entries(recurrenceMap)
        .filter(([_, count]) => count > 1)
        .map(([key, count]) => ({ key, count }));

      return NextResponse.json({ riskStats, recurringIssues });
    }

    // 普通列表查询
    const where: any = {};

    if (filterType) where.type = filterType;
    else if (type && type !== 'stats') where.type = type;

    if (area) where.location = area;
    if (status) where.status = status;
    if (risk) where.riskLevel = risk;

    // Handle 'My Tasks' logic server-side
    if (viewMode === 'my_tasks' && userId) {
      where.OR = [
        { reporterId: userId },
        { responsibleId: userId },
        { verifierId: userId },
        { ccUsers: { contains: userId } }
      ];
    }

    if (isPaginated) {
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

      return NextResponse.json({
        data: hazards.map(mapHazard),
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      });
    }

    // Fallback to fetching all if no pagination params
    const data = await prisma.hazardRecord.findMany({
      orderBy: { createdAt: 'desc' },
      include: { reporter: true, responsible: true }
    });
    return NextResponse.json(data.map(mapHazard));
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

      return NextResponse.json(mapHazard(res));
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
      ...updates 
    } = body;
    
    // 获取旧数据
    const oldRecord: any = await prisma.hazardRecord.findUnique({ where: { id } });
    
    if (!oldRecord) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
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

    let currentLogs = [];
    try {
      currentLogs = JSON.parse(oldRecord.logs || '[]');
    } catch(e) {}

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

    const res = await prisma.hazardRecord.update({
      where: { id },
      data: finalUpdates
    });

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
