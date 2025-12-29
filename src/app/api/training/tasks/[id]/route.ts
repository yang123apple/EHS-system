import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const taskId = params.id;

    const task = await prisma.trainingTask.findUnique({
      where: { id: taskId },
      include: {
        material: true,
        publisher: { select: { name: true } },
        assignments: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                departmentId: true,
                department: {
                  select: {
                    id: true,
                    name: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // 按部门组织完成情况统计
    const deptStats: Record<string, {
      deptId: string;
      deptName: string;
      total: number;
      completed: number;
      passed: number;
      inProgress: number;
      notStarted: number;
      users: any[];
    }> = {};

    task.assignments.forEach(assignment => {
      const deptId = assignment.user.departmentId || 'no-dept';
      const deptName = assignment.user.department?.name || '未分配部门';

      if (!deptStats[deptId]) {
        deptStats[deptId] = {
          deptId,
          deptName,
          total: 0,
          completed: 0,
          passed: 0,
          inProgress: 0,
          notStarted: 0,
          users: []
        };
      }

      deptStats[deptId].total++;
      
      if (assignment.status === 'passed') {
        deptStats[deptId].passed++;
        deptStats[deptId].completed++;
      } else if (assignment.status === 'completed') {
        deptStats[deptId].completed++;
      } else if (assignment.status === 'in-progress') {
        deptStats[deptId].inProgress++;
      } else {
        deptStats[deptId].notStarted++;
      }

      deptStats[deptId].users.push({
        id: assignment.user.id,
        name: assignment.user.name,
        status: assignment.status,
        progress: assignment.progress,
        isPassed: assignment.isPassed,
        examScore: assignment.examScore,
        completedAt: assignment.completedAt
      });
    });

    return NextResponse.json({
      task,
      departmentStats: Object.values(deptStats)
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch task details' }, { status: 500 });
  }
}
