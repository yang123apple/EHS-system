// src/app/api/logs/route.ts
import { NextResponse } from 'next/server';
import { SystemLogService } from '@/services/systemLog.service';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');
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

    return NextResponse.json(result);
  } catch (error) {
    console.error('获取日志失败:', error);
    return NextResponse.json({ error: '获取日志失败' }, { status: 500 });
  }
}
