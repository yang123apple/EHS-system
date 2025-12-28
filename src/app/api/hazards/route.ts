// src/app/api/hazards/route.ts
import { NextResponse } from 'next/server';
import { db, HazardRecord } from '@/lib/mockDb';

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
  const type = searchParams.get('type');

  // ✅ 新增：专门处理统计数据的请求
  if (type === 'stats') {
    const hazards = await db.getHazards();
    
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

  // 普通列表查询 (支持分页逻辑可在此扩展)
  const data = await db.getHazards();
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const body = await request.json();
  const res = await db.createHazard(body);
  return NextResponse.json(res);
}

export async function PATCH(request: Request) {
  const body = await request.json();
  const { id, operatorId, operatorName, actionName, ...updates } = body;
  
  // 获取旧数据
  const hazards = await db.getHazards();
  const oldRecord = hazards.find(h => h.id === id);
  
  if (!oldRecord) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // 构造日志
  const changeDesc = generateChanges(oldRecord, updates);
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

  const finalUpdates = {
    ...updates,
    logs: [newLog, ...(oldRecord.logs || [])] // 新日志插在最前
  };

  const res = await db.updateHazard(id, finalUpdates);
  return NextResponse.json(res);
}
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (id) {
    await db.deleteHazard(id);
    return NextResponse.json({ success: true });
  }
  return NextResponse.json({ error: 'Missing ID' }, { status: 400 });
}
