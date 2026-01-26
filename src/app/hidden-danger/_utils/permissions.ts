// src/app/hidden-danger/_utils/permissions.ts
import { HazardRecord } from '@/types/hidden-danger';
import { HAZARD_STATUS, APPROVAL_MODE } from '@/lib/business-constants';
import type { StepHandlerResult } from '@/services/hazardHandlerResolver.service';
import { apiFetch } from '@/lib/apiClient';

/**
 * 🚀 从 HazardWorkflowStep 表读取当前步骤信息（用于权限检查）
 * 
 * 这是一个异步函数，用于从 API 读取当前步骤的处理人信息
 * 建议在组件加载时调用，然后将步骤信息传递给权限检查函数
 * 
 * @param hazardId 隐患ID
 * @param stepIndex 当前步骤索引
 * @returns 步骤信息，如果不存在则返回 null
 */
export async function getCurrentStepInfoForPermission(
  hazardId: string,
  stepIndex?: number | null
): Promise<StepHandlerResult | null> {
  try {
    // 如果没有提供 stepIndex，返回 null
    if (stepIndex === undefined || stepIndex === null) {
      return null;
    }
    
    // 通过 API 调用获取步骤信息（客户端使用，须带鉴权避免 401）
    const response = await apiFetch(`/api/hazards/${hazardId}/workflow-step?stepIndex=${stepIndex}`);
    
    if (!response.ok) {
      console.warn('[权限检查] 获取步骤信息失败:', response.status);
      return null;
    }
    
    const data = await response.json();
    
    if (data.success && data.step) {
      return data.step;
    }
    
    return null;
  } catch (error) {
    console.error('[权限检查] 读取步骤信息失败:', error);
    return null;
  }
}

/**
 * 检查用户是否可以查看隐患详情
 */
export function canViewHazard(hazard: HazardRecord, user: any): boolean {
  if (!user) return false;

  // Admin 可以查看所有
  if (user.role === 'admin') return true;

  // 历史经手人可以查看（包括所有处理人和抄送人）
  // ✅ 优先使用新字段名，向后兼容旧字段名
  const historicalHandlers = hazard.historicalHandlerIds || hazard.old_personal_ID;
  if (historicalHandlers?.includes(user.id)) return true;

  // 上报人可以查看
  if (hazard.reporterId === user.id) return true;

  // 当前步骤执行人可以查看
  // ✅ 优先使用新字段名，向后兼容旧字段名
  const currentExecutorId = hazard.currentExecutorId || hazard.dopersonal_ID;
  if (currentExecutorId === user.id) return true;

  // 整改责任人可以查看（保留，用于历史查看）
  // ✅ 优先使用新字段名，向后兼容旧字段名
  const rectificationLeaderId = hazard.rectificationLeaderId || hazard.responsibleId;
  if (rectificationLeaderId === user.id) return true;

  // 🟢 候选处理人可以查看（或签/会签模式）
  if (hazard.candidateHandlers && hazard.candidateHandlers.length > 0) {
    const isCandidate = hazard.candidateHandlers.some(h => h.userId === user.id);
    if (isCandidate) return true;
  }

  // 抄送人员可以查看
  // ✅ 优先使用新字段名，向后兼容旧字段名
  const ccUserIds = hazard.ccUserIds || hazard.ccUsers;
  if (ccUserIds?.includes(user.id)) return true;

  // 验收人可以查看
  if (hazard.verifierId === user.id) return true;

  return false;
}

/**
 * 检查用户是否可以指派隐患
 */
export function canAssignHazard(hazard: HazardRecord, user: any): boolean {
  if (!user) return false;
  
  // Admin 可以指派
  if (user.role === 'admin') return true;
  
  // 拥有 assign 权限的用户可以指派
  if (user.permissions?.['hidden_danger']?.includes('assign')) return true;
  
  return false;
}

/**
 * 检查用户是否可以开始/提交整改
 * 
 * 🚀 优化：支持从 HazardWorkflowStep 表读取处理人信息（推荐）
 * 如果提供了 currentStepInfo，则从步骤信息读取；否则从 hazard 对象读取（向后兼容）
 * 
 * @param hazard 隐患记录
 * @param user 用户信息
 * @param currentStepInfo 当前步骤信息（可选，从 HazardWorkflowStep 表读取）
 * @returns 是否有权限
 */
export function canRectifyHazard(
  hazard: HazardRecord, 
  user: any,
  currentStepInfo?: StepHandlerResult | null
): boolean {
  if (!user) return false;
  
  // Admin 可以代为整改
  if (user.role === 'admin') return true;
  
  // 🚀 优化：如果提供了步骤信息，从步骤信息读取处理人（从表读取，更可靠）
  if (currentStepInfo) {
    const { handlers, approvalMode, candidateHandlers } = currentStepInfo;
    
    // 多人模式：检查是否在候选处理人列表中
    if (candidateHandlers && candidateHandlers.length > 0 && approvalMode) {
      // 注意：这里需要从 HazardCandidateHandler 表读取 hasOperated 状态
      // 但为了保持函数同步，我们暂时从 hazard.candidateHandlers 读取
      // 如果需要完整的 hasOperated 状态，应该使用异步版本
      if (approvalMode === APPROVAL_MODE.OR) {
        // OR模式（或签）：检查是否已有人操作（需要从表读取）
        const someoneOperated = hazard.candidateHandlers?.some(h => h.hasOperated) || false;
        if (someoneOperated) {
          return false;
        }
      } else if (approvalMode === APPROVAL_MODE.AND) {
        // AND模式（会签）：检查当前用户是否已操作
        const currentUserHandler = hazard.candidateHandlers?.find(h => h.userId === user.id);
        if (currentUserHandler && currentUserHandler.hasOperated) {
          return false;
        }
      }
      
      // 检查当前用户是否在候选人列表中
      const isCandidate = candidateHandlers.some(h => h.userId === user.id);
      if (isCandidate) return true;
    }
    
    // 单人模式：检查当前用户是否在处理人列表中
    if (handlers.userIds && handlers.userIds.length > 0) {
      if (handlers.userIds.includes(user.id)) return true;
    }
    
    // 🔧 责任人兜底：当前步骤为「提交整改」且匹配策略为责任人时，若 handlers 为空或未包含用户
    // （如责任人未在 allUsers、匹配失败等），仍允许责任人操作，与后端 PATCH 逻辑一致
    // ✅ 优先使用新字段名，向后兼容旧字段名
    const rectificationLeaderId = hazard.rectificationLeaderId || hazard.responsibleId;
    if (hazard.status === HAZARD_STATUS.RECTIFYING && rectificationLeaderId === user.id) {
      return true;
    }
    
    // 如果没有匹配到，返回 false
    return false;
  }
  
  // 向后兼容：从 hazard 对象读取（原有逻辑）
  // 🟢 多人模式：检查是否在候选处理人列表中（必须同时有approvalMode才生效）
  if (hazard.candidateHandlers && hazard.candidateHandlers.length > 0 && hazard.approvalMode) {
    const approvalMode = hazard.approvalMode;
    
    if (approvalMode === APPROVAL_MODE.OR) {
      // OR模式（或签）：任何一人操作后，其他人不能再操作
      const someoneOperated = hazard.candidateHandlers.some(h => h.hasOperated);
      if (someoneOperated) {
        return false;
      }
    } else if (approvalMode === APPROVAL_MODE.AND) {
      // AND模式（会签）：每个人都可以操作，但只能操作一次
      const currentUserHandler = hazard.candidateHandlers.find(h => h.userId === user.id);
      if (currentUserHandler && currentUserHandler.hasOperated) {
        return false; // 当前用户已操作过
      }
    }
    
    // 检查当前用户是否在候选人列表中
    const isCandidate = hazard.candidateHandlers.some(h => h.userId === user.id);
    if (isCandidate) return true;
  }
  
  // 单人模式：只有当前步骤执行人可以整改
  // ✅ 优先使用新字段名，向后兼容旧字段名
  const currentExecutorId = hazard.currentExecutorId || hazard.dopersonal_ID;
  if (currentExecutorId === user.id) return true;

  // 🔧 责任人兜底（无步骤信息时）：整改中且为责任人则允许，与后端逻辑一致
  // ✅ 优先使用新字段名，向后兼容旧字段名
  const rectificationLeaderId = hazard.rectificationLeaderId || hazard.responsibleId;
  if (hazard.status === HAZARD_STATUS.RECTIFYING && rectificationLeaderId === user.id) return true;
  
  return false;
}

/**
 * 检查用户是否可以验收隐患
 * 
 * 🚀 优化：支持从 HazardWorkflowStep 表读取处理人信息（推荐）
 * 如果提供了 currentStepInfo，则从步骤信息读取；否则从 hazard 对象读取（向后兼容）
 * 
 * @param hazard 隐患记录
 * @param user 用户信息
 * @param currentStepInfo 当前步骤信息（可选，从 HazardWorkflowStep 表读取）
 * @returns 是否有权限
 */
export function canVerifyHazard(
  hazard: HazardRecord, 
  user: any,
  currentStepInfo?: StepHandlerResult | null
): boolean {
  if (!user) return false;
  
  // Admin 可以代为验收
  if (user.role === 'admin') return true;
  
  // 🚀 优化：如果提供了步骤信息，从步骤信息读取处理人（从表读取，更可靠）
  if (currentStepInfo) {
    const { handlers, approvalMode, candidateHandlers } = currentStepInfo;
    
    // 多人模式：检查是否在候选处理人列表中
    if (candidateHandlers && candidateHandlers.length > 0 && approvalMode) {
      // 注意：这里需要从 HazardCandidateHandler 表读取 hasOperated 状态
      // 但为了保持函数同步，我们暂时从 hazard.candidateHandlers 读取
      if (approvalMode === APPROVAL_MODE.OR) {
        // OR模式（或签）：检查是否已有人操作
        const someoneOperated = hazard.candidateHandlers?.some(h => h.hasOperated) || false;
        if (someoneOperated) {
          return false;
        }
      } else if (approvalMode === APPROVAL_MODE.AND) {
        // AND模式（会签）：检查当前用户是否已操作
        const currentUserHandler = hazard.candidateHandlers?.find(h => h.userId === user.id);
        if (currentUserHandler && currentUserHandler.hasOperated) {
          return false;
        }
      }
      
      // 检查当前用户是否在候选人列表中
      const isCandidate = candidateHandlers.some(h => h.userId === user.id);
      if (isCandidate) return true;
    }
    
    // 单人模式：检查当前用户是否在处理人列表中
    if (handlers.userIds && handlers.userIds.length > 0) {
      if (handlers.userIds.includes(user.id)) return true;
    }
    
    // 如果没有匹配到，返回 false
    return false;
  }
  
  // 向后兼容：从 hazard 对象读取（原有逻辑）
  // 🟢 多人模式：检查是否在候选处理人列表中（必须同时有approvalMode才生效）
  if (hazard.candidateHandlers && hazard.candidateHandlers.length > 0 && hazard.approvalMode) {
    const approvalMode = hazard.approvalMode;
    
    if (approvalMode === APPROVAL_MODE.OR) {
      // OR模式（或签）：任何一人操作后，其他人不能再操作
      const someoneOperated = hazard.candidateHandlers.some(h => h.hasOperated);
      if (someoneOperated) {
        return false;
      }
    } else if (approvalMode === APPROVAL_MODE.AND) {
      // AND模式（会签）：每个人都可以操作，但只能操作一次
      const currentUserHandler = hazard.candidateHandlers.find(h => h.userId === user.id);
      if (currentUserHandler && currentUserHandler.hasOperated) {
        return false; // 当前用户已操作过
      }
    }
    
    // 检查当前用户是否在候选人列表中
    const isCandidate = hazard.candidateHandlers.some(h => h.userId === user.id);
    if (isCandidate) return true;
  }
  
  // 单人模式：只有当前步骤执行人可以验收
  // ✅ 优先使用新字段名，向后兼容旧字段名
  const currentExecutorId = hazard.currentExecutorId || hazard.dopersonal_ID;
  if (currentExecutorId === user.id) return true;
  
  return false;
}

/**
 * 检查用户是否可以删除隐患
 */
export function canDeleteHazard(hazard: HazardRecord, user: any): boolean {
  if (!user) return false;
  
  // 只有 Admin 或拥有 delete 权限的用户可以删除
  if (user.role === 'admin') return true;
  if (user.permissions?.['hidden_danger']?.includes('delete')) return true;
  
  return false;
}

/**
 * 检查用户是否可以申请延期
 */
export function canRequestExtension(hazard: HazardRecord, user: any): boolean {
  if (!user) return false;

  // 只有当前步骤执行人可以申请延期
  // ✅ 优先使用新字段名，向后兼容旧字段名
  const currentExecutorId = hazard.currentExecutorId || hazard.dopersonal_ID;
  if (currentExecutorId === user.id) return true;

  return false;
}

/**
 * 检查用户是否可以批准延期
 */
export function canApproveExtension(hazard: HazardRecord, user: any): boolean {
  if (!user) return false;
  
  // Admin 可以批准
  if (user.role === 'admin') return true;
  
  // 拥有 assign 权限的管理人员可以批准
  if (user.permissions?.['hidden_danger']?.includes('assign')) return true;
  
  return false;
}

/**
 * 检查用户是否可以驳回整改（责任人驳回）
 * 
 * 🚀 优化：支持从 HazardWorkflowStep 表读取处理人信息（推荐）
 * 如果提供了 currentStepInfo，则从步骤信息读取；否则从 hazard 对象读取（向后兼容）
 * 
 * @param hazard 隐患记录
 * @param user 用户信息
 * @param currentStepInfo 当前步骤信息（可选，从 HazardWorkflowStep 表读取）
 * @returns 是否有权限
 */
export function canRejectRectify(
  hazard: HazardRecord, 
  user: any,
  currentStepInfo?: StepHandlerResult | null
): boolean {
  if (!user) return false;
  
  // 只有在整改中状态才能驳回（使用常量，避免硬编码）
  if (hazard.status !== HAZARD_STATUS.RECTIFYING) return false;
  
  // Admin 可以驳回
  if (user.role === 'admin') return true;
  
  // 🚀 优化：如果提供了步骤信息，从步骤信息读取处理人（从表读取，更可靠）
  if (currentStepInfo) {
    const { handlers, candidateHandlers } = currentStepInfo;
    
    // 多人模式：检查是否在候选处理人列表中
    if (candidateHandlers && candidateHandlers.length > 0) {
      // 检查是否已有人操作（需要从表读取）
      const someoneOperated = hazard.candidateHandlers?.some(h => h.hasOperated) || false;
      if (someoneOperated) {
        return false;
      }
      
      const isCandidate = candidateHandlers.some(h => h.userId === user.id);
      if (isCandidate) return true;
    }
    
    // 单人模式：检查当前用户是否在处理人列表中
    if (handlers.userIds && handlers.userIds.length > 0) {
      if (handlers.userIds.includes(user.id)) return true;
    }
    
    // 如果没有匹配到，返回 false
    return false;
  }
  
  // 向后兼容：从 hazard 对象读取（原有逻辑）
  // 🟢 或签模式：检查是否在候选处理人列表中
  if (hazard.candidateHandlers && hazard.candidateHandlers.length > 0) {
    // 检查是否已有人操作
    const someoneOperated = hazard.candidateHandlers.some(h => h.hasOperated);
    if (someoneOperated) {
      return false;
    }
    
    const isCandidate = hazard.candidateHandlers.some(h => h.userId === user.id);
    if (isCandidate) return true;
  }
  
  // 单人模式：只有当前步骤执行人可以驳回
  // ✅ 优先使用新字段名，向后兼容旧字段名
  const currentExecutorId = hazard.currentExecutorId || hazard.dopersonal_ID;
  if (currentExecutorId === user.id) return true;
  
  return false;
}
