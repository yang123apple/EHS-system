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
import { HazardHandlerResolverService } from './hazardHandlerResolver.service';
import type { Department } from '@/utils/departmentUtils';
import { HazardNotificationService, NotificationData } from './hazardNotification.service';
import { syncHazardVisibility } from './hazardVisibility.service';

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
  // 🟢 新增：候选处理人信息（用于创建关联表记录）
  candidateHandlers?: Array<{
    userId: string;
    userName: string;
    stepIndex: number;
    stepId: string;
  }>;
  shouldSyncVisibility?: boolean; // 🚀 标记是否需要同步可见性
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
    role?: string;
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

      // 0. 状态流转前校验必要字段
      const validationError = await this.validateBeforeTransition(hazard, action, operator, stepIndex);
      if (validationError) {
        throw new Error(validationError);
      }

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

      // 4. 使用统一服务解析下一步骤的处理人和抄送人（确保与流程预览一致）
      const reporter = allUsers.find(u => u.id === updatedHazard.reporterId);
      
      const stepResult = await HazardHandlerResolverService.resolveStepHandlers({
        hazard: updatedHazard,
        step: nextStep,
        stepIndex: transition.nextStepIndex,
        allUsers,
        departments,
        reporter
      });

      if (!stepResult.success) {
        console.warn('[派发引擎] 步骤解析失败:', stepResult.error);
        // 不抛出错误，允许继续（某些步骤可能不需要处理人）
      }
      
      console.log('🎯 [派发引擎] 步骤解析结果:', {
        stepName: stepResult.stepName,
        handlersCount: stepResult.handlers.userIds?.length || 0,
        userIds: stepResult.handlers.userIds,
        userNames: stepResult.handlers.userNames,
        ccUsersCount: stepResult.ccUsers.userIds?.length || 0,
        approvalMode: stepResult.approvalMode || nextStep.handlerStrategy?.approvalMode || 'OR'
      });

      // 使用统一服务返回的结果
      const handlerResult = {
        success: stepResult.success,
        userIds: stepResult.handlers.userIds || [],
        userNames: stepResult.handlers.userNames || [],
        matchedBy: stepResult.handlers.matchedBy
      };
      
      const ccResult = stepResult.ccUsers;

      // 6. 生成操作日志
      const log = this.createLog(
        operator,
        action,
        transition.newStatus,
        comment,
        handlerResult.userNames,
        ccResult.userNames,
        nextStep.name  // 传入步骤名称
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

      // 8. 🚀 同步可见性记录（在返回结果前异步执行，不影响主流程）
      // 注意：这里只是标记需要同步，实际同步由API层在事务中完成
      // 避免在派发引擎中执行数据库操作，保持职责单一
      
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
        notifications,
        // 🟢 新增：候选处理人信息（用于创建关联表记录，使用统一服务返回的结果）
        candidateHandlers: stepResult.candidateHandlers && stepResult.candidateHandlers.length > 0
          ? stepResult.candidateHandlers.map(candidate => ({
              userId: candidate.userId,
              userName: candidate.userName,
              stepIndex: transition.nextStepIndex,
              stepId: transition.nextStepId
            }))
          : [],
        // 🚀 新增：标记需要同步可见性（由API层处理）
        shouldSyncVisibility: true
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
        candidateHandlers: [],
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
    // 🔒 严格边界检查：确保当前步骤索引有效
    if (currentStepIndex < 0 || currentStepIndex >= workflowSteps.length) {
      return {
        success: false,
        newStatus: currentStatus,
        nextStepId: '',
        nextStepIndex: currentStepIndex,
        error: `无效的步骤索引: ${currentStepIndex}，有效范围: 0-${workflowSteps.length - 1}`
      };
    }

    // 验证当前步骤是否存在
    const currentStep = workflowSteps[currentStepIndex];
    if (!currentStep) {
      return {
        success: false,
        newStatus: currentStatus,
        nextStepId: '',
        nextStepIndex: currentStepIndex,
        error: `未找到步骤配置: 索引=${currentStepIndex}`
      };
    }

    // 驳回操作：特殊处理
    if (action === DispatchAction.REJECT) {
      // 🔄 修复：基于步骤索引驳回，而不是硬编码步骤ID查找
      // 这样可以支持任意数量的自定义步骤
      if (currentStepIndex <= 0) {
        // 已经是第一步，无法驳回
        return {
          success: false,
          newStatus: currentStatus,
          nextStepId: currentStep.id,
          nextStepIndex: currentStepIndex,
          error: '已经是第一步，无法驳回'
        };
      }
      
      // 驳回：回到上一步（基于步骤索引，而不是步骤ID）
      const prevIndex = currentStepIndex - 1;
      const prevStep = workflowSteps[prevIndex];
      
      if (!prevStep) {
        return {
          success: false,
          newStatus: currentStatus,
          nextStepId: '',
          nextStepIndex: currentStepIndex,
          error: `未找到上一步骤配置: 索引=${prevIndex}`
        };
      }
      
      // 根据上一步骤的位置和ID推断状态
      const prevStatus = this.getStatusByStepId(prevStep.id, prevIndex, workflowSteps);
      
      console.log('🔄 [派发引擎] 驳回流转:', {
        from: {
          index: currentStepIndex,
          id: currentStep.id,
          name: currentStep.name
        },
        to: {
          index: prevIndex,
          id: prevStep.id,
          name: prevStep.name,
          status: prevStatus
        }
      });
      
      return {
        success: true,
        newStatus: prevStatus,
        nextStepId: prevStep.id,
        nextStepIndex: prevIndex
      };
    }

    // 正常流转：前进到下一步
    const nextStepIndex = currentStepIndex + 1;
    
    if (nextStepIndex >= workflowSteps.length) {
      // 已经是最后一步，流程结束（但这种情况应该在前面的边界检查中已经处理）
      // 这里作为双重保险，如果 currentStepIndex 已经是最后一个有效索引，则闭环
      if (currentStepIndex === workflowSteps.length - 1) {
        return {
          success: true,
          newStatus: 'closed',
          nextStepId: 'verify', // 最后停留在验收步骤
          nextStepIndex: workflowSteps.length - 1
        };
      }
      // 如果索引超出范围，应该返回错误（不应该到达这里，因为前面已经检查过）
      return {
        success: false,
        newStatus: currentStatus,
        nextStepId: '',
        nextStepIndex: currentStepIndex,
        error: `步骤索引超出范围: ${nextStepIndex}，最大有效索引: ${workflowSteps.length - 1}`
      };
    }

    const nextStep = workflowSteps[nextStepIndex];
    if (!nextStep) {
      return {
        success: false,
        newStatus: currentStatus,
        nextStepId: '',
        nextStepIndex: currentStepIndex,
        error: `未找到下一步骤配置: 索引=${nextStepIndex}`
      };
    }
    // 🔄 修复：传入步骤索引和完整流程配置，以便更准确地推断状态
    const newStatus = this.getStatusByStepId(nextStep.id, nextStepIndex, workflowSteps);

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
   * 根据步骤ID和位置推断对应的隐患状态
   * @param stepId 步骤ID
   * @param stepIndex 步骤索引（可选，用于更准确的状态推断）
   * @param workflowSteps 完整的工作流步骤配置（可选，用于上下文推断）
   */
  private static getStatusByStepId(
    stepId: string, 
    stepIndex?: number, 
    workflowSteps?: HazardWorkflowStep[]
  ): HazardStatus {
    // 标准步骤：直接映射
    if (stepId === 'report') return 'reported';
    if (stepId === 'assign') return 'assigned';
    if (stepId === 'rectify') return 'rectifying';
    if (stepId === 'verify') return 'verified';
    
    // 自定义步骤：根据在流程中的位置推断状态
    if (stepIndex !== undefined && workflowSteps && workflowSteps.length > 0) {
      // 查找标准步骤的位置作为参考点
      const reportIndex = workflowSteps.findIndex(s => s.id === 'report');
      const assignIndex = workflowSteps.findIndex(s => s.id === 'assign');
      const rectifyIndex = workflowSteps.findIndex(s => s.id === 'rectify');
      const verifyIndex = workflowSteps.findIndex(s => s.id === 'verify');
      
      // 根据位置推断状态（基于标准步骤的位置）
      // report -> assigned -> [自定义步骤] -> rectifying -> verified
      if (reportIndex >= 0 && stepIndex <= reportIndex) {
        return 'reported';
      } else if (assignIndex >= 0 && stepIndex <= assignIndex) {
        // 在 assign 步骤或之前（但已过 report）
        return 'assigned';
      } else if (rectifyIndex >= 0 && stepIndex < rectifyIndex) {
        // 在 assign 之后、rectify 之前（包括自定义步骤）
        return 'assigned';
      } else if (rectifyIndex >= 0 && stepIndex <= rectifyIndex) {
        // 在 rectify 步骤
        return 'rectifying';
      } else if (verifyIndex >= 0 && stepIndex < verifyIndex) {
        // 在 rectify 之后、verify 之前
        return 'rectifying';
      } else if (verifyIndex >= 0 && stepIndex <= verifyIndex) {
        // 在 verify 步骤
        return 'verified';
      } else if (verifyIndex >= 0 && stepIndex > verifyIndex) {
        // 在 verify 之后（不应该发生，但作为兜底）
        return 'verified';
      }
    }
    
    // 默认：自定义步骤使用 'assigned' 状态
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
        if (additionalData?.rectificationNotes || additionalData?.rectifyDesc) {
          updated.rectificationNotes = additionalData.rectificationNotes || additionalData.rectifyDesc;
          updated.rectifyDesc = additionalData.rectificationNotes || additionalData.rectifyDesc; // 向后兼容
          updated.rectificationPhotos = additionalData.rectificationPhotos || additionalData.rectifyPhotos || [];
          updated.rectifyPhotos = additionalData.rectificationPhotos || additionalData.rectifyPhotos || []; // 向后兼容
          updated.rectificationTime = new Date().toISOString();
          updated.rectifyTime = new Date().toISOString(); // 向后兼容
        }
        break;

      case DispatchAction.VERIFY:
        // 验收时，更新验收信息
        if (additionalData?.verifierId) {
          updated.verifierId = additionalData.verifierId;
          updated.verifierName = additionalData.verifierName;
          updated.verificationTime = new Date().toISOString();
          updated.verifyTime = new Date().toISOString(); // 向后兼容
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
    ccUserNames?: string[],
    stepName?: string  // 新增：自定义步骤名称
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

    // 优先使用自定义步骤名称，否则使用默认动作名称
    const displayActionName = stepName || actionNames[action];
    let changes = `${displayActionName} → 状态变更为"${statusNames[newStatus]}"`;
    
    if (handlerNames && handlerNames.length > 0) {
      changes += `\n处理人: ${handlerNames.join('、')}`;
    }
    
    if (comment) {
      changes += `\n备注: ${comment}`;
    }

    return {
      operatorName: operator.name,
      action: action,  // 使用英文枚举值（如 "submit"），满足测试和API契约要求
      time: new Date().toISOString(),
      changes,  // changes 字段包含中文显示名称
      ccUsers: ccUserNames && ccUserNames.length > 0 ? ccUserNames.map(name => name) : undefined,
      ccUserNames
    };
  }

  /**
   * 生成通知数据（不执行数据库操作）
   */
  private static generateNotifications(params: {
    hazard: HazardRecord;
    action: string; // 可能是英文枚举值（如 "submit"）或中文（如 "提交上报"）
    operator: { id: string; name: string };
    handlers: { userIds: string[]; userNames: string[] };
    ccUsers: { userIds: string[]; userNames: string[] };
    newStatus: HazardStatus;
  }): NotificationData[] {
    const { hazard, action, operator, handlers, ccUsers, newStatus } = params;
    const allNotifications: NotificationData[] = [];

    // 将英文枚举值转换为中文（用于通知服务）
    const actionNames: Record<string, string> = {
      [DispatchAction.SUBMIT]: '提交上报',
      [DispatchAction.ASSIGN]: '指派整改',
      [DispatchAction.RECTIFY]: '提交整改',
      [DispatchAction.VERIFY]: '验收闭环',
      [DispatchAction.REJECT]: '驳回',
      [DispatchAction.EXTEND_DEADLINE]: '延期申请'
    };
    const actionForNotification = actionNames[action] || action; // 如果是英文枚举值则转换，否则直接使用

    // 1. 生成处理人通知数据
    if (handlers.userIds.length > 0) {
      const handlerNotifications = HazardNotificationService.generateHandlerNotifications({
        hazard,
        handlerIds: handlers.userIds,
        handlerNames: handlers.userNames,
        action: actionForNotification, // 使用转换后的中文 action
        operatorName: operator.name
      });
      // 防御性检查：确保返回的是数组
      if (Array.isArray(handlerNotifications) && handlerNotifications.length > 0) {
        allNotifications.push(...handlerNotifications);
      }
    }

    // 2. 生成抄送人通知数据
    if (ccUsers.userIds.length > 0) {
      const ccNotifications = HazardNotificationService.generateCCNotifications({
        hazard,
        ccUserIds: ccUsers.userIds,
        ccUserNames: ccUsers.userNames,
        action: actionForNotification, // 使用转换后的中文 action
        operatorName: operator.name
      });
      // 防御性检查：确保返回的是数组
      if (Array.isArray(ccNotifications) && ccNotifications.length > 0) {
        allNotifications.push(...ccNotifications);
      }
    }

    // 3. 如果隐患闭环，生成上报人通知数据
    if (newStatus === 'closed' && hazard.reporterId) {
      const closedNotifications = HazardNotificationService.generateClosedNotification({
        hazard,
        reporterId: hazard.reporterId,
        reporterName: hazard.reporterName,
        operatorName: operator.name
      });
      // 防御性检查：确保返回的是数组
      if (Array.isArray(closedNotifications) && closedNotifications.length > 0) {
        allNotifications.push(...closedNotifications);
      }
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
   * 状态流转前校验必要字段
   * 确保当前执行人、整改提交时间等关键字段符合流转条件
   */
  /**
   * 判断操作人是否为管理员
   */
  private static isOperatorAdmin(operator: { id: string; name: string; role?: string }): boolean {
    if (!operator.role) return false;
    
    const roleStr = String(operator.role).toLowerCase();
    return (
      roleStr.includes('管理员') || 
      roleStr.includes('admin') || 
      roleStr.includes('super') ||
      roleStr.includes('主管') // 通常主管也拥有较高权限
    );
  }

  private static async validateBeforeTransition(
    hazard: HazardRecord,
    action: DispatchAction,
    operator: { id: string; name: string; role?: string },
    currentStepIndex: number
  ): Promise<string | null> {
    console.log('🔍 [派发引擎] 权限校验开始:', {
      action,
      operator: { id: operator.id, name: operator.name, role: operator.role },
      hazardStatus: hazard.status,
      currentStepIndex
    });

    // 🟢 特殊处理：隐患初始创建时跳过权限校验
    // SUBMIT 动作是系统初始化操作，此时还没有候选处理人列表
    if (action === DispatchAction.SUBMIT) {
      console.log('[派发引擎] SUBMIT 动作，跳过权限校验（初始化操作）');
      return null; // 直接通过校验
    }

    // 1. 校验当前执行人（dopersonal_ID）
    if (action === DispatchAction.RECTIFY) {
      // 提交整改时，必须验证当前执行人是否匹配
      if (!hazard.dopersonal_ID) {
        // 🔧 责任人/管理员兜底：
        // 1. 如果 dopersonal_ID 未设置，但当前状态为整改中且操作人是责任人
        // 2. 如果操作人是管理员，允许修复数据并继续
        const isAdmin = this.isOperatorAdmin(operator);
        const isResponsible = hazard.responsibleId === operator.id;
        
        if ((hazard.status === 'rectifying' && isResponsible) || isAdmin) {
          console.log(`[派发引擎] dopersonal_ID 未设置，但操作人具有权限（责任人=${isResponsible}, 管理员=${isAdmin}），允许提交整改`);
          // 允许操作，但会在后续更新时设置 dopersonal_ID
        } else {
          return '当前步骤执行人未设置，无法提交整改';
        }
      } else {
        // 检查操作人是否为当前执行人（或签/会签模式下允许候选处理人操作）
        const isCurrentHandler = hazard.dopersonal_ID === operator.id;
        const isCandidateHandler = hazard.candidateHandlers?.some(
          candidate => candidate.userId === operator.id && !candidate.hasOperated
        );
        const isAdmin = this.isOperatorAdmin(operator);
        
        if (!isCurrentHandler && !isCandidateHandler) {
          // 🔧 责任人/管理员兜底：即使不是当前执行人，但如果是责任人或管理员，也允许操作
          const isResponsible = hazard.responsibleId === operator.id;
          
          if ((hazard.status === 'rectifying' && isResponsible) || isAdmin) {
            console.log(`[派发引擎] 操作人不是当前执行人，但具有权限（责任人=${isResponsible}, 管理员=${isAdmin}），允许提交整改`);
            // 允许操作
          } else {
            return `当前操作人（${operator.name}）不是当前步骤的执行人，无法提交整改`;
          }
        }
      }
    }

    // 2. 校验整改提交时间（提交整改时必须有整改描述）
    if (action === DispatchAction.RECTIFY) {
      // 注意：这里不直接检查 rectificationTime，因为这是本次操作要设置的
      // 但可以检查是否已有整改描述（如果之前已提交过）
      // 实际校验会在API层进行
    }

    // 3. 校验验收操作（验收时必须已有整改提交）
    if (action === DispatchAction.VERIFY && hazard.status === 'rectifying') {
      const rectifyTime = hazard.rectificationTime || hazard.rectifyTime; // 优先使用新字段名
      if (!rectifyTime) {
        return '整改尚未提交，无法进行验收';
      }
      const rectifyDesc = hazard.rectificationNotes || hazard.rectifyDesc; // 优先使用新字段名
      if (!rectifyDesc) {
        return '整改描述为空，无法进行验收';
      }
    }

    // 4. 校验当前步骤索引一致性
    const expectedStepIndex = hazard.currentStepIndex ?? 0;
    if (currentStepIndex !== expectedStepIndex) {
      console.warn(`[派发引擎] 步骤索引不一致: 传入=${currentStepIndex}, 数据库=${expectedStepIndex}`);
      // 不直接抛出错误，因为可能是前端缓存问题，但记录警告
    }

      // 5. 校验会签/或签模式下的操作权限
      // 🟢 特殊处理：验收操作（VERIFY）不应受当前步骤（通常是整改步骤）候选处理人限制
      // 验收人通常是管理员或上报人主管，而当前步骤候选人通常是整改责任人
      const isVerifying = action === DispatchAction.VERIFY;

      if (isVerifying) {
        console.log('[派发引擎] 验收操作，跳过当前步骤候选处理人校验');
      } else {
        // 优先使用传入的 candidateHandlers 数据（如果已从关联表加载）
        if (hazard.candidateHandlers && hazard.candidateHandlers.length > 0 && hazard.approvalMode) {
          const approvalMode = hazard.approvalMode;
          const isAdmin = this.isOperatorAdmin(operator);

          // 🔒 安全校验：首先检查当前用户是否在候选处理人列表中
          const isCandidate = hazard.candidateHandlers.some(h => String(h.userId) === String(operator.id));

          // 🔧 管理员特权：如果是管理员，允许跳过候选人检查
          if (!isCandidate && !isAdmin) {
            return `您不是当前步骤的候选处理人，无法执行此操作`;
          }

          if (approvalMode === 'AND') {
            // 会签模式下，已操作过的用户不能重复操作
            // 🔒 从数据库重新查询以避免并发竞争条件
            const { hasUserOperated } = await import('./hazardCandidateHandler.service');
            const stepIndex = currentStepIndex ?? hazard.currentStepIndex ?? 0;
            const hasOperated = await hasUserOperated(hazard.id, operator.id, stepIndex);
            if (hasOperated) {
              return '您已完成本次会签，无法重复操作';
            }
          } else if (approvalMode === 'OR') {
            // 或签模式下，已有人操作后，其他人不能再操作
            // 🔒 从数据库重新查询以避免并发竞争条件
            const { hasAnyUserOperated } = await import('./hazardCandidateHandler.service');
            const stepIndex = currentStepIndex ?? hazard.currentStepIndex ?? 0;
            const someoneOperated = await hasAnyUserOperated(hazard.id, stepIndex);
            if (someoneOperated) {
              return '或签已完成，无法重复操作';
            }
          }
        } else if (hazard.approvalMode && (hazard.approvalMode === 'OR' || hazard.approvalMode === 'AND')) {
          // 如果 candidateHandlers 未加载，尝试从关联表查询（异步）
          const { hasUserOperated, isUserCandidate } = await import('./hazardCandidateHandler.service');
          const stepIndex = currentStepIndex ?? hazard.currentStepIndex ?? 0;
          const isAdmin = this.isOperatorAdmin(operator);
          
          // 🔒 安全校验：首先检查当前用户是否在候选处理人列表中
          const isCandidate = await isUserCandidate(hazard.id, operator.id, stepIndex);
          
          // 🔧 管理员特权：如果是管理员，允许跳过候选人检查
          if (!isCandidate && !isAdmin) {
            return `您不是当前步骤的候选处理人，无法执行此操作`;
          }
          
          const hasOperated = await hasUserOperated(hazard.id, operator.id, stepIndex);
          
          if (hazard.approvalMode === 'AND' && hasOperated) {
            // 会签模式下，已操作过的用户不能重复操作
            return '您已完成本次会签，无法重复操作';
          }
          
          if (hazard.approvalMode === 'OR' && hasOperated) {
            // 或签模式下，已有人操作后，其他人不能再操作
            return '或签已完成，无法重复操作';
          }
        }
      }

    return null; // 校验通过
  }

  /**
   * 验证派发合法性
   */
  static validateDispatch(
    hazard: HazardRecord,
    action: DispatchAction,
    operator: { id: string; name: string },
    workflowSteps: HazardWorkflowStep[] = []
  ): { valid: boolean; error?: string } {
    // 1. 检查状态流转是否合法
    const stepIndex = hazard.currentStepIndex ?? 0;
    const transition = this.getTransition(stepIndex, action, workflowSteps, hazard.status);
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
