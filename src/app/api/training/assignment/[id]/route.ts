import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, logApiOperation } from '@/middleware/auth';

export const GET = withAuth<{ params: Promise<{ id: string }> }>(async (req, context, user) => {
  const { params } = context;
  try {
    const { id } = await params;
    const assignment = await prisma.trainingAssignment.findUnique({
      where: { id },
      include: {
        task: {
            include: {
                material: true
            }
        }
      }
    });

    if (!assignment) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json(assignment);
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
});

export const POST = withAuth<{ params: Promise<{ id: string }> }>(async (req, context, user) => {
  const { params } = context;
  try {
    const { id } = await params; // Assignment ID
    const body = await req.json();
    const { action, progress, examScore, isPassed } = body;
    // action: 'update_progress' | 'complete_exam'

    if (action === 'update_progress') {
        // Logic: if video last 30s or doc last page
        const assignment = await prisma.trainingAssignment.update({
            where: { id },
            data: {
                progress,
                status: 'in-progress',
                updatedAt: new Date()
            }
        });

        // If material has NO exam and is "complete" (handled by frontend telling us it's done or progress=100)
        // Check if material requires exam first
        const currentAssign = await prisma.trainingAssignment.findUnique({
             where: { id },
             include: { task: { include: { material: true } } }
        });

        // 对于没有考试要求的学习内容，根据类型判断完成条件：
        // - 视频：进度 >= 95% 视为完成
        // - PDF/DOCX：进度 = 100% 视为完成（阅读到最后一页）
        if (currentAssign && !currentAssign.task.material.isExamRequired) {
            const materialType = currentAssign.task.material.type;
            const isVideo = materialType === 'video';
            const isDocument = materialType === 'pdf' || materialType === 'docx';
            
            // 视频：>= 95% 视为完成；文档：= 100% 视为完成
            const shouldComplete = (isVideo && progress >= 95) || (isDocument && progress === 100);
            
            if (shouldComplete) {
                await prisma.trainingAssignment.update({
                    where: { id },
                    data: {
                        status: 'passed',
                        isPassed: true,
                        completedAt: new Date()
                    }
                });

                // 记录到学习历史
                await prisma.materialLearnedRecord.upsert({
                    where: {
                        materialId_userId: {
                            materialId: currentAssign.task.materialId,
                            userId: currentAssign.userId
                        }
                    },
                    create: {
                        materialId: currentAssign.task.materialId,
                        userId: currentAssign.userId,
                        learnedAt: new Date()
                    },
                    update: {
                        learnedAt: new Date() // Update time if re-learned
                    }
                });
            }
        }

        return NextResponse.json({ success: true });
    } else if (action === 'complete_exam') {
        // 获取完整的 assignment 信息，包括 material
        const currentAssign = await prisma.trainingAssignment.findUnique({
            where: { id },
            include: { 
                task: { 
                    include: { 
                        material: true 
                    } 
                } 
            }
        });

        if (!currentAssign) {
            return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
        }

        const assignment = await prisma.trainingAssignment.update({
            where: { id },
            data: {
                examScore,
                isPassed,
                status: isPassed ? 'passed' : 'failed', // Failed allows retry
                completedAt: isPassed ? new Date() : undefined
            }
        });

        // 如果考试通过，记录到学习历史 (MaterialLearnedRecord)
        if (isPassed) {
            await prisma.materialLearnedRecord.upsert({
                where: {
                    materialId_userId: {
                        materialId: currentAssign.task.materialId,
                        userId: currentAssign.userId
                    }
                },
                create: {
                    materialId: currentAssign.task.materialId,
                    userId: currentAssign.userId,
                    learnedAt: new Date()
                },
                update: {
                    learnedAt: new Date() // Update time if re-learned
                }
            });
        }

        // 记录操作日志
        try {
            await logApiOperation(user, 'training', 'complete_exam', {
                assignmentId: id,
                taskId: currentAssign.taskId,
                taskTitle: currentAssign.task.title,
                materialId: currentAssign.task.materialId,
                materialTitle: currentAssign.task.material.title,
                examScore,
                isPassed,
                passingScore: currentAssign.task.material.passingScore
            });
        } catch (logError) {
            console.error('[Complete Exam API] 记录操作日志失败:', logError);
            // 日志失败不影响主流程
        }

        return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }
});
