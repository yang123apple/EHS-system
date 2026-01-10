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

    const where: any = { userId };

    // 如果提供了materialIds，只查询这些材料
    if (materialIds) {
      const ids = materialIds.split(',').filter(id => id.trim());
      where.materialId = { in: ids };
    }

    // 直接查询MaterialLearnedRecord，无论是否有学习任务
    // 已学习和学习任务已解耦，用户学完了就应该显示已学习
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
    const { userId, materialId, examPassed } = body; // examPassed: 可选参数，表示是否通过考试

    if (!userId || !materialId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 获取材料信息，检查是否有考试要求
    const material = await prisma.trainingMaterial.findUnique({
      where: { id: materialId }
    });

    if (!material) {
      return NextResponse.json({ error: 'Material not found' }, { status: 404 });
    }

    // 如果材料有考试要求，必须通过考试才能标记为已学习
    // 但现在不再强制要求有assignment，只要examPassed为true即可
    if (material.isExamRequired) {
      if (!examPassed) {
        return NextResponse.json({ 
          error: '该学习内容需要先通过考试才能标记为已学习',
          requiresExam: true
        }, { status: 400 });
      }
      // 如果examPassed为true，说明已经通过考试，可以直接记录为已学习
      // 无论是否有学习任务
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
