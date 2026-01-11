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

    // 验证新截止日期必须晚于原截止日期
    const oldDeadline = new Date(hazard.deadline);
    const newDeadline = new Date(input.newDeadline);
    if (newDeadline <= oldDeadline) {
      throw new Error('新截止日期必须晚于原截止日期');
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

    // 更新延期申请状态
    const updatedExtension = await prisma.hazardExtension.update({
      where: { id: input.extensionId },
      data: {
        status: input.approved ? 'approved' : 'rejected',
        approverId: input.approverId
      }
    });

    // 如果批准，更新隐患的截止日期
    if (input.approved) {
      await prisma.hazardRecord.update({
        where: { id: extension.hazardId },
        data: {
          deadline: extension.newDeadline
        }
      });
    }

    // 记录系统日志
    const actionLabel = input.approved ? '批准延期' : '拒绝延期';
    const action = input.approved ? 'APPROVE' : 'REJECT';
    
    await SystemLogService.createLog({
      userId: input.approverId,
      userName: input.approverName || '未知用户',
      action,
      actionLabel,
      module: 'HAZARD',
      targetId: extension.hazard.code || extension.hazardId,
      targetType: 'hazard',
      targetLabel: extension.hazard.desc.substring(0, 50),
      details: `${actionLabel}：原截止日期 ${extension.oldDeadline.toLocaleDateString()}，新截止日期 ${extension.newDeadline.toLocaleDateString()}，原因：${extension.reason}`,
      beforeData: {
        deadline: extension.hazard.deadline?.toISOString(),
        extensionStatus: 'pending'
      },
      afterData: {
        deadline: input.approved ? extension.newDeadline.toISOString() : extension.hazard.deadline?.toISOString(),
        extensionStatus: input.approved ? 'approved' : 'rejected'
      },
      userRoleInAction: '审批人'
    });

    console.log(`✅ [隐患延期] ${actionLabel}，延期申请ID: ${input.extensionId}, 隐患ID: ${extension.hazardId}`);

    return {
      extension: updatedExtension,
      hazardUpdated: input.approved
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

