// src/app/api/logs/route.ts
import { NextResponse } from 'next/server';
import { SystemLogService } from '@/services/systemLog.service';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1');
  // 支持 limit 和 pageSize 两种参数名
  const limit = parseInt(searchParams.get('limit') || searchParams.get('pageSize') || '50');
  const targetType = searchParams.get('targetType') || '';
  const action = searchParams.get('action') || '';
  const userId = searchParams.get('userId') || '';
  const startDate = searchParams.get('startDate') || '';
  const endDate = searchParams.get('endDate') || '';

  try {
    const result = await SystemLogService.getLogs({
      page,
      limit,
      targetType,
      action,
      userId,
      startDate,
      endDate,
    });

    // 统一返回格式：{ success: true, data: { logs, total, ... }, meta: {...} }
    // 同时解析快照数据（从 JSON 字符串转为对象）
    const logs = result.data.map((log: any) => ({
      ...log,
      snapshot: log.snapshot ? (typeof log.snapshot === 'string' ? JSON.parse(log.snapshot) : log.snapshot) : null,
    }));

    return NextResponse.json({
      success: true,
      data: {
        logs,
        total: result.meta.total,
      },
      meta: result.meta,
    });
  } catch (error) {
    console.error('获取日志失败:', error);
    return NextResponse.json({ 
      success: false, 
      error: '获取日志失败',
      data: { logs: [], total: 0 },
      meta: { page: 1, limit: 50, totalPages: 0 }
    }, { status: 500 });
  }
}
