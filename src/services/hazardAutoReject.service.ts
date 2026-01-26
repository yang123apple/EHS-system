/**
 * 隐患自动驳回服务
 * 
 * 用途：
 * - 当隐患当前执行人的用户账户被删除或进入离职状态时，自动驳回该隐患
 * - 通过通知系统通知发起人"隐患当前执行人账号不存在，请重新发起"
 */

import { prisma } from '@/lib/prisma';
import { HazardDispatchEngine, DispatchAction } from './hazardDispatchEngine';
import { HazardNotificationService } from './hazardNotification.service';
import { syncHazardVisibility } from './hazardVisibility.service';
import type { HazardRecord, HazardWorkflowStep } from '@/types/hidden-danger';
import fs from 'fs/promises';
import path from 'path';

const WORKFLOW_FILE = path.join(process.cwd(), 'data', 'hazard-workflow.json');

/**
 * 检查并自动驳回执行人已离职/删除的隐患
 * 
 * @param userId - 用户ID（已删除或已离职的用户）
 * @param reason - 驳回原因（可选，默认使用系统消息）
 * @returns 处理结果
 */
export async function autoRejectHazardsByExecutor(
  userId: string,
  reason?: string
): Promise<{
  success: boolean;
  rejectedCount: number;
  errors: Array<{ hazardId: string; error: string }>;
}> {
  const result = {
    success: true,
    rejectedCount: 0,
    errors: [] as Array<{ hazardId: string; error: string }>
  };

  try {
    // 1. 查询所有以该用户为当前执行人且未闭环的隐患
    const hazards = await prisma.hazardRecord.findMany({
      where: {
        dopersonal_ID: userId,
        isVoided: false,
        status: { not: 'closed' } // 只处理未闭环的隐患
      }
    });

    if (hazards.length === 0) {
      console.log(`[自动驳回] 用户 ${userId} 没有需要处理的隐患`);
      return result;
    }

    console.log(`[自动驳回] 发现 ${hazards.length} 条隐患需要自动驳回（执行人：${userId}）`);

    // 2. 加载工作流配置
    let workflowConfig: { steps: HazardWorkflowStep[] } = {
      steps: [
        { id: 'report', name: '上报并指派' },
        { id: 'assign', name: '开始整改' },
        { id: 'rectify', name: '提交整改' },
        { id: 'verify', name: '验收闭环' }
      ] as HazardWorkflowStep[]
    };
    try {
      const data = await fs.readFile(WORKFLOW_FILE, 'utf-8');
      workflowConfig = JSON.parse(data);
    } catch (fileError) {
      console.error('[自动驳回] 无法读取工作流配置文件:', fileError);
      // 如果无法读取配置文件，使用默认配置
    }

    // 3. 获取所有用户和部门（用于派发引擎）
    const allUsers = await prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        departmentId: true,
        department: { select: { name: true } },
        jobTitle: true
      }
    });

    const departments = await prisma.department.findMany({
      select: {
        id: true,
        name: true,
        parentId: true,
        level: true,
        managerId: true
      }
    });

    // 4. 遍历每条隐患，执行自动驳回
    for (const hazard of hazards) {
      try {
        await rejectHazardForDeletedExecutor(
          hazard as any,
          workflowConfig.steps,
          allUsers,
          departments,
          reason
        );
        result.rejectedCount++;
      } catch (error) {
        result.errors.push({
          hazardId: hazard.id,
          error: error instanceof Error ? error.message : String(error)
        });
        console.error(`[自动驳回] 隐患 ${hazard.code || hazard.id} 驳回失败:`, error);
      }
    }

    console.log(`[自动驳回] 完成：成功驳回 ${result.rejectedCount} 条隐患，失败 ${result.errors.length} 条`);
    return result;
  } catch (error) {
    console.error('[自动驳回] 处理失败:', error);
    result.success = false;
    return result;
  }
}

/**
 * 驳回单条隐患（执行人已删除/离职）
 */
async function rejectHazardForDeletedExecutor(
  hazard: HazardRecord,
  workflowSteps: HazardWorkflowStep[],
  allUsers: Array<{ id: string; username: string; name: string; role: string | null; departmentId: string | null; department: { name: string } | null; jobTitle: string | null }>,
  departments: Array<{ id: string; name: string; parentId: string | null; level: number; managerId: string | null }>,
  reason?: string
): Promise<void> {
  // 使用事务确保数据一致性
  await prisma.$transaction(async (tx) => {
    // 1. 使用派发引擎执行驳回操作
    // 驳回操作会将隐患状态回退到上一步（通常是"上报"步骤）
    const dispatchResult = await HazardDispatchEngine.dispatch({
      hazard: hazard as HazardRecord,
      action: DispatchAction.REJECT,
      operator: {
        id: 'system',
        name: '系统'
      },
      workflowSteps,
      allUsers: allUsers.map(u => ({
        id: u.id,
        name: u.name || u.username,
        role: u.role || undefined,
        departmentId: u.departmentId || undefined,
        department: u.department?.name,
        jobTitle: u.jobTitle || undefined
      })),
      departments: departments.map(d => ({
        id: d.id,
        name: d.name,
        parentId: d.parentId,
        level: d.level,
        managerId: d.managerId || undefined
      })),
      currentStepIndex: hazard.currentStepIndex ?? 0,
      comment: reason || `隐患当前执行人账号不存在，已自动驳回，请重新发起`
    });

    if (!dispatchResult.success) {
      throw new Error(dispatchResult.error || '派发引擎驳回失败');
    }

    // 2. 更新隐患记录
    // 获取当前 logs 字段（Prisma 返回的是 string | null）
    const currentLogs = (hazard as any).logs || null;
    
    await tx.hazardRecord.update({
      where: { id: hazard.id },
      data: {
        status: dispatchResult.newStatus,
        currentStepIndex: dispatchResult.nextStepIndex ?? 0,
        currentStepId: dispatchResult.currentStep || 'report',
        dopersonal_ID: null, // 清空执行人
        dopersonal_Name: null,
        // 追加日志
        logs: appendLog(currentLogs, {
          operatorName: '系统',
          action: 'reject',
          time: new Date().toISOString(),
          changes: `隐患当前执行人账号不存在，已自动驳回，请重新发起。原因：${reason || '执行人已离职或账户已删除'}`
        })
      }
    });

    // 3. 同步可见性表
    await syncHazardVisibility(hazard.id, tx);

    // 4. 通知发起人
    if (hazard.reporterId && hazard.reporterId !== 'DELETED_USER') {
      // 检查发起人是否仍然存在
      const reporter = await tx.user.findUnique({
        where: { id: hazard.reporterId },
        select: { id: true, isActive: true }
      });

      if (reporter && reporter.isActive) {
        // 创建通知
        const notification = HazardNotificationService.generateCustomNotifications({
          userIds: [hazard.reporterId],
          type: 'hazard_rejected',
          title: '隐患已自动驳回',
          content: `隐患"${hazard.code || hazard.id}"（${hazard.location}）的当前执行人账号不存在，已自动驳回，请重新发起。`,
          relatedId: hazard.id
        });

        if (notification.length > 0) {
          await tx.notification.createMany({
            data: notification.map(n => ({
              userId: n.userId,
              type: n.type,
              title: n.title,
              content: n.content,
              relatedType: n.relatedType,
              relatedId: n.relatedId,
              isRead: false
            }))
          });
        }
      }
    }

    console.log(`✅ [自动驳回] 隐患 ${hazard.code || hazard.id} 已自动驳回并通知发起人`);
  });
}

/**
 * 追加日志到隐患的 logs 字段
 */
function appendLog(
  existingLogs: string | null,
  newLog: {
    operatorName: string;
    action: string;
    time: string;
    changes: string;
  }
): string {
  try {
    const logs = existingLogs ? JSON.parse(existingLogs) : [];
    logs.push(newLog);
    return JSON.stringify(logs);
  } catch (error) {
    // 如果解析失败，创建新日志数组
    return JSON.stringify([newLog]);
  }
}
