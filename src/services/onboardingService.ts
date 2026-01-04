import { prisma } from '../lib/prisma';

/**
 * 为新员工分配默认入职培训（TrainingPlan.isDefault = true 下的所有课程）
 *
 * 业务要点：
 * - 幂等：如果用户已经有某门课程对应的 UserTask，则跳过该课程，避免重复指派
 * - 截止日期：统一按照“当前时间 + 30 天”设置
 * - 事务性：所有写入在同一事务中完成，保证原子性（要么都成功，要么都失败）
 * - 并发安全：在事务内部再次校验是否已存在对应的 UserTask，防止竞态导致重复创建
 *
 * 注意：下面的模型/字段名基于业务概念（User / Course / TrainingPlan / UserTask）。
 * 如果你的 Prisma schema 中字段或关系命名不同，请据实调整 `findMany` / `createMany` 的字段名与包含关系。
 */
export async function assignOnboardingPlanToUser(userId: string | number): Promise<{ created: number }> {
  // 1) 确认用户存在（可选，但推荐捕获错误早些返回）
  const user = await prisma.user.findUnique({ where: { id: typeof userId === 'number' ? userId : String(userId) } });
  if (!user) throw new Error(`User not found: ${userId}`);

  // 2) 查询所有标记为默认的培训计划，并包含其下的课程
  // 假设 TrainingPlan 与 Course 是多对多关系，并且在 Prisma 中以 `courses` 字段表示
  const defaultPlans = await prisma.trainingPlan.findMany({
    where: { isDefault: true },
    include: { courses: true },
  });

  // 3) 从这些计划中提取并去重课程 ID
  const allCourses = defaultPlans.flatMap((p: any) => p.courses || []);
  const courseIdSet = new Set<string | number>(allCourses.map((c: any) => c.id));
  const allCourseIds = Array.from(courseIdSet);

  if (allCourseIds.length === 0) {
    // 没有需要指派的课程
    return { created: 0 };
  }

  // 4) 在事务外做一次存在性检查，用于快速判断是否需要写入（减少无谓事务开销）
  const existingTasks = await prisma.userTask.findMany({
    where: { userId: typeof userId === 'number' ? userId : String(userId), courseId: { in: allCourseIds } },
    select: { courseId: true },
  });
  const existingCourseIds = new Set(existingTasks.map((t: any) => t.courseId));

  const toAssignCourseIds = allCourseIds.filter((id) => !existingCourseIds.has(id));
  if (toAssignCourseIds.length === 0) {
    // 用户已经拥有所有默认课程的任务，无需任何写操作
    return { created: 0 };
  }

  // 5) 计算截止日期（当前时间 + 30 天）
  const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  // 6) 在事务中再次检查并批量创建 UserTask（确保原子性与并发安全）
  const result = await prisma.$transaction(async (tx) => {
    // 6.1 在事务内再次检查，防止并发场景下重复创建
    const existingInsideTx = await tx.userTask.findMany({
      where: { userId: typeof userId === 'number' ? userId : String(userId), courseId: { in: toAssignCourseIds } },
      select: { courseId: true },
    });
    const existingInsideSet = new Set(existingInsideTx.map((t: any) => t.courseId));

    // 6.2 准备最终需要创建的记录
    const finalCreate = toAssignCourseIds.filter((id) => !existingInsideSet.has(id)).map((courseId) => ({
      userId: typeof userId === 'number' ? userId : String(userId),
      courseId,
      // 状态字段请与实际数据库枚举值一致（例如 'NOT_STARTED' / 'IN_PROGRESS' / 'COMPLETED'）
      status: 'NOT_STARTED',
      dueDate,
      // 如果表里有 `createdAt` / `updatedAt` 字段且不是由数据库默认填充，可在这里设置
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    if (finalCreate.length === 0) {
      return { created: 0 };
    }

    // 6.3 使用批量插入（createMany），在大多数数据库中效率更高
    // 注意：Prisma 的 createMany 在某些数据库下不返回具体记录，只返回影响行数
    await tx.userTask.createMany({ data: finalCreate });

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
