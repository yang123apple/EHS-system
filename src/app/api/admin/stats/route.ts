import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/middleware/auth';

/**
 * GET /api/admin/stats - 获取管理员页面统计数据
 */
export const GET = withAuth(async (request: NextRequest, context, user) => {
  try {
    // 权限检查：仅管理员可访问
    if (user.role !== 'admin') {
      return NextResponse.json({ 
        success: false,
        message: '权限不足' 
      }, { status: 403 });
    }

    // 获取今天的开始时间
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // 获取最近30天的开始时间
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // 并行获取所有统计数据
    const [
      totalUsers,
      totalDepartments,
      todayLogs,
      totalTemplates,
      todayAICalls,
      todayOperations,
      recentLogs,
    ] = await Promise.all([
      // 活跃用户数（排除 admin）
      prisma.user.count({
        where: { username: { not: 'admin' } }
      }),
      // 部门总数
      prisma.department.count(),
      // 今日日志数
      prisma.systemLog.count({
        where: {
          createdAt: { gte: today }
        }
      }),
      // 通知模板总数
      prisma.notificationTemplate.count(),
      // 今日 AI API 调用数
      prisma.aIApiLog.count({
        where: {
          createdAt: { gte: today }
        }
      }),
      // 今日操作数（系统日志）
      prisma.systemLog.count({
        where: {
          createdAt: { gte: today },
          action: { not: 'LOGIN' } // 排除登录操作
        }
      }),
      // 最近30天的日志（用于统计活跃用户）
      prisma.systemLog.findMany({
        where: {
          createdAt: { gte: thirtyDaysAgo },
          userId: { not: null }
        },
        select: {
          userId: true
        }
      }),
    ]);

    // 计算活跃用户数（最近30天有操作的用户，排除 admin）
    const activeUserIds = new Set(
      recentLogs
        .map(log => log.userId)
        .filter((id): id is string => Boolean(id))
    );
    // 排除 admin 用户
    const adminUser = await prisma.user.findUnique({
      where: { username: 'admin' },
      select: { id: true }
    });
    if (adminUser) {
      activeUserIds.delete(adminUser.id);
    }
    const activeUsers = activeUserIds.size;

    // 获取数据库大小（从备份统计获取）
    let databaseSize = '0 MB';
    try {
      const backupStatsResponse = await fetch(`${request.nextUrl.origin}/api/backup/stats`);
      if (backupStatsResponse.ok) {
        const backupStats = await backupStatsResponse.json();
        if (backupStats.success && backupStats.data?.database?.totalSize) {
          const sizeMB = backupStats.data.database.totalSize / (1024 * 1024);
          databaseSize = sizeMB >= 1024 
            ? `${(sizeMB / 1024).toFixed(2)} GB` 
            : `${sizeMB.toFixed(2)} MB`;
        }
      }
    } catch (error) {
      console.error('获取数据库大小失败:', error);
    }

    return NextResponse.json({
      success: true,
      data: {
        // 快速统计
        quickStats: {
          onlineUsers: activeUsers, // 使用活跃用户数作为在线用户数
          todayOperations: todayOperations,
          databaseSize: databaseSize,
        },
        // 模块统计
        moduleStats: {
          account: {
            activeUsers: totalUsers,
          },
          org: {
            departmentCount: totalDepartments,
          },
          logs: {
            todayLogs: todayLogs,
          },
          notifications: {
            templateCount: totalTemplates,
          },
          aiApi: {
            todayCalls: todayAICalls,
          },
        },
      },
    });
  } catch (error) {
    console.error('[Admin Stats API] 获取统计数据失败:', error);
    return NextResponse.json({ 
      success: false,
      message: '获取统计数据失败',
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
});

