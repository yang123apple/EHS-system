// src/types/work-permit.ts

// ==========================================
// 1. 基础实体类型 (Project, Template)
// ==========================================

export type Project = {
  id: string;
  code: string;
  name: string;
  location: string;
  supplierName: string;
  contractNo?: string;
  requestDept: string;
  startDate: string; // ISO Date string YYYY-MM-DD
  endDate: string; // ISO Date string YYYY-MM-DD
  // 允许额外的动态字段，保持与原代码兼容
  [key: string]: any;
};

// 🟢 审批模式定义
export type ApprovalMode = 'OR' | 'AND' | 'CONDITIONAL'; // OR=或签, AND=会签, CONDITIONAL=条件签

// 🟢 解析的模板字段
export interface ParsedField {
  cellKey: string;        // 单元格坐标 "R1C1"
  label: string;          // 标签内容 (左侧单元格)
  fieldName: string;      // 规范化字段名 "department", "location", "date"
  fieldType: 'text' | 'department' | 'date' | 'number' | 'personnel' | 'signature' | 'option' | 'match' | 'section' | 'other'; // 🟢 新增 section 类型
  hint: string;           // 提示文本
  editableHint?: string;  // 编辑后的提示（在编辑器中修改）
  options?: string[];     // 🟢 互斥选项列表（如 ["是", "否"]）
  required?: boolean;     // 🟢 是否为必填项（模板设计时指定）
  boundTemplateId?: string; // 🟢 section类型绑定的二级模板ID
  group?: string;         // 🟢 字段分组（如"基础信息"、"安全措施"）
  isSafetyMeasure?: boolean; // 🟢 是否为安全措施项
  rowIndex?: number;      // 🟢 原始行索引
  colIndex?: number;      // 🟢 原始列索引
}

// 🟢 审批人策略：新增 'specific_dept_manager'、'template_text_match'、'template_option_match'
export type ApproverStrategy = 'fixed' | 'current_dept_manager' | 'specific_dept_manager' | 'role' | 'template_field_manager' | 'template_text_match' | 'template_option_match';

export type Template = {
  id: string;
  name: string;
  type: string; // e.g., "动火作业", "高处作业"
  structureJson: string; // Excel 渲染所需的 JSON 字符串
  isLocked: boolean;
  workflowConfig?: string; // 存储 WorkflowStep[] 的 JSON 字符串
  // 🟢 解析的模板字段（JSON 字符串，解析后为 ParsedField[]）
  parsedFields?: string;
  // 🟢 水印设置
  watermarkSettings?: {
    text: string; // 如 "仅供内部审批"
    enabled: boolean;
  };
  // 🟢 V3.3 模板级别系统
  level?: string; // 'primary' | 'secondary'
  sectionBindings?: string; // JSON字符串，存储section单元格与二级模板的绑定关系
  // 🟢 V3.4 纸张方向
  orientation?: string; // 'portrait' | 'landscape'
  // 🟢 移动端表单配置
  mobileFormConfig?: string; // JSON字符串，存储移动端表单配置
};

// ==========================================
// 2. 审批流程相关类型 (Workflow)
// ==========================================

export type WorkflowType = 'approval' | 'cc' | 'reject' | 'issue' | 'site_confirm';

export interface WorkflowApprover {
  deptId: string;
  userId: string;
  userName: string;
  // 🟢 条件签模式下的触发条件
  conditions?: Array<{
    field: string;     // 字段名
    operator: string;  // 操作符
    value: string;     // 匹配值
  }>;
}

// 🟢 V3.6 新增：审批人策略项（支持条件判断）
export type ApproverStrategyItem = {
  id: string; // 唯一标识
  strategy: ApproverStrategy; // 找人策略
  strategyConfig?: {
    targetDeptId?: string;
    targetDeptName?: string;
    roleName?: string;
    fieldName?: string;
    expectedType?: 'department' | 'personnel' | 'text';
    textMatches?: Array<{
      fieldName: string;
      containsText: string;
      targetDeptId: string;
      targetDeptName: string;
    }>;
    optionMatches?: Array<{
      fieldName: string;
      checkedValue: string;
      approverType: 'person' | 'dept_manager';
      approverUserId?: string;
      approverUserName?: string;
      targetDeptId?: string;
      targetDeptName?: string;
    }>;
  };
  
  // 🟢 条件判断配置（条件签）
  condition?: {
    enabled: boolean;      // 是否启用条件判断
    fieldName: string;     // 判断字段名
    operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'contains' | 'not_contains' | 'in' | 'not_in'; // 判断符号
    value: string;         // 判断值
  };
  
  // 固定审批人（当strategy为fixed时）
  approvers?: WorkflowApprover[];
};

export type WorkflowStep = {
  step: number; // 步骤序号 (0, 1, 2...)
  stepIndex?: number; // 新标准字段（可选，用于新引擎）
  name: string; // 步骤名称 (e.g., "安全员审批")
  type: WorkflowType;

  // 🟢 支持会签/或签/条件签
  approvalMode?: ApprovalMode;

  // 🟢 V3.6 新版：多策略配置（每个步骤可以有多个审批人策略）
  approverStrategies?: ApproverStrategyItem[];

  // === 以下为向后兼容的旧字段 ===
  // 🟢 审批人策略（旧版，保留向后兼容）
  approverStrategy?: ApproverStrategy;

  // 🟢 策略配置参数（旧版，保留向后兼容）
  strategyConfig?: {
    targetDeptId?: string;
    targetDeptName?: string;
    roleName?: string;
    fieldName?: string;
    expectedType?: 'department' | 'personnel' | 'text';
    textMatches?: Array<{
      fieldName: string;
      containsText: string;
      targetDeptId: string;
      targetDeptName: string;
    }>;
    optionMatches?: Array<{
      fieldName: string;
      checkedValue: string;
      approverType: 'person' | 'dept_manager';
      approverUserId?: string;
      approverUserName?: string;
      targetDeptId?: string;
      targetDeptName?: string;
    }>;
  };

  // 固定审批人列表（旧版，仅当 approverStrategy === 'fixed' 时使用）
  approvers: WorkflowApprover[];

  // 🟢 条件触发器（可选，旧版）
  triggerConditions?: Array<{
    field: string;
    operator: string;
    value: string;
  }>;

  // 绑定的 Excel 单元格坐标 (用于签字回填)
  outputCell?: { r: number; c: number };

  // 兼容旧数据的字段 (可选)
  rowIndex?: number;
};

// ==========================================
// 3. 作业记录与日志相关类型 (Record & Logs)
// ==========================================

export interface ApprovalLogReply {
  user: string;
  userId?: string;
  content: string;
  time: string;
}

export interface ApprovalLog {
  approver: string; // 审批人姓名
  action: 'pass' | 'reject' | 'read' | 'submit';
  opinion: string;
  time: string;
  // 🟢 拒绝原因分类
  rejectReasonType?: string;
  // 🟢 电子签名（Base64 图像）
  signatureImage?: string;
  // 🟢 步骤索引（用于多级审批定位）
  stepIndex?: number;
  replies?: ApprovalLogReply[];
}

export type PermitRecord = {
  id: string;
  code?: string; // 🟢 新增：作业单编号
  createdAt: string; // ISO string
  status: string; // e.g., 'ongoing', 'rejected', 'approved'
  currentStep: number;
  // JSON 字符串，解析后为 ApprovalLog[]
  approvalLogs?: string;
  // JSON 字符串，解析后为 Attachment[]
  attachments?: string;
  template: Template;
  project?: Project; // 关联的项目信息
  // 表单填写的实际数据 (Excel 单元格数据)，JSON 字符串
  dataJson: string;
};

// ==========================================
// 4. 辅助数据结构 (Attachments, Department)
// ==========================================

export interface Attachment {
  name: string;
  size: string; // e.g. "12.5 KB"
  type: string; // MIME type
  content: string | ArrayBuffer | null | undefined; // Base64 或文件流
}

// 组织架构人员
export interface DeptUser {
  id: string;
  name: string;
  departmentId?: string;
}

// 组织架构部门
export interface Department {
  id: string;
  name: string;
  users?: DeptUser[];
  children?: Department[];
}
// ==========================================
// 5.  V3.4 ����ģ��Partϵͳ
// ==========================================

// Partʰȡ����
export type PartPickStrategy = 'field_match'; // ָ���ֶβ���

// Part������
export interface WorkflowPart {
  part: number;              // Part��� (1, 2, 3...)
  pickStrategy: PartPickStrategy; // ʰȡ����
  pickConfig: {
  };
}
