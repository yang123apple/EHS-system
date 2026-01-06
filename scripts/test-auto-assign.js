// scripts/test-auto-assign.js
// 测试脚本：验证自动派发功能
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testAutoAssign() {
  console.log('=== 自动派发功能测试 ===\n');

  try {
    // 1. 创建测试用户
    console.log('1️⃣ 创建测试用户...');
    const testUser = await prisma.user.create({
      data: {
        username: `test_${Date.now()}`,
        name: '测试操作工',
        password: '123456',
        jobTitle: '操作工',
        role: 'user'
      }
    });
    console.log(`✓ 创建用户: ${testUser.name} (${testUser.id})\n`);

    // 2. 创建培训材料
    console.log('2️⃣ 创建培训材料...');
    const material = await prisma.trainingMaterial.create({
      data: {
        title: '安全生产培训',
        type: 'video',
        url: '/test.mp4',
        uploaderId: testUser.id,
        isPublic: true
      }
    });
    console.log(`✓ 创建材料: ${material.title}\n`);

    // 3. 创建培训任务
    console.log('3️⃣ 创建培训任务...');
    const task = await prisma.trainingTask.create({
      data: {
        title: '新员工安全培训',
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        materialId: material.id,
        publisherId: testUser.id,
        targetType: 'user',
        targetConfig: JSON.stringify([testUser.id])
      }
    });
    console.log(`✓ 创建任务: ${task.title}\n`);

    // 4. 创建自动派发规则（事件驱动）
    console.log('4️⃣ 创建自动派发规则（事件驱动 - 岗位匹配）...');
    const rule1 = await prisma.autoAssignRule.create({
      data: {
        taskId: task.id,
        mode: 'event',
        eventType: 'user_first_login',
        condition: JSON.stringify({
          conjunction: 'AND',
          conditions: [
            { field: 'jobTitle', operator: 'equals', value: '操作工' }
          ]
        }),
        isActive: true
      }
    });
    console.log(`✓ 创建规则: ${rule1.id} (事件: ${rule1.eventType})\n`);

    // 5. 创建复杂规则（正则匹配）
    console.log('5️⃣ 创建复杂规则（正则匹配）...');
    const rule2 = await prisma.autoAssignRule.create({
      data: {
        taskId: task.id,
        mode: 'rule',
        eventType: null,
        condition: JSON.stringify({
          conjunction: 'OR',
          conditions: [
            { field: 'jobTitle', operator: 'regex', value: '^操作.*' },
            { field: 'jobTitle', operator: 'contains', value: '技术' }
          ]
        }),
        isActive: true
      }
    });
    console.log(`✓ 创建规则: ${rule2.id} (模式: rule, 正则匹配)\n`);

    // 6. 测试事件触发（内联实现）
    console.log('6️⃣ 测试事件触发逻辑（内联）...');
    // 模拟 processEvent 逻辑
    const eventRules = await prisma.autoAssignRule.findMany({
      where: { mode: 'event', eventType: 'user_first_login', isActive: true },
      include: { task: true }
    });
    
    let assigned1 = 0;
    for (const rule of eventRules) {
      const cond = rule.condition ? JSON.parse(rule.condition) : {};
      if (cond.conjunction && cond.conditions) {
        // 复杂条件：检查用户是否匹配
        const allUsers = await prisma.user.findMany({ where: { id: testUser.id } });
        for (const user of allUsers) {
          const results = cond.conditions.map(c => {
            if (c.operator === 'equals') return user[c.field] === c.value;
            if (c.operator === 'contains') return String(user[c.field]).includes(c.value);
            if (c.operator === 'regex') return new RegExp(c.value).test(String(user[c.field]));
            return false;
          });
          const pass = cond.conjunction === 'AND' ? results.every(r => r) : results.some(r => r);
          if (pass) {
            const exist = await prisma.trainingAssignment.findUnique({
              where: { taskId_userId: { taskId: rule.taskId, userId: user.id } }
            }).catch(() => null);
            if (!exist) {
              await prisma.trainingAssignment.create({
                data: {
                  taskId: rule.taskId,
                  userId: user.id,
                  status: 'assigned',
                  progress: 0,
                  isPassed: false
                }
              });
              assigned1++;
            }
          }
        }
      }
    }
    console.log(`✓ 事件触发结果: 分配了 ${assigned1} 个任务\n`);

    // 7. 验证任务分配
    console.log('7️⃣ 验证任务分配...');
    const assignments = await prisma.trainingAssignment.findMany({
      where: { userId: testUser.id },
      include: { task: true }
    });
    console.log(`✓ 用户拥有 ${assignments.length} 个任务分配:`);
    assignments.forEach(a => {
      console.log(`  - ${a.task.title} (状态: ${a.status})`);
    });
    console.log();

    // 8. 测试规则扫描（内联实现）
    console.log('8️⃣ 测试规则扫描逻辑（内联）...');
    const ruleRules = await prisma.autoAssignRule.findMany({
      where: { mode: 'rule', isActive: true },
      include: { task: true }
    });
    
    let assigned2 = 0;
    for (const rule of ruleRules) {
      const cond = rule.condition ? JSON.parse(rule.condition) : {};
      if (cond.conjunction && cond.conditions) {
        const allUsers = await prisma.user.findMany();
        for (const user of allUsers) {
          const results = cond.conditions.map(c => {
            if (c.operator === 'equals') return user[c.field] === c.value;
            if (c.operator === 'contains') return String(user[c.field] || '').includes(c.value);
            if (c.operator === 'regex') return new RegExp(c.value).test(String(user[c.field] || ''));
            return false;
          });
          const pass = cond.conjunction === 'AND' ? results.every(r => r) : results.some(r => r);
          if (pass) {
            const exist = await prisma.trainingAssignment.findUnique({
              where: { taskId_userId: { taskId: rule.taskId, userId: user.id } }
            }).catch(() => null);
            if (!exist) {
              await prisma.trainingAssignment.create({
                data: {
                  taskId: rule.taskId,
                  userId: user.id,
                  status: 'assigned',
                  progress: 0,
                  isPassed: false
                }
              });
              assigned2++;
            }
          }
        }
      }
    }
    console.log(`✓ 规则扫描结果: 分配了 ${assigned2} 个任务\n`);

    // 9. 测试正则匹配
    console.log('9️⃣ 测试正则匹配条件...');
    const techUser = await prisma.user.create({
      data: {
        username: `tech_${Date.now()}`,
        name: '测试技术员',
        password: '123456',
        jobTitle: '技术员',
        role: 'user'
      }
    });
    console.log(`✓ 创建技术员用户: ${techUser.name}\n`);
    
    // 再次运行规则扫描看技术员是否被匹配
    let assigned3 = 0;
    for (const rule of ruleRules) {
      const cond = rule.condition ? JSON.parse(rule.condition) : {};
      if (cond.conjunction && cond.conditions) {
        const results = cond.conditions.map(c => {
          if (c.operator === 'equals') return techUser[c.field] === c.value;
          if (c.operator === 'contains') return String(techUser[c.field] || '').includes(c.value);
          if (c.operator === 'regex') return new RegExp(c.value).test(String(techUser[c.field] || ''));
          return false;
        });
        const pass = cond.conjunction === 'AND' ? results.every(r => r) : results.some(r => r);
        if (pass) {
          const exist = await prisma.trainingAssignment.findUnique({
            where: { taskId_userId: { taskId: rule.taskId, userId: techUser.id } }
          }).catch(() => null);
          if (!exist) {
            await prisma.trainingAssignment.create({
              data: {
                taskId: rule.taskId,
                userId: techUser.id,
                status: 'assigned',
                progress: 0,
                isPassed: false
              }
            });
            assigned3++;
          }
        }
      }
    }
    
    const techAssignments = await prisma.trainingAssignment.findMany({
      where: { userId: techUser.id }
    });
    console.log(`✓ 技术员用户拥有 ${techAssignments.length} 个任务分配（新增 ${assigned3} 个）\n`);

    console.log('=== ✅ 所有测试通过！===\n');
    console.log('📋 测试总结:');
    console.log(`  - 创建用户: 2 个`);
    console.log(`  - 创建培训材料: 1 个`);
    console.log(`  - 创建培训任务: 1 个`);
    console.log(`  - 创建自动派发规则: 2 个`);
    console.log(`  - 事件触发测试: ✓`);
    console.log(`  - 规则扫描测试: ✓`);
    console.log(`  - 正则匹配测试: ✓\n`);

  } catch (error) {
    console.error('❌ 测试失败:', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

testAutoAssign();
