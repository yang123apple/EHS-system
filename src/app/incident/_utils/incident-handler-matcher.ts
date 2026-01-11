/**
 * 事故处理人匹配工具
 * 根据工作流配置的策略匹配合适的处理人
 */

import { IncidentWorkflowStep } from './workflow-config';
import type { Incident } from '@/types/incident';

/**
 * 简单用户类型
 */
export interface SimpleUser {
  id: string;
  name: string;
  role?: string;
  departmentId?: string | null;
}

/**
 * 简单部门类型
 */
export interface SimpleDepartment {
  id: string;
  name: string;
  parentId?: string | null;
}

/**
 * 匹配处理人
 */
export async function matchIncidentHandler(params: {
  incident: Incident;
  step: IncidentWorkflowStep;
  allUsers: SimpleUser[];
  departments: SimpleDepartment[];
}): Promise<{
  success: boolean;
  userIds: string[];
  userNames: string[];
  matchedBy?: string;
  error?: string;
}> {
  const { incident, step, allUsers, departments } = params;
  
  if (!step?.handlerStrategy) {
    return {
      success: false,
      userIds: [],
      userNames: [],
      error: '步骤缺少处理人策略配置'
    };
  }

  const strategy = step.handlerStrategy.type;

  try {
    const handlers = matchHandlerInternal(strategy, incident, allUsers, departments, step.handlerStrategy);
    
    if (!handlers || handlers.length === 0) {
      return {
        success: false,
        userIds: [],
        userNames: [],
        error: `未找到符合策略"${strategy}"的处理人`
      };
    }

    return {
      success: true,
      userIds: handlers.map(h => h.id),
      userNames: handlers.map(h => h.name),
      matchedBy: strategy
    };
  } catch (error) {
    console.error('[事故处理人匹配] 匹配失败:', error);
    return {
      success: false,
      userIds: [],
      userNames: [],
      error: error instanceof Error ? error.message : '未知错误'
    };
  }
}

/**
 * 内部函数：根据策略匹配处理人
 */
function matchHandlerInternal(
  strategy: string,
  incident: Incident,
  allUsers: SimpleUser[],
  departments: SimpleDepartment[],
  config?: any
): SimpleUser[] {
  console.log('[事故处理人匹配] 开始匹配:', {
    strategy,
    incidentId: incident.id,
    departmentId: incident.departmentId,
  });

  switch (strategy) {
    case 'fixed':
      // 固定用户
      if (config?.userId) {
        const user = allUsers.find(u => u.id === config.userId);
        return user ? [user] : [];
      }
      return [];

    case 'reporter':
      // 上报人
      if (incident.reporterId) {
        const user = allUsers.find(u => u.id === incident.reporterId);
        return user ? [user] : [];
      }
      return [];

    case 'department_manager':
      // 责任部门经理
      if (incident.departmentId) {
        const dept = departments.find(d => d.id === incident.departmentId);
        if (dept) {
          // 查找该部门的经理（role包含'manager'或'主管'）
          const managers = allUsers.filter(u => 
            u.departmentId === incident.departmentId && 
            (u.role === 'manager' || u.role === 'admin' || (u.role && u.role.includes('主管')))
          );
          return managers.length > 0 ? managers : [];
        }
      }
      return [];

    case 'role':
      // 按角色匹配
      if (config?.value) {
        const roleUsers = allUsers.filter(u => u.role === config.value);
        return roleUsers;
      }
      return [];

    default:
      console.warn(`[事故处理人匹配] 未知策略: ${strategy}`);
      return [];
  }
}

