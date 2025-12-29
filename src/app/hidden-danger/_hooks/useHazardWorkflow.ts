// src/app/hidden-danger/_hooks/useHazardWorkflow.ts
import { useState } from 'react';
import { hazardService } from '@/services/hazard.service';
import { HazardRecord, CCRule, EmergencyPlanRule, HazardWorkflowConfig, SimpleUser } from '@/types/hidden-danger';
import { HazardDispatchEngine, DispatchAction } from '@/services/hazardDispatchEngine';
import { matchHandler } from '@/app/hidden-danger/_utils/handler-matcher';
import type { Department } from '@/utils/departmentUtils';
import { SystemLogService } from '@/services/systemLog.service';

export function useHazardWorkflow(onSuccess: () => void) {
  const [loading, setLoading] = useState(false);

  /**
   * 核心处理函数：使用派发引擎自动匹配处理人和抄送人
   */
  const processAction = async (
    action: string,
    hazard?: HazardRecord,
    payload?: any,
    user?: any,
    rules?: { ccRules: CCRule[], planRules: EmergencyPlanRule[] },
    allUsers?: SimpleUser[],
    workflowConfig?: HazardWorkflowConfig | null,
    departments?: Department[]
  ) => {
    if (!hazard) {
      console.error('processAction: hazard is required');
      return;
    }

    if (!allUsers || !workflowConfig || !departments) {
      console.error('processAction: 缺少必要参数 (allUsers, workflowConfig, departments)');
      return;
    }
    
    setLoading(true);
    try {
      // 映射动作到派发引擎的动作类型
      const dispatchActionMap: Record<string, DispatchAction> = {
        'submit': DispatchAction.SUBMIT,  // 步骤1：上报并指派
        'assign': DispatchAction.ASSIGN,  // 步骤2：开始整改
        'start_rectify': DispatchAction.RECTIFY,
        'finish_rectify': DispatchAction.RECTIFY,  // 步骤3：提交整改
        'verify_pass': DispatchAction.VERIFY,  // 步骤4：验收通过
        'verify_reject': DispatchAction.REJECT,
        'request_extension': DispatchAction.EXTEND_DEADLINE,
        'reject_by_responsible': DispatchAction.REJECT
      };

      const dispatchAction = dispatchActionMap[action];
      
      if (!dispatchAction) {
        // 不支持的操作，使用旧逻辑
        console.warn(`操作 ${action} 未使用派发引擎`);
        
        let updates: any = { 
          operatorId: user?.id, 
          operatorName: user?.name,
          time: new Date().toISOString() 
        };

        switch (action) {
          case 'approve_extension':
            updates = { ...updates, ...payload, isExtensionApproved: true, actionName: '批准延期' };
            break;
          case 'reject_extension':
            updates = { ...updates, ...payload, isExtensionApproved: false, actionName: '拒绝延期' };
            break;
        }

        await hazardService.updateHazard({ id: hazard.id, ...updates });
        onSuccess();
        return;
      }

      // 使用派发引擎
      console.log('🚀 使用派发引擎处理:', {
        action,
        dispatchAction,
        hazardId: hazard.id,
        operator: user?.name
      });

      const result = await HazardDispatchEngine.dispatch({
        hazard,
        action: dispatchAction,
        operator: {
          id: user?.id || 'system',
          name: user?.name || '系统'
        },
        workflowSteps: workflowConfig.steps,
        allUsers,
        departments,
        comment: payload?.comment || payload?.rejectReason || payload?.extensionReason,
        additionalData: payload
      });

      if (!result.success) {
        throw new Error(result.error || '派发失败');
      }

      console.log('✅ 派发成功:', {
        newStatus: result.newStatus,
        handlers: result.handlers.userNames,
        ccUsers: result.ccUsers.userNames,
        handlersDetail: result.handlers
      });

      // 【关键修复】先处理派发引擎匹配的处理人，然后再合并 payload
      // 这样可以确保派发引擎的结果优先
      const dispatchedHandlers: any = {};
      
      console.log('🔍 检查处理人数据:', {
        action,
        userIds: result.handlers.userIds,
        userNames: result.handlers.userNames,
        length: result.handlers.userIds?.length,
        判断结果: result.handlers.userIds?.length > 0,
        当前责任人: {
          responsibleId: hazard.responsibleId,
          responsibleName: hazard.responsibleName
        }
      });
      
      // ========== 新的动态步骤流转逻辑 ==========
      // 获取当前步骤索引
      const currentStepIndex = hazard.currentStepIndex ?? 0;
      const currentStepId = result.currentStep;
      
      console.log('📍 当前步骤位置:', {
        currentStepIndex,
        currentStepId,
        totalSteps: workflowConfig.steps.length
      });

      // 根据动作类型决定下一步
      let nextStepIndex = currentStepIndex;
      
      if (action === 'verify_reject' || action === 'reject_by_responsible') {
        // 驳回：回退到整改步骤
        const rectifyStepIndex = workflowConfig.steps.findIndex(s => s.id === 'rectify');
        nextStepIndex = rectifyStepIndex >= 0 ? rectifyStepIndex : currentStepIndex;
        console.log('🔙 驳回操作，回退到整改步骤，索引:', nextStepIndex);
      } else {
        // 正常流转：前进到下一步
        nextStepIndex = currentStepIndex + 1;
        console.log('➡️ 正常流转，前进到下一步，索引:', nextStepIndex);
      }

      // 更新步骤追踪信息
      dispatchedHandlers.currentStepIndex = nextStepIndex;
      dispatchedHandlers.currentStepId = workflowConfig.steps[nextStepIndex]?.id;

      // 设置下一步的执行人
      if (nextStepIndex < workflowConfig.steps.length) {
        const nextStep = workflowConfig.steps[nextStepIndex];
        
        console.log('🎯 下一步骤:', {
          index: nextStepIndex,
          id: nextStep.id,
          name: nextStep.name
        });

        // 特殊处理：整改步骤的执行人强制为整改责任人
        if (nextStep.id === 'rectify') {
          dispatchedHandlers.dopersonal_ID = hazard.responsibleId;
          dispatchedHandlers.dopersonal_Name = hazard.responsibleName;
          if (hazard.responsibleId) {
            dispatchedHandlers.old_personal_ID = [...(hazard.old_personal_ID || []), hazard.responsibleId];
          }
          console.log('🎯 下一步是整改步骤，执行人设为整改责任人:', hazard.responsibleName);
        } else {
          // 其他步骤：使用派发引擎匹配的处理人
          if (result.handlers.userIds && result.handlers.userIds.length > 0) {
            const handlerId = result.handlers.userIds[0];
            const handlerName = result.handlers.userNames[0];
            
            dispatchedHandlers.dopersonal_ID = handlerId;
            dispatchedHandlers.dopersonal_Name = handlerName;
            dispatchedHandlers.old_personal_ID = [...(hazard.old_personal_ID || []), handlerId];
            
            console.log('🎯 下一步执行人（派发引擎匹配）:', handlerName, '(ID:', handlerId, ')');
            
            // 如果是验收步骤，同时更新验收人字段
            if (nextStep.id === 'verify') {
              dispatchedHandlers.verifierId = handlerId;
              dispatchedHandlers.verifierName = handlerName;
            }
          } else {
            console.warn('⚠️ 派发引擎未匹配到处理人');
          }
        }
      } else {
        // 已经是最后一步，流程结束
        dispatchedHandlers.dopersonal_ID = null;
        dispatchedHandlers.dopersonal_Name = null;
        console.log('✅ 已到达最后一步，流程结束');
      }

      // 将抄送人也添加到历史经手人数组
      const currentOldPersonalIds = dispatchedHandlers.old_personal_ID || hazard.old_personal_ID || [];
      const allOldPersonalIds = [...new Set([...currentOldPersonalIds, ...result.ccUsers.userIds])];

      // 构建更新数据：派发引擎结果 > payload 中的其他数据
      const updates: any = {
        operatorId: user?.id,
        operatorName: user?.name,
        status: result.newStatus,
        actionName: result.log.action,
        logs: [result.log, ...(hazard.logs || [])],
        ccUsers: result.ccUsers.userIds,
        ccUserNames: result.ccUsers.userNames,
        // 先合并 payload 中的其他数据（如 deadline、rectifyRequirement、photos 等）
        ...payload,
        // 最后覆盖派发引擎匹配的处理人（确保优先级最高）
        ...dispatchedHandlers,
        // 更新历史经手人数组（包含处理人和抄送人）
        old_personal_ID: allOldPersonalIds
      };

      console.log('📦 准备更新的数据:', {
        action,
        payload,
        dispatchedHandlers,
        finalUpdates: updates,
        责任人字段: {
          responsibleId: updates.responsibleId,
          responsibleName: updates.responsibleName,
          responsibleDeptId: updates.responsibleDeptId,
          responsibleDeptName: updates.responsibleDeptName
        }
      });

      // 更新隐患状态
      await hazardService.updateHazard({ id: hazard.id, ...updates });

      // 记录系统操作日志（包含引擎派发快照）
      try {
        const actionTypeMap: Record<string, string> = {
          'submit': 'hazard_reported',
          'assign': 'hazard_assigned',
          'finish_rectify': 'hazard_rectified',
          'verify_pass': 'hazard_verified',
          'verify_reject': 'hazard_rejected',
        };

        const logAction = actionTypeMap[action] || `hazard_${action}`;
        
        // 构建快照数据
        const snapshot = {
          action: result.log.action,
          operatorName: user?.name,
          operatedAt: new Date().toISOString(),
          hazardCode: hazard.code,
          hazardDesc: hazard.desc,
          currentStep: workflowConfig.steps[currentStepIndex]?.name,
          nextStep: workflowConfig.steps[nextStepIndex]?.name,
          dispatchResult: {
            assignedTo: result.handlers.userNames,
            assignedToIds: result.handlers.userIds,
            ccTo: result.ccUsers.userNames,
            ccToIds: result.ccUsers.userIds,
            matchedBy: result.handlers.matchedBy || '默认规则',
            status: result.newStatus,
          },
          comment: payload?.comment || payload?.rejectReason || payload?.extensionReason,
          additionalData: payload,
        };

        await SystemLogService.createLog({
          action: logAction,
          targetType: 'hazard',
          targetId: hazard.id,
          userId: user?.id || 'system',
          userName: user?.name || '系统',
          details: `${result.log.action}：${hazard.code} - ${hazard.desc?.substring(0, 50)}`,
          snapshot,
        });

        console.log('📝 已记录系统日志，包含派发快照');
      } catch (logError) {
        console.error('❌ 记录系统日志失败（不影响主流程）:', logError);
      }

      // 创建通知（通过 API）
      if (result.notifications && result.notifications.length > 0) {
        try {
          await fetch('/api/notifications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notifications: result.notifications }),
          });
          console.log(`✅ 已创建 ${result.notifications.length} 条通知`);
        } catch (notifyError) {
          console.error('❌ 创建通知失败（不影响主流程）:', notifyError);
          // 通知创建失败不应阻断主流程
        }
      }

      onSuccess(); // 成功后刷新数据并关闭弹窗
    } catch (error) {
      console.error("处理失败:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return { processAction, loading };
}
