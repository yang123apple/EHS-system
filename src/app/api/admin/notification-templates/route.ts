import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// 获取通知模板列表
export async function GET(request: NextRequest) {
  try {
    console.log('[API] 获取通知模板列表...');
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || '';
    const isActive = searchParams.get('isActive');

    const where: any = {};
    if (type) where.type = type;
    if (isActive !== null && isActive !== '') {
      where.isActive = isActive === 'true';
    }

    console.log('[API] 查询条件:', where);

    const templates = await prisma.notificationTemplate.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    console.log('[API] 找到模板数量:', templates.length);

    return NextResponse.json({
      success: true,
      data: templates,
    });
  } catch (error) {
    console.error('[API] 获取通知模板失败:', error);
    return NextResponse.json(
      { success: false, message: '获取通知模板失败' },
      { status: 500 }
    );
  }
}

// 创建通知模板
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      name, 
      title, 
      content, 
      type, 
      triggerEvent, 
      triggerCondition,
      variables,
      isActive 
    } = body;

    // 验证必填字段
    if (!name || !title || !content || !type || !triggerEvent) {
      return NextResponse.json(
        { success: false, message: '缺少必填字段' },
        { status: 400 }
      );
    }

    // 检查名称是否已存在
    const existing = await prisma.notificationTemplate.findUnique({
      where: { name },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, message: '模板名称已存在' },
        { status: 400 }
      );
    }

    const template = await prisma.notificationTemplate.create({
      data: {
        name,
        title,
        content,
        type,
        triggerEvent,
        triggerCondition: triggerCondition ? JSON.stringify(triggerCondition) : null,
        variables: variables ? JSON.stringify(variables) : null,
        isActive: isActive !== undefined ? isActive : true,
      },
    });

    return NextResponse.json({
      success: true,
      data: template,
      message: '创建成功',
    });
  } catch (error) {
    console.error('创建通知模板失败:', error);
    return NextResponse.json(
      { success: false, message: '创建通知模板失败' },
      { status: 500 }
    );
  }
}

// 更新通知模板
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...data } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, message: '缺少模板ID' },
        { status: 400 }
      );
    }

    // 如果更新名称，检查是否冲突
    if (data.name) {
      const existing = await prisma.notificationTemplate.findFirst({
        where: {
          name: data.name,
          id: { not: id },
        },
      });

      if (existing) {
        return NextResponse.json(
          { success: false, message: '模板名称已存在' },
          { status: 400 }
        );
      }
    }

    // 处理 JSON 字段
    if (data.triggerCondition && typeof data.triggerCondition === 'object') {
      data.triggerCondition = JSON.stringify(data.triggerCondition);
    }
    if (data.variables && typeof data.variables === 'object') {
      data.variables = JSON.stringify(data.variables);
    }

    const template = await prisma.notificationTemplate.update({
      where: { id },
      data,
    });

    return NextResponse.json({
      success: true,
      data: template,
      message: '更新成功',
    });
  } catch (error) {
    console.error('更新通知模板失败:', error);
    return NextResponse.json(
      { success: false, message: '更新通知模板失败' },
      { status: 500 }
    );
  }
}

// 删除通知模板
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, message: '缺少模板ID' },
        { status: 400 }
      );
    }

    await prisma.notificationTemplate.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: '删除成功',
    });
  } catch (error) {
    console.error('删除通知模板失败:', error);
    return NextResponse.json(
      { success: false, message: '删除通知模板失败' },
      { status: 500 }
    );
  }
}
