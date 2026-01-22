// src/app/api/check-types/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withErrorHandling, withAuth } from '@/middleware/auth';

// GET - 获取检查类型列表
export const GET = withErrorHandling(
  withAuth(async (request: NextRequest, context, user) => {
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('activeOnly') === 'true';

    const checkTypes = await prisma.checkType.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: { sortOrder: 'asc' },
    });

    return NextResponse.json(checkTypes);
  })
);

// POST - 创建新检查类型
export const POST = withErrorHandling(
  withAuth(async (request: NextRequest, context, user) => {
    // 检查权限（仅管理员可以管理检查类型）
    if (user.role !== 'admin') {
      return NextResponse.json({ error: '无权限' }, { status: 403 });
    }

    const body = await request.json();
    const { name, value, description, sortOrder, isActive } = body;

    if (!name || !value) {
      return NextResponse.json(
        { error: '名称和值不能为空' },
        { status: 400 }
      );
    }

    // 检查值是否已存在
    const existing = await prisma.checkType.findUnique({
      where: { value },
    });

    if (existing) {
      return NextResponse.json(
        { error: '该检查类型值已存在' },
        { status: 400 }
      );
    }

    const checkType = await prisma.checkType.create({
      data: {
        name,
        value,
        description,
        sortOrder: sortOrder || 0,
        isActive: isActive !== undefined ? isActive : true,
      },
    });

    return NextResponse.json(checkType);
  })
);

// PUT - 批量更新检查类型
export const PUT = withErrorHandling(
  withAuth(async (request: NextRequest, context, user) => {
    if (user.role !== 'admin') {
      return NextResponse.json({ error: '无权限' }, { status: 403 });
    }

    const body = await request.json();
    const { checkTypes } = body;

    if (!Array.isArray(checkTypes)) {
      return NextResponse.json(
        { error: '无效的数据格式' },
        { status: 400 }
      );
    }

    // 批量更新
    await Promise.all(
      checkTypes.map((ct: any) =>
        prisma.checkType.update({
          where: { id: ct.id },
          data: {
            name: ct.name,
            description: ct.description,
            sortOrder: ct.sortOrder,
            isActive: ct.isActive,
          },
        })
      )
    );

    return NextResponse.json({ success: true });
  })
);

// DELETE - 删除检查类型
export const DELETE = withErrorHandling(
  withAuth(async (request: NextRequest, context, user) => {
    if (user.role !== 'admin') {
      return NextResponse.json({ error: '无权限' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: '缺少检查类型ID' },
        { status: 400 }
      );
    }

    await prisma.checkType.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  })
);
