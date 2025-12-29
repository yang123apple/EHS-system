'use server';

import { prisma } from '@/lib/prisma';
import { TrainingMaterial, ExamQuestion, TrainingTask, TrainingAssignment } from '@prisma/client';
import { revalidatePath } from 'next/cache';

// --- Material Management ---

export async function uploadMaterial(data: {
  title: string;
  description?: string;
  type: string;
  url: string;
  uploaderId: string;
  isExamRequired: boolean;
  passingScore?: number;
  questions?: any[];
  duration?: number;
}) {
  try {
    const { questions, ...materialData } = data;

    const material = await prisma.trainingMaterial.create({
      data: {
        ...materialData,
        questions: questions && questions.length > 0 ? {
          create: questions.map(q => ({
            question: q.question,
            type: q.type,
            options: JSON.stringify(q.options),
            answer: JSON.stringify(q.answer), // JSON string of correct option indices or values
            score: q.score,
          }))
        } : undefined
      }
    });

    revalidatePath('/training/admin/content');
    return { success: true, data: material };
  } catch (error) {
    console.error('Error uploading material:', error);
    return { success: false, error: 'Failed to upload material' };
  }
}

export async function getMaterials() {
  try {
    const materials = await prisma.trainingMaterial.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
          uploader: {
              select: { name: true }
          },
          _count: {
            select: { questions: true }
          }
      }
    });
    return { success: true, data: materials };
  } catch (error) {
    console.error('Error fetching materials:', error);
    return { success: false, error: 'Failed to fetch materials' };
  }
}

export async function getMaterial(id: string) {
    try {
        const material = await prisma.trainingMaterial.findUnique({
            where: { id },
            include: {
                questions: true
            }
        });
        return { success: true, data: material };
    } catch (error) {
        return { success: false, error: 'Not found' };
    }
}

export async function updateMaterial(id: string, data: any) {
    // Handling update logic including questions replacement
    // For simplicity, we might delete all questions and recreate if questions are provided
    // But keeping it simple for now
    try {
        // Implementation for update
        const { questions, ...updateData } = data;

        await prisma.trainingMaterial.update({
            where: { id },
            data: updateData
        });

        if (questions) {
            // Transactional update for questions
            await prisma.$transaction(async (tx) => {
                await tx.examQuestion.deleteMany({ where: { materialId: id }});
                for (const q of questions) {
                    await tx.examQuestion.create({
                        data: {
                            materialId: id,
                            question: q.question,
                            type: q.type,
                            options: JSON.stringify(q.options),
                            answer: JSON.stringify(q.answer),
                            score: q.score
                        }
                    });
                }
            });
        }
        revalidatePath('/training/admin/content');
        return { success: true };
    } catch (e) {
        console.error(e);
        return { success: false, error: 'Update failed' };
    }
}

// --- Task Management ---

export async function createTrainingTask(data: {
  title: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  materialId: string;
  publisherId: string;
  targetType: 'all' | 'dept' | 'user';
  targetConfig?: any; // JSON object { deptIds: [], userIds: [] }
}) {
  try {
    // 1. Determine target users
    let targetUserIds: string[] = [];

    if (data.targetType === 'all') {
      const users = await prisma.user.findMany({ select: { id: true } });
      targetUserIds = users.map(u => u.id);
    } else if (data.targetType === 'dept') {
      const deptIds = data.targetConfig.deptIds || [];
      // Need recursive fetch or assuming flat for now?
      // Let's assume we fetch users in these depts
      // Note: If recursion is needed, we'd need a helper. For now, direct assignment.
      const users = await prisma.user.findMany({
        where: { departmentId: { in: deptIds } },
        select: { id: true }
      });
      targetUserIds = users.map(u => u.id);
    } else if (data.targetType === 'user') {
      targetUserIds = data.targetConfig.userIds || [];
    }

    // 2. Create Task
    const task = await prisma.trainingTask.create({
      data: {
        title: data.title,
        description: data.description,
        startDate: data.startDate,
        endDate: data.endDate,
        materialId: data.materialId,
        publisherId: data.publisherId,
        targetType: data.targetType,
        targetConfig: JSON.stringify(data.targetConfig),
      }
    });

    // 3. Create Assignments (Using Promise.all as per memory instruction avoiding createMany)
    // Filter unique IDs just in case
    const uniqueIds = Array.from(new Set(targetUserIds));

    await Promise.all(uniqueIds.map(userId =>
       prisma.trainingAssignment.create({
         data: {
           taskId: task.id,
           userId: userId,
           status: 'assigned',
           progress: 0
         }
       })
    ));

    // 4. Create Notifications
    await Promise.all(uniqueIds.map(userId =>
        prisma.notification.create({
            data: {
                userId,
                type: 'training_assigned',
                title: '新培训任务',
                content: `您有一个新的培训任务：${data.title}`,
                relatedType: 'training_task',
                relatedId: task.id
            }
        })
    ));

    revalidatePath('/training/admin/tasks');
    return { success: true, data: task };
  } catch (error) {
    console.error('Error creating task:', error);
    return { success: false, error: 'Failed to create task' };
  }
}

export async function getAdminTasks() {
    try {
        const tasks = await prisma.trainingTask.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                material: { select: { title: true, type: true } },
                publisher: { select: { name: true } },
                _count: { select: { assignments: true } }
            }
        });

        // Enhance with stats (completed count)
        const tasksWithStats = await Promise.all(tasks.map(async (task) => {
            const completedCount = await prisma.trainingAssignment.count({
                where: {
                    taskId: task.id,
                    status: { in: ['completed', 'passed'] }
                }
            });
            return {
                ...task,
                completedCount
            };
        }));

        return { success: true, data: tasksWithStats };
    } catch (e) {
        return { success: false, error: e };
    }
}

// --- User Learning ---

export async function getUserTasks(userId: string) {
    try {
        const assignments = await prisma.trainingAssignment.findMany({
            where: { userId },
            include: {
                task: {
                    include: {
                        material: true,
                        publisher: { select: { name: true } }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        return { success: true, data: assignments };
    } catch (e) {
        return { success: false, error: e };
    }
}

export async function getAssignment(assignmentId: string, userId: string) {
     try {
        const assignment = await prisma.trainingAssignment.findUnique({
            where: { id: assignmentId },
            include: {
                task: {
                    include: {
                        material: {
                            include: {
                                questions: true
                            }
                        }
                    }
                }
            }
        });

        if (!assignment || assignment.userId !== userId) {
            return { success: false, error: 'Unauthorized or not found' };
        }

        return { success: true, data: assignment };
    } catch (e) {
        return { success: false, error: e };
    }
}

export async function updateProgress(assignmentId: string, progress: number, isCompleted: boolean = false) {
    try {
        const data: any = { progress };
        if (isCompleted) {
             // If manual completion (no exam), mark as passed/completed
             const assignment = await prisma.trainingAssignment.findUnique({ where: { id: assignmentId }, select: { task: { select: { material: { select: { isExamRequired: true }}}}}});

             if (assignment && !assignment.task.material.isExamRequired) {
                 data.status = 'passed';
                 data.isPassed = true;
                 data.completedAt = new Date();
             } else {
                 data.status = 'completed'; // Ready for exam
                 data.completedAt = new Date();
             }
        } else {
            data.status = 'in-progress';
        }

        await prisma.trainingAssignment.update({
            where: { id: assignmentId },
            data
        });
        return { success: true };
    } catch (e) {
        return { success: false, error: e };
    }
}

export async function submitExam(assignmentId: string, answers: Record<string, any>) {
    try {
        const assignment = await prisma.trainingAssignment.findUnique({
            where: { id: assignmentId },
            include: {
                task: {
                    include: {
                        material: {
                            include: {
                                questions: true
                            }
                        }
                    }
                }
            }
        });

        if (!assignment) return { success: false, error: 'Not found' };

        let score = 0;
        let totalScore = 0;

        // Calculate score
        assignment.task.material.questions.forEach(q => {
            totalScore += q.score;
            const userAnswer = answers[q.id];

            // Check answer logic
            // options/answers are JSON strings. Need to parse.
            // Simplified logic: assume answer is "A" or ["A", "B"]
            // The stored answer in DB should be parsed.
            try {
                const correct = JSON.parse(q.answer);

                // Compare logic
                // If single choice, string compare
                // If multi, array compare (sort and join?)

                // Assuming userAnswer comes in compatible format
                if (q.type === 'single') {
                    if (userAnswer === correct) score += q.score;
                } else {
                     // Multi: exact match
                     if (Array.isArray(userAnswer) && Array.isArray(correct)) {
                         if (userAnswer.sort().join() === correct.sort().join()) {
                             score += q.score;
                         }
                     }
                }
            } catch (e) {
                console.error("Error parsing answer for Q", q.id, e);
            }
        });

        const passingScore = assignment.task.material.passingScore || 60; // Default 60? or 0
        const isPassed = score >= passingScore;

        await prisma.trainingAssignment.update({
            where: { id: assignmentId },
            data: {
                examScore: score,
                isPassed,
                status: isPassed ? 'passed' : 'failed',
                completedAt: new Date()
            }
        });

        return { success: true, score, isPassed, passingScore };

    } catch (e) {
        console.error(e);
        return { success: false, error: e };
    }
}
