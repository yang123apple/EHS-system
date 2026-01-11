/**
 * 事故事件管理类型定义
 */

export type IncidentType = 'injury' | 'near_miss' | 'property_damage' | 'environmental';
export type IncidentSeverity = 'minor' | 'moderate' | 'serious' | 'critical';
export type IncidentStatus = 'reported' | 'investigating' | 'reviewed' | 'closed' | 'rejected';

export interface Incident {
  id: string;
  code: string | null;
  type: IncidentType;
  severity: IncidentSeverity;
  occurredAt: Date;
  location: string;
  description: string;
  reporterId: string;
  reporterName: string;
  reporterDept: string | null;
  reportTime: Date;
  departmentId: string | null;
  departmentName: string | null;
  
  // 调查详情
  directCause: string | null;
  indirectCause: string | null;
  managementCause: string | null;
  rootCause: string | null;
  
  // 整改措施
  correctiveActions: string | null; // JSON字符串
  preventiveActions: string | null; // JSON字符串
  actionDeadline: Date | null;
  actionResponsibleId: string | null;
  actionResponsibleName: string | null;
  
  // 附件
  photos: string | null; // JSON数组
  attachments: string | null; // JSON数组
  investigationReport: string | null;
  
  // 工作流
  status: IncidentStatus;
  currentStepIndex: number | null;
  currentStepId: string | null;
  flowId: string | null;
  workflowLogs: string | null; // JSON字符串
  
  // 审批与结案
  reviewerId: string | null;
  reviewerName: string | null;
  reviewTime: Date | null;
  reviewComment: string | null;
  closerId: string | null;
  closerName: string | null;
  closeTime: Date | null;
  closeReason: string | null;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface CorrectiveAction {
  action: string;
  deadline?: Date;
  responsibleId?: string;
  responsibleName?: string;
  completed?: boolean;
  completedAt?: Date;
}

export interface PreventiveAction {
  action: string;
  deadline?: Date;
  responsibleId?: string;
  responsibleName?: string;
  completed?: boolean;
  completedAt?: Date;
}

/**
 * 事故类型标签映射
 */
export const IncidentTypeLabels: Record<IncidentType, string> = {
  injury: '伤害事故',
  near_miss: '未遂事故',
  property_damage: '财产损失',
  environmental: '环境事故',
};

/**
 * 严重程度标签映射
 */
export const IncidentSeverityLabels: Record<IncidentSeverity, string> = {
  minor: '轻微',
  moderate: '中等',
  serious: '严重',
  critical: '重大',
};

/**
 * 状态标签映射
 */
export const IncidentStatusLabels: Record<IncidentStatus, string> = {
  reported: '已上报',
  investigating: '调查中',
  reviewed: '待审批',
  closed: '已结案',
  rejected: '已驳回',
};

