import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// 获取系统日志列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const action = searchParams.get('action') || '';
    const userId = searchParams.get('userId') || '';
    const targetType = searchParams.get('targetType') || '';
    const startDate = searchParams.get('startDate') || '';
    const endDate = searchParams.get('endDate') || '';
    const type = searchParams.get('type') || ''; // 'login' | 'operation'

    const skip = (page - 1) * limit;

    // 构建查询条件
    const where: any = {};

    // 登录日志：action = 'login' 或 'logout' 或中文的 '用户登录' 或 '用户退出'
    // 操作日志：其他所有action
    if (type === 'login') {
      where.action = { in: ['login', 'logout', '用户登录', '用户退出'] };
    } else if (type === 'operation') {
      where.action = { notIn: ['login', 'logout', '用户登录', '用户退出'] };
    }

    // 如果指定了 action 筛选，需要结合 type 条件
    if (action) {
      if (type === 'login') {
        // 在登录日志中搜索，需要同时满足两个条件
        where.AND = [
          { action: { in: ['login', 'logout', '用户登录', '用户退出'] } },
          { action: { contains: action } }
        ];
        delete where.action;
      } else if (type === 'operation') {
        // 在操作日志中搜索，需要同时满足两个条件
        where.AND = [
          { action: { notIn: ['login', 'logout', '用户登录', '用户退出'] } },
          { action: { contains: action } }
        ];
        delete where.action;
      } else {
        // 没有指定类型，直接按 action 搜索
        where.action = { contains: action };
      }
    }

    if (userId) {
      where.userId = userId;
    }

    if (targetType) {
      where.targetType = targetType;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }

    // 查询日志
    const [logs, total] = await Promise.all([
      prisma.systemLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.systemLog.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        logs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('获取系统日志失败:', error);
    return NextResponse.json(
      { success: false, message: '获取系统日志失败' },
      { status: 500 }
    );
  }
}

// 获取日志统计数据
export async function POST(request: NextRequest) {
  try {
    const { type } = await request.json();

    if (type === 'stats') {
      // 获取统计数据
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const last7Days = new Date(today);
      last7Days.setDate(last7Days.getDate() - 7);
      const last30Days = new Date(today);
      last30Days.setDate(last30Days.getDate() - 30);

      const [
        totalLogs,
        todayLogs,
        todayLogins,
        uniqueUsersToday,
        loginLogs,
        operationLogs,
        errorLogs,
        topUsers,
        topActions,
        dailyStats,
      ] = await Promise.all([
        // 总日志数
        prisma.systemLog.count(),
        
        // 今日日志数
        prisma.systemLog.count({
          where: { createdAt: { gte: today } },
        }),
        
        // 今日登录数（包含登录和退出）
        prisma.systemLog.count({
          where: { 
            action: { in: ['login', 'logout', '用户登录', '用户退出'] },
            createdAt: { gte: today },
          },
        }),
        
        // 今日活跃用户数
        prisma.systemLog.groupBy({
          by: ['userId'],
          where: {
            createdAt: { gte: today },
            userId: { not: null },
          },
        }).then(result => result.length),
        
        // 登录日志数（包含登录和退出）
        prisma.systemLog.count({
          where: { action: { in: ['login', 'logout', '用户登录', '用户退出'] } },
        }),
        
        // 操作日志数
        prisma.systemLog.count({
          where: { action: { notIn: ['login', 'logout', '用户登录', '用户退出'] } },
        }),
        
        // 错误日志数（包含"失败"或"错误"的action）
        prisma.systemLog.count({
          where: {
            OR: [
              { action: { contains: '失败' } },
              { action: { contains: '错误' } },
              { details: { contains: 'error' } },
            ],
          },
        }),
        
        // 操作最多的用户（最近7天）
        prisma.systemLog.groupBy({
          by: ['userId', 'userName'],
          where: {
            createdAt: { gte: last7Days },
            userId: { not: null },
          },
          _count: { id: true },
          orderBy: { _count: { id: 'desc' } },
          take: 5,
        }),
        
        // 最常见的操作（最近7天）
        prisma.systemLog.groupBy({
          by: ['action'],
          where: {
            createdAt: { gte: last7Days },
          },
          _count: { id: true },
          orderBy: { _count: { id: 'desc' } },
          take: 5,
        }),
        
        // 最近30天每日统计
        prisma.$queryRaw<Array<{ date: string; count: number }>>`
          SELECT 
            DATE(createdAt) as date,
            COUNT(*) as count
          FROM SystemLog
          WHERE createdAt >= ${last30Days.toISOString()}
          GROUP BY DATE(createdAt)
          ORDER BY date DESC
          LIMIT 30
        `,
      ]);

      return NextResponse.json({
        success: true,
        data: {
          overview: {
            totalLogs,
            todayLogs,
            todayLogins,
            uniqueUsersToday,
            loginLogs,
            operationLogs,
            errorLogs,
          },
          topUsers: topUsers.map(u => ({
            userId: u.userId,
            userName: u.userName,
            count: u._count.id,
          })),
          topActions: topActions.map(a => ({
            action: a.action,
            count: a._count.id,
          })),
          dailyStats,
        },
      });
    }

    return NextResponse.json(
      { success: false, message: '未知的请求类型' },
      { status: 400 }
    );
  } catch (error) {
    console.error('获取日志统计失败:', error);
    return NextResponse.json(
      { success: false, message: '获取日志统计失败' },
      { status: 500 }
    );
  }
}
