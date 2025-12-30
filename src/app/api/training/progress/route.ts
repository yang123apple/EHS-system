import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/middleware/auth';

export const POST = withAuth(async (req, context, user) => {
  try {
    const { assignmentId, progress, status } = await req.json();

    if (!assignmentId) {
      return NextResponse.json({ error: 'Assignment ID required' }, { status: 400 });
    }

    const assignment = await prisma.trainingAssignment.findUnique({
      where: { id: assignmentId },
      include: { task: true }
    });

    if (!assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    const updateData: any = {};
    if (progress !== undefined) updateData.progress = progress;
    if (status) updateData.status = status;

    // 如果状态更新为 completed，且之前未完成，记录到学习历史
    if (status === 'completed' && assignment.status !== 'completed' && assignment.status !== 'passed') {
        updateData.completedAt = new Date();

        // 记录学习历史 (MaterialLearnedRecord)
        // 使用 upsert 防止重复
        await prisma.materialLearnedRecord.upsert({
            where: {
                materialId_userId: {
                    materialId: assignment.task.materialId,
                    userId: assignment.userId
                }
            },
            create: {
                materialId: assignment.task.materialId,
                userId: assignment.userId,
                learnedAt: new Date()
            },
            update: {
                learnedAt: new Date() // Update time if re-learned
            }
        });
    }

    const updated = await prisma.trainingAssignment.update({
      where: { id: assignmentId },
      data: updateData
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Progress update error:', error);
    return NextResponse.json({ error: 'Failed to update progress' }, { status: 500 });
  }
});
