import { PermitRecord, WorkflowStep } from '@/types/work-permit';
import {
  WorkflowStatus,
  WorkflowAction,
  ApprovalLogEntry
} from '@/types/workflow';
import { resolveApprovers } from '@/lib/workflowUtils';
import { db } from '@/lib/db';

export class WorkflowEngine {
  /**
   * 执行状态流转
   * 🟢 解决痛点3: 将“创建”和“审批”解耦，统一入口
   */
  static async transition(
    record: PermitRecord,
    action: WorkflowAction,
    operator: { id: string; name: string },
    comment: string,
    workflowConfig: WorkflowStep[]
  ) {
    // 1. 验证状态机 (简单的 Guard Clause)
    if (record.status === WorkflowStatus.APPROVED || record.status === WorkflowStatus.REJECTED) {
      throw new Error('流程已结束，无法操作');
    }

    const currentStep = workflowConfig.find(s => s.stepIndex === record.currentStep);
    if (!currentStep) {
      throw new Error('当前步骤配置不存在');
    }

    // 2. 生成日志条目 (Immutable Log)
    const newLog: ApprovalLogEntry = {
      id: Date.now().toString(),
      stepIndex: record.currentStep,
      stepName: currentStep.name || '未知节点',
      action,
      operatorId: operator.id,
      operatorName: operator.name,
      timestamp: new Date().toISOString(),
      comment,
      snapshotVersion: 1
    };

    // 3. 初始化新状态
    let newStatus = record.status;
    let newStepIndex = record.currentStep;
    let nextApprovers: any[] = [];

    // 解析当前表单数据（用于 resolveApprovers）
    const formData = JSON.parse(record.dataJson || '{}');
    const parsedFields = record.template?.parsedFields
      ? (() => { try { return JSON.parse(record.template.parsedFields as any); } catch { return []; } })()
      : [];

    if (action === WorkflowAction.SUBMIT) {
      // 首次提交
      newStatus = WorkflowStatus.PENDING;
      newStepIndex = 0;
    } else if (action === WorkflowAction.APPROVE) {
      // 🟢 处理会签 (AND) / 或签 (OR) 逻辑
      const approvalMode = currentStep.approvalMode || 'OR'; // 默认 OR

      if (approvalMode === 'AND') {
        // 获取该步骤所有应审批人
        const requiredApprovers = await resolveApprovers(
          record.project?.requestDept || '',
          currentStep,
          formData,
          parsedFields
        );

        // 获取当前步骤已有的 approve 日志（不包括当前操作）
        const existingLogs: ApprovalLogEntry[] = record.approvalLogs
          ? JSON.parse(record.approvalLogs).filter(
              (log: ApprovalLogEntry) =>
                log.stepIndex === record.currentStep && log.action === WorkflowAction.APPROVE
            )
          : [];

        // 构建已批准用户 ID 集合（包含当前操作者）
        const approvedUserIds = new Set<string>();
        existingLogs.forEach(log => approvedUserIds.add(log.operatorId));
        approvedUserIds.add(operator.id);

        // 检查是否所有人都已批准
        const allApproved = requiredApprovers.every(user => approvedUserIds.has(user.id));

        if (!allApproved) {
          // 会签未完成：停留在当前步骤，状态仍为 PENDING
          newStatus = WorkflowStatus.PENDING;
          newStepIndex = record.currentStep; // 不前进
        } else {
          // 会签完成：进入下一步
          const isLastStep = record.currentStep >= workflowConfig.length - 1;
          if (isLastStep) {
            newStatus = WorkflowStatus.APPROVED;
            newStepIndex = -1;
          } else {
            newStatus = WorkflowStatus.PENDING;
            newStepIndex = record.currentStep + 1;
          }
        }
      } else {
        // OR 模式（默认）：一人批准即通过
        const isLastStep = record.currentStep >= workflowConfig.length - 1;
        if (isLastStep) {
          newStatus = WorkflowStatus.APPROVED;
          newStepIndex = -1;
        } else {
          newStatus = WorkflowStatus.PENDING;
          newStepIndex = record.currentStep + 1;
        }
      }
    } else if (action === WorkflowAction.REJECT) {
      // 驳回：流程结束
      newStatus = WorkflowStatus.REJECTED;
      newStepIndex = -1;
    }

    // 4. 计算下一节点的审批人（如果是流转中）
    if (newStatus === WorkflowStatus.PENDING && newStepIndex !== -1) {
      const nextConfig = workflowConfig.find(s => s.stepIndex === newStepIndex);
      if (nextConfig) {
        const users = await resolveApprovers(
          record.project?.requestDept || '',
          nextConfig,
          formData,
          parsedFields
        );
        nextApprovers = users.map(u => ({ id: u.id, name: u.name }));
      }
    }

    // 5. 返回更新后的数据结构 (Service 层负责写入 DB)
    return {
      status: newStatus,
      currentStep: newStepIndex,
      // 🟢 解决痛点4: 追加日志而不是覆盖
      approvalLogs: JSON.stringify([
        ...(record.approvalLogs ? JSON.parse(record.approvalLogs) : []),
        newLog
      ]),
      nextApproversJson: JSON.stringify(nextApprovers)
    };
  }
}