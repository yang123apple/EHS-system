/**
 * 隐患延期服务
 * 负责隐患整改延期的申请和审批
 */

import { prisma } from '@/lib/prisma';
import { SystemLogService } from '@/services/systemLog.service';
import { setEndOfDay, extractDatePart } from '@/utils/dateUtils';

export interface RequestExtensionInput {
  hazardId: string;
  newDeadline: string; // ISO 日期字符串
  reason: string;
  applicantId: string;
  applicantName?: string;
}

export interface ApproveExtensionInput {
  extensionId: string;
  approverId: string;
  approverName?: string;
  approved: boolean; // true: 批准, false: 拒绝
}

/**
 * 申请延期
 * 创建一条 HazardExtension 记录，状态为 pending
 */
export async function requestExtension(input: RequestExtensionInput) {
  try {
    // 获取隐患记录，获取当前 deadline
    const hazard = await prisma.hazardRecord.findUnique({
      where: { id: input.hazardId }
    });

    if (!hazard) {
      throw new Error('隐患不存在');
    }

    if (!hazard.deadline) {
      throw new Error('隐患没有截止日期，无法申请延期');
    }

    // 检查是否已有待审批的延期申请
    const pendingExtension = await prisma.hazardExtension.findFirst({
      where: {
        hazardId: input.hazardId,
        status: 'pending'
      }
    });

    if (pendingExtension) {
      throw new Error('已有待审批的延期申请，请等待审批结果');
    }

    // 🔒 验证新截止日期的合理性
    const oldDeadline = new Date(hazard.deadline);
    const newDeadline = new Date(input.newDeadline);
    const now = new Date();
    
    // 1. 新截止日期必须晚于原截止日期
    if (newDeadline <= oldDeadline) {
      throw new Error('新截止日期必须晚于原截止日期');
    }
    
    // 2. 新截止日期必须晚于当前时间
    if (newDeadline <= now) {
      throw new Error('新截止日期必须晚于当前时间');
    }
    
    // 3. 单次延期不超过90天（可配置上限）
    const MAX_EXTENSION_DAYS = 90;
    const daysDiff = Math.ceil((newDeadline.getTime() - oldDeadline.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff > MAX_EXTENSION_DAYS) {
      throw new Error(`单次延期不能超过 ${MAX_EXTENSION_DAYS} 天，当前申请延期 ${daysDiff} 天`);
    }

    // 创建延期申请记录
    const extension = await prisma.hazardExtension.create({
      data: {
        hazardId: input.hazardId,
        oldDeadline: oldDeadline,
        newDeadline: setEndOfDay(extractDatePart(input.newDeadline)),
        reason: input.reason,
        applicantId: input.applicantId,
        status: 'pending'
      },
      include: {
        hazard: {
          select: {
            code: true,
            desc: true
          }
        }
      }
    });

    // 记录系统日志
    await SystemLogService.createLog({
      userId: input.applicantId,
      userName: input.applicantName || '未知用户',
      action: 'CREATE',
      actionLabel: '申请延期',
      module: 'HAZARD',
      targetId: hazard.code || input.hazardId,
      targetType: 'hazard',
      targetLabel: hazard.desc.substring(0, 50),
      details: `申请延期：从 ${oldDeadline.toLocaleDateString()} 延期至 ${newDeadline.toLocaleDateString()}，原因：${input.reason}`,
      afterData: {
        extensionId: extension.id,
        newDeadline: extension.newDeadline.toISOString(),
        reason: input.reason
      },
      userRoleInAction: '申请人'
    });

    console.log(`✅ [隐患延期] 已创建延期申请，隐患ID: ${input.hazardId}, 申请ID: ${extension.id}`);

    return extension;
  } catch (error) {
    console.error('[隐患延期] 申请延期失败:', error);
    throw error;
  }
}

/**
 * 审批延期申请
 * 如果通过：更新 Extension 状态为 approved，并更新 HazardRecord 的 deadline
 * 如果拒绝：更新 Extension 状态为 rejected
 */
export async function approveExtension(input: ApproveExtensionInput) {
  try {
    // 获取延期申请记录
    const extension = await prisma.hazardExtension.findUnique({
      where: { id: input.extensionId },
      include: {
        hazard: {
          select: {
            id: true,
            code: true,
            desc: true,
            deadline: true
          }
        }
      }
    });

    if (!extension) {
      throw new Error('延期申请不存在');
    }

    if (extension.status !== 'pending') {
      throw new Error(`延期申请状态为 ${extension.status}，无法审批`);
    }

    // 🔒 如果批准，校验新日期的合理性
    if (input.approved) {
      const now = new Date();
      const newDeadline = new Date(extension.newDeadline);
      
      // 1. 新截止日期必须晚于当前时间
      if (newDeadline <= now) {
        throw new Error('新截止日期必须晚于当前时间，无法批准延期');
      }
      
      // 2. 检查原截止日期是否仍然有效（防止审批时原截止日期已过期）
      const oldDeadline = new Date(extension.oldDeadline);
      if (oldDeadline < now) {
        console.warn(`⚠️ [延期审批] 原截止日期已过期，但仍允许批准延期`);
      }
    }

    // 🔒 使用事务确保更新延期记录和主隐患deadline的原子性
    const result = await prisma.$transaction(async (tx) => {
      const approvalTime = new Date();
      
      // 1. 更新延期申请状态（记录审批人和审批时间）
      const updatedExtension = await tx.hazardExtension.update({
        where: { id: input.extensionId },
        data: {
          status: input.approved ? 'approved' : 'rejected',
          approverId: input.approverId,
          // 注意：schema中没有approvalTime字段，如果需要可以添加
          // 目前使用updatedAt字段记录审批时间
        }
      });

      // 2. 如果批准，在同一事务中更新隐患的截止日期
      if (input.approved) {
        await tx.hazardRecord.update({
          where: { id: extension.hazardId },
          data: {
            deadline: extension.newDeadline
          }
        });
      }

      return { updatedExtension, approvalTime };
    });

    const { updatedExtension, approvalTime } = result;

    // 记录系统日志
    const actionLabel = input.approved ? '批准延期' : '拒绝延期';
    const action = input.approved ? 'APPROVE' : 'REJECT';
    
    // 获取更新后的隐患记录（用于日志记录）
    const updatedHazard = input.approved 
      ? await prisma.hazardRecord.findUnique({
          where: { id: extension.hazardId },
          select: { deadline: true }
        })
      : extension.hazard;
    
    await SystemLogService.createLog({
      userId: input.approverId,
      userName: input.approverName || '未知用户',
      action,
      actionLabel,
      module: 'HAZARD',
      targetId: extension.hazard.code || extension.hazardId,
      targetType: 'hazard',
      targetLabel: extension.hazard.desc.substring(0, 50),
      details: `${actionLabel}：原截止日期 ${extension.oldDeadline.toLocaleDateString()}，新截止日期 ${extension.newDeadline.toLocaleDateString()}，原因：${extension.reason}，审批时间：${approvalTime.toLocaleString()}`,
      beforeData: {
        deadline: extension.hazard.deadline?.toISOString(),
        extensionStatus: 'pending'
      },
      afterData: {
        deadline: input.approved ? extension.newDeadline.toISOString() : extension.hazard.deadline?.toISOString(),
        extensionStatus: input.approved ? 'approved' : 'rejected',
        approvalTime: approvalTime.toISOString()
      },
      userRoleInAction: '审批人'
    });

    console.log(`✅ [隐患延期] ${actionLabel}，延期申请ID: ${input.extensionId}, 隐患ID: ${extension.hazardId}, 审批时间: ${approvalTime.toLocaleString()}`);

    return {
      extension: updatedExtension,
      hazardUpdated: input.approved,
      approvalTime: approvalTime.toISOString()
    };
  } catch (error) {
    console.error('[隐患延期] 审批延期失败:', error);
    throw error;
  }
}

/**
 * 获取隐患的所有延期记录
 */
export async function getHazardExtensions(hazardId: string) {
  try {
    const extensions = await prisma.hazardExtension.findMany({
      where: { hazardId },
      orderBy: { createdAt: 'desc' },
      include: {
        hazard: {
          select: {
            code: true
          }
        }
      }
    });

    return extensions;
  } catch (error) {
    console.error('[隐患延期] 获取延期记录失败:', error);
    throw error;
  }
}

