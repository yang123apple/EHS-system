// 检查数据库状态和创建模板
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAndInit() {
  console.log('========================================');
  console.log('检查数据库状态...\n');

  try {
    // 检查 NotificationTemplate 表是否存在
    const tables = await prisma.$queryRaw`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='NotificationTemplate';
    `;
    
    console.log('NotificationTemplate 表:', tables.length > 0 ? '✅ 存在' : '❌ 不存在');
    
    if (tables.length === 0) {
      console.log('\n❌ NotificationTemplate 表不存在！');
      console.log('请运行: node node_modules/prisma/build/index.js migrate deploy');
      await prisma.$disconnect();
      return;
    }

    // 检查现有模板数量
    const count = await prisma.notificationTemplate.count();
    console.log(`现有模板数量: ${count}\n`);

    if (count > 0) {
      console.log('已存在的模板:');
      const existing = await prisma.notificationTemplate.findMany({
        select: { name: true, type: true, triggerEvent: true, isActive: true }
      });
      existing.forEach(t => {
        console.log(`  - ${t.name} (${t.type}/${t.triggerEvent}) ${t.isActive ? '✅' : '❌'}`);
      });
      console.log('\n如果要重新创建，请先在管理页面删除现有模板。');
      await prisma.$disconnect();
      return;
    }

    // 创建模板
    console.log('开始创建模板...\n');

    const templates = [
      {
        name: 'training_assigned_default',
        title: '新培训任务',
        content: '{{user.name}}分配给您一个新的培训任务：{{training.title}}，请及时完成。',
        type: 'training',
        triggerEvent: 'training_assigned',
        triggerCondition: null,
        variables: '["user.name","training.title","training.id"]',
        isActive: true,
      },
      {
        name: 'training_updated_default',
        title: '培训任务已更新',
        content: '培训任务"{{training.title}}"已更新，请及时查看。',
        type: 'training',
        triggerEvent: 'training_updated',
        triggerCondition: null,
        variables: '["training.title","training.id"]',
        isActive: true,
      },
      {
        name: 'permit_pending_approval_default',
        title: '待审批作业票',
        content: '【{{permit.templateName}}】{{permit.projectName}} - 等待您审批（第{{permit.stepNumber}}步：{{permit.stepName}}）',
        type: 'work_permit',
        triggerEvent: 'permit_pending_approval',
        triggerCondition: null,
        variables: '["permit.templateName","permit.projectName","permit.stepNumber","permit.stepName","user.name"]',
        isActive: true,
      },
      {
        name: 'permit_approved_default',
        title: '作业票审批通过',
        content: '【已完成】【{{permit.templateName}}】{{permit.projectName}} - {{user.name}}通过了您的申请',
        type: 'work_permit',
        triggerEvent: 'permit_approved',
        triggerCondition: null,
        variables: '["permit.templateName","permit.projectName","user.name"]',
        isActive: true,
      },
      {
        name: 'permit_rejected_default',
        title: '作业票被驳回',
        content: '【已驳回】【{{permit.templateName}}】{{permit.projectName}} - {{user.name}}驳回了您的申请',
        type: 'work_permit',
        triggerEvent: 'permit_rejected',
        triggerCondition: null,
        variables: '["permit.templateName","permit.projectName","user.name"]',
        isActive: true,
      },
      {
        name: 'hazard_assigned_default',
        title: '隐患已分配',
        content: '{{user.name}}分配给您一个隐患（编号：{{hazard.code}}，位置：{{hazard.location}}），请及时处理。',
        type: 'hazard',
        triggerEvent: 'hazard_assigned',
        triggerCondition: null,
        variables: '["user.name","hazard.code","hazard.location","hazard.riskLevel"]',
        isActive: true,
      },
    ];

    let created = 0;
    for (const template of templates) {
      try {
        await prisma.notificationTemplate.create({ data: template });
        console.log(`✅ 创建成功: ${template.name}`);
        created++;
      } catch (error) {
        console.error(`❌ 创建失败: ${template.name} - ${error.message}`);
      }
    }

    console.log(`\n========================================`);
    console.log(`完成！成功创建 ${created}/${templates.length} 个模板`);
    console.log(`========================================`);
    console.log('\n现在访问 /admin/notifications 查看结果');

  } catch (error) {
    console.error('错误:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAndInit();
