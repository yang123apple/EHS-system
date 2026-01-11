/**
 * 事故事件处理工作流配置
 * 定义事故处理流程：上报 -> 调查 -> 审批 -> 结案
 */

export interface IncidentWorkflowStep {
  id: string;
  name: string;
  index: number;
  handlerStrategy?: {
    type: 'fixed' | 'department_manager' | 'role' | 'field_based';
    value?: string;
    field?: string;
    condition?: any;
  };
  approvalMode?: 'OR' | 'AND'; // 或签/会签
  requiredFields?: string[]; // 该步骤必须填写的字段
}

export const INCIDENT_WORKFLOW_CONFIG: IncidentWorkflowStep[] = [
  {
    id: 'reported',
    name: '已上报',
    index: 0,
    handlerStrategy: {
      type: 'role',
      value: 'admin', // 管理员处理
    },
  },
  {
    id: 'investigating',
    name: '调查中',
    index: 1,
    handlerStrategy: {
      type: 'role',
      value: 'manager', // 经理或管理员调查
    },
    requiredFields: ['directCause', 'indirectCause', 'managementCause', 'rootCause', 'correctiveActions'],
  },
  {
    id: 'reviewed',
    name: '待审批',
    index: 2,
    handlerStrategy: {
      type: 'role',
      value: 'admin', // 管理员审批
    },
    approvalMode: 'OR',
  },
  {
    id: 'closed',
    name: '已结案',
    index: 3,
  },
];

/**
 * 根据状态获取当前步骤配置
 */
export function getStepByStatus(status: string): IncidentWorkflowStep | undefined {
  return INCIDENT_WORKFLOW_CONFIG.find(step => step.id === status);
}

/**
 * 获取下一步骤
 */
export function getNextStep(currentStepIndex: number): IncidentWorkflowStep | null {
  const nextIndex = currentStepIndex + 1;
  if (nextIndex >= INCIDENT_WORKFLOW_CONFIG.length) {
    return null; // 已是最后一步
  }
  return INCIDENT_WORKFLOW_CONFIG[nextIndex];
}

