/**
 * 工作流策略选择器 - 工具函数
 */

import type {
  WorkflowStrategyType,
  WorkflowStrategyConfig,
  ComponentMode,
} from './types';

/**
 * 获取策略标签
 */
export function getStrategyLabel(strategy: WorkflowStrategyType, mode: ComponentMode = 'simple'): string {
  const labels: Record<WorkflowStrategyType, string> = {
    // 基础策略
    fixed: '固定人员',
    role: '角色（部门+职位）',
    
    // 部门主管相关
    reporter_manager: mode === 'simple' ? '上报人所在部门主管' : '申请人所在部门主管',
    responsible_manager: '责任人所在部门主管',
    dept_manager: '指定部门主管',
    handler_manager: '处理人主管',
    
    // 表单字段匹配
    form_field_dept_manager: '表单字段指定部门主管',
    form_condition: '表单条件判断',
    
    // 匹配规则
    location_match: '区域匹配',
    type_match: '类型匹配',
    risk_match: '风险等级匹配',
    
    // 直接指定
    responsible: '责任人',
    reporter: mode === 'simple' ? '上报人' : '申请人',
  };

  return labels[strategy] || strategy;
}

/**
 * 获取策略描述
 */
export function getStrategyDescription(strategy: WorkflowStrategyType, mode: ComponentMode = 'simple'): string {
  const descriptions: Record<WorkflowStrategyType, string> = {
    fixed: '指定具体的固定人员',
    role: '根据部门和职位关键词查找人员',
    reporter_manager: `系统自动查找${mode === 'simple' ? '上报人' : '申请人'}所在部门的负责人`,
    responsible_manager: '系统自动查找责任人所在部门的负责人',
    dept_manager: '指定某个部门的负责人',
    handler_manager: '系统自动查找处理人所在部门的负责人',
    form_field_dept_manager: '根据表单中的部门字段查找该部门负责人',
    form_condition: '根据表单字段值条件判断，动态选择审批人',
    location_match: '根据隐患所在区域匹配对应部门负责人',
    type_match: '根据隐患类型匹配对应部门负责人',
    risk_match: '根据风险等级匹配对应部门负责人',
    responsible: '自动路由给隐患的责任人',
    reporter: `自动路由给隐患的${mode === 'simple' ? '上报人' : '申请人'}`,
  };

  return descriptions[strategy] || '';
}

/**
 * 获取默认配置
 */
export function getDefaultConfig(strategy: WorkflowStrategyType): WorkflowStrategyConfig {
  switch (strategy) {
    case 'fixed':
      return { fixedPersons: [] };
    
    case 'role':
      return {
        role: {
          targetDeptId: undefined,
          targetDeptName: undefined,
          roleName: '',
        }
      };
    
    case 'dept_manager':
      return {
        deptManager: {
          targetDeptId: undefined,
          targetDeptName: undefined,
        }
      };
    
    case 'reporter_manager':
      return {
        deptManager: {
          relativeTo: 'reporter',
        }
      };
    
    case 'responsible_manager':
      return {
        deptManager: {
          relativeTo: 'responsible',
        }
      };
    
    case 'handler_manager':
      return {
        deptManager: {
          relativeTo: 'handler',
        }
      };
    
    case 'form_field_dept_manager':
      return {
        formField: {
          fieldName: '',
          expectedType: 'department',
        }
      };
    
    case 'form_condition':
      return {
        formCondition: {
          fieldName: '',
          operator: '=',
          value: '',
          thenStrategy: 'fixed',
          thenConfig: {},
        }
      };
    
    case 'location_match':
      return {
        matchRules: {
          locationRules: [],
        }
      };
    
    case 'type_match':
      return {
        matchRules: {
          typeRules: [],
        }
      };
    
    case 'risk_match':
      return {
        matchRules: {
          riskRules: [],
        }
      };
    
    case 'responsible':
    case 'reporter':
    default:
      return {};
  }
}

/**
 * 验证配置是否完整
 */
export function validateConfig(strategy: WorkflowStrategyType, config: WorkflowStrategyConfig): {
  valid: boolean;
  message?: string;
} {
  switch (strategy) {
    case 'fixed':
      if (!config.fixedPersons || config.fixedPersons.length === 0) {
        return { valid: false, message: '请选择至少一个固定人员' };
      }
      break;
    
    case 'role':
      if (!config.role?.roleName) {
        return { valid: false, message: '请输入职位关键词' };
      }
      break;
    
    case 'dept_manager':
      if (!config.deptManager?.targetDeptId) {
        return { valid: false, message: '请选择目标部门' };
      }
      break;
    
    case 'form_field_dept_manager':
      if (!config.formField?.fieldName) {
        return { valid: false, message: '请选择表单字段' };
      }
      break;
    
    case 'location_match':
      if (!config.matchRules?.locationRules || config.matchRules.locationRules.length === 0) {
        return { valid: false, message: '请添加至少一条区域匹配规则' };
      }
      break;
    
    case 'type_match':
      if (!config.matchRules?.typeRules || config.matchRules.typeRules.length === 0) {
        return { valid: false, message: '请添加至少一条类型匹配规则' };
      }
      break;
    
    case 'risk_match':
      if (!config.matchRules?.riskRules || config.matchRules.riskRules.length === 0) {
        return { valid: false, message: '请添加至少一条风险等级匹配规则' };
      }
      break;
  }

  return { valid: true };
}
