import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/middleware/auth';

// GET /api/admin/notifications - 获取所有消息记录（管理员）
export const GET = withAuth(async (request: NextRequest, context, user) => {
  try {
    // 权限检查：仅管理员可访问
    if (user.role !== 'admin') {
      return NextResponse.json({ 
        success: false,
        message: '权限不足' 
      }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const isRead = searchParams.get('isRead');
    const keyword = searchParams.get('keyword');
    const limit = parseInt(searchParams.get('limit') || '100');
    
    // 构建查询条件
    const where: any = {};
    
    if (type && type !== 'all') {
      where.type = type;
    }
    
    if (isRead && isRead !== 'all') {
      where.isRead = isRead === 'true';
    }
    
    if (keyword) {
      where.OR = [
        { title: { contains: keyword } },
        { content: { contains: keyword } },
      ];
    }

    // 查询消息记录
    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // 手动查询用户信息
    const userIds = [...new Set(notifications.map(n => n.userId))];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, department: true },
    });

    const userMap = new Map(users.map(u => [u.id, u]));

    // 组装数据
    const notificationsWithUser = notifications.map(n => ({
      ...n,
      user: userMap.get(n.userId) || null,
    }));

    // 统计数据
    const total = await prisma.notification.count({ where });
    const unread = await prisma.notification.count({
      where: { ...where, isRead: false },
    });

    // 按类型统计
    const byTypeResult = await prisma.notification.groupBy({
      by: ['type'],
      where,
      _count: true,
    });

    const byType: Record<string, number> = {};
    byTypeResult.forEach(item => {
      byType[item.type] = item._count;
    });

    return NextResponse.json({
      success: true,
      data: notificationsWithUser,
      stats: {
        total,
        unread,
        byType,
      },
    });
  } catch (error) {
    console.error('[Admin Notifications API] 获取消息记录失败:', error);
    return NextResponse.json({ 
      success: false,
      message: '获取消息记录失败',
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
});
