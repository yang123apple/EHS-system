/**
 * 作业许可相关常量定义
 */

/**
 * 作业许可状态定义
 */
export const WORK_PERMIT_STATUS = {
  // 草稿状态
  DRAFT: 'draft',
  // 待审批
  PENDING: 'pending',
  // 已批准
  APPROVED: 'approved',
  // 进行中
  IN_PROGRESS: 'in_progress',
  // 活跃状态
  ACTIVE: 'active',
  // 处理中
  PROCESSING: 'processing',
  // 已完成
  COMPLETED: 'completed',
  // 已拒绝
  REJECTED: 'rejected',
  // 已关闭
  CLOSED: 'closed',
} as const;

/**
 * 活跃状态列表（用于统计"进行中"的作业）
 *
 * 定义：所有未完成、未拒绝、未关闭的状态
 *
 * 使用场景：
 * - Dashboard 统计
 * - 作业列表筛选
 * - 统计报表
 *
 * ⚠️ 修改此列表前请确保：
 * 1. 与产品需求一致
 * 2. 所有使用方都已测试
 * 3. 更新相关文档
 */
export const ACTIVE_WORK_PERMIT_STATUSES = [
  WORK_PERMIT_STATUS.DRAFT,
  WORK_PERMIT_STATUS.PENDING,
  WORK_PERMIT_STATUS.APPROVED,
  WORK_PERMIT_STATUS.IN_PROGRESS,
  WORK_PERMIT_STATUS.ACTIVE,
  WORK_PERMIT_STATUS.PROCESSING,
] as const;

/**
 * 已结束状态列表
 */
export const FINISHED_WORK_PERMIT_STATUSES = [
  WORK_PERMIT_STATUS.COMPLETED,
  WORK_PERMIT_STATUS.REJECTED,
  WORK_PERMIT_STATUS.CLOSED,
] as const;

/**
 * 类型导出
 */
export type WorkPermitStatus = typeof WORK_PERMIT_STATUS[keyof typeof WORK_PERMIT_STATUS];
export type ActiveWorkPermitStatus = typeof ACTIVE_WORK_PERMIT_STATUSES[number];
export type FinishedWorkPermitStatus = typeof FINISHED_WORK_PERMIT_STATUSES[number];
