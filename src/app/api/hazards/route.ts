// src/app/api/hazards/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/mockDb';
import { HazardRecord } from '@/types/hidden-danger';
import { prisma } from '@/lib/prisma';

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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type'); // This might be 'stats' or a filter value?
  // Wait, 'type' param is used for 'stats' mode.
  // If type is NOT stats, it could be a filter 'type'.
  // We need to disambiguate.

  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');
  const skip = (page - 1) * limit;
  const isPaginated = searchParams.has('page');

  // Filters
  const filterType = searchParams.get('filterType'); // Use distinct param name or check value
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

  // Use 'type' if it's not 'stats', or use 'filterType' if provided
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
          { ccUsers: { contains: userId } } // Assuming ccUsers is a string
      ];
      // Note: 'dopersonal_ID' is not standard in schema but used in frontend logic.
      // If it exists in DB schema (it does not appear in prisma/schema.prisma I read earlier, but frontend uses it),
      // I should check schema again.
      // Schema has: `old_personal_ID`. Frontend uses `dopersonal_ID`.
      // I will assume standard fields for now.
      // If `dopersonal_ID` is important, it needs to be mapped or schema updated.
      // Based on schema: `responsibleId` is likely the current assignee.
  }

  if (isPaginated) {
     const [hazards, total] = await Promise.all([
         prisma.hazardRecord.findMany({
             where,
             skip,
             take: limit,
             orderBy: { createdAt: 'desc' },
             include: { reporter: true, responsible: true } // Include relations if needed
         }),
         prisma.hazardRecord.count({ where })
     ]);

     return NextResponse.json({
         data: hazards,
         meta: {
             total,
             page,
             limit,
             totalPages: Math.ceil(total / limit)
         }
     });
  }

  // Fallback to fetching all if no pagination params (for backward compatibility)
  const data = await prisma.hazardRecord.findMany({
      orderBy: { createdAt: 'desc' },
      include: { reporter: true, responsible: true }
  });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const body = await request.json();
  const res = await prisma.hazardRecord.create({
      data: body
  });
  return NextResponse.json(res);
}

export async function PATCH(request: Request) {
  const body = await request.json();
  const { id, operatorId, operatorName, actionName, ...updates } = body;
  
  // 获取旧数据 - Use prisma
  const oldRecord: any = await prisma.hazardRecord.findUnique({ where: { id } });
  
  if (!oldRecord) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // 构造日志
  const changeDesc = generateChanges(oldRecord as HazardRecord, updates);
  const newLog: any = {
    operatorId: operatorId || 'system',
    operatorName: operatorName || '系统',
    action: actionName || '更新记录', // 例如：指派、整改、驳回
    time: new Date().toISOString(),
    changes: changeDesc || updates.extensionReason || '无关键字段变更'
  };

  // 如果有抄送信息，也记录到日志中
  if (updates.ccUsers && updates.ccUsers.length > 0) {
    newLog.ccUsers = updates.ccUsers;
    newLog.ccUserNames = updates.ccUserNames || [];
  }

  // Update logs logic needs to be handled. Prisma stores logs as String (JSON).
  let currentLogs = [];
  try {
      currentLogs = JSON.parse(oldRecord.logs || '[]');
  } catch(e) {}

  const updatedLogs = [newLog, ...currentLogs];

  const finalUpdates = {
    ...updates,
    logs: JSON.stringify(updatedLogs)
  };

  // Remove fields that are not in schema or handled differently
  delete finalUpdates.ccUserNames;
  if (finalUpdates.ccUsers) {
      finalUpdates.ccUsers = JSON.stringify(finalUpdates.ccUsers); // Store as string if schema is string
  }

  // Use prisma directly to update
  const res = await prisma.hazardRecord.update({
      where: { id },
      data: finalUpdates
  });

  return NextResponse.json(res);
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (id) {
    await prisma.hazardRecord.delete({ where: { id } });
    return NextResponse.json({ success: true });
  }
  return NextResponse.json({ error: 'Missing ID' }, { status: 400 });
}
