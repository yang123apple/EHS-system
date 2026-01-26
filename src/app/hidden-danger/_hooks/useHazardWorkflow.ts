// src/app/hidden-danger/_hooks/useHazardWorkflow.ts
import { useState } from 'react';
import { hazardService } from '@/services/hazard.service';
import { HazardRecord, CCRule, EmergencyPlanRule, HazardWorkflowConfig, SimpleUser } from '@/types/hidden-danger';
import { HazardDispatchEngine, DispatchAction } from '@/services/hazardDispatchEngine';
import { matchHandler } from '@/app/hidden-danger/_utils/handler-matcher';
import type { Department } from '@/utils/departmentUtils';
import { apiFetch } from '@/lib/apiClient';

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
        currentStepIndex: hazard.currentStepIndex,
        operator: {
          id: user?.id,
          name: user?.name,
          role: user?.role,
          roles: user?.roles // 尝试打印 roles，有些系统使用数组
        }
      });

      const result = await HazardDispatchEngine.dispatch({
        hazard,
        action: dispatchAction,
        operator: {
          id: user?.id || 'system',
          name: user?.name || '系统',
          role: user?.role || (Array.isArray(user?.roles) ? user.roles.join(',') : '') // 兼容 roles 数组
        },
        workflowSteps: workflowConfig.steps,
        allUsers,
        departments,
        currentStepIndex: hazard.currentStepIndex ?? 0, // 传入当前步骤索引
        comment: payload?.comment || payload?.rejectReason || payload?.extensionReason,
        additionalData: payload
      });

      if (!result.success) {
        throw new Error(result.error || '派发失败');
      }

      console.log('✅ 派发成功:', {
        newStatus: result.newStatus,
        nextStepIndex: result.nextStepIndex,
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
      
      // 🟢 会签模式检查：如果当前步骤是AND模式且不是所有人都已审批，则停留在当前步骤
      let shouldStayAtCurrentStep = false;
      if (hazard.candidateHandlers && hazard.candidateHandlers.length > 0 && hazard.approvalMode === 'AND') {
        // 计算操作后的hasOperated状态
        const updatedCandidates = hazard.candidateHandlers.map(candidate => ({
          ...candidate,
          hasOperated: candidate.userId === user?.id ? true : (candidate.hasOperated || false)
        }));
        
        // 检查是否所有人都已操作
        const allOperated = updatedCandidates.every(c => c.hasOperated);
        
        if (!allOperated) {
          shouldStayAtCurrentStep = true;
          console.log('🟡 会签模式：不是所有人都已审批，停留在当前步骤', {
            candidates: updatedCandidates,
            allOperated
          });
        } else {
          console.log('✅ 会签模式：所有人都已审批，可以流转到下一步', {
            candidates: updatedCandidates
          });
        }
      }
      
      // ========== 使用派发引擎返回的 nextStepIndex，但会签模式可能需要停留 ==========
      let nextStepIndex;
      if (shouldStayAtCurrentStep) {
        // 会签模式且未全部审批：停留在当前步骤
        nextStepIndex = hazard.currentStepIndex ?? 0;
        console.log('🟡 会签未完成，停留在步骤:', nextStepIndex);
      } else {
        // 正常流转：使用派发引擎返回的下一步
        nextStepIndex = result.nextStepIndex ?? (hazard.currentStepIndex ?? 0) + 1;
      }
      
      console.log('📍 派发引擎返回的下一步位置:', {
        nextStepIndex,
        currentStepIndex: hazard.currentStepIndex,
        nextStepId: result.currentStep,
        totalSteps: workflowConfig.steps.length
      });

      // 更新步骤追踪信息
      dispatchedHandlers.currentStepIndex = nextStepIndex;
      dispatchedHandlers.currentStepId = workflowConfig.steps[nextStepIndex]?.id;

      // 🔧 修复：当「提交整改」时，如果当前步骤是「整改」且 dopersonal_ID 未设置，则设置为责任人
      // 处理「开始整改」时 dopersonal_ID 未正确设置的情况
      if (action === 'finish_rectify' && hazard.status === 'rectifying') {
        const currentStep = workflowConfig.steps[hazard.currentStepIndex ?? 0];
        if (currentStep?.id === 'rectify' && !hazard.dopersonal_ID && hazard.responsibleId) {
          dispatchedHandlers.dopersonal_ID = hazard.responsibleId;
          dispatchedHandlers.dopersonal_Name = hazard.responsibleName;
          console.log('🔧 提交整改时发现 dopersonal_ID 未设置，已设置为责任人:', hazard.responsibleName);
        }
      }
      
      // 🟢 会签模式未完成：保持当前处理人不变，只更新candidateHandlers
      if (shouldStayAtCurrentStep) {
        // 保持当前处理人
        dispatchedHandlers.dopersonal_ID = hazard.dopersonal_ID || dispatchedHandlers.dopersonal_ID;
        dispatchedHandlers.dopersonal_Name = hazard.dopersonal_Name || dispatchedHandlers.dopersonal_Name;
        dispatchedHandlers.approvalMode = hazard.approvalMode;
        // candidateHandlers会在后面统一更新
        
        console.log('🟡 会签未完成，保持当前处理人:', {
          dopersonal_ID: dispatchedHandlers.dopersonal_ID,
          dopersonal_Name: dispatchedHandlers.dopersonal_Name
        });
      }
      // 设置下一步的执行人（仅当流转到下一步时）
      else if (nextStepIndex < workflowConfig.steps.length) {
        const nextStep = workflowConfig.steps[nextStepIndex];
        
        console.log('🎯 下一步骤:', {
          index: nextStepIndex,
          id: nextStep.id,
          name: nextStep.name,
          approvalMode: nextStep.handlerStrategy.approvalMode || 'OR'
        });

        // 特殊处理：整改步骤的执行人强制为整改责任人
        if (nextStep.id === 'rectify') {
          dispatchedHandlers.dopersonal_ID = hazard.responsibleId;
          dispatchedHandlers.dopersonal_Name = hazard.responsibleName;
          dispatchedHandlers.candidateHandlers = null; // 清除候选人列表
          dispatchedHandlers.approvalMode = null; // 清除审批模式
          if (hazard.responsibleId) {
            dispatchedHandlers.old_personal_ID = [...(hazard.old_personal_ID || []), hazard.responsibleId];
          }
          console.log('🎯 下一步是整改步骤，执行人设为整改责任人:', hazard.responsibleName);
        } else {
          // 其他步骤：使用派发引擎匹配的处理人
          if (result.handlers.userIds && result.handlers.userIds.length > 0) {
            const approvalMode = nextStep.handlerStrategy.approvalMode || 'OR';
            
            console.log('🎯 设置下一步执行人:', {
              approvalMode,
              handlerCount: result.handlers.userIds.length,
              handlerIds: result.handlers.userIds,
              handlerNames: result.handlers.userNames,
              nextStepId: nextStep.id,
              nextStepName: nextStep.name,
              matchedBy: result.handlers.matchedBy
            });
            
            // 🟢 OR模式或AND模式且有多个处理人：设置candidateHandlers
            if ((approvalMode === 'OR' || approvalMode === 'AND') && result.handlers.userIds.length > 1) {
              dispatchedHandlers.candidateHandlers = result.handlers.userIds.map((id, idx) => ({
                userId: id,
                userName: result.handlers.userNames[idx],
                hasOperated: false
              }));
              dispatchedHandlers.approvalMode = approvalMode; // 保存审批模式
              
              // 同时设置dopersonal_ID为第一个处理人（兼容性）
              dispatchedHandlers.dopersonal_ID = result.handlers.userIds[0];
              dispatchedHandlers.dopersonal_Name = result.handlers.userNames[0];
              
              console.log(`🎯 设置${approvalMode}模式多人处理（${approvalMode === 'OR' ? '或签' : '会签'}）:`, {
                candidateCount: dispatchedHandlers.candidateHandlers.length,
                candidates: dispatchedHandlers.candidateHandlers,
                approvalMode
              });
            } else {
              // 单人模式或CONDITIONAL模式：只设置dopersonal_ID
              const handlerId = result.handlers.userIds[0];
              const handlerName = result.handlers.userNames[0];
              
              dispatchedHandlers.dopersonal_ID = handlerId;
              dispatchedHandlers.dopersonal_Name = handlerName;
              dispatchedHandlers.candidateHandlers = null; // 清除候选人列表
              dispatchedHandlers.approvalMode = null; // 清除审批模式
              
              console.log('🎯 设置单人执行模式:', handlerName, '(ID:', handlerId, ')');
            }
            
            // 将处理人添加到历史经手人
            result.handlers.userIds.forEach(id => {
              if (!dispatchedHandlers.old_personal_ID) {
                dispatchedHandlers.old_personal_ID = [];
              }
              if (!dispatchedHandlers.old_personal_ID.includes(id)) {
                dispatchedHandlers.old_personal_ID.push(id);
              }
            });
            
            // 如果是验收步骤，同时更新验收人字段
            if (nextStep.id === 'verify') {
              dispatchedHandlers.verifierId = result.handlers.userIds[0];
              dispatchedHandlers.verifierName = result.handlers.userNames[0];
            }
          } else {
            console.warn('⚠️ 派发引擎未匹配到处理人', {
              resultHandlers: result.handlers,
              nextStepId: nextStep.id,
              nextStepName: nextStep.name
            });
          }
        }
      } else {
        // 已经是最后一步，流程结束
        dispatchedHandlers.dopersonal_ID = null;
        dispatchedHandlers.dopersonal_Name = null;
        dispatchedHandlers.candidateHandlers = null;
        dispatchedHandlers.approvalMode = null;
        console.log('✅ 已到达最后一步，流程结束');
      }

      // 🔧 修复：将当前操作人、抄送人都添加到历史经手人数组
      const currentOldPersonalIds = dispatchedHandlers.old_personal_ID || hazard.old_personal_ID || [];
      const allOldPersonalIds = [
        ...new Set([
          ...currentOldPersonalIds,
          ...result.ccUsers.userIds,
          // ✅ 关键修复：添加当前操作人ID，确保审核人能继续看到隐患
          ...(user?.id ? [user.id] : [])
        ])
      ];

      console.log('📝 更新历史经手人列表:', {
        当前操作人: user?.id,
        原历史列表: currentOldPersonalIds,
        新增抄送人: result.ccUsers.userIds,
        最终历史列表: allOldPersonalIds
      });

      // 🟢 会签模式未完成时，保持当前状态
      const finalStatus = shouldStayAtCurrentStep ? hazard.status : result.newStatus;

      // 构建更新数据：派发引擎结果 > payload 中的其他数据
      const updates: any = {
        operatorId: user?.id,
        operatorName: user?.name,
        status: finalStatus,
        actionName: result.log.action,
        logs: [result.log, ...(hazard.logs || [])],
        ccUsers: result.ccUsers.userIds,
        ccUserNames: result.ccUsers.userNames,
        // 先合并 payload 中的其他数据（如 deadline、rectifyRequirement、photos 等）
        ...payload,
        // 最后覆盖派发引擎匹配的处理人（确保优先级最高）
        ...dispatchedHandlers,
        // ✅ 更新历史经手人数组（包含当前操作人、处理人和抄送人）
        old_personal_ID: allOldPersonalIds
      };
      
      // 🟢 处理候选处理人（或签/会签模式）
      if (hazard.candidateHandlers && hazard.candidateHandlers.length > 0) {
        if (shouldStayAtCurrentStep) {
          // 会签模式未完成：更新candidateHandlers的hasOperated状态
          updates.candidateHandlers = hazard.candidateHandlers.map(candidate => ({
            ...candidate,
            hasOperated: candidate.userId === user?.id ? true : candidate.hasOperated
          }));
          
          console.log('🟡 会签未完成，更新候选人状态:', {
            operatorId: user?.id,
            operatorName: user?.name,
            candidateHandlers: updates.candidateHandlers
          });
        } else if (hazard.approvalMode === 'OR') {
          // OR模式已完成流转：清除旧的candidateHandlers，使用dispatchedHandlers中的新值
          // dispatchedHandlers已经设置了下一步的candidateHandlers（如果下一步也是多人模式）
          // 或者已经清除了candidateHandlers（如果下一步是单人模式）
          console.log('✅ 或签已完成，流转到下一步，candidateHandlers由dispatchedHandlers控制');
        }
        
        // 🟢 生成会签/或签进度通知（仅当停留在当前步骤时）
        if (shouldStayAtCurrentStep && hazard.approvalMode && (hazard.approvalMode === 'OR' || hazard.approvalMode === 'AND')) {
          const { HazardNotificationService } = await import('@/services/hazardNotification.service');
          const progressNotifications = HazardNotificationService.generateApprovalProgressNotifications({
            hazard,
            candidateHandlers: updates.candidateHandlers,
            operatorId: user?.id,
            operatorName: user?.name || '未知用户',
            approvalMode: hazard.approvalMode
          });
          
          // 将进度通知添加到通知列表
          if (progressNotifications.length > 0) {
            result.notifications.push(...progressNotifications);
            console.log(`📬 已添加 ${progressNotifications.length} 条${hazard.approvalMode === 'AND' ? '会签' : '或签'}进度通知`);
          }
        }
      }

      console.log('📦 准备更新的数据:', {
        action,
        payload,
        dispatchedHandlers,
        finalUpdates: updates,
        dopersonal_ID: updates.dopersonal_ID,
        dopersonal_Name: updates.dopersonal_Name,
        责任人字段: {
          responsibleId: updates.responsibleId,
          responsibleName: updates.responsibleName,
          responsibleDeptId: updates.responsibleDeptId,
          responsibleDeptName: updates.responsibleDeptName
        }
      });

      // 🔒 将通知数据一起发送到更新API，确保在同一事务中创建
      const updatePayload: any = { id: hazard.id, ...updates };
      if (result.notifications && result.notifications.length > 0) {
        updatePayload.notifications = result.notifications;
      }

      // 🟢 修复：将 candidateHandlers 传递到 dispatchResult 中，以便 API 更新关联表
      if (dispatchedHandlers.candidateHandlers && Array.isArray(dispatchedHandlers.candidateHandlers) && dispatchedHandlers.candidateHandlers.length > 0) {
        updatePayload.dispatchResult = {
          candidateHandlers: dispatchedHandlers.candidateHandlers.map((ch: any) => ({
            userId: ch.userId,
            userName: ch.userName,
            stepIndex: dispatchedHandlers.currentStepIndex ?? nextStepIndex,
            stepId: dispatchedHandlers.currentStepId || undefined
          }))
        };
        console.log('🟢 已添加 dispatchResult.candidateHandlers 到更新载荷:', updatePayload.dispatchResult);
      }

      // 更新隐患状态（包含通知创建，在同一事务中）
      await hazardService.updateHazard(updatePayload);

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
        
        // 获取当前步骤和下一步骤信息
        const currentStepObj = workflowConfig.steps[hazard.currentStepIndex ?? 0];
        const nextStepObj = workflowConfig.steps[nextStepIndex];
        
        // 构建快照数据
        const snapshot = {
          action: result.log.action,
          operatorName: user?.name,
          operatedAt: new Date().toISOString(),
          hazardCode: hazard.code,
          hazardDesc: hazard.desc,
          currentStep: currentStepObj?.name || '未知步骤',
          nextStep: nextStepObj?.name || '流程结束',
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

        await apiFetch('/api/logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: logAction,
            targetType: 'hazard',
            targetId: hazard.id,
            userId: user?.id || 'system',
            userName: user?.name || '系统',
            details: `${result.log.action}：${hazard.code} - ${hazard.desc?.substring(0, 50)}`,
            snapshot,
          })
        });

        console.log('📝 已记录系统日志，包含派发快照');
      } catch (logError) {
        console.error('❌ 记录系统日志失败（不影响主流程）:', logError);
      }

      // 🔒 通知已在更新API的事务中创建，无需单独调用
      if (result.notifications && result.notifications.length > 0) {
        console.log(`✅ 已通过事务创建 ${result.notifications.length} 条通知`);
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
