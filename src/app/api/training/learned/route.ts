import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/middleware/auth';

// 获取已学习材料的ID列表
export const GET = withAuth(async (req: NextRequest, context, user) => {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const materialIds = searchParams.get('materialIds'); // comma-separated

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    let where: any = { userId };

    // 如果提供了materialIds，只查询这些材料
    if (materialIds) {
      const ids = materialIds.split(',').filter(id => id.trim());
      where.materialId = { in: ids };
    }

    const records = await prisma.materialLearnedRecord.findMany({
      where,
      select: {
        materialId: true
      }
    });

    const learnedMaterialIds = records.map(r => r.materialId);
    return NextResponse.json({ learnedMaterialIds });
  } catch (error) {
    console.error('获取已学习记录失败:', error);
    return NextResponse.json({ error: 'Failed to fetch learned records' }, { status: 500 });
  }
});

// 标记材料为已学习
export const POST = withAuth(async (req: NextRequest, context, user) => {
  try {
    const body = await req.json();
    const { userId, materialId } = body;

    if (!userId || !materialId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 使用upsert避免重复插入
    await prisma.materialLearnedRecord.upsert({
      where: {
        materialId_userId: {
          materialId,
          userId
        }
      },
      create: {
        materialId,
        userId
      },
      update: {
        learnedAt: new Date()
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('创建已学习记录失败:', error);
    return NextResponse.json({ error: 'Failed to create learned record' }, { status: 500 });
  }
});
