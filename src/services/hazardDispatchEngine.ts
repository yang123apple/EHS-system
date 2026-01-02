/**
 * 隐患派发引擎
 * 统一管理隐患的派发逻辑，包括：
 * 1. 处理人匹配
 * 2. 抄送人匹配
 * 3. 状态流转
 * 4. 派发历史记录
 */

import { 
  HazardRecord, 
  HazardWorkflowStep,
  HazardLog,
  SimpleUser,
  HazardStatus 
} from '@/types/hidden-danger';
import { matchHandler } from '@/app/hidden-danger/_utils/handler-matcher';
import { matchAllCCRules } from '@/app/hidden-danger/_utils/cc-matcher';
import type { Department } from '@/utils/departmentUtils';
import { HazardNotificationService, NotificationData } from './hazardNotification.service';

/**
 * 派发动作类型
 */
export enum DispatchAction {
  SUBMIT = 'submit',           // 提交上报
  ASSIGN = 'assign',           // 指派整改
  RECTIFY = 'rectify',         // 提交整改
  VERIFY = 'verify',           // 验收闭环
  REJECT = 'reject',           // 驳回
  EXTEND_DEADLINE = 'extend'   // 延期
}

/**
 * 派发结果
 */
export interface DispatchResult {
  success: boolean;
  newStatus: HazardStatus;
  currentStep: string;
  nextStepIndex?: number; // 新增：下一步骤索引
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
  log: HazardLog;
  notifications: NotificationData[]; // 需要创建的通知数据
  error?: string;
}

/**
 * 派发上下文
 */
export interface DispatchContext {
  hazard: HazardRecord;
  action: DispatchAction;
  operator: {
    id: string;
    name: string;
  };
  workflowSteps: HazardWorkflowStep[];
  allUsers: SimpleUser[];
  departments: Department[];
  currentStepIndex?: number; // 当前步骤索引，用于动态步骤流转
  comment?: string;
  additionalData?: any; // 用于传递额外数据，如指派的责任人等
}

/**
 * 隐患派发引擎
 */
export class HazardDispatchEngine {
  /**
   * 执行派发
   */
  static async dispatch(context: DispatchContext): Promise<DispatchResult> {
    const { hazard, action, operator, workflowSteps, allUsers, departments, currentStepIndex, comment, additionalData } = context;

    try {
      // 🔄 使用步骤索引的当前值，如果未提供则默认为0
      const stepIndex = currentStepIndex ?? hazard.currentStepIndex ?? 0;
      
      console.log('🎯 [派发引擎] 开始派发:', {
        action,
        currentStepIndex: stepIndex,
        totalSteps: workflowSteps.length,
        hazardId: hazard.id
      });

      // 1. 根据动作和当前步骤索引确定下一步骤
      const transition = this.getTransition(stepIndex, action, workflowSteps, hazard.status);
      if (!transition.success) {
        throw new Error(transition.error || '无效的状态流转');
      }

      console.log('✅ [派发引擎] 流转结果:', {
        nextStepIndex: transition.nextStepIndex,
        nextStepId: transition.nextStepId,
        newStatus: transition.newStatus
      });

      // 2. 获取下一步骤配置（用于匹配处理人和抄送人）
      const nextStep = workflowSteps[transition.nextStepIndex];
      if (!nextStep) {
        throw new Error(`未找到步骤配置: 索引=${transition.nextStepIndex}`);
      }

      // 3. 创建更新后的隐患数据（用于处理人和抄送人匹配）
      const updatedHazard = this.getUpdatedHazard(hazard, action, additionalData);

      // 4. 匹配处理人（针对下一步骤）
      const handlerResult = await matchHandler({
        hazard: updatedHazard,
        step: nextStep,
        allUsers,
        departments
      });

      if (!handlerResult.success || handlerResult.userNames.length === 0) {
        console.warn('[派发引擎] 处理人匹配失败:', handlerResult.error);
        // 不抛出错误，允许继续（某些步骤可能不需要处理人）
      }
      
      console.log('🎯 [派发引擎] 匹配到的处理人:', {
        count: handlerResult.userIds?.length || 0,
        userIds: handlerResult.userIds,
        userNames: handlerResult.userNames,
        approvalMode: nextStep.handlerStrategy.approvalMode || 'OR'
      });

      // 5. 匹配抄送人
      const reporter = allUsers.find(u => u.id === updatedHazard.reporterId);
      // 修复：直接使用返回的 userIds，而不是通过用户名查找
      const handler = handlerResult.success && handlerResult.userIds.length > 0
        ? allUsers.find(u => u.id === handlerResult.userIds[0])
        : undefined;

      const ccResult = await matchAllCCRules(
        updatedHazard,
        nextStep.ccRules || [],
        allUsers,
        departments,
        reporter,
        handler
      );

      // 6. 生成操作日志
      const log = this.createLog(
        operator,
        action,
        transition.newStatus,
        comment,
        handlerResult.userNames,
        ccResult.userNames
      );

      // 7. 生成通知数据（不直接创建通知）
      const notifications = this.generateNotifications({
        hazard: updatedHazard,
        action: log.action,
        operator,
        handlers: {
          userIds: handlerResult.success ? handlerResult.userIds : [],
          userNames: handlerResult.userNames
        },
        ccUsers: ccResult,
        newStatus: transition.newStatus
      });

      // 8. 返回派发结果（包含通知数据）
      return {
        success: true,
        newStatus: transition.newStatus,
        currentStep: transition.nextStepId, // 步骤ID（用于兼容）
        nextStepIndex: transition.nextStepIndex, // 步骤索引（新增）
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
      console.error('[派发引擎] 派发失败:', error);
      const stepIndex = currentStepIndex ?? hazard.currentStepIndex ?? 0;
      return {
        success: false,
        newStatus: hazard.status,
        currentStep: this.getStepIdByStatus(hazard.status),
        nextStepIndex: stepIndex,
        handlers: { userIds: [], userNames: [] },
        ccUsers: { userIds: [], userNames: [], details: [] },
        log: this.createLog(operator, action, hazard.status, comment),
        notifications: [],
        error: error instanceof Error ? error.message : '未知错误'
      };
    }
  }

  /**
   * 🔄 基于步骤索引的动态流转逻辑（支持任意数量的自定义步骤）
   * @param currentStepIndex 当前步骤索引
   * @param action 派发动作
   * @param workflowSteps 完整的工作流步骤配置
   * @param currentStatus 当前隐患状态（用于兼容性检查）
   */
  private static getTransition(
    currentStepIndex: number,
    action: DispatchAction,
    workflowSteps: HazardWorkflowStep[],
    currentStatus: HazardStatus
  ): {
    success: boolean;
    newStatus: HazardStatus;
    nextStepId: string;
    nextStepIndex: number;
    error?: string;
  } {
    // 驳回操作：特殊处理
    if (action === DispatchAction.REJECT) {
      // 根据当前步骤决定驳回到哪一步
      const currentStep = workflowSteps[currentStepIndex];
      
      if (currentStep?.id === 'verify') {
        // 从验收驳回 -> 回到整改步骤
        const rectifyIndex = workflowSteps.findIndex(s => s.id === 'rectify');
        if (rectifyIndex >= 0) {
          return {
            success: true,
            newStatus: 'rectifying',
            nextStepId: workflowSteps[rectifyIndex].id,
            nextStepIndex: rectifyIndex
          };
        }
      } else if (currentStep?.id === 'rectify') {
        // 从整改驳回 -> 回到指派步骤
        const assignIndex = workflowSteps.findIndex(s => s.id === 'assign');
        if (assignIndex >= 0) {
          return {
            success: true,
            newStatus: 'assigned',
            nextStepId: workflowSteps[assignIndex].id,
            nextStepIndex: assignIndex
          };
        }
      } else {
        // 其他中间步骤驳回 -> 回到上一步
        const prevIndex = Math.max(0, currentStepIndex - 1);
        return {
          success: true,
          newStatus: this.getStatusByStepId(workflowSteps[prevIndex]?.id),
          nextStepId: workflowSteps[prevIndex]?.id || 'report',
          nextStepIndex: prevIndex
        };
      }
    }

    // 正常流转：前进到下一步
    const nextStepIndex = currentStepIndex + 1;
    
    if (nextStepIndex >= workflowSteps.length) {
      // 已经是最后一步，流程结束
      return {
        success: true,
        newStatus: 'closed',
        nextStepId: 'verify', // 最后停留在验收步骤
        nextStepIndex: workflowSteps.length - 1
      };
    }

    const nextStep = workflowSteps[nextStepIndex];
    const newStatus = this.getStatusByStepId(nextStep.id);

    console.log('🔄 [派发引擎] 动态流转:', {
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
   * 根据步骤ID推断对应的隐患状态
   */
  private static getStatusByStepId(stepId: string): HazardStatus {
    if (stepId === 'report') return 'reported';
    if (stepId === 'assign') return 'assigned';
    if (stepId === 'rectify') return 'rectifying';
    if (stepId === 'verify') return 'verified';
    
    // 自定义步骤：根据位置推断状态
    // report -> assigned -> [自定义步骤] -> rectifying -> verified
    // 自定义步骤默认使用 'assigned' 状态
    return 'assigned';
  }

  /**
   * 根据状态获取步骤ID（与 hazard-workflow.json 中的步骤ID保持一致）
   */
  private static getStepIdByStatus(status: HazardStatus): string {
    const statusStepMap: Record<HazardStatus, string> = {
      'reported': 'report',      // 上报步骤
      'assigned': 'assign',      // 指派步骤
      'rectifying': 'rectify',   // 整改步骤
      'verified': 'verify',      // 验收步骤
      'closed': 'verify'         // 已闭环，停留在验收步骤
    };
    return statusStepMap[status] || 'report';
  }

  /**
   * 获取更新后的隐患数据（用于处理人和抄送人匹配）
   */
  private static getUpdatedHazard(
    hazard: HazardRecord,
    action: DispatchAction,
    additionalData?: any
  ): HazardRecord {
    const updated = { ...hazard };

    // 根据动作更新相关字段
    switch (action) {
      case DispatchAction.ASSIGN:
        // 指派整改时，不使用 additionalData 中的责任人信息
        // 责任人将由派发引擎的处理人匹配逻辑自动确定
        // 这里不做任何更新，保持原有的隐患数据用于匹配
        break;

      case DispatchAction.RECTIFY:
        // 提交整改时，更新整改信息
        if (additionalData?.rectifyDesc) {
          updated.rectifyDesc = additionalData.rectifyDesc;
          updated.rectifyPhotos = additionalData.rectifyPhotos || [];
          updated.rectifyTime = new Date().toISOString();
        }
        break;

      case DispatchAction.VERIFY:
        // 验收时，更新验收信息
        if (additionalData?.verifierId) {
          updated.verifierId = additionalData.verifierId;
          updated.verifierName = additionalData.verifierName;
          updated.verifyTime = new Date().toISOString();
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
    action: DispatchAction,
    newStatus: HazardStatus,
    comment?: string,
    handlerNames?: string[],
    ccUserNames?: string[]
  ): HazardLog {
    const actionNames: Record<DispatchAction, string> = {
      [DispatchAction.SUBMIT]: '提交上报',
      [DispatchAction.ASSIGN]: '指派整改',
      [DispatchAction.RECTIFY]: '提交整改',
      [DispatchAction.VERIFY]: '验收闭环',
      [DispatchAction.REJECT]: '驳回',
      [DispatchAction.EXTEND_DEADLINE]: '延期申请'
    };

    const statusNames: Record<HazardStatus, string> = {
      'reported': '已上报',
      'assigned': '已指派',
      'rectifying': '整改中',
      'verified': '已验收',
      'closed': '已闭环'
    };

    let changes = `${actionNames[action]} → 状态变更为"${statusNames[newStatus]}"`;
    
    if (handlerNames && handlerNames.length > 0) {
      changes += `\n处理人: ${handlerNames.join('、')}`;
    }
    
    if (comment) {
      changes += `\n备注: ${comment}`;
    }

    return {
      operatorName: operator.name,
      action: actionNames[action],
      time: new Date().toISOString(),
      changes,
      ccUsers: ccUserNames && ccUserNames.length > 0 ? ccUserNames.map(name => name) : undefined,
      ccUserNames
    };
  }

  /**
   * 生成通知数据（不执行数据库操作）
   */
  private static generateNotifications(params: {
    hazard: HazardRecord;
    action: string;
    operator: { id: string; name: string };
    handlers: { userIds: string[]; userNames: string[] };
    ccUsers: { userIds: string[]; userNames: string[] };
    newStatus: HazardStatus;
  }): NotificationData[] {
    const { hazard, action, operator, handlers, ccUsers, newStatus } = params;
    const allNotifications: NotificationData[] = [];

    // 1. 生成处理人通知数据
    if (handlers.userIds.length > 0) {
      const handlerNotifications = HazardNotificationService.generateHandlerNotifications({
        hazard,
        handlerIds: handlers.userIds,
        handlerNames: handlers.userNames,
        action,
        operatorName: operator.name
      });
      allNotifications.push(...handlerNotifications);
    }

    // 2. 生成抄送人通知数据
    if (ccUsers.userIds.length > 0) {
      const ccNotifications = HazardNotificationService.generateCCNotifications({
        hazard,
        ccUserIds: ccUsers.userIds,
        ccUserNames: ccUsers.userNames,
        action,
        operatorName: operator.name
      });
      allNotifications.push(...ccNotifications);
    }

    // 3. 如果隐患闭环，生成上报人通知数据
    if (newStatus === 'closed' && hazard.reporterId) {
      const closedNotifications = HazardNotificationService.generateClosedNotification({
        hazard,
        reporterId: hazard.reporterId,
        reporterName: hazard.reporterName,
        operatorName: operator.name
      });
      allNotifications.push(...closedNotifications);
    }

    console.log(`📋 [通知系统] 生成通知数据: 处理人${handlers.userNames.length}人, 抄送${ccUsers.userNames.length}人, 共${allNotifications.length}条`);
    return allNotifications;
  }

  /**
   * 批量派发（用于批量操作场景）
   */
  static async batchDispatch(
    contexts: DispatchContext[]
  ): Promise<DispatchResult[]> {
    const results: DispatchResult[] = [];
    
    for (const context of contexts) {
      const result = await this.dispatch(context);
      results.push(result);
    }
    
    return results;
  }

  /**
   * 验证派发合法性
   */
  static validateDispatch(
    hazard: HazardRecord,
    action: DispatchAction,
    operator: { id: string; name: string }
  ): { valid: boolean; error?: string } {
    // 1. 检查状态流转是否合法
    const transition = this.getTransition(hazard.status, action);
    if (!transition.success) {
      return { valid: false, error: transition.error };
    }

    // 2. 检查操作权限（可根据需要扩展）
    // 例如：只有上报人可以提交整改等

    return { valid: true };
  }

  /**
   * 获取可用的操作列表
   */
  static getAvailableActions(
    hazard: HazardRecord,
    operator: { id: string; name: string; role?: string }
  ): DispatchAction[] {
    const actions: DispatchAction[] = [];

    switch (hazard.status) {
      case 'reported':
        // 已上报：可以指派或驳回
        if (operator.role === '管理员' || operator.role?.includes('主管')) {
          actions.push(DispatchAction.ASSIGN, DispatchAction.REJECT);
        }
        break;

      case 'assigned':
        // 已指派：当前步骤执行人可以提交整改，管理员可以驳回
        if (operator.id === hazard.dopersonal_ID) {
          actions.push(DispatchAction.RECTIFY, DispatchAction.EXTEND_DEADLINE);
        }
        if (operator.role === '管理员') {
          actions.push(DispatchAction.REJECT);
        }
        break;

      case 'rectifying':
        // 整改中：管理员可以验收或驳回
        if (operator.role === '管理员' || operator.role?.includes('主管')) {
          actions.push(DispatchAction.VERIFY, DispatchAction.REJECT);
        }
        break;

      case 'verified':
        // 已验收：管理员可以闭环或驳回
        if (operator.role === '管理员') {
          actions.push(DispatchAction.VERIFY, DispatchAction.REJECT);
        }
        break;

      case 'closed':
        // 已闭环：无可用操作
        break;
    }

    return actions;
  }
}
