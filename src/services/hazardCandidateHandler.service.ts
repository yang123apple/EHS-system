/**
 * 隐患候选处理人服务
 * 统一管理或签/会签模式下的候选处理人操作状态
 */

import { prisma } from '@/lib/prisma';

export interface CandidateHandlerInput {
  userId: string;
  userName: string;
  stepIndex: number;
  stepId?: string;
}

export interface UpdateOperationInput {
  userId: string;
  hasOperated: boolean;
  opinion?: string;
}

/**
 * 创建或更新候选处理人列表
 * @param hazardId 隐患ID
 * @param candidates 候选处理人列表
 * @param stepIndex 步骤索引
 * @param stepId 步骤ID（可选）
 */
export async function upsertCandidateHandlers(
  hazardId: string,
  candidates: CandidateHandlerInput[],
  stepIndex: number,
  stepId?: string
): Promise<void> {
  // 使用事务确保一致性
  await prisma.$transaction(async (tx) => {
    // 1. 删除该隐患、该步骤的旧记录
    await tx.hazardCandidateHandler.deleteMany({
      where: {
        hazardId,
        stepIndex
      }
    });

    // 2. 创建新的候选处理人记录
    if (candidates.length > 0) {
      await tx.hazardCandidateHandler.createMany({
        data: candidates.map(candidate => ({
          hazardId,
          userId: candidate.userId,
          userName: candidate.userName,
          stepIndex,
          stepId: stepId || null,
          hasOperated: false
        }))
      });
    }
  });
}

/**
 * 更新候选处理人的操作状态
 * @param hazardId 隐患ID
 * @param userId 用户ID
 * @param stepIndex 步骤索引
 * @param input 操作信息
 */
export async function updateCandidateHandlerOperation(
  hazardId: string,
  userId: string,
  stepIndex: number,
  input: UpdateOperationInput
): Promise<void> {
  await prisma.hazardCandidateHandler.updateMany({
    where: {
      hazardId,
      userId,
      stepIndex
    },
    data: {
      hasOperated: input.hasOperated,
      opinion: input.opinion || null,
      operatedAt: input.hasOperated ? new Date() : null
    }
  });
}

/**
 * 获取隐患的候选处理人列表
 * @param hazardId 隐患ID
 * @param stepIndex 步骤索引（可选，不传则返回所有步骤）
 */
export async function getCandidateHandlers(
  hazardId: string,
  stepIndex?: number
): Promise<Array<{
  userId: string;
  userName: string;
  stepIndex: number;
  stepId: string | null;
  hasOperated: boolean;
  operatedAt: Date | null;
  opinion: string | null;
}>> {
  const where: any = { hazardId };
  if (stepIndex !== undefined) {
    where.stepIndex = stepIndex;
  }

  const records = await prisma.hazardCandidateHandler.findMany({
    where,
    orderBy: [
      { stepIndex: 'asc' },
      { createdAt: 'asc' }
    ]
  });

  return records.map(r => ({
    userId: r.userId,
    userName: r.userName,
    stepIndex: r.stepIndex,
    stepId: r.stepId,
    hasOperated: r.hasOperated,
    operatedAt: r.operatedAt,
    opinion: r.opinion
  }));
}

/**
 * 检查或签/会签规则是否满足流转条件
 * @param hazardId 隐患ID
 * @param stepIndex 步骤索引
 * @param approvalMode 审批模式：'OR' | 'AND'
 * @returns 是否满足流转条件
 */
export async function checkApprovalCompletion(
  hazardId: string,
  stepIndex: number,
  approvalMode: 'OR' | 'AND'
): Promise<boolean> {
  const candidates = await prisma.hazardCandidateHandler.findMany({
    where: {
      hazardId,
      stepIndex
    }
  });

  if (candidates.length === 0) {
    return false; // 没有候选处理人，无法完成
  }

  if (approvalMode === 'OR') {
    // 或签：只要有一人操作即可
    return candidates.some(c => c.hasOperated);
  } else if (approvalMode === 'AND') {
    // 会签：所有人都必须操作
    return candidates.every(c => c.hasOperated);
  }

  return false;
}

/**
 * 检查用户是否已操作（防止重复操作）
 * @param hazardId 隐患ID
 * @param userId 用户ID
 * @param stepIndex 步骤索引
 */
export async function hasUserOperated(
  hazardId: string,
  userId: string,
  stepIndex: number
): Promise<boolean> {
  const record = await prisma.hazardCandidateHandler.findUnique({
    where: {
      hazardId_userId_stepIndex: {
        hazardId,
        userId,
        stepIndex
      }
    }
  });

  return record?.hasOperated || false;
}

/**
 * 检查用户是否是候选处理人
 * @param hazardId 隐患ID
 * @param userId 用户ID
 * @param stepIndex 步骤索引
 * @returns 是否是候选处理人
 */
export async function isUserCandidate(
  hazardId: string,
  userId: string,
  stepIndex: number
): Promise<boolean> {
  const record = await prisma.hazardCandidateHandler.findUnique({
    where: {
      hazardId_userId_stepIndex: {
        hazardId,
        userId,
        stepIndex
      }
    }
  });

  return !!record;
}

/**
 * 删除隐患的所有候选处理人记录（用于清理或步骤流转）
 * @param hazardId 隐患ID
 * @param stepIndex 步骤索引（可选，不传则删除所有步骤）
 */
export async function deleteCandidateHandlers(
  hazardId: string,
  stepIndex?: number
): Promise<void> {
  const where: any = { hazardId };
  if (stepIndex !== undefined) {
    where.stepIndex = stepIndex;
  }

  await prisma.hazardCandidateHandler.deleteMany({ where });
}
