import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const tasks = await prisma.trainingTask.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        material: true,
        publisher: { select: { name: true } },
        assignments: { select: { status: true } }
      }
    });
    return NextResponse.json(tasks);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, description, startDate, endDate, materialId, publisherId, targetType, targetConfig } = body;

    // 1. Create Task
    const task = await prisma.trainingTask.create({
      data: {
        title,
        description,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        materialId,
        publisherId,
        targetType,
        targetConfig: JSON.stringify(targetConfig)
      }
    });

    // 2. Resolve Users and Create Assignments
    let userIds: string[] = [];
    if (targetType === 'all') {
      const users = await prisma.user.findMany({ select: { id: true } });
      userIds = users.map(u => u.id);
    } else if (targetType === 'dept') {
      // targetConfig is array of deptIds
      // Recursive lookup for sub-departments
      const allDepts = await prisma.department.findMany();

      const getAllSubDeptIds = (parentIds: string[]): string[] => {
          const children = allDepts.filter(d => d.parentId && parentIds.includes(d.parentId)).map(d => d.id);
          if (children.length === 0) return parentIds;
          return [...parentIds, ...getAllSubDeptIds(children)];
      };

      const finalDeptIds = getAllSubDeptIds(targetConfig);

      const users = await prisma.user.findMany({
        where: { departmentId: { in: finalDeptIds } },
        select: { id: true }
      });
      userIds = users.map(u => u.id);
    } else if (targetType === 'user') {
      // targetConfig is array of userIds
      userIds = targetConfig;
    }

    // Batch create assignments
    if (userIds.length > 0) {
       await Promise.all(userIds.map(uid =>
         prisma.trainingAssignment.create({
           data: {
              taskId: task.id,
              userId: uid,
              status: 'assigned',
              progress: 0,
              isPassed: false
           }
         })
       ));

       // Create Notifications
       await Promise.all(userIds.map(uid =>
          prisma.notification.create({
            data: {
                userId: uid,
                type: 'training_assigned',
                title: '新培训任务',
                content: `您有新的培训任务：${title}，请及时完成。`,
                relatedType: 'training_task',
                relatedId: task.id
            }
          })
       ));
    }

    return NextResponse.json(task);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
  }
}
