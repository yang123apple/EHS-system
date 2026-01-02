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
      include: {
        material: true
      }
    });

    // 分离有考试要求和没有考试要求的材料
    const materialsWithExam: string[] = [];
    const materialsWithoutExam: string[] = [];
    
    records.forEach(record => {
      if (record.material.isExamRequired) {
        materialsWithExam.push(record.materialId);
      } else {
        materialsWithoutExam.push(record.materialId);
      }
    });

    // 对于有考试要求的材料，批量查询是否通过考试
    let passedExamMaterials: string[] = [];
    if (materialsWithExam.length > 0) {
      const passedAssignments = await prisma.trainingAssignment.findMany({
        where: {
          userId,
          task: {
            materialId: { in: materialsWithExam }
          },
          isPassed: true,
          status: 'passed'
        },
        select: {
          task: {
            select: {
              materialId: true
            }
          }
        }
      });

      passedExamMaterials = passedAssignments.map(a => a.task.materialId);
    }

    // 合并结果：没有考试要求的材料 + 通过考试的材料
    const learnedMaterialIds = [...materialsWithoutExam, ...passedExamMaterials];

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

    // 获取材料信息，检查是否有考试要求
    const material = await prisma.trainingMaterial.findUnique({
      where: { id: materialId }
    });

    if (!material) {
      return NextResponse.json({ error: 'Material not found' }, { status: 404 });
    }

    // 如果材料有考试要求，必须通过考试才能标记为已学习
    if (material.isExamRequired) {
      // 检查是否有对应的 assignment 且已通过考试
      const assignment = await prisma.trainingAssignment.findFirst({
        where: {
          userId,
          task: {
            materialId
          },
          isPassed: true,
          status: 'passed'
        }
      });

      if (!assignment) {
        return NextResponse.json({ 
          error: '该学习内容需要先通过考试才能标记为已学习',
          requiresExam: true
        }, { status: 400 });
      }
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
