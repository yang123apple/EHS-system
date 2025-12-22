// src/app/api/logs/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  // 1. 简易权限校验 (实际项目中建议结合 session/token 校验)
  // 这里假设前端会过滤，后端只做兜底。严谨做法是从 header 获取 user 校验 role === 'admin'
  
  try {
    const logs = await prisma.systemLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100, // 限制最新的 100 条，或者做分页
    });
    return NextResponse.json(logs);
  } catch (error) {
    return NextResponse.json({ error: '获取日志失败' }, { status: 500 });
  }
}