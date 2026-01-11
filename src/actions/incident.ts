'use server';

/**
 * 事故事件管理 Server Actions
 * 处理事故相关的所有服务端操作，包括权限验证和错误处理
 */

import { IncidentService, type IncidentCreateInput, type IncidentUpdateInput, type InvestigationSubmitInput } from '@/services/incident.service';
import { PermissionManager, type User } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';

/**
 * Server Action 响应类型
 */
type ActionResponse<T = void> = {
  success: boolean;
  message?: string;
  error?: string;
  data?: T;
};

/**
 * 上报事故
 * 
 * @param input - 事故上报数据
 * @param operatorId - 操作人ID（从session获取）
 * @returns 操作结果
 */
export async function reportIncident(
  input: IncidentCreateInput,
  operatorId: string
): Promise<ActionResponse<{ id: string; code: string }>> {
  try {
    // 1. 权限验证
    const operator = await prisma.user.findUnique({
      where: { id: operatorId },
      include: { department: true }
    });

    if (!operator) {
      return {
        success: false,
        error: '未授权：请先登录'
      };
    }

    // 转换为 User 类型
    const user: User = {
      id: operator.id,
      name: operator.name,
      role: operator.role as 'admin' | 'user',
      departmentName: operator.department?.name,
      departmentId: operator.departmentId || undefined,
      jobTitle: operator.jobTitle || undefined,
      permissions: typeof operator.permissions === 'string' 
        ? JSON.parse(operator.permissions) 
        : operator.permissions || {},
    };

    // 检查是否有上报权限（所有登录用户都可以上报）
    // 如果需要更严格的权限控制，可以添加：
    // if (!PermissionManager.hasPermission(user, 'incident', 'report')) {
    //   return { success: false, error: '权限不足' };
    // }

    // 2. 数据验证
    if (!input.type || !input.severity || !input.occurredAt || !input.location || !input.description) {
      return {
        success: false,
        error: '请填写完整的事故信息'
      };
    }

    // 3. 调用服务层
    const incident = await IncidentService.reportIncident(input, user);

    return {
      success: true,
      message: '事故上报成功',
      data: {
        id: incident.id,
        code: incident.code || ''
      }
    };
  } catch (error) {
    console.error('[reportIncident] 上报事故失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '上报失败，请稍后重试'
    };
  }
}

/**
 * 更新事故信息
 * 
 * @param incidentId - 事故ID
 * @param input - 更新数据
 * @param operatorId - 操作人ID
 * @returns 操作结果
 */
export async function updateIncident(
  incidentId: string,
  input: IncidentUpdateInput,
  operatorId: string
): Promise<ActionResponse> {
  try {
    // 1. 权限验证
    const operator = await prisma.user.findUnique({
      where: { id: operatorId },
      include: { department: true }
    });

    if (!operator) {
      return {
        success: false,
        error: '未授权：请先登录'
      };
    }

    // 转换为 User 类型
    const user: User = {
      id: operator.id,
      name: operator.name,
      role: operator.role as 'admin' | 'user',
      departmentName: operator.department?.name,
      departmentId: operator.departmentId || undefined,
      jobTitle: operator.jobTitle || undefined,
      permissions: typeof operator.permissions === 'string' 
        ? JSON.parse(operator.permissions) 
        : operator.permissions || {},
    };

    // 检查权限（只有管理员或事故上报人可以更新）
    const incident = await prisma.incident.findUnique({
      where: { id: incidentId }
    });

    if (!incident) {
      return {
        success: false,
        error: '事故不存在'
      };
    }

    if (user.role !== 'admin' && incident.reporterId !== operatorId) {
      return {
        success: false,
        error: '权限不足：只有管理员或上报人可以更新事故信息'
      };
    }

    // 2. 调用服务层
    await IncidentService.updateIncident(incidentId, input, user);

    return {
      success: true,
      message: '更新成功'
    };
  } catch (error) {
    console.error('[updateIncident] 更新事故失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '更新失败，请稍后重试'
    };
  }
}

/**
 * 提交调查报告
 * 
 * @param incidentId - 事故ID
 * @param input - 调查数据
 * @param operatorId - 操作人ID
 * @returns 操作结果
 */
export async function submitInvestigation(
  incidentId: string,
  input: InvestigationSubmitInput,
  operatorId: string
): Promise<ActionResponse> {
  try {
    // 1. 权限验证
    const operator = await prisma.user.findUnique({
      where: { id: operatorId },
      include: { department: true }
    });

    if (!operator) {
      return {
        success: false,
        error: '未授权：请先登录'
      };
    }

    // 转换为 User 类型
    const user: User = {
      id: operator.id,
      name: operator.name,
      role: operator.role as 'admin' | 'user',
      departmentName: operator.department?.name,
      departmentId: operator.departmentId || undefined,
      jobTitle: operator.jobTitle || undefined,
      permissions: typeof operator.permissions === 'string' 
        ? JSON.parse(operator.permissions) 
        : operator.permissions || {},
    };

    // 检查权限（只有管理员可以提交调查报告）
    if (user.role !== 'admin') {
      return {
        success: false,
        error: '权限不足：只有管理员可以提交调查报告'
      };
    }

    // 2. 数据验证
    if (!input.directCause || !input.indirectCause || !input.managementCause || !input.rootCause) {
      return {
        success: false,
        error: '请填写完整的调查信息（直接原因、间接原因、管理原因、根本原因）'
      };
    }

    if (!input.correctiveActions || input.correctiveActions.length === 0) {
      return {
        success: false,
        error: '请至少添加一条纠正措施'
      };
    }

    if (!input.actionDeadline || !input.actionResponsibleId) {
      return {
        success: false,
        error: '请设置整改期限和负责人'
      };
    }

    // 3. 调用服务层（input 已经包含了 signature 字段，如果提供的话）
    await IncidentService.submitInvestigation(incidentId, input, user);

    return {
      success: true,
      message: '调查报告提交成功，等待审批'
    };
  } catch (error) {
    console.error('[submitInvestigation] 提交调查报告失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '提交失败，请稍后重试'
    };
  }
}

/**
 * 结案事故
 * 
 * @param incidentId - 事故ID
 * @param closeReason - 结案原因
 * @param operatorId - 操作人ID
 * @returns 操作结果
 */
export async function closeIncident(
  incidentId: string,
  closeReason: string,
  operatorId: string
): Promise<ActionResponse> {
  try {
    // 1. 权限验证
    const operator = await prisma.user.findUnique({
      where: { id: operatorId },
      include: { department: true }
    });

    if (!operator) {
      return {
        success: false,
        error: '未授权：请先登录'
      };
    }

    // 转换为 User 类型
    const user: User = {
      id: operator.id,
      name: operator.name,
      role: operator.role as 'admin' | 'user',
      departmentName: operator.department?.name,
      departmentId: operator.departmentId || undefined,
      jobTitle: operator.jobTitle || undefined,
      permissions: typeof operator.permissions === 'string' 
        ? JSON.parse(operator.permissions) 
        : operator.permissions || {},
    };

    // 只有管理员可以结案
    if (user.role !== 'admin') {
      return {
        success: false,
        error: '权限不足：只有管理员可以结案事故'
      };
    }

    // 2. 数据验证
    if (!closeReason || closeReason.trim().length === 0) {
      return {
        success: false,
        error: '请填写结案原因'
      };
    }

    // 3. 调用服务层
    await IncidentService.closeIncident(incidentId, closeReason, user);

    return {
      success: true,
      message: '事故已结案'
    };
  } catch (error) {
    console.error('[closeIncident] 结案事故失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '结案失败，请稍后重试'
    };
  }
}

/**
 * 获取事故列表（Server Action版本，用于服务端组件）
 */
export async function getIncidents(filters?: {
  status?: string;
  type?: string;
  severity?: string;
  departmentId?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}) {
  try {
    return await IncidentService.getIncidents(filters);
  } catch (error) {
    console.error('[getIncidents] 获取事故列表失败:', error);
    throw error;
  }
}

/**
 * 获取单个事故详情（Server Action版本）
 */
export async function getIncidentById(incidentId: string) {
  try {
    const incident = await IncidentService.getIncidentById(incidentId);
    if (!incident) {
      throw new Error('事故不存在');
    }
    return incident;
  } catch (error) {
    console.error('[getIncidentById] 获取事故详情失败:', error);
    throw error;
  }
}

