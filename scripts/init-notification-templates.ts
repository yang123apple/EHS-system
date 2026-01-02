/**
 * 初始化通知模板 - TypeScript 版本
 * 使用项目现有的 Prisma 客户端
 */

import { prisma } from '../src/lib/prisma';

const notificationTemplates = [
  // 培训模块模板
  {
    name: 'training_assigned_default',
    title: '新培训任务',
    content: '{{user.name}}分配给您一个新的培训任务：{{training.title}}，请及时完成。',
    type: 'training',
    triggerEvent: 'training_assigned',
    triggerCondition: null,
    variables: JSON.stringify(['user.name', 'training.title', 'training.id']),
    isActive: true,
  },
  {
    name: 'training_updated_default',
    title: '培训任务已更新',
    content: '培训任务"{{training.title}}"已更新，请及时查看。',
    type: 'training',
    triggerEvent: 'training_updated',
    triggerCondition: null,
    variables: JSON.stringify(['training.title', 'training.id']),
    isActive: true,
  },
  {
    name: 'training_completed_reminder',
    title: '培训任务即将到期',
    content: '您的培训任务"{{training.title}}"即将到期，请尽快完成。',
    type: 'training',
    triggerEvent: 'training_deadline_reminder',
    triggerCondition: null,
    variables: JSON.stringify(['training.title', 'training.id', 'training.endDate']),
    isActive: true,
  },

  // 作业票模块模板
  {
    name: 'permit_pending_approval_default',
    title: '待审批作业票',
    content: '【{{permit.templateName}}】{{permit.projectName}} - 等待您审批（第{{permit.stepNumber}}步：{{permit.stepName}}）',
    type: 'work_permit',
    triggerEvent: 'permit_pending_approval',
    triggerCondition: null,
    variables: JSON.stringify(['permit.templateName', 'permit.projectName', 'permit.stepNumber', 'permit.stepName', 'user.name']),
    isActive: true,
  },
  {
    name: 'permit_approved_default',
    title: '作业票审批通过',
    content: '【已完成】【{{permit.templateName}}】{{permit.projectName}} - {{user.name}}通过了您的申请',
    type: 'work_permit',
    triggerEvent: 'permit_approved',
    triggerCondition: null,
    variables: JSON.stringify(['permit.templateName', 'permit.projectName', 'user.name']),
    isActive: true,
  },
  {
    name: 'permit_rejected_default',
    title: '作业票被驳回',
    content: '【已驳回】【{{permit.templateName}}】{{permit.projectName}} - {{user.name}}驳回了您的申请',
    type: 'work_permit',
    triggerEvent: 'permit_rejected',
    triggerCondition: null,
    variables: JSON.stringify(['permit.templateName', 'permit.projectName', 'user.name']),
    isActive: true,
  },
  {
    name: 'permit_submitted_default',
    title: '作业票已提交',
    content: '您提交的作业票【{{permit.templateName}}】{{permit.projectName}}已进入审批流程。',
    type: 'work_permit',
    triggerEvent: 'permit_submitted',
    triggerCondition: null,
    variables: JSON.stringify(['permit.templateName', 'permit.projectName', 'permit.code']),
    isActive: true,
  },

  // 隐患模块模板
  {
    name: 'hazard_created_default',
    title: '新隐患已创建',
    content: '隐患编号：{{hazard.code}}，位置：{{hazard.location}}，请及时处理。',
    type: 'hazard',
    triggerEvent: 'hazard_created',
    triggerCondition: null,
    variables: JSON.stringify(['hazard.code', 'hazard.location', 'hazard.status', 'hazard.riskLevel']),
    isActive: true,
  },
  {
    name: 'hazard_assigned_default',
    title: '隐患已分配',
    content: '{{user.name}}分配给您一个隐患（编号：{{hazard.code}}，位置：{{hazard.location}}），请及时处理。',
    type: 'hazard',
    triggerEvent: 'hazard_assigned',
    triggerCondition: null,
    variables: JSON.stringify(['user.name', 'hazard.code', 'hazard.location', 'hazard.riskLevel']),
    isActive: true,
  },
  {
    name: 'hazard_high_risk',
    title: '高风险隐患需关注',
    content: '⚠️ 高风险隐患（编号：{{hazard.code}}，位置：{{hazard.location}}）需要您立即处理！',
    type: 'hazard',
    triggerEvent: 'hazard_assigned',
    triggerCondition: JSON.stringify({ 'hazard.riskLevel': 'high' }),
    variables: JSON.stringify(['hazard.code', 'hazard.location', 'hazard.description']),
    isActive: true,
  },
  {
    name: 'hazard_completed_default',
    title: '隐患已完成',
    content: '隐患（编号：{{hazard.code}}）已完成处理。',
    type: 'hazard',
    triggerEvent: 'hazard_completed',
    triggerCondition: null,
    variables: JSON.stringify(['hazard.code', 'hazard.location', 'user.name']),
    isActive: true,
  },

  // 系统模块模板
  {
    name: 'system_maintenance',
    title: '系统维护通知',
    content: '系统将于近期进行维护，请提前保存您的工作。',
    type: 'system',
    triggerEvent: 'system_maintenance',
    triggerCondition: null,
    variables: JSON.stringify(['maintenance.startTime', 'maintenance.endTime']),
    isActive: false, // 默认不启用，需要手动触发
  },
];

async function initNotificationTemplates() {
  console.log('开始初始化通知模板...\n');

  let createdCount = 0;
  let skippedCount = 0;

  for (const template of notificationTemplates) {
    try {
      // 检查是否已存在
      const existing = await prisma.notificationTemplate.findUnique({
        where: { name: template.name },
      });

      if (existing) {
        console.log(`⏭️  跳过已存在的模板: ${template.name}`);
        skippedCount++;
        continue;
      }

      // 创建模板
      await prisma.notificationTemplate.create({
        data: template,
      });

      console.log(`✅ 创建模板: ${template.name} (${template.triggerEvent})`);
      createdCount++;
    } catch (error: any) {
      console.error(`❌ 创建模板失败 ${template.name}:`, error.message);
    }
  }

  console.log(`\n初始化完成！`);
  console.log(`✅ 创建: ${createdCount} 个模板`);
  console.log(`⏭️  跳过: ${skippedCount} 个模板`);
  console.log(`📊 总计: ${notificationTemplates.length} 个模板`);
}

// 运行初始化
initNotificationTemplates()
  .catch((error) => {
    console.error('初始化失败:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
