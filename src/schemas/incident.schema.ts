/**
 * 事故事件管理模块的共享 Zod Schema
 * 用于前后端统一的类型校验和日期格式
 */

import { z } from 'zod';
import { isoDateStringSchema } from './hazard.schema';

// ============ 基础类型枚举 ============

/**
 * 事故类型枚举值
 */
export const INCIDENT_TYPE_VALUES = ['injury', 'near_miss', 'property_damage', 'environmental'] as const;

/**
 * 事故严重程度枚举值
 */
export const INCIDENT_SEVERITY_VALUES = ['minor', 'moderate', 'serious', 'critical'] as const;

/**
 * 事故状态枚举值
 */
export const INCIDENT_STATUS_VALUES = ['reported', 'investigating', 'reviewed', 'closed', 'rejected'] as const;

// ============ Zod Schema 定义 ============

/**
 * 事故类型 schema
 */
export const incidentTypeSchema = z.enum(INCIDENT_TYPE_VALUES, {
  message: '无效的事故类型值',
});

/**
 * 事故严重程度 schema
 */
export const incidentSeveritySchema = z.enum(INCIDENT_SEVERITY_VALUES, {
  message: '无效的事故严重程度值',
});

/**
 * 事故状态 schema
 */
export const incidentStatusSchema = z.enum(INCIDENT_STATUS_VALUES, {
  message: '无效的事故状态值',
});

/**
 * 整改措施 schema
 */
export const correctiveActionSchema = z.object({
  action: z.string(),
  deadline: isoDateStringSchema.optional().nullable(),
  responsibleId: z.string().optional().nullable(),
  responsibleName: z.string().optional().nullable(),
  completed: z.boolean().optional(),
  completedAt: isoDateStringSchema.optional().nullable(),
});

/**
 * 预防措施 schema
 */
export const preventiveActionSchema = z.object({
  action: z.string(),
  deadline: isoDateStringSchema.optional().nullable(),
  responsibleId: z.string().optional().nullable(),
  responsibleName: z.string().optional().nullable(),
  completed: z.boolean().optional(),
  completedAt: isoDateStringSchema.optional().nullable(),
});

/**
 * 事故事件主 Schema（完整版）
 * 注意：所有日期字段统一使用 ISO 字符串格式（与 HazardRecord 保持一致）
 */
export const incidentSchema = z.object({
  id: z.string(),
  code: z.string().nullable(),
  type: incidentTypeSchema,
  severity: incidentSeveritySchema,
  occurredAt: isoDateStringSchema,
  location: z.string(),
  description: z.string(),
  reporterId: z.string(),
  reporterName: z.string(),
  reporterDept: z.string().nullable(),
  reportTime: isoDateStringSchema,
  departmentId: z.string().nullable(),
  departmentName: z.string().nullable(),
  directCause: z.string().nullable(),
  indirectCause: z.string().nullable(),
  managementCause: z.string().nullable(),
  rootCause: z.string().nullable(),
  correctiveActions: z.string().nullable(), // JSON 字符串，包含 correctiveActionSchema 数组
  preventiveActions: z.string().nullable(), // JSON 字符串，包含 preventiveActionSchema 数组
  actionDeadline: isoDateStringSchema.optional().nullable(),
  actionResponsibleId: z.string().nullable(),
  actionResponsibleName: z.string().nullable(),
  photos: z.string().nullable(), // JSON 数组
  attachments: z.string().nullable(), // JSON 数组
  investigationReport: z.string().nullable(),
  status: incidentStatusSchema,
  currentStepIndex: z.number().nullable(),
  currentStepId: z.string().nullable(),
  flowId: z.string().nullable(),
  workflowLogs: z.string().nullable(), // JSON 字符串
  currentHandlerId: z.string().nullable(),
  currentHandlerName: z.string().nullable(),
  candidateHandlers: z.string().nullable(), // JSON 数组
  approvalMode: z.string().nullable(),
  reviewerId: z.string().nullable(),
  reviewerName: z.string().nullable(),
  reviewTime: isoDateStringSchema.optional().nullable(),
  reviewComment: z.string().nullable(),
  closerId: z.string().nullable(),
  closerName: z.string().nullable(),
  closeTime: isoDateStringSchema.optional().nullable(),
  closeReason: z.string().nullable(),
  ccDepts: z.string().nullable(), // JSON 数组
  ccUsers: z.string().nullable(), // JSON 数组
  createdAt: isoDateStringSchema,
  updatedAt: isoDateStringSchema,
}).passthrough(); // 允许额外字段，避免严格校验阻塞现有数据

/**
 * 事故事件创建 Schema（简化版，用于表单校验）
 */
export const createIncidentSchema = incidentSchema.pick({
  type: true,
  severity: true,
  occurredAt: true,
  location: true,
  description: true,
});

// ============ TypeScript 类型导出 ============

/**
 * 从 Schema 推导的 TypeScript 类型
 * 确保前后端类型一致，日期统一为 ISO 字符串格式
 */
export type IncidentType = z.infer<typeof incidentTypeSchema>;
export type IncidentSeverity = z.infer<typeof incidentSeveritySchema>;
export type IncidentStatus = z.infer<typeof incidentStatusSchema>;
export type CorrectiveAction = z.infer<typeof correctiveActionSchema>;
export type PreventiveAction = z.infer<typeof preventiveActionSchema>;

/**
 * Incident 类型（日期字段为 ISO 字符串格式）
 * 注意：此类型与后端 Prisma 模型的日期字段格式一致（存储为 ISO 字符串）
 */
export type Incident = z.infer<typeof incidentSchema>;
export type CreateIncidentInput = z.infer<typeof createIncidentSchema>;
