// src/types/hidden-danger.d.ts
/**
 * 隐患管理模块类型定义
 * 
 * ⚠️ 类型一致性说明：
 * - 所有日期字段统一使用 ISO 8601 字符串格式（而非 Date 对象）
 * - 状态、风险等级等枚举值使用统一的常量定义（避免硬编码）
 */

// 从常量文件导入类型，确保类型一致
import type {
  HazardStatus as HazardStatusConst,
  HazardRiskLevel as RiskLevelConst,
  ApprovalMode as ApprovalModeConst,
} from '@/lib/business-constants';

export type HazardStatus = HazardStatusConst;
export type RiskLevel = RiskLevelConst;

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
  checkType?: string; // 检查类型：daily, special, monthly, pre-holiday, self, other
  rectificationType?: string; // 整改方式：immediate, scheduled
  reporterId: string;
  reporterName: string;
  reporterDeptName?: string; // ✅ 上报人部门名称（推荐使用）
  reportTime: string;

  // ============ 整改责任人信息 ============
  /** @deprecated 使用 rectificationDeptId 替代 */
  responsibleDept?: string;
  /** @deprecated 使用 rectificationDeptId 替代 */
  responsibleDeptId?: string; // 责任部门ID
  /** @deprecated 使用 rectificationDeptName 替代 */
  responsibleDeptName?: string; // 责任部门名称
  /** @deprecated 使用 rectificationLeaderId 替代 */
  responsibleId?: string; // 整改责任人ID（隐患创建时确定，永不改变）
  /** @deprecated 使用 rectificationLeaderName 替代 */
  responsibleName?: string; // 整改责任人姓名（隐患创建时确定，永不改变）

  // ✅ 新字段：整改责任人（推荐使用）
  rectificationLeaderId?: string; // 整改责任人ID
  rectificationLeaderName?: string; // 整改责任人姓名
  rectificationDeptId?: string; // 整改部门ID
  rectificationDeptName?: string; // 整改部门名称

  // ============ 当前执行人信息 ============
  /** @deprecated 使用 currentExecutorId 替代（极差命名） */
  dopersonal_ID?: string; // 当前步骤执行人 ID（动态字段，随步骤流转更新）
  /** @deprecated 使用 currentExecutorName 替代（极差命名） */
  dopersonal_Name?: string; // 当前步骤执行人姓名（动态字段，随步骤流转更新）
  /** @deprecated 使用 historicalHandlerIds 替代 */
  old_personal_ID?: string[]; // 历史经手人 ID 数组（包括所有处理人和抄送人，永久保留查看权限）

  // ✅ 新字段：当前执行人（推荐使用）
  currentExecutorId?: string; // 当前步骤执行人ID
  currentExecutorName?: string; // 当前步骤执行人姓名
  historicalHandlerIds?: string[]; // 历史处理人ID列表

  // 🟢 或签/会签模式支持：候选处理人列表
  candidateHandlers?: Array<{
    userId: string;
    userName: string;
    hasOperated?: boolean; // 是否已操作（用于记录实际操作人）
  }>;
  approvalMode?: ApprovalModeConst; // 当前步骤的审批模式（OR=或签，AND=会签）
  currentStepIndex?: number; // 当前步骤索引（用于追踪工作流位置，支持动态步骤）
  currentStepId?: string; // 当前步骤ID（用于追踪工作流位置）
  deadline?: string;
  isExtensionRequested?: boolean;
  extensionReason?: string;

  // ============ 整改过程信息 ============
  /** @deprecated 使用 rectificationNotes 替代 */
  rectifyDesc?: string;
  /** @deprecated 使用 rectificationPhotos 替代 */
  rectifyPhotos?: string[];
  /** @deprecated 使用 rectificationTime 替代 */
  rectifyTime?: string;
  /** @deprecated 使用 rectificationRequirements 替代 */
  rectifyRequirement?: string;

  // ✅ 新字段：整改过程（推荐使用）
  rectificationNotes?: string; // 整改备注
  rectificationPhotos?: string[]; // 整改照片
  rectificationTime?: string; // 整改完成时间
  rectificationRequirements?: string; // 整改要求

  // ============ 验收信息 ============
  verifierId?: string;
  verifierName?: string;
  /** @deprecated 使用 verificationTime 替代 */
  verifyTime?: string;
  /** @deprecated 使用 verificationPhotos 替代 */
  verifyPhotos?: string[]; // 验收时的现场照片路径（JSON字符串解析为数组）
  /** @deprecated 使用 verificationNotes 替代 */
  verifyDesc?: string; // 验收时的描述/评价

  // ✅ 新字段：验收过程（推荐使用）
  verificationTime?: string; // 验收时间
  verificationPhotos?: string[]; // 验收照片
  verificationNotes?: string; // 验收意见

  // ============ 根因分析 ============
  rootCause?: string; // 根本原因分析分类（如：人的不安全行为、物的不安全状态、管理缺陷等）

  // ============ 工作流日志 ============
  logs?: HazardLog[];

  // ============ 应急预案相关 ============
  requireEmergencyPlan?: boolean;
  emergencyPlanDeadline?: string;
  emergencyPlanContent?: string;
  emergencyPlanSubmitTime?: string;

  // ============ 抄送信息 ============
  /** @deprecated 使用 ccDeptIds 替代 */
  ccDepts?: string[];
  /** @deprecated 使用 ccUserIds 替代 */
  ccUsers?: string[];
  ccUserNames?: string[]; // 抄送用户名称列表

  // ✅ 新字段：抄送（推荐使用）
  ccDeptIds?: string[]; // 抄送部门ID列表
  ccUserIds?: string[]; // 抄送用户ID列表

  rejectReason?: string; // 驳回原因

  // 🟢 软删除字段
  isVoided?: boolean; // 是否已作废
  voidReason?: string; // 作废原因
  voidedAt?: string; // 作废时间（ISO 8601字符串）
  voidedBy?: string; // 作废操作人信息（JSON格式：{id, name, role}）

  // 关联关系
  extensions?: HazardExtension[]; // 延期记录
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
  checkTypes?: string[]; // 检查类型配置（可选，向下兼容）
}

// 隐患整改延期历史记录
export interface HazardExtension {
  id: string;
  hazardId: string;
  oldDeadline: string; // ISO 日期字符串
  newDeadline: string; // ISO 日期字符串
  reason: string;
  applicantId: string;
  approverId?: string; // 批准人ID（Nullable）
  status: 'pending' | 'approved' | 'rejected'; // 状态：pending(待审批), approved(已批准), rejected(已驳回)
  createdAt: string; // ISO 日期字符串
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
