// src/app/api/logs/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1');
  // 支持 limit 和 pageSize 两种参数名
  const limit = parseInt(searchParams.get('limit') || searchParams.get('pageSize') || '50');
  const targetType = searchParams.get('targetType') || '';
  const targetId = searchParams.get('targetId') || '';
  const action = searchParams.get('action') || '';
  const userId = searchParams.get('userId') || '';
  const startDate = searchParams.get('startDate') || '';
  const endDate = searchParams.get('endDate') || '';
  const module = searchParams.get('module') || '';

  try {
    const skip = (page - 1) * limit;
    const where: any = {};

    // 构建查询条件
    if (targetType) where.targetType = { contains: targetType };
    if (targetId) where.targetId = { contains: targetId };
    if (action) where.action = { contains: action };
    if (userId) where.userId = userId;
    if (module) where.module = module;
    
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        where.createdAt.gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    const [logs, total] = await Promise.all([
      prisma.systemLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.systemLog.count({ where }),
    ]);

    // 解析所有JSON字段（从字符串转为对象）
    const parsedLogs = logs.map((log: any) => ({
      ...log,
      beforeData: log.beforeData ? (typeof log.beforeData === 'string' ? JSON.parse(log.beforeData) : log.beforeData) : null,
      afterData: log.afterData ? (typeof log.afterData === 'string' ? JSON.parse(log.afterData) : log.afterData) : null,
      changes: log.changes ? (typeof log.changes === 'string' ? JSON.parse(log.changes) : log.changes) : null,
      snapshot: log.snapshot ? (typeof log.snapshot === 'string' ? JSON.parse(log.snapshot) : log.snapshot) : null,
      diff: log.diff ? (typeof log.diff === 'string' ? JSON.parse(log.diff) : log.diff) : null,
      clientInfo: log.clientInfo ? (typeof log.clientInfo === 'string' ? JSON.parse(log.clientInfo) : log.clientInfo) : null,
    }));

    return NextResponse.json({
      success: true,
      data: {
        logs: parsedLogs,
        total,
      },
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('获取日志失败:', error);
    return NextResponse.json({ 
      success: false, 
      error: '获取日志失败',
      data: { logs: [], total: 0 },
      meta: { page: 1, limit: 50, total: 0, totalPages: 0 }
    }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // 验证必需字段
    if (!body.module) {
      return NextResponse.json(
        { success: false, error: 'module字段为必需字段' },
        { status: 400 }
      );
    }
    
    const logData: any = {
      // 用户信息
      userId: body.userId,
      userName: body.userName,
      userRole: body.userRole,
      userDepartment: body.userDepartment,
      userDepartmentId: body.userDepartmentId,
      userJobTitle: body.userJobTitle,
      userRoleInAction: body.userRoleInAction,
      
      // 操作信息
      action: body.action,
      actionLabel: body.actionLabel,
      module: body.module,
      
      // 目标对象
      targetId: body.targetId,
      targetType: body.targetType,
      targetLabel: body.targetLabel,
      
      // 详情
      details: body.details,
      beforeData: body.beforeData ? JSON.stringify(body.beforeData) : null,
      afterData: body.afterData ? JSON.stringify(body.afterData) : null,
      changes: body.changes ? JSON.stringify(body.changes) : null,
      snapshot: body.snapshot ? JSON.stringify(body.snapshot) : null,
      diff: body.diff ? JSON.stringify(body.diff) : null,
      
      // 客户端信息
      ip: body.ip || req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
      userAgent: body.userAgent || req.headers.get('user-agent') || undefined,
      clientInfo: body.clientInfo ? JSON.stringify(body.clientInfo) : null,
    };

    const log = await prisma.systemLog.create({
      data: logData,
    });

    if (!log) {
      return NextResponse.json(
        { success: false, error: '创建日志失败' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: log,
    });
  } catch (error) {
    console.error('创建日志失败:', error);
    return NextResponse.json(
      { success: false, error: '创建日志失败' },
      { status: 500 }
    );
  }
}
