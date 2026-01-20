/**
 * 统一工作流策略选择器 - 类型定义
 * 
 * 用于隐患管理和作业票管理的通用人员/审批人选择策略
 */

// ==================== 基础策略类型 ====================

/**
 * 统一的策略类型
 */
export type WorkflowStrategyType =
  // 基础策略
  | 'fixed'                      // 固定人员
  | 'role'                       // 角色（部门+职位）
  
  // 部门主管相关
  | 'reporter_manager'           // 上报人/申请人所在部门主管
  | 'responsible_manager'        // 责任人所在部门主管
  | 'dept_manager'               // 指定部门主管
  | 'handler_manager'            // 处理人主管（隐患专用）
  
  // 表单字段匹配
  | 'form_field_dept_manager'    // 表单字段指定的部门主管
  | 'form_condition'             // 表单条件判断（作业票高级功能）
  
  // 匹配规则（隐患专用）
  | 'location_match'             // 区域匹配
  | 'type_match'                 // 类型匹配
  | 'risk_match'                 // 风险等级匹配
  
  // 直接指定
  | 'responsible'                // 责任人（隐患）
  | 'reporter';                  // 上报人/申请人

/**
 * 审批模式
 */
export type ApprovalMode = 'OR' | 'AND' | 'CONDITIONAL';

/**
 * 条件操作符
 */
export type ConditionOperator = 
  | '=' | '!=' | '>' | '<' | '>=' | '<='
  | 'contains' | 'not_contains'
  | 'in' | 'not_in';

// ==================== 配置接口 ====================

/**
 * 固定人员配置
 */
export interface FixedPersonConfig {
  userId: string;
  userName: string;
  deptId?: string;
  deptName?: string;
}

/**
 * 角色配置
 */
export interface RoleConfig {
  targetDeptId?: string;
  targetDeptName?: string;
  roleName: string;              // 职位关键词
}

/**
 * 部门主管配置
 */
export interface DeptManagerConfig {
  targetDeptId?: string;
  targetDeptName?: string;
  // 相对部门（用于 reporter_manager 等）
  relativeTo?: 'reporter' | 'responsible' | 'handler';
}

/**
 * 表单字段匹配配置
 */
export interface FormFieldConfig {
  fieldName: string;             // 字段名称
  expectedType?: 'department' | 'personnel' | 'text' | 'number' | 'date';
}

/**
 * 表单条件判断配置（作业票高级功能）
 */
export interface FormConditionConfig {
  fieldName: string;             // 判断字段名
  operator: ConditionOperator;   // 判断符号
  value: string;                 // 判断值
  
  // 满足条件后的处理人配置
  thenStrategy: WorkflowStrategyType;
  thenConfig: any;               // 递归配置
}

/**
 * 区域匹配规则
 */
export interface LocationMatchRule {
  location: string;              // 区域名称
  deptId: string;
  deptName: string;
}

/**
 * 类型匹配规则
 */
export interface TypeMatchRule {
  type: string;                  // 隐患类型
  deptId: string;
  deptName: string;
}

/**
 * 风险等级匹配规则
 */
export interface RiskMatchRule {
  riskLevel: 'high' | 'major' | 'medium' | 'low';
  deptId: string;
  deptName: string;
}

/**
 * 匹配规则配置（隐患专用）
 */
export interface MatchRuleConfig {
  locationRules?: LocationMatchRule[];
  typeRules?: TypeMatchRule[];
  riskRules?: RiskMatchRule[];
}

// ==================== 统一策略配置 ====================

/**
 * 统一的策略配置
 */
export interface WorkflowStrategyConfig {
  // 固定人员
  fixedPersons?: FixedPersonConfig[];
  
  // 角色
  role?: RoleConfig;
  
  // 部门主管
  deptManager?: DeptManagerConfig;
  
  // 表单字段
  formField?: FormFieldConfig;
  
  // 表单条件
  formCondition?: FormConditionConfig;
  
  // 匹配规则
  matchRules?: MatchRuleConfig;
}

/**
 * 条件判断配置（条件签模式）
 */
export interface StrategyCondition {
  enabled: boolean;
  fieldName: string;
  operator: ConditionOperator;
  value: string;
}

/**
 * 策略项（支持多策略+条件判断）
 */
export interface WorkflowStrategyItem {
  id: string;                    // 唯一标识
  strategy: WorkflowStrategyType;
  config: WorkflowStrategyConfig;
  
  // 条件判断（仅在CONDITIONAL模式下使用）
  condition?: StrategyCondition;
  
  // 描述
  description?: string;
}

// ==================== 组件Props ====================

/**
 * 解析的表单字段（用于表单条件判断）
 */
export interface ParsedFormField {
  fieldName: string;
  label: string;
  fieldType: 'text' | 'number' | 'date' | 'department' | 'personnel' | 'option' | 'other';
  cellKey?: string;
  options?: string[];
}

/**
 * 部门信息
 */
export interface DepartmentInfo {
  id: string;
  name: string;
  parentId?: string;
}

/**
 * 用户信息
 */
export interface UserInfo {
  id: string;
  name: string;
  departmentId?: string;
  departmentName?: string;
  jobTitle?: string;
}

/**
 * 组件支持的策略类型（用于适配简单/复杂场景）
 */
export type SupportedStrategies = WorkflowStrategyType[];

/**
 * 组件模式
 */
export type ComponentMode = 'simple' | 'advanced';

/**
 * 工作流策略选择器Props
 */
export interface WorkflowStrategySelectorProps {
  // 模式：simple（隐患简单模式）/ advanced（作业票完整功能）
  mode?: ComponentMode;
  
  // 支持的策略类型（自定义限制）
  supportedStrategies?: SupportedStrategies;
  
  // 当前配置
  strategyItems: WorkflowStrategyItem[];
  
  // 审批模式（OR/AND/CONDITIONAL）
  approvalMode?: ApprovalMode;
  
  // 表单字段（用于条件判断）
  parsedFields?: ParsedFormField[];
  
  // 组织架构数据
  departments: DepartmentInfo[];
  allUsers: UserInfo[];
  
  // 回调函数
  onChange: (items: WorkflowStrategyItem[]) => void;
  onSelectDepartment?: (itemId: string, purpose?: string) => void;
  onSelectUser?: (itemId: string) => void;
  
  // UI配置
  className?: string;
  showDescription?: boolean;     // 是否显示策略描述
}
