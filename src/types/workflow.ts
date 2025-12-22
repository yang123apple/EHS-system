// src/types/workflow.ts

// 1. 严格的状态枚举 (State Machine)
export enum WorkflowStatus {
  DRAFT = 'draft',         // 草稿
  PENDING = 'pending',     // 审批中
  APPROVED = 'approved',   // 已归档/通过
  REJECTED = 'rejected',   // 已驳回
  REVOKED = 'revoked'      // 已撤回
}

export enum WorkflowAction {
  SUBMIT = 'submit',
  APPROVE = 'approve',
  REJECT = 'reject',
  REVOKE = 'revoke',
  TRANSFER = 'transfer' // 转办
}

// 2. 审批人解析策略 (Strategy Pattern)
export type ApproverStrategy = 
  | 'specific_user'    // 指定人员
  | 'role'             // 指定角色 (如 EHS工程师)
  | 'direct_manager'   // 直属上级
  | 'dept_manager'     // 部门负责人 (需指定部门层级)
  | 'form_cell'        // 动态：从表单单元格读取

export interface WorkflowStepConfig {
  stepIndex: number;
  name: string;
  strategy: ApproverStrategy;
  
  // 策略参数
  strategyValue?: string; // 角色名 或 部门层级(数字) 或 单元格坐标(R-C)
  candidates?: string[];  // 预设候选人ID列表
}

// 3. 结构化的审批日志 (Log Structure)
export interface ApprovalLogEntry {
  id: string;
  stepIndex: number;      // 对应哪个节点
  stepName: string;
  action: WorkflowAction;
  operatorId: string;
  operatorName: string;
  timestamp: string;
  comment: string;
  
  // 🟢 解决痛点4: 快照与附件
  snapshotVersion?: number; // 关联到数据版本的快照
  attachments?: { name: string, url: string }[]; 
}

// 4. 作业票记录扩展 (集成到 PermitRecord)
export interface WorkflowState {
  status: WorkflowStatus;
  currentStepIndex: number; // -1 表示结束或未开始
  history: ApprovalLogEntry[];
  nextApprovers: { id: string, name: string }[]; // 🟢 解决痛点5: 明确知道下一个人是谁
}