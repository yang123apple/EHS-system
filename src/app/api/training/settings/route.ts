import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    // 从HazardConfig表中获取培训类型设置
    const config = await prisma.hazardConfig.findUnique({
      where: { key: 'training_categories' }
    });

    if (!config) {
      // 返回默认类型
      return NextResponse.json({
        categories: ['安全培训', '技术培训', '管理培训', '合规培训']
      });
    }

    return NextResponse.json({
      categories: JSON.parse(config.value)
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { categories } = body;

    // 更新或创建配置
    await prisma.hazardConfig.upsert({
      where: { key: 'training_categories' },
      update: { value: JSON.stringify(categories) },
      create: {
        key: 'training_categories',
        value: JSON.stringify(categories),
        description: '培训系统学习类型配置'
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
