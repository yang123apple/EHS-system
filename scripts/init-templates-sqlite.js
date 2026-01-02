/**
 * 直接通过数据库操作初始化通知模板
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'prisma', 'dev.db');

const templates = [
  {
    id: 'tpl_train_assign_001',
    name: 'training_assigned_default',
    title: '新培训任务',
    content: '{{user.name}}分配给您一个新的培训任务：{{training.title}}，请及时完成。',
    type: 'training',
    triggerEvent: 'training_assigned',
    triggerCondition: null,
    variables: '["user.name","training.title","training.id"]',
    isActive: 1,
  },
  {
    id: 'tpl_train_update_001',
    name: 'training_updated_default',
    title: '培训任务已更新',
    content: '培训任务"{{training.title}}"已更新，请及时查看。',
    type: 'training',
    triggerEvent: 'training_updated',
    triggerCondition: null,
    variables: '["training.title","training.id"]',
    isActive: 1,
  },
  {
    id: 'tpl_permit_pend_001',
    name: 'permit_pending_approval_default',
    title: '待审批作业票',
    content: '【{{permit.templateName}}】{{permit.projectName}} - 等待您审批（第{{permit.stepNumber}}步：{{permit.stepName}}）',
    type: 'work_permit',
    triggerEvent: 'permit_pending_approval',
    triggerCondition: null,
    variables: '["permit.templateName","permit.projectName","permit.stepNumber","permit.stepName","user.name"]',
    isActive: 1,
  },
  {
    id: 'tpl_permit_appr_001',
    name: 'permit_approved_default',
    title: '作业票审批通过',
    content: '【已完成】【{{permit.templateName}}】{{permit.projectName}} - {{user.name}}通过了您的申请',
    type: 'work_permit',
    triggerEvent: 'permit_approved',
    triggerCondition: null,
    variables: '["permit.templateName","permit.projectName","user.name"]',
    isActive: 1,
  },
  {
    id: 'tpl_permit_rej_001',
    name: 'permit_rejected_default',
    title: '作业票被驳回',
    content: '【已驳回】【{{permit.templateName}}】{{permit.projectName}} - {{user.name}}驳回了您的申请',
    type: 'work_permit',
    triggerEvent: 'permit_rejected',
    triggerCondition: null,
    variables: '["permit.templateName","permit.projectName","user.name"]',
    isActive: 1,
  },
  {
    id: 'tpl_hazard_assi_001',
    name: 'hazard_assigned_default',
    title: '隐患已分配',
    content: '{{user.name}}分配给您一个隐患（编号：{{hazard.code}}，位置：{{hazard.location}}），请及时处理。',
    type: 'hazard',
    triggerEvent: 'hazard_assigned',
    triggerCondition: null,
    variables: '["user.name","hazard.code","hazard.location","hazard.riskLevel"]',
    isActive: 1,
  },
];

console.log('开始初始化通知模板...\n');
console.log(`数据库路径: ${dbPath}\n`);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ 无法连接到数据库:', err.message);
    process.exit(1);
  }
  console.log('✅ 成功连接到数据库\n');
});

let created = 0;
let skipped = 0;

const insertPromises = templates.map((template) => {
  return new Promise((resolve, reject) => {
    const now = new Date().toISOString();
    
    const sql = `
      INSERT OR IGNORE INTO NotificationTemplate 
      (id, name, title, content, type, triggerEvent, triggerCondition, variables, isActive, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    db.run(
      sql,
      [
        template.id,
        template.name,
        template.title,
        template.content,
        template.type,
        template.triggerEvent,
        template.triggerCondition,
        template.variables,
        template.isActive,
        now,
        now,
      ],
      function (err) {
        if (err) {
          console.error(`❌ 插入失败 ${template.name}:`, err.message);
          reject(err);
        } else {
          if (this.changes > 0) {
            console.log(`✅ 创建模板: ${template.name} (${template.triggerEvent})`);
            created++;
          } else {
            console.log(`⏭️  跳过: ${template.name} (已存在)`);
            skipped++;
          }
          resolve();
        }
      }
    );
  });
});

Promise.all(insertPromises)
  .then(() => {
    // 验证结果
    db.get('SELECT COUNT(*) as count FROM NotificationTemplate', [], (err, row) => {
      if (err) {
        console.error('查询失败:', err.message);
      } else {
        console.log(`\n==============================================`);
        console.log(`初始化完成！`);
        console.log(`✅ 新创建: ${created} 个模板`);
        console.log(`⏭️  已存在: ${skipped} 个模板`);
        console.log(`📊 数据库中总计: ${row.count} 个模板`);
        console.log(`==============================================\n`);
      }
      
      db.close((err) => {
        if (err) {
          console.error('关闭数据库失败:', err.message);
        }
      });
    });
  })
  .catch((error) => {
    console.error('初始化失败:', error);
    db.close();
    process.exit(1);
  });
