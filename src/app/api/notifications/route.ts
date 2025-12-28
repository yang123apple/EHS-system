import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/notifications - 获取当前用户的通知
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const unreadOnly = searchParams.get('unreadOnly') === 'true';
    
    if (!userId) {
      return NextResponse.json({ error: '缺少用户ID' }, { status: 400 });
    }

    // 构建查询条件
    const where: any = { userId };
    if (unreadOnly) {
      where.isRead = false;
    }

    // 查询通知，按创建时间倒序
    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50, // 最多返回50条
    });

    // 统计未读数量
    const unreadCount = await prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    });

    return NextResponse.json({ 
      notifications, 
      unreadCount 
    });
  } catch (error) {
    console.error('获取通知失败:', error);
    return NextResponse.json({ error: '获取通知失败' }, { status: 500 });
  }
}

// PATCH /api/notifications - 标记通知为已读
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { notificationIds, userId } = body;

    if (!notificationIds || !Array.isArray(notificationIds)) {
      return NextResponse.json({ error: '缺少通知ID列表' }, { status: 400 });
    }

    // 批量更新通知为已读
    const result = await prisma.notification.updateMany({
      where: {
        id: { in: notificationIds },
        userId, // 确保只能更新自己的通知
      },
      data: {
        isRead: true,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ 
      success: true, 
      updatedCount: result.count 
    });
  } catch (error) {
    console.error('标记已读失败:', error);
    return NextResponse.json({ error: '标记已读失败' }, { status: 500 });
  }
}

// POST /api/notifications - 创建新通知（支持单个或批量）
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // 支持批量创建
    if (body.notifications && Array.isArray(body.notifications)) {
      const notifications = body.notifications;
      
      if (notifications.length === 0) {
        return NextResponse.json({ success: true, count: 0 });
      }

      // 验证每个通知都有必要字段
      const invalidNotification = notifications.find(
        (n: any) => !n.userId || !n.type || !n.title || !n.content
      );

      if (invalidNotification) {
        return NextResponse.json({ error: '通知数据缺少必要字段' }, { status: 400 });
      }

      // 批量创建通知
      const result = await prisma.notification.createMany({
        data: notifications.map((n: any) => ({
          userId: n.userId,
          type: n.type,
          title: n.title,
          content: n.content,
          relatedType: n.relatedType || 'hazard',
          relatedId: n.relatedId,
          isRead: false,
        })),
      });

      console.log(`✅ 批量创建通知成功: ${result.count} 条`);
      return NextResponse.json({ success: true, count: result.count });
    }

    // 支持单个创建（向后兼容）
    const { userId, type, title, content, relatedType, relatedId } = body;

    if (!userId || !type || !title || !content) {
      return NextResponse.json({ error: '缺少必要字段' }, { status: 400 });
    }

    // 创建单个通知
    const notification = await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        content,
        relatedType,
        relatedId,
        isRead: false,
      },
    });

    return NextResponse.json({ success: true, notification });
  } catch (error) {
    console.error('创建通知失败:', error);
    return NextResponse.json({ error: '创建通知失败' }, { status: 500 });
  }
}
