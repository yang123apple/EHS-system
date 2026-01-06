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
      include: { 
        task: {
          include: {
            material: true
          }
        }
      }
    });

    if (!assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    const updateData: any = {};
    if (progress !== undefined) updateData.progress = progress;
    if (status) updateData.status = status;

    // 对于没有考试要求的学习内容，根据类型自动判断是否完成：
    // - 视频：进度 >= 95% 视为完成
    // - PDF/DOCX：进度 = 100% 视为完成（阅读到最后一页）
    if (!assignment.task.material.isExamRequired && progress !== undefined) {
        const materialType = assignment.task.material.type;
        const isVideo = materialType === 'video';
        const isDocument = materialType === 'pdf' || materialType === 'docx';
        
        // 视频：>= 95% 视为完成；文档：= 100% 视为完成
        const shouldAutoComplete = (isVideo && progress >= 95) || (isDocument && progress === 100);
        
        if (shouldAutoComplete && assignment.status !== 'passed') {
            updateData.status = 'passed';
            updateData.isPassed = true;
            updateData.completedAt = new Date();
            
            // 记录到学习历史
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
    }

    // 如果状态更新为 completed，且之前未完成，记录到学习历史
    // 重要：对于有考试要求的学习内容，必须通过考试才能记录为已学习
    if (status === 'completed' && assignment.status !== 'completed' && assignment.status !== 'passed') {
        updateData.completedAt = new Date();

        // 只有当材料没有考试要求时，才直接记录到学习历史
        // 如果有考试要求，必须通过考试才能记录（在考试通过时记录）
        if (!assignment.task.material.isExamRequired) {
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
