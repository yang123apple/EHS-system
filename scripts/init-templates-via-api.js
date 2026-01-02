/**
 * 通过 API 初始化通知模板
 * 这个脚本使用 fetch 调用管理端 API 来创建模板
 */

const templates = [
  // 培训模块模板
  {
    name: 'training_assigned_default',
    title: '新培训任务',
    content: '{{user.name}}分配给您一个新的培训任务：{{training.title}}，请及时完成。',
    type: 'training',
    triggerEvent: 'training_assigned',
    triggerCondition: null,
    variables: ['user.name', 'training.title', 'training.id'],
    isActive: true,
  },
  {
    name: 'training_updated_default',
    title: '培训任务已更新',
    content: '培训任务"{{training.title}}"已更新，请及时查看。',
    type: 'training',
    triggerEvent: 'training_updated',
    triggerCondition: null,
    variables: ['training.title', 'training.id'],
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
    variables: ['permit.templateName', 'permit.projectName', 'permit.stepNumber', 'permit.stepName', 'user.name'],
    isActive: true,
  },
  {
    name: 'permit_approved_default',
    title: '作业票审批通过',
    content: '【已完成】【{{permit.templateName}}】{{permit.projectName}} - {{user.name}}通过了您的申请',
    type: 'work_permit',
    triggerEvent: 'permit_approved',
    triggerCondition: null,
    variables: ['permit.templateName', 'permit.projectName', 'user.name'],
    isActive: true,
  },
  {
    name: 'permit_rejected_default',
    title: '作业票被驳回',
    content: '【已驳回】【{{permit.templateName}}】{{permit.projectName}} - {{user.name}}驳回了您的申请',
    type: 'work_permit',
    triggerEvent: 'permit_rejected',
    triggerCondition: null,
    variables: ['permit.templateName', 'permit.projectName', 'user.name'],
    isActive: true,
  },
  // 隐患模块模板
  {
    name: 'hazard_assigned_default',
    title: '隐患已分配',
    content: '{{user.name}}分配给您一个隐患（编号：{{hazard.code}}，位置：{{hazard.location}}），请及时处理。',
    type: 'hazard',
    triggerEvent: 'hazard_assigned',
    triggerCondition: null,
    variables: ['user.name', 'hazard.code', 'hazard.location', 'hazard.riskLevel'],
    isActive: true,
  },
];

console.log(`
==============================================
通知模板初始化工具
==============================================

准备创建 ${templates.length} 个通知模板

使用说明：
1. 确保应用已启动（默认 http://localhost:3000）
2. 需要管理员账号的认证 token
3. 将 token 添加到环境变量或直接修改脚本

开始初始化...
`);

async function initTemplates() {
  const baseURL = process.env.BASE_URL || 'http://localhost:3000';
  const token = process.env.ADMIN_TOKEN; // 需要设置管理员 token
  
  if (!token) {
    console.log(`
⚠️  警告: 未设置 ADMIN_TOKEN 环境变量

请按以下步骤操作：
1. 在浏览器中登录管理员账号
2. 打开开发者工具 (F12)
3. 在 Console 中运行: localStorage.getItem('token')
4. 复制 token 值
5. 重新运行: $env:ADMIN_TOKEN="your-token-here"; node scripts/init-templates-via-api.js

或者直接在管理页面手动创建模板：http://localhost:3000/admin/notifications
`);
    return;
  }

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const template of templates) {
    try {
      const response = await fetch(`${baseURL}/api/admin/notification-templates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(template),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        console.log(`✅ 创建成功: ${template.name}`);
        created++;
      } else if (result.message?.includes('已存在')) {
        console.log(`⏭️  跳过: ${template.name} (已存在)`);
        skipped++;
      } else {
        console.error(`❌ 创建失败: ${template.name} - ${result.message || '未知错误'}`);
        failed++;
      }
    } catch (error) {
      console.error(`❌ 网络错误: ${template.name} - ${error.message}`);
      failed++;
    }
  }

  console.log(`
==============================================
初始化完成
==============================================
✅ 成功创建: ${created} 个
⏭️  已存在跳过: ${skipped} 个
❌ 失败: ${failed} 个
📊 总计: ${templates.length} 个
==============================================
`);
}

initTemplates().catch(console.error);
