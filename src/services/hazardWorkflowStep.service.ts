/**
 * 隐患工作流步骤服务
 * 
 * 用于保存和读取每个隐患的每个步骤的执行人和抄送人信息
 * 在创建隐患时，通过 HazardHandlerResolverService 解析所有步骤并保存
 * 后续操作从数据库读取，而不是重新计算
 */

import { prisma } from '@/lib/prisma';
import type { StepHandlerResult } from './hazardHandlerResolver.service';

/**
 * 保存工作流步骤信息到数据库
 */
export async function saveWorkflowSteps(
  hazardId: string,
  stepResults: StepHandlerResult[]
): Promise<void> {
  console.log(`💾 [工作流步骤] 开始保存步骤信息:`, {
    hazardId,
    stepsCount: stepResults.length
  });

  try {
    // 删除该隐患的旧步骤记录（如果存在）
    await prisma.hazardWorkflowStep.deleteMany({
      where: { hazardId }
    });

    // 批量创建新步骤记录
    const stepData = stepResults.map(step => ({
      hazardId,
      stepIndex: step.stepIndex,
      stepId: step.stepId,
      stepName: step.stepName,
      handlerUserIds: JSON.stringify(step.handlers.userIds || []),
      handlerUserNames: JSON.stringify(step.handlers.userNames || []),
      matchedBy: step.handlers.matchedBy,
      ccUserIds: step.ccUsers.userIds.length > 0 ? JSON.stringify(step.ccUsers.userIds) : null,
      ccUserNames: step.ccUsers.userNames.length > 0 ? JSON.stringify(step.ccUsers.userNames) : null,
      approvalMode: step.approvalMode || null,
      success: step.success,
      error: step.error || null
    }));

    await prisma.hazardWorkflowStep.createMany({
      data: stepData
    });

    console.log(`✅ [工作流步骤] 步骤信息保存成功:`, {
      hazardId,
      savedSteps: stepData.length
    });
  } catch (error) {
    console.error(`❌ [工作流步骤] 保存失败:`, error);
    throw error;
  }
}

/**
 * 从数据库读取工作流步骤信息
 */
export async function getWorkflowSteps(hazardId: string): Promise<StepHandlerResult[]> {
  console.log(`📖 [工作流步骤] 读取步骤信息:`, { hazardId });

  try {
    const steps = await prisma.hazardWorkflowStep.findMany({
      where: { hazardId },
      orderBy: { stepIndex: 'asc' }
    });

    const stepResults: StepHandlerResult[] = steps.map(step => ({
      stepIndex: step.stepIndex,
      stepId: step.stepId,
      stepName: step.stepName,
      success: step.success,
      handlers: {
        userIds: JSON.parse(step.handlerUserIds || '[]'),
        userNames: JSON.parse(step.handlerUserNames || '[]'),
        matchedBy: step.matchedBy === null ? undefined : step.matchedBy
      },
      ccUsers: {
        userIds: step.ccUserIds ? JSON.parse(step.ccUserIds) : [],
        userNames: step.ccUserNames ? JSON.parse(step.ccUserNames) : [],
        details: [] // 详情信息不保存，需要时重新计算
      },
      error: step.error || undefined,
      candidateHandlers: step.handlerUserIds ? JSON.parse(step.handlerUserIds).map((userId: string, idx: number) => ({
        userId,
        userName: JSON.parse(step.handlerUserNames || '[]')[idx] || ''
      })) : [],
      approvalMode: step.approvalMode as 'OR' | 'AND' | undefined
    }));

    console.log(`✅ [工作流步骤] 步骤信息读取成功:`, {
      hazardId,
      stepsCount: stepResults.length
    });

    return stepResults;
  } catch (error) {
    console.error(`❌ [工作流步骤] 读取失败:`, error);
    throw error;
  }
}

/**
 * 获取指定步骤的信息
 */
export async function getWorkflowStep(
  hazardId: string,
  stepIndex: number
): Promise<StepHandlerResult | null> {
  try {
    const step = await prisma.hazardWorkflowStep.findUnique({
      where: {
        hazardId_stepIndex: {
          hazardId,
          stepIndex
        }
      }
    });

    if (!step) {
      return null;
    }

    return {
      stepIndex: step.stepIndex,
      stepId: step.stepId,
      stepName: step.stepName,
      success: step.success,
      handlers: {
        userIds: JSON.parse(step.handlerUserIds || '[]'),
        userNames: JSON.parse(step.handlerUserNames || '[]'),
        matchedBy: step.matchedBy === null ? undefined : step.matchedBy
      },
      ccUsers: {
        userIds: step.ccUserIds ? JSON.parse(step.ccUserIds) : [],
        userNames: step.ccUserNames ? JSON.parse(step.ccUserNames) : [],
        details: []
      },
      error: step.error || undefined,
      candidateHandlers: step.handlerUserIds ? JSON.parse(step.handlerUserIds).map((userId: string, idx: number) => ({
        userId,
        userName: JSON.parse(step.handlerUserNames || '[]')[idx] || ''
      })) : [],
      approvalMode: step.approvalMode as 'OR' | 'AND' | undefined
    };
  } catch (error) {
    console.error(`❌ [工作流步骤] 读取单步骤失败:`, error);
    return null;
  }
}

/**
 * 更新指定步骤的处理人信息
 */
export async function updateWorkflowStep(
  hazardId: string,
  stepIndex: number,
  updates: {
    handlers?: {
      userIds: string[];
      userNames: string[];
      matchedBy?: string;
    };
    success?: boolean;
    error?: string;
  }
): Promise<void> {
  console.log(`🔄 [工作流步骤] 更新步骤信息:`, {
    hazardId,
    stepIndex,
    hasHandlers: !!updates.handlers,
    success: updates.success
  });

  try {
    const updateData: any = {};
    
    if (updates.handlers) {
      updateData.handlerUserIds = JSON.stringify(updates.handlers.userIds || []);
      updateData.handlerUserNames = JSON.stringify(updates.handlers.userNames || []);
      if (updates.handlers.matchedBy !== undefined) {
        updateData.matchedBy = updates.handlers.matchedBy;
      }
    }
    
    if (updates.success !== undefined) {
      updateData.success = updates.success;
    }
    
    if (updates.error !== undefined) {
      updateData.error = updates.error;
    }

    await prisma.hazardWorkflowStep.update({
      where: {
        hazardId_stepIndex: {
          hazardId,
          stepIndex
        }
      },
      data: updateData
    });

    console.log(`✅ [工作流步骤] 步骤信息更新成功:`, {
      hazardId,
      stepIndex
    });
  } catch (error) {
    console.error(`❌ [工作流步骤] 更新失败:`, error);
    throw error;
  }
}
