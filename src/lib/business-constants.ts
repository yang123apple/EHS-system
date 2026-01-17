/**
 * 业务常量统一管理文件
 * 集中定义状态值、动作、权限键等业务常量，避免硬编码分散
 */

// ============ 隐患管理模块常量 ============

/**
 * 隐患状态常量
 */
export const HAZARD_STATUS = {
  REPORTED: 'reported',
  ASSIGNED: 'assigned',
  RECTIFYING: 'rectifying',
  VERIFIED: 'verified',
  CLOSED: 'closed',
} as const;

/**
 * 隐患风险等级常量
 */
export const HAZARD_RISK_LEVEL = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  MAJOR: 'major',
} as const;

/**
 * 审批模式常量
 */
export const APPROVAL_MODE = {
  OR: 'OR',
  AND: 'AND',
  CONDITIONAL: 'CONDITIONAL',
} as const;

/**
 * 延期状态常量
 */
export const EXTENSION_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;

/**
 * 隐患操作动作常量
 */
export const HAZARD_ACTION = {
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  ASSIGN: 'ASSIGN',
  RECTIFY: 'RECTIFY',
  VERIFY: 'VERIFY',
  REJECT: 'REJECT',
  REQUEST_EXTENSION: 'REQUEST_EXTENSION',
  APPROVE_EXTENSION: 'APPROVE_EXTENSION',
  REJECT_EXTENSION: 'REJECT_EXTENSION',
  CLOSE: 'CLOSE',
} as const;

/**
 * 隐患权限键常量（与 SYSTEM_MODULES 中的权限键对应）
 */
export const HAZARD_PERMISSION = {
  ACCESS: 'access',
  REPORT: 'report',
  HANDLE: 'handle',
  ASSIGN: 'assign',
  VIEW_STATS: 'view_stats',
  MANAGE_CONFIG: 'manage_config',
  DELETE: 'delete',
  EDIT_CC_WORKFLOW: 'edit_cc_workflow',
} as const;

// ============ 事故事件管理模块常量 ============

/**
 * 事故类型常量
 */
export const INCIDENT_TYPE = {
  INJURY: 'injury',
  NEAR_MISS: 'near_miss',
  PROPERTY_DAMAGE: 'property_damage',
  ENVIRONMENTAL: 'environmental',
} as const;

/**
 * 事故严重程度常量
 */
export const INCIDENT_SEVERITY = {
  MINOR: 'minor',
  MODERATE: 'moderate',
  SERIOUS: 'serious',
  CRITICAL: 'critical',
} as const;

/**
 * 事故状态常量
 */
export const INCIDENT_STATUS = {
  REPORTED: 'reported',
  INVESTIGATING: 'investigating',
  REVIEWED: 'reviewed',
  CLOSED: 'closed',
  REJECTED: 'rejected',
} as const;

/**
 * 事故操作动作常量
 */
export const INCIDENT_ACTION = {
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  INVESTIGATE: 'INVESTIGATE',
  REVIEW: 'REVIEW',
  APPROVE: 'APPROVE',
  REJECT: 'REJECT',
  CLOSE: 'CLOSE',
} as const;

// ============ 系统通用常量 ============

/**
 * 系统模块常量（与 SYSTEM_MODULES 中的模块键对应）
 */
export const SYSTEM_MODULE = {
  WORK_PERMIT: 'work_permit',
  HIDDEN_DANGER: 'hidden_danger',
  DOC_SYS: 'doc_sys',
  TRAINING: 'training',
  ARCHIVES: 'archives',
} as const;

/**
 * 通用操作动作常量
 */
export const COMMON_ACTION = {
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  VIEW: 'VIEW',
  EXPORT: 'EXPORT',
  IMPORT: 'IMPORT',
} as const;

/**
 * 批量操作限制常量
 */
export const BATCH_LIMITS = {
  EXPORT_MAX: 10000, // 单次导出最大条数
  IMPORT_MAX: 5000,  // 单次导入最大条数
  DELETE_MAX: 1000,  // 单次删除最大条数
} as const;

// ============ 类型定义（用于 TypeScript 类型推断） ============

export type HazardStatus = typeof HAZARD_STATUS[keyof typeof HAZARD_STATUS];
export type HazardRiskLevel = typeof HAZARD_RISK_LEVEL[keyof typeof HAZARD_RISK_LEVEL];
export type ApprovalMode = typeof APPROVAL_MODE[keyof typeof APPROVAL_MODE];
export type ExtensionStatus = typeof EXTENSION_STATUS[keyof typeof EXTENSION_STATUS];
export type HazardAction = typeof HAZARD_ACTION[keyof typeof HAZARD_ACTION];
export type HazardPermission = typeof HAZARD_PERMISSION[keyof typeof HAZARD_PERMISSION];

export type IncidentType = typeof INCIDENT_TYPE[keyof typeof INCIDENT_TYPE];
export type IncidentSeverity = typeof INCIDENT_SEVERITY[keyof typeof INCIDENT_SEVERITY];
export type IncidentStatus = typeof INCIDENT_STATUS[keyof typeof INCIDENT_STATUS];
export type IncidentAction = typeof INCIDENT_ACTION[keyof typeof INCIDENT_ACTION];

export type SystemModule = typeof SYSTEM_MODULE[keyof typeof SYSTEM_MODULE];
export type CommonAction = typeof COMMON_ACTION[keyof typeof COMMON_ACTION];
