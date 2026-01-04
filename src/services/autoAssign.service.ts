import { prisma } from '@/lib/prisma';
import { assignOnboardingPlanToUser } from './onboardingService';

/**
 * 简单的自动派发服务。
 * - processEvent：用于事件驱动（用户首次登录、调岗、文档更新、考试结束等）触发匹配规则并执行指派
 * - runRuleScan：用于规则驱动的定时扫描（每天夜间运行），确保所有符合条件的用户都拥有对应任务
 *
 * 注意：本实现尽量保持通用与可读，具体条件解析/匹配逻辑建议根据业务复杂度逐步丰富。
 */

// 匹配单个条件
async function matchCondition(c: any, user: any): Promise<boolean> {
  const { field, operator, value } = c;
  const userVal = user[field];
  
  if (!userVal && field !== 'all') return false;
  
  switch (operator) {
    case 'equals': return String(userVal) === String(value);
    case 'contains': return String(userVal).includes(String(value));
    case 'startsWith': return String(userVal).startsWith(String(value));
    case 'in': return String(value).split(',').map(v => v.trim()).includes(String(userVal));
    case 'regex': try { return new RegExp(value).test(String(userVal)); } catch { return false; }
    case 'levelGte': try { return parseInt(String(userVal)) >= parseInt(value); } catch { return false; }
    case 'levelLte': try { return parseInt(String(userVal)) <= parseInt(value); } catch { return false; }
    default: return false;
  }
}

// 解析复杂条件并返回匹配的用户ID列表
async function resolveUserIds(cond: any): Promise<string[]> {
  // 支持新格式 { conjunction, conditions } 和旧格式 { jobTitle: '...' }
  if (cond.conjunction && Array.isArray(cond.conditions)) {
    // 新格式：获取所有用户并逐个匹配
    const allUsers = await prisma.user.findMany({ include: { department: true } });
    const matched: string[] = [];
    
    for (const user of allUsers) {
      const results = await Promise.all(cond.conditions.map((c: any) => matchCondition(c, user)));
      const pass = cond.conjunction === 'AND' ? results.every(r => r) : results.some(r => r);
      if (pass) matched.push(user.id);
    }
    return matched;
  }
  
  // 旧格式兼容
  if (cond.userId) return [cond.userId];
  if (cond.all === true) {
    const users = await prisma.user.findMany({ select: { id: true } });
    return users.map(u => u.id);
  }
  if (cond.deptId) {
    const allDepts = await prisma.department.findMany();
    const getAllSubDeptIds = (parentIds: string[]): string[] => {
      const children = allDepts.filter(d => d.parentId && parentIds.includes(d.parentId)).map(d => d.id);
      if (children.length === 0) return parentIds;
      return [...parentIds, ...getAllSubDeptIds(children)];
    };
    const finalDeptIds = getAllSubDeptIds([cond.deptId]);
    const users = await prisma.user.findMany({ where: { departmentId: { in: finalDeptIds } }, select: { id: true } });
    return users.map(u => u.id);
  }
  if (cond.jobTitle) {
    const users = await prisma.user.findMany({ where: { jobTitle: cond.jobTitle }, select: { id: true } });
    return users.map(u => u.id);
  }
  return [];
}

export async function processEvent(eventType: string, payload: any) {
  // 查询所有与该事件类型匹配的激活规则
  const rules = await prisma.autoAssignRule.findMany({ where: { mode: 'event', eventType, isActive: true }, include: { task: true } });

  let totalAssigned = 0;

  for (const rule of rules) {
    try {
      const cond = rule.condition ? JSON.parse(rule.condition) : {};
      const userIds = await resolveUserIds(cond);

      // 为这些用户创建 assignment（幂等：避免重复创建）
      for (const uid of userIds) {
        // 使用 createOrConnect 风格的实现：先查是否存在
        const exist = await prisma.trainingAssignment.findUnique({ where: { taskId_userId: { taskId: rule.taskId, userId: uid } } }).catch(() => null);
        if (exist) continue;

        await prisma.trainingAssignment.create({
          data: {
            taskId: rule.taskId,
            userId: uid,
            status: 'assigned',
            progress: 0,
            isPassed: false
          }
        });

        // 可选：发送通知
        await prisma.notification.create({
          data: {
            userId: uid,
            type: 'training_assigned',
            title: '新培训任务',
            content: `您被自动加入培训任务：${rule.task.title}`,
            relatedType: 'training_task',
            relatedId: rule.taskId
          }
        });

        totalAssigned++;
      }
    } catch (e) {
      console.error('processEvent autoAssignRule error', rule.id, e);
      // 忽略单条规则的错误，继续处理其它规则
    }
  }

  return { assigned: totalAssigned };
}

export async function runRuleScan() {
  // 扫描所有规则模式为 'rule' 的激活规则
  const rules = await prisma.autoAssignRule.findMany({ where: { mode: 'rule', isActive: true }, include: { task: true } });
  let totalAssigned = 0;

  for (const rule of rules) {
    try {
      const cond = rule.condition ? JSON.parse(rule.condition) : {};
      const userIds = await resolveUserIds(cond);

      for (const uid of userIds) {
        const exist = await prisma.trainingAssignment.findUnique({ where: { taskId_userId: { taskId: rule.taskId, userId: uid } } }).catch(() => null);
        if (exist) continue;

        await prisma.trainingAssignment.create({
          data: {
            taskId: rule.taskId,
            userId: uid,
            status: 'assigned',
            progress: 0,
            isPassed: false
          }
        });

        await prisma.notification.create({
          data: {
            userId: uid,
            type: 'training_assigned',
            title: '新培训任务',
            content: `您被自动加入培训任务：${rule.task.title}`,
            relatedType: 'training_task',
            relatedId: rule.taskId
          }
        });

        totalAssigned++;
      }
    } catch (e) {
      console.error('runRuleScan autoAssignRule error', rule.id, e);
    }
  }

  return { assigned: totalAssigned };
}

export default { processEvent, runRuleScan };
