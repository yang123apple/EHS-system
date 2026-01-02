/**
 * 使用 Prisma 客户端初始化通知模板
 * 这个脚本通过 Prisma 直接操作数据库
 */

// 由于 ES Module 导入问题，我们使用动态导入
async function initTemplates() {
  // 动态导入 Prisma 客户端
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();

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

  console.log('开始初始化通知模板...\n');

  let created = 0;
  let skipped = 0;

  try {
    // 检查 NotificationTemplate 模型是否存在
    if (!prisma.notificationTemplate) {
      console.error('❌ NotificationTemplate 模型不存在');
      console.error('请确保:');
      console.error('1. prisma/schema.prisma 中已定义 NotificationTemplate 模型');
      console.error('2. 已运行 npx prisma generate');
      await prisma.$disconnect();
      return;
    }

    for (const template of templates) {
      try {
        // 检查是否已存在
        const existing = await prisma.notificationTemplate.findUnique({
          where: { name: template.name },
        });

        if (existing) {
          console.log(`⏭️  跳过: ${template.name} (已存在)`);
          skipped++;
          continue;
        }

        // 创建模板
        await prisma.notificationTemplate.create({
          data: template,
        });

        console.log(`✅ 创建模板: ${template.name} (${template.triggerEvent})`);
        created++;
      } catch (error) {
        console.error(`❌ 创建失败 ${template.name}:`, error.message);
      }
    }

    // 统计总数
    const total = await prisma.notificationTemplate.count();

    console.log(`\n==============================================`);
    console.log(`初始化完成！`);
    console.log(`✅ 新创建: ${created} 个模板`);
    console.log(`⏭️  已存在: ${skipped} 个模板`);
    console.log(`📊 数据库中总计: ${total} 个模板`);
    console.log(`==============================================\n`);
  } catch (error) {
    console.error('初始化失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 运行
initTemplates().catch(console.error);
