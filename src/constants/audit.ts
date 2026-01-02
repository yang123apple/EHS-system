/**
 * EHS 系统审计日志常量定义
 * 
 * 本文件定义了日志记录的常量、映射关系和辅助函数
 */

import { LogModule, LogAction, BusinessActionRegistry, BusinessCode } from '@/types/audit';

// ============ 模块中文映射 ============
export const ModuleLabels: Record<LogModule, string> = {
  [LogModule.HAZARD]: '隐患管理',
  [LogModule.WORK_PERMIT]: '作业许可',
  [LogModule.TRAINING]: '培训管理',
  [LogModule.DOCUMENT]: '文档管理',
  [LogModule.USER]: '用户管理',
  [LogModule.ORGANIZATION]: '组织架构',
  [LogModule.SYSTEM]: '系统设置',
  [LogModule.NOTIFICATION]: '通知中心',
};

// ============ 操作类型中文映射 ============
export const ActionLabels: Record<LogAction, string> = {
  [LogAction.CREATE]: '创建',
  [LogAction.UPDATE]: '更新',
  [LogAction.DELETE]: '删除',
  [LogAction.APPROVE]: '审批通过',
  [LogAction.REJECT]: '审批驳回',
  [LogAction.SUBMIT]: '提交',
  [LogAction.ASSIGN]: '分配',
  [LogAction.EXPORT]: '导出',
  [LogAction.IMPORT]: '导入',
  [LogAction.LOGIN]: '登录',
  [LogAction.LOGOUT]: '登出',
  [LogAction.VIEW]: '查看',
  [LogAction.DOWNLOAD]: '下载',
  [LogAction.UPLOAD]: '上传',
  [LogAction.CONFIG]: '配置',
  [LogAction.ARCHIVE]: '归档',
  [LogAction.RESTORE]: '恢复',
};

// ============ 敏感字段列表（不记录到快照中） ============
export const SENSITIVE_FIELDS = [
  'password',
  'passwordHash',
  'apiKey',
  'secret',
  'token',
  'accessToken',
  'refreshToken',
  'privateKey',
  'credential',
];

// ============ 忽略字段列表（不计入差异比对） ============
export const IGNORED_DIFF_FIELDS = [
  'updatedAt',
  'createdAt',
  'id',           // 数据库ID通常不需要比对
  '__v',          // Mongoose版本字段
  '_id',          // MongoDB ID
];

// ============ 业务编码映射辅助函数 ============
/**
 * 根据模块和操作获取业务编码
 * @param module 模块名称
 * @param action 操作类型（在 BusinessActionRegistry 中的键名）
 * @returns 业务编码，如果不存在则返回 undefined
 */
export function getBusinessCode(
  module: LogModule,
  action: string
): BusinessCode | undefined {
  const moduleKey = module as keyof typeof BusinessActionRegistry;
  const moduleActions = BusinessActionRegistry[moduleKey];
  
  if (!moduleActions) return undefined;
  
  const actionKey = action.toUpperCase() as keyof typeof moduleActions;
  return moduleActions[actionKey] as BusinessCode | undefined;
}

/**
 * 生成操作描述
 * @param userName 操作人姓名
 * @param module 模块
 * @param action 操作类型
 * @param targetLabel 操作对象描述
 * @returns 自然语言描述，如："张三 审批通过了 作业票 [JOB-2024-001]"
 */
export function generateActionDescription(
  userName: string,
  module: LogModule,
  action: LogAction,
  targetLabel?: string
): string {
  const moduleLabel = ModuleLabels[module];
  const actionLabel = ActionLabels[action];
  
  if (targetLabel) {
    return `${userName} ${actionLabel}了 ${moduleLabel} [${targetLabel}]`;
  }
  
  return `${userName} ${actionLabel}了 ${moduleLabel}`;
}

/**
 * 生成中文操作标签
 * @param module 模块
 * @param action 操作类型
 * @returns 如："创建隐患"、"审批作业票"
 */
export function generateActionLabel(
  module: LogModule,
  action: LogAction
): string {
  const moduleLabel = ModuleLabels[module];
  const actionLabel = ActionLabels[action];
  
  return `${actionLabel}${moduleLabel}`;
}

// ============ 业务对象类型映射 ============
export const TargetTypeLabels: Record<string, string> = {
  'hazard': '隐患',
  'work_permit': '作业票',
  'training_task': '培训任务',
  'training_material': '培训材料',
  'document': '文档',
  'user': '用户',
  'department': '部门',
  'notification': '通知',
  'template': '模板',
  'workflow': '工作流',
};

/**
 * 获取业务对象类型的中文名称
 */
export function getTargetTypeLabel(targetType?: string): string {
  if (!targetType) return '对象';
  return TargetTypeLabels[targetType] || targetType;
}

// ============ 日志颜色主题（用于前端显示） ============
export const ActionColorScheme: Record<LogAction, string> = {
  [LogAction.CREATE]: 'text-green-600 bg-green-50',
  [LogAction.UPDATE]: 'text-blue-600 bg-blue-50',
  [LogAction.DELETE]: 'text-red-600 bg-red-50',
  [LogAction.APPROVE]: 'text-emerald-600 bg-emerald-50',
  [LogAction.REJECT]: 'text-orange-600 bg-orange-50',
  [LogAction.SUBMIT]: 'text-indigo-600 bg-indigo-50',
  [LogAction.ASSIGN]: 'text-purple-600 bg-purple-50',
  [LogAction.EXPORT]: 'text-cyan-600 bg-cyan-50',
  [LogAction.IMPORT]: 'text-teal-600 bg-teal-50',
  [LogAction.LOGIN]: 'text-gray-600 bg-gray-50',
  [LogAction.LOGOUT]: 'text-gray-600 bg-gray-50',
  [LogAction.VIEW]: 'text-slate-600 bg-slate-50',
  [LogAction.DOWNLOAD]: 'text-sky-600 bg-sky-50',
  [LogAction.UPLOAD]: 'text-violet-600 bg-violet-50',
  [LogAction.CONFIG]: 'text-amber-600 bg-amber-50',
  [LogAction.ARCHIVE]: 'text-stone-600 bg-stone-50',
  [LogAction.RESTORE]: 'text-lime-600 bg-lime-50',
};

/**
 * 获取操作类型的图标（可选，基于 Lucide React）
 */
export const ActionIcons: Record<LogAction, string> = {
  [LogAction.CREATE]: 'Plus',
  [LogAction.UPDATE]: 'Edit',
  [LogAction.DELETE]: 'Trash2',
  [LogAction.APPROVE]: 'CheckCircle',
  [LogAction.REJECT]: 'XCircle',
  [LogAction.SUBMIT]: 'Send',
  [LogAction.ASSIGN]: 'UserPlus',
  [LogAction.EXPORT]: 'Download',
  [LogAction.IMPORT]: 'Upload',
  [LogAction.LOGIN]: 'LogIn',
  [LogAction.LOGOUT]: 'LogOut',
  [LogAction.VIEW]: 'Eye',
  [LogAction.DOWNLOAD]: 'Download',
  [LogAction.UPLOAD]: 'Upload',
  [LogAction.CONFIG]: 'Settings',
  [LogAction.ARCHIVE]: 'Archive',
  [LogAction.RESTORE]: 'RotateCcw',
};
