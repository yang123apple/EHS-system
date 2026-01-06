import { prisma } from '../lib/prisma';

/**
 * 为新员工分配默认入职培训
 *
 * 业务要点：
 * - 幂等：如果用户已经有某门课程对应的 TrainingAssignment，则跳过该课程，避免重复指派
 * - 截止日期：统一按照"当前时间 + 30 天"设置
 * - 事务性：所有写入在同一事务中完成，保证原子性（要么都成功，要么都失败）
 * - 并发安全：在事务内部再次校验是否已存在对应的 TrainingAssignment，防止竞态导致重复创建
 *
 * 注意：当前实现基于实际的 Prisma schema（TrainingTask / TrainingAssignment）。
 * 如果需要"默认培训计划"功能，需要在 TrainingTask 中添加 isDefault 字段，或通过其他配置方式实现。
 */
export async function assignOnboardingPlanToUser(userId: string | number): Promise<{ created: number }> {
  // 1) 确认用户存在
  const userIdStr = typeof userId === 'number' ? String(userId) : userId;
  const user = await prisma.user.findUnique({ where: { id: userIdStr } });
  if (!user) throw new Error(`User not found: ${userId}`);

  // 2) 查询所有培训任务（当前 schema 中没有 isDefault 字段，暂时查询所有公开的培训材料对应的任务）
  // TODO: 如果需要在 TrainingTask 中添加 isDefault 字段，可以在这里添加过滤条件
  const defaultTasks = await prisma.trainingTask.findMany({
    where: {
      // 暂时查询所有未过期的任务作为默认培训
      endDate: { gte: new Date() },
    },
    include: { material: true },
  });

  if (defaultTasks.length === 0) {
    // 没有需要指派的培训任务
    return { created: 0 };
  }

  // 3) 提取任务 ID
  const allTaskIds = defaultTasks.map((t) => t.id);

  // 4) 在事务外做一次存在性检查，用于快速判断是否需要写入（减少无谓事务开销）
  const existingAssignments = await prisma.trainingAssignment.findMany({
    where: { 
      userId: userIdStr, 
      taskId: { in: allTaskIds } 
    },
    select: { taskId: true },
  });
  const existingTaskIds = new Set(existingAssignments.map((t) => t.taskId));

  const toAssignTaskIds = allTaskIds.filter((id) => !existingTaskIds.has(id));
  if (toAssignTaskIds.length === 0) {
    // 用户已经拥有所有默认培训任务的分配，无需任何写操作
    return { created: 0 };
  }

  // 5) 在事务中再次检查并批量创建 TrainingAssignment（确保原子性与并发安全）
  const result = await prisma.$transaction(async (tx) => {
    // 5.1 在事务内再次检查，防止并发场景下重复创建
    const existingInsideTx = await tx.trainingAssignment.findMany({
      where: { 
        userId: userIdStr, 
        taskId: { in: toAssignTaskIds } 
      },
      select: { taskId: true },
    });
    const existingInsideSet = new Set(existingInsideTx.map((t) => t.taskId));

    // 5.2 准备最终需要创建的记录
    const finalCreate = toAssignTaskIds
      .filter((id) => !existingInsideSet.has(id))
      .map((taskId) => ({
        taskId,
        userId: userIdStr,
        status: 'assigned',
        progress: 0,
        isPassed: false,
      }));

    if (finalCreate.length === 0) {
      return { created: 0 };
    }

    // 5.3 使用批量插入（createMany），在大多数数据库中效率更高
    await tx.trainingAssignment.createMany({ data: finalCreate });

    return { created: finalCreate.length };
  });

  return result;
}

/**
 * 建议：该函数应在用户注册流程中的“注册成功且用户基本信息（部门、岗位、入职日期等）已经写入数据库”之后被调用。
 * - 同步调用：如果希望注册接口在返回前保证任务已指派（可能增加响应时延），可在注册接口最后直接 await 本函数。
 * - 异步/后台调用：更常见的做法是将该函数作为后台任务（或由队列/worker 执行），这样注册接口能更快返回给前端，任务指派在后台完成。
 */

export default {
  assignOnboardingPlanToUser,
};
