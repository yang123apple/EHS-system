// src/types/hidden-danger.d.ts

export type HazardStatus = 'reported' | 'assigned' | 'rectifying' | 'verified' | 'closed';
export type RiskLevel = 'low' | 'medium' | 'high' | 'major';

export interface HazardLog {
  operatorName: string;
  action: string;
  time: string;
  changes: string;
  ccUsers?: string[]; // 抄送人ID列表
  ccUserNames?: string[]; // 抄送人名称列表
}

export interface HazardRecord {
  id: string;
  code?: string; // 隐患编号：日期+序号，如20251225001
  status: HazardStatus;
  riskLevel: RiskLevel;
  type: string;
  location: string;
  desc: string;
  photos: string[];
  reporterId: string;
  reporterName: string;
  reportTime: string;
  responsibleDept?: string;
  responsibleDeptId?: string; // 责任部门ID
  responsibleDeptName?: string; // 责任部门名称
  responsibleId?: string; // 整改责任人ID（隐患创建时确定，永不改变）
  responsibleName?: string; // 整改责任人姓名（隐患创建时确定，永不改变）
  dopersonal_ID?: string; // 当前步骤执行人 ID（动态字段，随步骤流转更新）
  dopersonal_Name?: string; // 当前步骤执行人姓名（动态字段，随步骤流转更新）
  // 🟢 或签/会签模式支持：候选处理人列表
  candidateHandlers?: Array<{
    userId: string;
    userName: string;
    hasOperated?: boolean; // 是否已操作（用于记录实际操作人）
  }>;
  approvalMode?: 'OR' | 'AND' | 'CONDITIONAL'; // 当前步骤的审批模式（OR=或签，AND=会签）
  old_personal_ID?: string[]; // 历史经手人 ID 数组（包括所有处理人和抄送人，永久保留查看权限）
  currentStepIndex?: number; // 当前步骤索引（用于追踪工作流位置，支持动态步骤）
  currentStepId?: string; // 当前步骤ID（用于追踪工作流位置）
  deadline?: string;
  isExtensionRequested?: boolean;
  extensionReason?: string;
  rectifyDesc?: string;
  rectifyPhotos?: string[];
  rectifyTime?: string;
  verifierId?: string;
  verifierName?: string;
  verifyTime?: string;
  logs?: HazardLog[];
  // V2 字段
  rectifyRequirement?: string;
  requireEmergencyPlan?: boolean;
  emergencyPlanDeadline?: string;
  emergencyPlanContent?: string;
  emergencyPlanSubmitTime?: string;
  ccDepts?: string[];
  ccUsers?: string[];
  ccUserNames?: string[]; // 抄送用户名称列表
  rejectReason?: string; // 驳回原因
}

export interface CCRule {
  id: string;
  name: string;
  riskLevels: RiskLevel[];
  ccDepts: string[];
  ccUsers: string[];
  enabled: boolean;
}

export interface EmergencyPlanRule {
  id: string;
  name: string;
  riskLevels: ('high' | 'major')[];
  daysBeforeDeadline: number;
  enabled: boolean;
}

export interface HazardConfig {
  types: string[];
  areas: string[];
}

export interface SimpleUser {
  id: string;
  name: string;
  department?: string;      // 部门名称
  departmentId?: string;    // 部门ID
  role?: string;
  jobTitle?: string;
}

// ========== 流转规则系统类型定义 ==========

export type HandlerStrategy = 
  | 'fixed'                    // 指定具体人员
  | 'reporter_manager'         // 上报人所在部门主管
  | 'responsible_manager'      // 责任人所在部门主管
  | 'dept_manager'             // 指定部门主管
  | 'role'                     // 指定部门+职位
  | 'location_match'           // 根据区域匹配
  | 'type_match'               // 根据类型匹配
  | 'risk_match'               // 根据风险等级匹配
  | 'responsible'              // 责任人
  | 'reporter';                // 上报人

export type CCRuleType =
  | 'fixed_users'              // 固定人员
  | 'reporter_manager'         // 上报人主管
  | 'responsible_manager'      // 责任人主管
  | 'handler_manager'          // 处理人主管
  | 'dept_by_location'         // 按区域匹配部门
  | 'dept_by_type'             // 按类型匹配部门
  | 'role_match'               // 角色匹配
  | 'responsible'              // 责任人
  | 'reporter';                // 上报人

export interface LocationMatch {
  location: string;            // 匹配区域
  deptId: string;              // 目标部门ID
  deptName: string;            // 目标部门名称
}

export interface TypeMatch {
  type: string;                // 匹配类型
  deptId: string;              // 目标部门ID
  deptName: string;            // 目标部门名称
}

export interface RiskMatch {
  riskLevel: RiskLevel;        // 匹配风险等级
  deptId: string;              // 目标部门ID
  deptName: string;            // 目标部门名称
}

export interface WorkflowStrategyConfig {
  // 固定人员
  fixedUsers?: Array<{
    userId: string;
    userName: string;
  }>;
  
  // 部门相关
  targetDeptId?: string;
  targetDeptName?: string;
  roleName?: string;           // 职位名称
  
  // 匹配规则
  locationMatches?: LocationMatch[];
  typeMatches?: TypeMatch[];
  riskMatches?: RiskMatch[];
}

export interface TriggerCondition {
  field: 'location' | 'type' | 'riskLevel';
  operator: '包含' | '等于' | '不等于';
  value: string;
}

export interface HazardCCRule {
  id: string;
  type: CCRuleType;
  config?: {
    // 固定人员
    userIds?: string[];
    userNames?: string[];
    
    // 部门相关
    deptId?: string;
    deptName?: string;
    roleName?: string;
    
    // 匹配规则
    locationMatch?: string;
    typeMatch?: string;
    riskLevelMatch?: RiskLevel;
  };
  description: string;         // 规则描述
}

// 审批模式
export type ApprovalMode = 'OR' | 'AND' | 'CONDITIONAL';

// 条件判断
export interface StrategyCondition {
  enabled: boolean;
  field: 'location' | 'type' | 'riskLevel';
  operator: '=' | '!=' | 'contains' | 'not_contains';
  value: string;
}

// 单个策略项
export interface HandlerStrategyItem {
  id: string;
  strategy: HandlerStrategy;
  condition?: StrategyCondition;
  
  // 固定人员
  fixedUsers?: Array<{
    userId: string;
    userName: string;
  }>;
  
  // 部门相关
  targetDeptId?: string;
  targetDeptName?: string;
  roleName?: string;
  
  // 匹配规则
  locationMatches?: LocationMatch[];
  typeMatches?: TypeMatch[];
  riskMatches?: RiskMatch[];
}

export interface HandlerStrategyConfig {
  type: HandlerStrategy;
  description?: string;
  approvalMode?: ApprovalMode; // 审批模式：或签、会签、条件签
  strategies?: HandlerStrategyItem[]; // 多策略配置
  
  // 兼容旧版单策略配置
  // 固定人员
  fixedUsers?: Array<{
    userId: string;
    userName: string;
  }>;
  
  // 部门相关
  targetDeptId?: string;
  targetDeptName?: string;
  roleName?: string;
  
  // 匹配规则
  locationMatches?: LocationMatch[];
  typeMatches?: TypeMatch[];
  riskMatches?: RiskMatch[];
}

export interface HazardWorkflowStep {
  id: string;                  // 步骤ID
  name: string;                // 步骤名称
  description?: string;        // 步骤描述
  handlerStrategy: HandlerStrategyConfig;
  ccRules: HazardCCRule[];
}

export interface HazardWorkflowConfig {
  steps: HazardWorkflowStep[];
  version: number;             // 配置版本（数字）
  updatedAt: string;           // 更新时间
  updatedBy: string;           // 更新人
}
