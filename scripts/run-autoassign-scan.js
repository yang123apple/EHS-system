// scripts/run-autoassign-scan.js
// 简单脚本：在夜间定时运行，触发规则驱动扫描
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// 独立实现夜间扫描脚本，避免依赖 TS module 加载问题。
async function main(){
  try {
    const rules = await prisma.autoAssignRule.findMany({ where: { mode: 'rule', isActive: true }, include: { task: true } });
    let totalAssigned = 0;

    for (const rule of rules) {
      try {
        const cond = rule.condition ? JSON.parse(rule.condition) : {};
        let userIds = [];
        if (cond.jobTitle) {
          const users = await prisma.user.findMany({ where: { jobTitle: cond.jobTitle }, select: { id: true } });
          userIds = users.map(u => u.id);
        } else if (cond.deptId) {
          const allDepts = await prisma.department.findMany();
          const getAllSubDeptIds = (parentIds) => {
            const children = allDepts.filter(d => d.parentId && parentIds.includes(d.parentId)).map(d => d.id);
            if (children.length === 0) return parentIds;
            return [...parentIds, ...getAllSubDeptIds(children)];
          };
          const finalDeptIds = getAllSubDeptIds([cond.deptId]);
          const users = await prisma.user.findMany({ where: { departmentId: { in: finalDeptIds } }, select: { id: true } });
          userIds = users.map(u => u.id);
        } else if (cond.all === true) {
          const users = await prisma.user.findMany({ select: { id: true } });
          userIds = users.map(u => u.id);
        }

        for (const uid of userIds) {
          const exist = await prisma.trainingAssignment.findUnique({ where: { taskId_userId: { taskId: rule.taskId, userId: uid } } }).catch(() => null);
          if (exist) continue;
          await prisma.trainingAssignment.create({ data: { taskId: rule.taskId, userId: uid, status: 'assigned', progress: 0, isPassed: false } });
          await prisma.notification.create({ data: { userId: uid, type: 'training_assigned', title: '新培训任务', content: `您被自动加入培训任务：${rule.task.title}`, relatedType: 'training_task', relatedId: rule.taskId } });
          totalAssigned++;
        }
      } catch (e) {
        console.error('rule scan error', rule.id, e);
      }
    }

    console.log('AutoAssign nightly scan result:', { assigned: totalAssigned });
  } catch (e) {
    console.error('run-autoassign-scan error', e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
