/**
 * 数据转换工具 - 将旧版隐患/作业票配置转换为新的统一格式
 */

import type {
  WorkflowStrategyItem,
  WorkflowStrategyType,
  WorkflowStrategyConfig,
  ConditionOperator,
} from './types';

// ==================== 隐患旧格式类型定义 ====================

interface OldHazardHandlerConfig {
  type: string;
  fixedUsers?: Array<{ userId: string; userName: string }>;
  targetDeptId?: string;
  targetDeptName?: string;
  roleName?: string;
  locationMatches?: Array<{ location: string; deptId: string; deptName: string }>;
  typeMatches?: Array<{ type: string; deptId: string; deptName: string }>;
  riskMatches?: Array<{ riskLevel: string; deptId: string; deptName: string }>;
}

// ==================== 作业票旧格式类型定义 ====================

interface OldWorkPermitApproverStrategy {
  id: string;
  strategy: string;
  strategyConfig?: {
    targetDeptId?: string;
    targetDeptName?: string;
    roleName?: string;
    fieldName?: string;
  };
  approvers?: Array<{ userId: string; name: string; userName: string }>;
  condition?: {
    enabled: boolean;
    fieldName: string;
    operator: string;
    value: string;
  };
}

// ==================== 转换函数 ====================

/**
 * 隐患配置 -> 统一格式
 */
export function convertHazardConfigToUnified(
  oldConfig: OldHazardHandlerConfig
): WorkflowStrategyItem {
  const id = `strategy_${Date.now()}_${Math.random()}`;
  let strategy: WorkflowStrategyType;
  let config: WorkflowStrategyConfig = {};

  // 映射策略类型
  const strategyMap: Record<string, WorkflowStrategyType> = {
    'fixed': 'fixed',
    'reporter_manager': 'reporter_manager',
    'responsible_manager': 'responsible_manager',
    'responsible': 'responsible',
    'reporter': 'reporter',
    'dept_manager': 'dept_manager',
    'role': 'role',
    'location_match': 'location_match',
    'type_match': 'type_match',
    'risk_match': 'risk_match',
  };

  strategy = strategyMap[oldConfig.type] || 'fixed';

  // 根据不同策略转换配置
  switch (strategy) {
    case 'fixed':
      config = {
        fixedPersons: oldConfig.fixedUsers?.map(u => ({
          userId: u.userId,
          userName: u.userName,
        })) || [],
      };
      break;

    case 'role':
      config = {
        role: {
          targetDeptId: oldConfig.targetDeptId,
          targetDeptName: oldConfig.targetDeptName,
          roleName: oldConfig.roleName || '',
        },
      };
      break;

    case 'dept_manager':
      config = {
        deptManager: {
          targetDeptId: oldConfig.targetDeptId,
          targetDeptName: oldConfig.targetDeptName,
        },
      };
      break;

    case 'location_match':
      config = {
        matchRules: {
          locationRules: oldConfig.locationMatches || [],
        },
      };
      break;

    case 'type_match':
      config = {
        matchRules: {
          typeRules: oldConfig.typeMatches || [],
        },
      };
      break;

    case 'risk_match':
      config = {
        matchRules: {
          riskRules: oldConfig.riskMatches?.map(r => ({
            ...r,
            riskLevel: r.riskLevel as any,
          })) || [],
        },
      };
      break;

    default:
      config = {};
  }

  return {
    id,
    strategy,
    config,
  };
}

/**
 * 作业票配置 -> 统一格式
 */
export function convertWorkPermitConfigToUnified(
  oldStrategies: OldWorkPermitApproverStrategy[]
): WorkflowStrategyItem[] {
  return oldStrategies.map(oldStrategy => {
    let strategy: WorkflowStrategyType;
    let config: WorkflowStrategyConfig = {};

    // 映射策略类型
    const strategyMap: Record<string, WorkflowStrategyType> = {
      'fixed': 'fixed',
      'current_dept_manager': 'reporter_manager',
      'specific_dept_manager': 'dept_manager',
      'role': 'role',
      'template_field_dept_manager': 'form_field_dept_manager',
    };

    strategy = strategyMap[oldStrategy.strategy] || 'fixed';

    // 根据不同策略转换配置
    switch (strategy) {
      case 'fixed':
        config = {
          fixedPersons: oldStrategy.approvers?.map(a => ({
            userId: a.userId,
            userName: a.name || a.userName,
          })) || [],
        };
        break;

      case 'role':
        config = {
          role: {
            targetDeptId: oldStrategy.strategyConfig?.targetDeptId,
            targetDeptName: oldStrategy.strategyConfig?.targetDeptName,
            roleName: oldStrategy.strategyConfig?.roleName || '',
          },
        };
        break;

      case 'dept_manager':
        config = {
          deptManager: {
            targetDeptId: oldStrategy.strategyConfig?.targetDeptId,
            targetDeptName: oldStrategy.strategyConfig?.targetDeptName,
          },
        };
        break;

      case 'form_field_dept_manager':
        config = {
          formField: {
            fieldName: oldStrategy.strategyConfig?.fieldName || '',
            expectedType: 'department',
          },
        };
        break;

      default:
        config = {};
    }

    return {
      id: oldStrategy.id,
      strategy,
      config,
      condition: oldStrategy.condition ? {
        enabled: oldStrategy.condition.enabled,
        fieldName: oldStrategy.condition.fieldName,
        operator: oldStrategy.condition.operator as ConditionOperator,
        value: oldStrategy.condition.value,
      } : undefined,
    };
  });
}

/**
 * 统一格式 -> 隐患格式（用于保存）
 */
export function convertUnifiedToHazardConfig(
  items: WorkflowStrategyItem[]
): OldHazardHandlerConfig[] {
  return items.map(item => {
    const oldConfig: OldHazardHandlerConfig = {
      type: item.strategy,
    };

    // 根据策略类型转换配置
    if (item.config.fixedPersons) {
      oldConfig.fixedUsers = item.config.fixedPersons;
    }

    if (item.config.role) {
      oldConfig.targetDeptId = item.config.role.targetDeptId;
      oldConfig.targetDeptName = item.config.role.targetDeptName;
      oldConfig.roleName = item.config.role.roleName;
    }

    if (item.config.deptManager) {
      oldConfig.targetDeptId = item.config.deptManager.targetDeptId;
      oldConfig.targetDeptName = item.config.deptManager.targetDeptName;
    }

    if (item.config.matchRules?.locationRules) {
      oldConfig.locationMatches = item.config.matchRules.locationRules;
    }

    if (item.config.matchRules?.typeRules) {
      oldConfig.typeMatches = item.config.matchRules.typeRules;
    }

    if (item.config.matchRules?.riskRules) {
      oldConfig.riskMatches = item.config.matchRules.riskRules;
    }

    return oldConfig;
  });
}

/**
 * 统一格式 -> 作业票格式（用于保存）
 */
export function convertUnifiedToWorkPermitConfig(
  items: WorkflowStrategyItem[]
): OldWorkPermitApproverStrategy[] {
  return items.map(item => {
    // 反向映射策略类型
    const strategyMap: Record<WorkflowStrategyType, string> = {
      'fixed': 'fixed',
      'reporter_manager': 'current_dept_manager',
      'dept_manager': 'specific_dept_manager',
      'role': 'role',
      'form_field_dept_manager': 'template_field_dept_manager',
      // 其他策略类型映射到最接近的
      'responsible_manager': 'current_dept_manager',
      'handler_manager': 'current_dept_manager',
      'responsible': 'fixed',
      'reporter': 'fixed',
      'location_match': 'fixed',
      'type_match': 'fixed',
      'risk_match': 'fixed',
      'form_condition': 'fixed',
    };

    const oldStrategy: OldWorkPermitApproverStrategy = {
      id: item.id,
      strategy: strategyMap[item.strategy] || 'fixed',
      condition: item.condition,
    };

    // 转换配置
    if (item.config.fixedPersons) {
      oldStrategy.approvers = item.config.fixedPersons.map(p => ({
        userId: p.userId,
        name: p.userName,
        userName: p.userName,
      }));
    }

    if (item.config.role || item.config.deptManager) {
      oldStrategy.strategyConfig = {
        targetDeptId: item.config.role?.targetDeptId || item.config.deptManager?.targetDeptId,
        targetDeptName: item.config.role?.targetDeptName || item.config.deptManager?.targetDeptName,
        roleName: item.config.role?.roleName,
      };
    }

    if (item.config.formField) {
      oldStrategy.strategyConfig = {
        fieldName: item.config.formField.fieldName,
      };
    }

    return oldStrategy;
  });
}

/**
 * 批量转换隐患工作流配置
 */
export function batchConvertHazardWorkflow(oldWorkflow: {
  steps: Array<{
    id: string;
    name: string;
    handlerStrategy: OldHazardHandlerConfig;
  }>;
}): Array<{
  id: string;
  name: string;
  strategies: WorkflowStrategyItem[];
}> {
  return oldWorkflow.steps.map(step => ({
    id: step.id,
    name: step.name,
    strategies: [convertHazardConfigToUnified(step.handlerStrategy)],
  }));
}

/**
 * 批量转换作业票工作流配置
 */
export function batchConvertWorkPermitWorkflow(oldWorkflow: {
  steps: Array<{
    step: number;
    name: string;
    approverStrategies?: OldWorkPermitApproverStrategy[];
  }>;
}): Array<{
  step: number;
  name: string;
  strategies: WorkflowStrategyItem[];
}> {
  return oldWorkflow.steps.map(step => ({
    step: step.step,
    name: step.name,
    strategies: step.approverStrategies 
      ? convertWorkPermitConfigToUnified(step.approverStrategies)
      : [],
  }));
}
