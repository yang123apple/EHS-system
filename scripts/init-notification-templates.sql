-- 初始化通知模板的 SQL 脚本
-- 使用方法: 
-- 1. 打开 Prisma Studio: npx prisma studio
-- 2. 或使用 SQLite 客户端连接到 prisma/dev.db
-- 3. 执行以下 SQL 语句

-- 培训模块模板
INSERT OR IGNORE INTO NotificationTemplate (id, name, title, content, type, triggerEvent, triggerCondition, variables, isActive, createdAt, updatedAt)
VALUES 
('tpl_train_assign_001', 'training_assigned_default', '新培训任务', '{{user.name}}分配给您一个新的培训任务：{{training.title}}，请及时完成。', 'training', 'training_assigned', NULL, '["user.name","training.title","training.id"]', 1, datetime('now'), datetime('now')),
('tpl_train_update_001', 'training_updated_default', '培训任务已更新', '培训任务"{{training.title}}"已更新，请及时查看。', 'training', 'training_updated', NULL, '["training.title","training.id"]', 1, datetime('now'), datetime('now'));

-- 作业票模块模板
INSERT OR IGNORE INTO NotificationTemplate (id, name, title, content, type, triggerEvent, triggerCondition, variables, isActive, createdAt, updatedAt)
VALUES 
('tpl_permit_pend_001', 'permit_pending_approval_default', '待审批作业票', '【{{permit.templateName}}】{{permit.projectName}} - 等待您审批（第{{permit.stepNumber}}步：{{permit.stepName}}）', 'work_permit', 'permit_pending_approval', NULL, '["permit.templateName","permit.projectName","permit.stepNumber","permit.stepName","user.name"]', 1, datetime('now'), datetime('now')),
('tpl_permit_appr_001', 'permit_approved_default', '作业票审批通过', '【已完成】【{{permit.templateName}}】{{permit.projectName}} - {{user.name}}通过了您的申请', 'work_permit', 'permit_approved', NULL, '["permit.templateName","permit.projectName","user.name"]', 1, datetime('now'), datetime('now')),
('tpl_permit_rej_001', 'permit_rejected_default', '作业票被驳回', '【已驳回】【{{permit.templateName}}】{{permit.projectName}} - {{user.name}}驳回了您的申请', 'work_permit', 'permit_rejected', NULL, '["permit.templateName","permit.projectName","user.name"]', 1, datetime('now'), datetime('now'));

-- 隐患模块模板
INSERT OR IGNORE INTO NotificationTemplate (id, name, title, content, type, triggerEvent, triggerCondition, variables, isActive, createdAt, updatedAt)
VALUES 
('tpl_hazard_assi_001', 'hazard_assigned_default', '隐患已分配', '{{user.name}}分配给您一个隐患（编号：{{hazard.code}}，位置：{{hazard.location}}），请及时处理。', 'hazard', 'hazard_assigned', NULL, '["user.name","hazard.code","hazard.location","hazard.riskLevel"]', 1, datetime('now'), datetime('now'));

-- 验证插入结果
SELECT COUNT(*) as template_count FROM NotificationTemplate;
SELECT name, type, triggerEvent, isActive FROM NotificationTemplate ORDER BY type, name;
