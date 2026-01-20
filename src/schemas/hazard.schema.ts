/**
 * 隐患管理模块的共享 Zod Schema
 * 用于前后端统一的类型校验和日期格式
 */

import { z } from 'zod';

// ============ 基础类型枚举 ============

/**
 * 隐患状态枚举值
 */
export const HAZARD_STATUS_VALUES = ['reported', 'assigned', 'rectifying', 'verified', 'closed'] as const;

/**
 * 风险等级枚举值
 */
export const RISK_LEVEL_VALUES = ['low', 'medium', 'high', 'major'] as const;

/**
 * 审批模式枚举值
 */
export const APPROVAL_MODE_VALUES = ['OR', 'AND', 'CONDITIONAL'] as const;

/**
 * 延期状态枚举值
 */
export const EXTENSION_STATUS_VALUES = ['pending', 'approved', 'rejected'] as const;

// ============ Zod Schema 定义 ============

/**
 * ISO 日期字符串 schema（统一使用 ISO 8601 格式）
 * 存储使用 UTC，展示时转换为本地时间
 */
export const isoDateStringSchema = z.string().datetime({
  message: '日期必须是有效的 ISO 8601 格式字符串',
});

/**
 * 隐患状态 schema
 */
export const hazardStatusSchema = z.enum(HAZARD_STATUS_VALUES, {
  message: '无效的隐患状态值',
});

/**
 * 风险等级 schema
 */
export const riskLevelSchema = z.enum(RISK_LEVEL_VALUES, {
  message: '无效的风险等级值',
});

/**
 * 审批模式 schema
 */
export const approvalModeSchema = z.enum(APPROVAL_MODE_VALUES, {
  message: '无效的审批模式值',
});

/**
 * 延期状态 schema
 */
export const extensionStatusSchema = z.enum(EXTENSION_STATUS_VALUES, {
  message: '无效的延期状态值',
});

/**
 * 候选处理人 schema
 */
export const candidateHandlerSchema = z.object({
  userId: z.string().min(1, '用户ID不能为空'),
  userName: z.string().min(1, '用户名称不能为空'),
  hasOperated: z.boolean().optional(),
  operatedAt: isoDateStringSchema.optional().nullable(),
  opinion: z.string().optional().nullable(),
});

/**
 * 隐患日志 schema
 */
export const hazardLogSchema = z.object({
  operatorName: z.string(),
  action: z.string(),
  time: isoDateStringSchema,
  changes: z.string(),
  ccUsers: z.array(z.string()).optional(),
  ccUserNames: z.array(z.string()).optional(),
});

/**
 * 隐患延期记录 schema
 */
export const hazardExtensionSchema = z.object({
  id: z.string(),
  hazardId: z.string(),
  oldDeadline: isoDateStringSchema,
  newDeadline: isoDateStringSchema,
  reason: z.string(),
  applicantId: z.string(),
  approverId: z.string().optional().nullable(),
  status: extensionStatusSchema,
  createdAt: isoDateStringSchema,
});

/**
 * 隐患记录主 Schema（完整版）
 * 注意：所有日期字段统一使用 ISO 字符串格式
 */
export const hazardRecordSchema = z.object({
  id: z.string(),
  code: z.string().optional().nullable(),
  status: hazardStatusSchema,
  riskLevel: riskLevelSchema,
  type: z.string(),
  location: z.string(),
  desc: z.string(),
  photos: z.array(z.string()),
  reporterId: z.string(),
  reporterName: z.string(),
  reportTime: isoDateStringSchema,
  responsibleDept: z.string().optional().nullable(),
  responsibleDeptId: z.string().optional().nullable(),
  responsibleDeptName: z.string().optional().nullable(),
  responsibleId: z.string().optional().nullable(),
  responsibleName: z.string().optional().nullable(),
  dopersonal_ID: z.string().optional().nullable(),
  dopersonal_Name: z.string().optional().nullable(),
  candidateHandlers: z.array(candidateHandlerSchema).optional(),
  approvalMode: approvalModeSchema.optional().nullable(),
  old_personal_ID: z.array(z.string()).optional(),
  currentStepIndex: z.number().optional().nullable(),
  currentStepId: z.string().optional().nullable(),
  deadline: isoDateStringSchema.optional().nullable(),
  isExtensionRequested: z.boolean().optional(),
  extensionReason: z.string().optional().nullable(),
  rectifyDesc: z.string().optional().nullable(),
  rectifyPhotos: z.array(z.string()).optional(),
  rectifyTime: isoDateStringSchema.optional().nullable(),
  verifierId: z.string().optional().nullable(),
  verifierName: z.string().optional().nullable(),
  verifyTime: isoDateStringSchema.optional().nullable(),
  verifyPhotos: z.array(z.string()).optional(),
  verifyDesc: z.string().optional().nullable(),
  rootCause: z.string().optional().nullable(),
  logs: z.array(hazardLogSchema).optional(),
  rectifyRequirement: z.string().optional().nullable(),
  requireEmergencyPlan: z.boolean().optional(),
  emergencyPlanDeadline: isoDateStringSchema.optional().nullable(),
  emergencyPlanContent: z.string().optional().nullable(),
  emergencyPlanSubmitTime: isoDateStringSchema.optional().nullable(),
  ccDepts: z.array(z.string()).optional(),
  ccUsers: z.array(z.string()).optional(),
  ccUserNames: z.array(z.string()).optional(),
  rejectReason: z.string().optional().nullable(),
  extensions: z.array(hazardExtensionSchema).optional(),
}).passthrough(); // 允许额外字段，避免严格校验阻塞现有数据

/**
 * 隐患记录创建 Schema（简化版，用于表单校验）
 */
export const createHazardRecordSchema = hazardRecordSchema.pick({
  type: true,
  location: true,
  desc: true,
  photos: true,
  riskLevel: true,
}).extend({
  photos: z.array(z.string()).default([]),
});

/**
 * 隐患记录更新 Schema
 */
export const updateHazardRecordSchema = hazardRecordSchema.partial();

// ============ TypeScript 类型导出 ============

/**
 * 从 Schema 推导的 TypeScript 类型
 * 确保前后端类型一致
 */
export type HazardStatus = z.infer<typeof hazardStatusSchema>;
export type RiskLevel = z.infer<typeof riskLevelSchema>;
export type ApprovalMode = z.infer<typeof approvalModeSchema>;
export type ExtensionStatus = z.infer<typeof extensionStatusSchema>;
export type CandidateHandler = z.infer<typeof candidateHandlerSchema>;
export type HazardLog = z.infer<typeof hazardLogSchema>;
export type HazardExtension = z.infer<typeof hazardExtensionSchema>;
export type HazardRecord = z.infer<typeof hazardRecordSchema>;
export type CreateHazardRecordInput = z.infer<typeof createHazardRecordSchema>;
export type UpdateHazardRecordInput = z.infer<typeof updateHazardRecordSchema>;

// ============ 工具函数 ============

/**
 * 将 Date 对象转换为 ISO 字符串（UTC）
 */
export function toISOString(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  if (typeof date === 'string') {
    // 验证是否为有效 ISO 字符串
    try {
      new Date(date).toISOString();
      return date;
    } catch {
      return null;
    }
  }
  return date.toISOString();
}

/**
 * 将 ISO 字符串转换为 Date 对象（用于兼容需要 Date 类型的场景）
 */
export function fromISOString(isoString: string | null | undefined): Date | null {
  if (!isoString) return null;
  try {
    return new Date(isoString);
  } catch {
    return null;
  }
}

/**
 * 安全解析 JSON（用于 logs、ccUsers、candidateHandlers 等字段）
 */
export function safeJsonParse<T>(jsonString: string | null | undefined, defaultValue: T): T {
  if (!jsonString) return defaultValue;
  try {
    return JSON.parse(jsonString) as T;
  } catch (error) {
    console.warn('JSON 解析失败:', error, '原始字符串:', jsonString);
    return defaultValue;
  }
}
