/**
 * 事故派发引擎
 * 统一管理事故的派发逻辑，包括：
 * 1. 处理人匹配
 * 2. 抄送人匹配
 * 3. 状态流转
 * 4. 派发历史记录
 */

import { 
  IncidentWorkflowStep,
  INCIDENT_WORKFLOW_CONFIG
} from './workflow-config';
import { matchIncidentHandler } from './incident-handler-matcher';
import type { Incident } from '@/types/incident';
import type { User } from '@prisma/client';
import { HazardNotificationService, type NotificationData } from '@/services/hazardNotification.service';
import { prisma } from '@/lib/prisma';

/**
 * 派发动作类型
 */
export enum IncidentDispatchAction {
  REPORT = 'report',               // 上报事故
  SUBMIT_INVESTIGATION = 'submit_investigation', // 提交调查
  APPROVE = 'approve',             // 审批通过
  REJECT = 'reject',               // 驳回
  CLOSE = 'close',                 // 结案
}

/**
 * 派发结果
 */
export interface IncidentDispatchResult {
  success: boolean;
  newStatus: string;
  currentStep: string;
  nextStepIndex?: number;
  handlers: {
    userIds: string[];
    userNames: string[];
    matchedBy?: string;
  };
  ccUsers: {
    userIds: string[];
    userNames: string[];
    details: any[];
  };
  log: {
    operatorName: string;
    action: string;
    time: string;
    changes: string;
    ccUserNames?: string[];
  };
  notifications: NotificationData[];
  error?: string;
}

/**
 * 派发上下文
 */
export interface IncidentDispatchContext {
  incident: Incident;
  action: IncidentDispatchAction;
  operator: {
    id: string;
    name: string;
    role?: string;
  };
  workflowSteps: IncidentWorkflowStep[];
  allUsers: Array<{ id: string; name: string; role?: string; departmentId?: string | null }>;
  departments: Array<{ id: string; name: string; parentId?: string | null }>;
  currentStepIndex?: number;
  comment?: string;
  additionalData?: any;
}

/**
 * 事故派发引擎
 */
export class IncidentDispatchEngine {
  /**
   * 执行派发
   */
  static async dispatch(context: IncidentDispatchContext): Promise<IncidentDispatchResult> {
    const { incident, action, operator, workflowSteps, allUsers, departments, currentStepIndex, comment, additionalData } = context;

    try {
      // 使用步骤索引的当前值，如果未提供则从事故状态推断
      const stepIndex = currentStepIndex ?? this.getStepIndexByStatus(incident.status) ?? 0;
      
      console.log('🎯 [事故派发引擎] 开始派发:', {
        action,
        currentStepIndex: stepIndex,
        totalSteps: workflowSteps.length,
        incidentId: incident.id
      });

      // 1. 根据动作和当前步骤索引确定下一步骤
      const transition = this.getTransition(stepIndex, action, workflowSteps, incident.status);
      if (!transition.success) {
        throw new Error(transition.error || '无效的状态流转');
      }

      console.log('✅ [事故派发引擎] 流转结果:', {
        nextStepIndex: transition.nextStepIndex,
        nextStepId: transition.nextStepId,
        newStatus: transition.newStatus
      });

      // 2. 获取下一步骤配置（用于匹配处理人和抄送人）
      const nextStep = workflowSteps[transition.nextStepIndex];
      if (!nextStep) {
        throw new Error(`未找到步骤配置: 索引=${transition.nextStepIndex}`);
      }

      // 3. 创建更新后的事故数据（用于处理人和抄送人匹配）
      const updatedIncident = this.getUpdatedIncident(incident, action, additionalData);

      // 4. 匹配处理人（针对下一步骤）
      const handlerResult = await matchIncidentHandler({
        incident: updatedIncident,
        step: nextStep,
        allUsers,
        departments
      });

      if (!handlerResult.success || handlerResult.userNames.length === 0) {
        console.warn('[事故派发引擎] 处理人匹配失败:', handlerResult.error);
        // 不抛出错误，允许继续（某些步骤可能不需要处理人）
      }
      
      console.log('🎯 [事故派发引擎] 匹配到的处理人:', {
        count: handlerResult.userIds?.length || 0,
        userIds: handlerResult.userIds,
        userNames: handlerResult.userNames,
      });

      // 5. 匹配抄送人（简化处理，实际可以扩展）
      const ccResult = {
        userIds: [] as string[],
        userNames: [] as string[],
        details: [] as any[]
      };

      // 6. 生成操作日志
      const log = this.createLog(
        operator,
        action,
        transition.newStatus,
        comment,
        handlerResult.userNames,
        ccResult.userNames,
        nextStep.name
      );

      // 7. 生成通知数据
      const notifications = this.generateNotifications({
        incident: updatedIncident,
        action: log.action,
        operator,
        handlers: {
          userIds: handlerResult.success ? handlerResult.userIds : [],
          userNames: handlerResult.userNames
        },
        ccUsers: ccResult,
        newStatus: transition.newStatus
      });

      // 8. 返回派发结果
      return {
        success: true,
        newStatus: transition.newStatus,
        currentStep: transition.nextStepId,
        nextStepIndex: transition.nextStepIndex,
        handlers: {
          userIds: handlerResult.success ? handlerResult.userIds : [],
          userNames: handlerResult.userNames,
          matchedBy: handlerResult.matchedBy
        },
        ccUsers: ccResult,
        log,
        notifications
      };
    } catch (error) {
      console.error('[事故派发引擎] 派发失败:', error);
      const stepIndex = currentStepIndex ?? this.getStepIndexByStatus(incident.status) ?? 0;
      return {
        success: false,
        newStatus: incident.status,
        currentStep: this.getStepIdByStatus(incident.status),
        nextStepIndex: stepIndex,
        handlers: { userIds: [], userNames: [] },
        ccUsers: { userIds: [], userNames: [], details: [] },
        log: this.createLog(operator, action, incident.status, comment),
        notifications: [],
        error: error instanceof Error ? error.message : '未知错误'
      };
    }
  }

  /**
   * 基于步骤索引的动态流转逻辑
   */
  private static getTransition(
    currentStepIndex: number,
    action: IncidentDispatchAction,
    workflowSteps: IncidentWorkflowStep[],
    currentStatus: string
  ): {
    success: boolean;
    newStatus: string;
    nextStepId: string;
    nextStepIndex: number;
    error?: string;
  } {
    // 驳回操作：特殊处理
    if (action === IncidentDispatchAction.REJECT) {
      // 根据当前步骤决定驳回到哪一步
      const currentStep = workflowSteps[currentStepIndex];
      
      if (currentStep?.id === 'reviewed') {
        // 从审批驳回 -> 回到调查步骤
        const investigateIndex = workflowSteps.findIndex(s => s.id === 'investigating');
        if (investigateIndex >= 0) {
          return {
            success: true,
            newStatus: 'investigating',
            nextStepId: workflowSteps[investigateIndex].id,
            nextStepIndex: investigateIndex
          };
        }
      } else {
        // 其他步骤驳回 -> 回到上一步
        const prevIndex = Math.max(0, currentStepIndex - 1);
        return {
          success: true,
          newStatus: this.getStatusByStepId(workflowSteps[prevIndex]?.id),
          nextStepId: workflowSteps[prevIndex]?.id || 'reported',
          nextStepIndex: prevIndex
        };
      }
    }

    // 正常流转：根据动作确定下一步
    let nextStepIndex = currentStepIndex;

    switch (action) {
      case IncidentDispatchAction.REPORT:
        // 上报 -> 进入调查
        nextStepIndex = workflowSteps.findIndex(s => s.id === 'investigating') ?? currentStepIndex + 1;
        break;
      case IncidentDispatchAction.SUBMIT_INVESTIGATION:
        // 提交调查 -> 进入审批
        nextStepIndex = workflowSteps.findIndex(s => s.id === 'reviewed') ?? currentStepIndex + 1;
        break;
      case IncidentDispatchAction.APPROVE:
        // 审批通过 -> 进入结案
        nextStepIndex = workflowSteps.findIndex(s => s.id === 'closed') ?? currentStepIndex + 1;
        break;
      case IncidentDispatchAction.CLOSE:
        // 结案 -> 流程结束
        nextStepIndex = workflowSteps.findIndex(s => s.id === 'closed') ?? workflowSteps.length - 1;
        break;
    }
    
    if (nextStepIndex >= workflowSteps.length || nextStepIndex < 0) {
      // 流程结束
      return {
        success: true,
        newStatus: 'closed',
        nextStepId: 'closed',
        nextStepIndex: workflowSteps.length - 1
      };
    }

    const nextStep = workflowSteps[nextStepIndex];
    const newStatus = this.getStatusByStepId(nextStep.id);

    console.log('🔄 [事故派发引擎] 动态流转:', {
      from: currentStepIndex,
      to: nextStepIndex,
      nextStepId: nextStep.id,
      nextStepName: nextStep.name,
      newStatus
    });

    return {
      success: true,
      newStatus,
      nextStepId: nextStep.id,
      nextStepIndex
    };
  }

  /**
   * 根据步骤ID推断对应的事故状态
   */
  private static getStatusByStepId(stepId: string): string {
    const statusMap: Record<string, string> = {
      'reported': 'reported',
      'investigating': 'investigating',
      'reviewed': 'reviewed',
      'closed': 'closed',
    };
    return statusMap[stepId] || 'reported';
  }

  /**
   * 根据状态获取步骤索引
   */
  private static getStepIndexByStatus(status: string): number | null {
    const step = INCIDENT_WORKFLOW_CONFIG.find(s => s.id === status);
    return step ? step.index : null;
  }

  /**
   * 根据状态获取步骤ID
   */
  private static getStepIdByStatus(status: string): string {
    const statusStepMap: Record<string, string> = {
      'reported': 'reported',
      'investigating': 'investigating',
      'reviewed': 'reviewed',
      'closed': 'closed',
      'rejected': 'reported',
    };
    return statusStepMap[status] || 'reported';
  }

  /**
   * 获取更新后的事故数据（用于处理人和抄送人匹配）
   */
  private static getUpdatedIncident(
    incident: Incident,
    action: IncidentDispatchAction,
    additionalData?: any
  ): Incident {
    const updated = { ...incident };

    // 根据动作更新相关字段
    switch (action) {
      case IncidentDispatchAction.SUBMIT_INVESTIGATION:
        // 提交调查时，更新调查信息
        if (additionalData?.rootCause) {
          updated.rootCause = additionalData.rootCause;
        }
        break;
    }

    return updated;
  }

  /**
   * 创建操作日志
   */
  private static createLog(
    operator: { id: string; name: string },
    action: IncidentDispatchAction,
    newStatus: string,
    comment?: string,
    handlerNames?: string[],
    ccUserNames?: string[],
    stepName?: string
  ): {
    operatorName: string;
    action: string;
    time: string;
    changes: string;
    ccUserNames?: string[];
  } {
    const actionNames: Record<IncidentDispatchAction, string> = {
      [IncidentDispatchAction.REPORT]: '上报事故',
      [IncidentDispatchAction.SUBMIT_INVESTIGATION]: '提交调查',
      [IncidentDispatchAction.APPROVE]: '审批通过',
      [IncidentDispatchAction.REJECT]: '驳回',
      [IncidentDispatchAction.CLOSE]: '结案',
    };

    const statusNames: Record<string, string> = {
      'reported': '已上报',
      'investigating': '调查中',
      'reviewed': '待审批',
      'closed': '已结案',
      'rejected': '已驳回',
    };

    const displayActionName = stepName || actionNames[action];
    let changes = `${displayActionName} → 状态变更为"${statusNames[newStatus] || newStatus}"`;
    
    if (handlerNames && handlerNames.length > 0) {
      changes += `\n处理人: ${handlerNames.join('、')}`;
    }
    
    if (comment) {
      changes += `\n备注: ${comment}`;
    }

    return {
      operatorName: operator.name,
      action: displayActionName,
      time: new Date().toISOString(),
      changes,
      ccUserNames: ccUserNames && ccUserNames.length > 0 ? ccUserNames : undefined,
    };
  }

  /**
   * 生成通知数据
   */
  private static generateNotifications(params: {
    incident: Incident;
    action: string;
    operator: { id: string; name: string };
    handlers: { userIds: string[]; userNames: string[] };
    ccUsers: { userIds: string[]; userNames: string[] };
    newStatus: string;
  }): NotificationData[] {
    const { incident, action, operator, handlers, ccUsers, newStatus } = params;
    const allNotifications: NotificationData[] = [];

    // 1. 生成处理人通知数据
    if (handlers.userIds.length > 0) {
      handlers.userIds.forEach((userId, index) => {
        allNotifications.push({
          userId,
          type: 'incident_action',
          title: '事故处理通知',
          content: `${operator.name} ${action}，请及时处理事故"${incident.description?.substring(0, 50) || incident.id}"`,
          relatedType: 'incident',
          relatedId: incident.id,
          isRead: false,
        });
      });
    }

    // 2. 如果事故结案，通知上报人
    if (newStatus === 'closed' && incident.reporterId) {
      allNotifications.push({
        userId: incident.reporterId,
        type: 'incident_closed',
        title: '事故已结案',
        content: `事故"${incident.description?.substring(0, 50) || incident.id}"已结案`,
        relatedType: 'incident',
        relatedId: incident.id,
        isRead: false,
      });
    }

    console.log(`📋 [通知系统] 生成通知数据: 处理人${handlers.userNames.length}人, 抄送${ccUsers.userNames.length}人, 共${allNotifications.length}条`);
    return allNotifications;
  }
}

