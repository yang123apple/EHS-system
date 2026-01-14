import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/middleware/auth';
import fs from 'fs';
import path from 'path';

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

    // 获取最近1小时的开始时间（用于统计在线用户）
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

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
      // 账户总数（包括 admin）
      prisma.user.count(),
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
      // 今日操作数（系统日志，排除登录操作）
      prisma.systemLog.count({
        where: {
          createdAt: { gte: today },
          action: { not: 'LOGIN' } // 排除登录操作
        }
      }),
      // 最近1小时的日志（用于统计在线用户）
      prisma.systemLog.findMany({
        where: {
          createdAt: { gte: oneHourAgo },
          userId: { not: null }
        },
        select: {
          userId: true
        }
      }),
    ]);

    // 计算在线用户数（最近1小时内有操作的用户）
    const onlineUserIds = new Set(
      recentLogs
        .map(log => log.userId)
        .filter((id): id is string => Boolean(id))
    );
    const onlineUsers = onlineUserIds.size;

    // 获取数据库大小（直接计算数据库文件大小）
    let databaseSize = '0 MB';
    try {
      const dbPath = path.join(process.cwd(), 'prisma', 'dev.db');
      const dbShmPath = path.join(process.cwd(), 'prisma', 'dev.db-shm');
      const dbWalPath = path.join(process.cwd(), 'prisma', 'dev.db-wal');
      
      let totalSize = 0;
      if (fs.existsSync(dbPath)) {
        totalSize += fs.statSync(dbPath).size;
      }
      if (fs.existsSync(dbShmPath)) {
        totalSize += fs.statSync(dbShmPath).size;
      }
      if (fs.existsSync(dbWalPath)) {
        totalSize += fs.statSync(dbWalPath).size;
      }
      
      if (totalSize > 0) {
        const sizeMB = totalSize / (1024 * 1024);
        databaseSize = sizeMB >= 1024 
          ? `${(sizeMB / 1024).toFixed(2)} GB` 
          : `${sizeMB.toFixed(2)} MB`;
      }
    } catch (error) {
      console.error('获取数据库大小失败:', error);
    }

    return NextResponse.json({
      success: true,
      data: {
        // 快速统计
        quickStats: {
          onlineUsers: onlineUsers, // 最近1小时内有操作的用户数
          todayOperations: todayOperations,
          databaseSize: databaseSize,
        },
        // 模块统计
        moduleStats: {
          account: {
            activeUsers: totalUsers, // 系统中总账户数量（包括 admin）
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

