/**
 * 事故事件管理类型定义
 * 
 * ⚠️ 类型一致性说明：
 * - 所有日期字段统一使用 ISO 8601 字符串格式（而非 Date 对象）
 * - 这与后端 Prisma 模型和 Zod Schema 保持一致
 * - 存储时使用 UTC，展示时转换为本地时间
 */

// 使用常量定义，避免硬编码
import type { 
  IncidentType as IncidentTypeConst,
  IncidentSeverity as IncidentSeverityConst,
  IncidentStatus as IncidentStatusConst
} from '@/lib/business-constants';

export type IncidentType = IncidentTypeConst;
export type IncidentSeverity = IncidentSeverityConst;
export type IncidentStatus = IncidentStatusConst;

/**
 * Incident 接口定义
 * 注意：所有日期字段统一使用 ISO 8601 字符串格式（如：'2024-01-15T10:30:00.000Z'）
 */
export interface Incident {
  id: string;
  code: string | null;
  type: IncidentType;
  severity: IncidentSeverity;
  occurredAt: string; // ISO 8601 日期字符串（原为 Date）
  location: string;
  description: string;
  reporterId: string;
  reporterName: string;
  /** @deprecated 使用 reporterDeptName 替代 */
  reporterDept: string | null;
  reporterDeptName?: string | null; // ✅ 上报人部门名称（推荐使用）
  reportTime: string; // ISO 8601 日期字符串（原为 Date）
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
  actionDeadline: string | null; // ISO 8601 日期字符串（原为 Date）
  /** @deprecated 使用 rectificationLeaderId 替代（与 HazardRecord 统一） */
  actionResponsibleId: string | null;
  /** @deprecated 使用 rectificationLeaderName 替代（与 HazardRecord 统一） */
  actionResponsibleName: string | null;

  // ✅ 新字段：整改责任人（推荐使用，与 HazardRecord 统一）
  rectificationLeaderId?: string | null; // 整改责任人ID
  rectificationLeaderName?: string | null; // 整改责任人姓名

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

  // 当前处理人（动态字段，随工作流流转更新）
  currentHandlerId?: string | null;
  currentHandlerName?: string | null;
  candidateHandlers?: string | null; // 候选处理人列表（JSON格式，用于或签/会签）
  approvalMode?: string | null; // 当前步骤的审批模式（OR=或签，AND=会签）

  // 审批与结案
  reviewerId: string | null;
  reviewerName: string | null;
  reviewTime: string | null; // ISO 8601 日期字符串（原为 Date）
  reviewComment: string | null;
  closerId: string | null;
  closerName: string | null;
  closeTime: string | null; // ISO 8601 日期字符串（原为 Date）
  closeReason: string | null;

  // 通知与抄送
  /** @deprecated 使用 ccDeptIds 替代 */
  ccDepts?: string | null; // 抄送部门（JSON数组）
  /** @deprecated 使用 ccUserIds 替代 */
  ccUsers?: string | null; // 抄送用户（JSON数组）

  // ✅ 新字段：抄送（推荐使用）
  ccDeptIds?: string | null; // 抄送部门ID列表（JSON数组）
  ccUserIds?: string | null; // 抄送用户ID列表（JSON数组）

  createdAt: string; // ISO 8601 日期字符串（原为 Date）
  updatedAt: string; // ISO 8601 日期字符串（原为 Date）
}

/**
 * 整改措施接口
 * 注意：日期字段统一使用 ISO 8601 字符串格式
 */
export interface CorrectiveAction {
  action: string;
  deadline?: string | null; // ISO 8601 日期字符串（原为 Date）
  responsibleId?: string | null;
  responsibleName?: string | null;
  completed?: boolean;
  completedAt?: string | null; // ISO 8601 日期字符串（原为 Date）
}

/**
 * 预防措施接口
 * 注意：日期字段统一使用 ISO 8601 字符串格式
 */
export interface PreventiveAction {
  action: string;
  deadline?: string | null; // ISO 8601 日期字符串（原为 Date）
  responsibleId?: string | null;
  responsibleName?: string | null;
  completed?: boolean;
  completedAt?: string | null; // ISO 8601 日期字符串（原为 Date）
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

