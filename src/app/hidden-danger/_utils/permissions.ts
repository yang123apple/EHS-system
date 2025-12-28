// src/app/hidden-danger/_utils/permissions.ts
import { HazardRecord } from '@/types/hidden-danger';

/**
 * 检查用户是否可以查看隐患详情
 */
export function canViewHazard(hazard: HazardRecord, user: any): boolean {
  if (!user) return false;
  
  // Admin 可以查看所有
  if (user.role === 'admin') return true;
  
  // 历史经手人可以查看（包括所有处理人和抄送人）
  if (hazard.old_personal_ID?.includes(user.id)) return true;
  
  // 上报人可以查看
  if (hazard.reporterId === user.id) return true;
  
  // 当前步骤执行人可以查看
  if (hazard.dopersonal_ID === user.id) return true;
  
  // 整改责任人可以查看（保留，用于历史查看）
  if (hazard.responsibleId === user.id) return true;
  
  // 抄送人员可以查看
  if (hazard.ccUsers?.includes(user.id)) return true;
  
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
 */
export function canRectifyHazard(hazard: HazardRecord, user: any): boolean {
  if (!user) return false;
  
  // 只有当前步骤执行人可以整改
  if (hazard.dopersonal_ID === user.id) return true;
  
  // Admin 也可以代为整改
  if (user.role === 'admin') return true;
  
  return false;
}

/**
 * 检查用户是否可以验收隐患
 */
export function canVerifyHazard(hazard: HazardRecord, user: any): boolean {
  if (!user) return false;
  
  // 只有当前步骤执行人可以验收
  if (hazard.dopersonal_ID === user.id) return true;
  
  // Admin 也可以代为验收
  if (user.role === 'admin') return true;
  
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
  if (hazard.dopersonal_ID === user.id) return true;
  
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
 */
export function canRejectRectify(hazard: HazardRecord, user: any): boolean {
  if (!user) return false;
  
  // 只有在整改中状态才能驳回
  if (hazard.status !== 'rectifying') return false;
  
  // 只有当前步骤执行人可以驳回
  if (hazard.dopersonal_ID === user.id) return true;
  
  // Admin 也可以驳回
  if (user.role === 'admin') return true;
  
  return false;
}
