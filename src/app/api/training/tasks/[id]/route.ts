import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, withErrorHandling, withPermission, withResourcePermission, logApiOperation } from '@/middleware/auth';
import { type Department } from '@/utils/departmentUtils';
import { setStartOfDay, setEndOfDay, extractDatePart } from '@/utils/dateUtils';
import { createTrainingNotification } from '@/lib/notificationService';

interface DepartmentStat {
  deptId: string;
  deptName: string;
  parentId: string | null;
  level: number;
  total: number;
  completed: number;
  passed: number;
  inProgress: number;
  notStarted: number;
  users: any[];
  children?: DepartmentStat[];
}

export const GET = withErrorHandling(
  withAuth<{ params: Promise<{ id: string }> }>(async (
    req: NextRequest,
    context,
    user
  ) => {
    try {
      const { id: taskId } = await context.params;

      const task = await prisma.trainingTask.findUnique({
        where: { id: taskId },
        include: {
          material: true,
          publisher: { select: { name: true } },
          assignments: {
            select: {
              id: true,
              status: true,
              progress: true,
              isPassed: true,
              examScore: true,
              completedAt: true,
              user: {
                select: {
                  id: true,
                  name: true,
                  departmentId: true,
                  department: {
                    select: {
                      id: true,
                      name: true,
                      parentId: true,
                      level: true
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

    // 获取所有部门
    const allDepartments = await prisma.department.findMany({
      select: {
        id: true,
        name: true,
        parentId: true,
        level: true
      }
    });

    const deptMap = new Map<string, Department>();
    allDepartments.forEach(dept => {
      deptMap.set(dept.id, {
        id: dept.id,
        name: dept.name,
        parentId: dept.parentId,
        level: dept.level
      });
    });

    // 首先统计每个部门的直接用户（不包括子部门）
    const directDeptStats: Record<string, DepartmentStat> = {};

    task.assignments.forEach(assignment => {
      // 检查 user 是否存在
      if (!assignment.user) {
        console.warn('Assignment missing user:', assignment.id);
        return;
      }

      const deptId = assignment.user.departmentId;
      if (!deptId) return; // 跳过未分配部门的用户

      const dept = deptMap.get(deptId);
      if (!dept) {
        console.warn('Department not found:', deptId);
        return;
      }

      if (!directDeptStats[deptId]) {
        directDeptStats[deptId] = {
          deptId: dept.id,
          deptName: dept.name,
          parentId: dept.parentId,
          level: dept.level,
          total: 0,
          completed: 0,
          passed: 0,
          inProgress: 0,
          notStarted: 0,
          users: []
        };
      }

      directDeptStats[deptId].total++;
      
      if (assignment.status === 'passed') {
        directDeptStats[deptId].passed++;
        directDeptStats[deptId].completed++;
      } else if (assignment.status === 'completed') {
        directDeptStats[deptId].completed++;
      } else if (assignment.status === 'in-progress') {
        directDeptStats[deptId].inProgress++;
      } else {
        directDeptStats[deptId].notStarted++;
      }

      directDeptStats[deptId].users.push({
        id: assignment.user.id,
        name: assignment.user.name,
        status: assignment.status || 'assigned',
        progress: assignment.progress ?? 0,
        isPassed: assignment.isPassed ?? false,
        examScore: assignment.examScore ?? null,
        completedAt: assignment.completedAt 
          ? (assignment.completedAt instanceof Date 
              ? assignment.completedAt.toISOString() 
              : new Date(assignment.completedAt).toISOString())
          : null
      });
    });

    // 为所有部门创建统计对象（包括没有直接用户的部门）
    const allDeptStats: Record<string, DepartmentStat> = {};
    deptMap.forEach((dept, deptId) => {
      allDeptStats[deptId] = directDeptStats[deptId] || {
        deptId: dept.id,
        deptName: dept.name,
        parentId: dept.parentId,
        level: dept.level,
        total: 0,
        completed: 0,
        passed: 0,
        inProgress: 0,
        notStarted: 0,
        users: []
      };
    });

    // 从叶子节点向上聚合统计数据（父部门包含子部门）
    // 按层级从高到低排序（层级高的先处理）
    const sortedDepts = Object.values(allDeptStats).sort((a, b) => b.level - a.level);

    sortedDepts.forEach(deptStat => {
      if (deptStat.parentId) {
        const parentStat = allDeptStats[deptStat.parentId];
        if (parentStat) {
          // 将子部门的统计数据累加到父部门
          parentStat.total += deptStat.total;
          parentStat.completed += deptStat.completed;
          parentStat.passed += deptStat.passed;
          parentStat.inProgress += deptStat.inProgress;
          parentStat.notStarted += deptStat.notStarted;
        }
      }
    });

    // 构建树状结构
    const deptStatsMap = new Map<string, DepartmentStat>();
    const rootStats: DepartmentStat[] = [];

    // 创建所有节点的映射
    Object.values(allDeptStats).forEach(stat => {
      deptStatsMap.set(stat.deptId, { ...stat, children: [] });
    });

    // 构建树结构
    deptStatsMap.forEach((stat, deptId) => {
      if (stat.parentId && deptStatsMap.has(stat.parentId)) {
        const parent = deptStatsMap.get(stat.parentId)!;
        if (!parent.children) parent.children = [];
        parent.children.push(stat);
      } else {
        rootStats.push(stat);
      }
    });

    // 递归排序子节点（按名称或层级）
    function sortChildren(children?: DepartmentStat[]) {
      if (!children) return;
      children.sort((a, b) => a.deptName.localeCompare(b.deptName));
      children.forEach(child => sortChildren(child.children));
    }
    rootStats.forEach(root => sortChildren(root.children));

    // 只返回有用户的部门（过滤掉所有统计都为0的部门树节点）
    function filterEmptyStats(stats: DepartmentStat[]): DepartmentStat[] {
      const result: DepartmentStat[] = [];
      for (const stat of stats) {
        const filteredChildren = stat.children ? filterEmptyStats(stat.children) : undefined;
        // 如果当前节点有用户或有子节点，则保留
        if (stat.total > 0 || (filteredChildren && filteredChildren.length > 0)) {
          result.push({
            ...stat,
            children: filteredChildren
          });
        }
      }
      return result;
    }

    const filteredRootStats = filterEmptyStats(rootStats);

      return NextResponse.json({
        task,
        departmentStats: filteredRootStats
      });
    } catch (error) {
      console.error('[GET /api/training/tasks/[id]] Error:', error);
      throw error;
    }
  })
);

export const PUT = withErrorHandling(
  withResourcePermission(
    'training',
    'edit_task',
    async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
      const { id: taskId } = await params;
      const task = await prisma.trainingTask.findUnique({
        where: { id: taskId },
        select: { publisherId: true }
      });
      return task?.publisherId || null;
    },
    async (
      req: NextRequest,
      { params }: { params: Promise<{ id: string }> },
      user
    ) => {
      const { id: taskId } = await params;
    const body = await req.json();
    const { title, description, startDate, endDate, materialId, targetType, targetConfig } = body;

    // Check if task exists
    const existingTask = await prisma.trainingTask.findUnique({
      where: { id: taskId }
    });

    if (!existingTask) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Update task
    // 开始时间设置为当天的 00:00:00，结束时间设置为当天的 23:59:59.999
    const updatedTask = await prisma.trainingTask.update({
      where: { id: taskId },
      data: {
        title,
        description,
        startDate: setStartOfDay(extractDatePart(startDate)),
        endDate: setEndOfDay(extractDatePart(endDate)),
        materialId,
        targetType,
        targetConfig: JSON.stringify(targetConfig)
      }
    });

    // Resolve new user IDs based on targetType and targetConfig
    let newUserIds: string[] = [];
    if (targetType === 'all') {
      const users = await prisma.user.findMany({ select: { id: true } });
      newUserIds = users.map(u => u.id);
    } else if (targetType === 'dept') {
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
      newUserIds = users.map(u => u.id);
    } else if (targetType === 'user') {
      newUserIds = targetConfig;
    }

    // Get existing assignments
    const existingAssignments = await prisma.trainingAssignment.findMany({
      where: { taskId },
      select: { userId: true }
    });
    const existingUserIds = existingAssignments.map(a => a.userId);

    // Find users to add and remove
    const usersToAdd = newUserIds.filter(id => !existingUserIds.includes(id));
    const usersToRemove = existingUserIds.filter(id => !newUserIds.includes(id));

    // Remove assignments for users no longer in target
    if (usersToRemove.length > 0) {
      await prisma.trainingAssignment.deleteMany({
        where: {
          taskId,
          userId: { in: usersToRemove }
        }
      });
    }

    // Add new assignments
    if (usersToAdd.length > 0) {
      await Promise.all(usersToAdd.map(uid =>
        prisma.trainingAssignment.create({
          data: {
            taskId,
            userId: uid,
            status: 'assigned',
            progress: 0,
            isPassed: false
          }
        })
      ));

      // Create notifications for new assignments using notification service
      await createTrainingNotification(
        'training_updated',
        usersToAdd,
        {
          id: taskId,
          title: title || '',
        },
        user.name
      );
    }

    // 记录操作日志
    await logApiOperation(user, 'training', 'edit_task', {
      taskId: updatedTask.id,
      title: updatedTask.title,
      targetType,
      assignedUsers: newUserIds.length,
      addedUsers: usersToAdd.length,
      removedUsers: usersToRemove.length
    });

      return NextResponse.json(updatedTask);
    }
  )
);

export const DELETE = withErrorHandling(
  withResourcePermission(
    'training',
    'delete_task',
    async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
      const { id: taskId } = await params;
      const task = await prisma.trainingTask.findUnique({
        where: { id: taskId },
        select: { publisherId: true }
      });
      return task?.publisherId || null;
    },
    async (
      req: NextRequest,
      { params }: { params: Promise<{ id: string }> },
      user
    ) => {
      const { id: taskId } = await params;

    // 检查任务是否存在
    const task = await prisma.trainingTask.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        title: true,
        assignments: {
          select: { id: true }
        }
      }
    });

    if (!task) {
      return NextResponse.json({ error: '任务不存在' }, { status: 404 });
    }

    // 删除所有关联的培训分配记录
    await prisma.trainingAssignment.deleteMany({
      where: { taskId }
    });

    // 删除任务
    await prisma.trainingTask.delete({
      where: { id: taskId }
    });

    // 记录操作日志
    await logApiOperation(user, 'training', 'delete_task', {
      taskId: task.id,
      title: task.title,
      assignmentsCount: task.assignments.length
    });

      return NextResponse.json({ 
        success: true,
        message: '任务已删除'
      });
    }
  )
);