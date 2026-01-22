/**
 * 隐患处理人解析服务
 * 
 * 统一的处理人推测逻辑，确保新建隐患预测和实际流转时的处理人完全一致
 * 
 * 使用场景：
 * 1. 前端新建隐患时的流程预览（predictWorkflow）
 * 2. 后端隐患流转时的实际执行人匹配（HazardDispatchEngine）
 * 3. 任何需要获取隐患各步骤执行人的场景
 */

import { matchHandler } from '@/app/hidden-danger/_utils/handler-matcher';
import { matchAllCCRules } from '@/app/hidden-danger/_utils/cc-matcher';
import type { 
  HazardRecord, 
  HazardWorkflowStep,
  SimpleUser 
} from '@/types/hidden-danger';
import type { Department } from '@/utils/departmentUtils';

/**
 * 步骤处理人解析结果
 */
export interface StepHandlerResult {
  stepIndex: number;
  stepId: string;
  stepName: string;
  success: boolean;
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
  error?: string;
  // 候选处理人信息（用于或签/会签模式）
  candidateHandlers?: Array<{
    userId: string;
    userName: string;
  }>;
  // 审批模式
  approvalMode?: 'OR' | 'AND';
}

/**
 * 完整工作流解析结果
 */
export interface WorkflowResolutionResult {
  success: boolean;
  steps: StepHandlerResult[];
  error?: string;
}

/**
 * 解析上下文
 */
export interface ResolutionContext {
  // 隐患数据（可以是实际隐患或模拟隐患）
  hazard: Partial<HazardRecord> & {
    id?: string;
    code?: string;
    type: string;
    location: string;
    riskLevel?: string;
    reporterId?: string;
    reporterName?: string;
    reporterDepartmentId?: string;
    responsibleId?: string;
    responsibleName?: string;
    responsibleDeptId?: string;
    assignedDepartmentId?: string;
    status?: string;
  };
  // 工作流步骤配置
  workflowSteps: HazardWorkflowStep[];
  // 所有用户
  allUsers: SimpleUser[];
  // 部门数据
  departments: Department[];
  // 当前上报人（可选，用于抄送规则匹配）
  reporter?: SimpleUser;
}

/**
 * 隐患处理人解析服务
 */
export class HazardHandlerResolverService {
  /**
   * 解析整个工作流的所有步骤处理人
   * 
   * 这是统一的核心方法，前端预测和后端流转都应该使用此方法
   * 
   * @param context 解析上下文
   * @returns 工作流解析结果
   */
  static async resolveWorkflow(
    context: ResolutionContext
  ): Promise<WorkflowResolutionResult> {
    const { hazard, workflowSteps, allUsers, departments, reporter } = context;

    console.log('🔍 [处理人解析] 开始解析工作流:', {
      hazardId: hazard.id,
      type: hazard.type,
      location: hazard.location,
      stepsCount: workflowSteps.length,
      usersCount: allUsers.length,
      deptsCount: departments.length
    });

    const stepResults: StepHandlerResult[] = [];

    try {
      // 逐步解析每个步骤的处理人
      for (let i = 0; i < workflowSteps.length; i++) {
        const step = workflowSteps[i];
        const stepResult = await this.resolveStepHandlers({
          hazard,
          step,
          stepIndex: i,
          allUsers,
          departments,
          reporter
        });

        stepResults.push(stepResult);

        // 如果某个步骤解析失败，记录但继续处理下一步
        if (!stepResult.success) {
          console.warn(`[处理人解析] 步骤 ${i + 1} 解析失败:`, stepResult.error);
        }
      }

      const allSuccess = stepResults.every(r => r.success);
      
      console.log('✅ [处理人解析] 工作流解析完成:', {
        totalSteps: stepResults.length,
        successfulSteps: stepResults.filter(r => r.success).length,
        allSuccess
      });

      return {
        success: allSuccess,
        steps: stepResults,
        error: allSuccess ? undefined : '部分步骤无法匹配处理人'
      };
    } catch (error) {
      console.error('❌ [处理人解析] 工作流解析失败:', error);
      return {
        success: false,
        steps: stepResults,
        error: error instanceof Error ? error.message : '未知错误'
      };
    }
  }

  /**
   * 解析单个步骤的处理人
   * 
   * @param params 解析参数
   * @returns 步骤处理人解析结果
   */
  static async resolveStepHandlers(params: {
    hazard: Partial<HazardRecord> & {
      type: string;
      location: string;
      reporterId?: string;
      responsibleId?: string;
      responsibleDeptId?: string;
      assignedDepartmentId?: string;
    };
    step: HazardWorkflowStep;
    stepIndex: number;
    allUsers: SimpleUser[];
    departments: Department[];
    reporter?: SimpleUser;
  }): Promise<StepHandlerResult> {
    const { hazard, step, stepIndex, allUsers, departments, reporter } = params;

    console.log(`🔄 [处理人解析] 解析步骤 ${stepIndex + 1}: ${step.name}`);

    try {
      // 1. 匹配处理人
      const handlerResult = await matchHandler({
        hazard: hazard as any,
        step,
        allUsers,
        departments
      });

      if (!handlerResult.success) {
        console.warn(`[处理人解析] 步骤 ${stepIndex + 1} 处理人匹配失败:`, handlerResult.error);
      } else {
        console.log(`[处理人解析] 步骤 ${stepIndex + 1} 匹配到处理人:`, {
          count: handlerResult.userNames.length,
          names: handlerResult.userNames,
          strategy: handlerResult.matchedBy
        });
      }

      // 2. 匹配抄送人
      const currentHandler = handlerResult.success && handlerResult.userIds.length > 0
        ? allUsers.find(u => u.id === handlerResult.userIds[0])
        : undefined;

      const ccResult = await matchAllCCRules(
        hazard as any,
        step.ccRules || [],
        allUsers,
        departments,
        reporter,
        currentHandler
      );

      console.log(`[处理人解析] 步骤 ${stepIndex + 1} 匹配到抄送人:`, {
        count: ccResult.userNames.length,
        names: ccResult.userNames
      });

      // 3. 构建候选处理人列表（用于或签/会签）
      const candidateHandlers = handlerResult.success && handlerResult.userIds.length > 0
        ? handlerResult.userIds.map((userId, idx) => ({
            userId,
            userName: handlerResult.userNames[idx] || ''
          }))
        : [];

      // 4. 获取审批模式（只支持 OR 和 AND）
      const approvalMode = step.handlerStrategy?.approvalMode;
      const validApprovalMode = approvalMode === 'OR' || approvalMode === 'AND' 
        ? approvalMode 
        : undefined;

      return {
        stepIndex,
        stepId: step.id,
        stepName: step.name,
        success: handlerResult.success,
        handlers: {
          userIds: handlerResult.userIds || [],
          userNames: handlerResult.userNames || [],
          matchedBy: handlerResult.matchedBy
        },
        ccUsers: ccResult,
        candidateHandlers,
        approvalMode: validApprovalMode,
        error: handlerResult.error
      };
    } catch (error) {
      console.error(`❌ [处理人解析] 步骤 ${stepIndex + 1} 解析失败:`, error);
      return {
        stepIndex,
        stepId: step.id,
        stepName: step.name,
        success: false,
        handlers: {
          userIds: [],
          userNames: []
        },
        ccUsers: {
          userIds: [],
          userNames: [],
          details: []
        },
        error: error instanceof Error ? error.message : '未知错误'
      };
    }
  }

  /**
   * 解析指定步骤的处理人（用于单步骤解析场景）
   * 
   * @param context 解析上下文
   * @param stepIndex 步骤索引
   * @returns 步骤处理人解析结果
   */
  static async resolveStepByIndex(
    context: ResolutionContext,
    stepIndex: number
  ): Promise<StepHandlerResult> {
    const { hazard, workflowSteps, allUsers, departments, reporter } = context;

    if (stepIndex < 0 || stepIndex >= workflowSteps.length) {
      return {
        stepIndex,
        stepId: '',
        stepName: '',
        success: false,
        handlers: { userIds: [], userNames: [] },
        ccUsers: { userIds: [], userNames: [], details: [] },
        error: `无效的步骤索引: ${stepIndex}`
      };
    }

    const step = workflowSteps[stepIndex];

    return this.resolveStepHandlers({
      hazard,
      step,
      stepIndex,
      allUsers,
      departments,
      reporter
    });
  }

  /**
   * 创建模拟隐患数据（用于前端预测场景）
   * 
   * @param formData 表单数据
   * @param currentUser 当前用户
   * @returns 模拟隐患数据
   */
  static createMockHazard(
    formData: {
      type: string;
      location: string;
      riskLevel?: string;
      responsibleId?: string;
      responsibleName?: string;
      responsibleDeptId?: string;
      [key: string]: any;
    },
    currentUser: {
      id: string;
      name: string;
      department?: string;
      departmentId?: string;
      [key: string]: any;
    }
  ): any {
    return {
      ...formData,
      reporterId: currentUser.id,
      reporterName: currentUser.name,
      reporterDepartmentId: currentUser.departmentId,
      assignedDepartmentId: formData.responsibleDeptId,
      status: 'assigned' as any,
      // 确保必需字段存在
      type: formData.type,
      location: formData.location
    };
  }
}

/**
 * 导出便捷方法（向后兼容）
 */
export const resolveWorkflowHandlers = HazardHandlerResolverService.resolveWorkflow;
export const resolveStepHandlers = HazardHandlerResolverService.resolveStepHandlers;
export const resolveStepByIndex = HazardHandlerResolverService.resolveStepByIndex;
export const createMockHazard = HazardHandlerResolverService.createMockHazard;
