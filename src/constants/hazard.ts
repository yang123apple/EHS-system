// src/constants/hazard.ts
import { HazardStatus, RiskLevel } from '@/types/hidden-danger';

// 视图模式定义
export type ViewMode = 'overview' | 'my_tasks' | 'all_list' | 'stats' | 'config' | 'logs';

export const VIEW_MODES = {
  OVERVIEW: 'overview' as ViewMode,
  MY_TASKS: 'my_tasks' as ViewMode,
  ALL_LIST: 'all_list' as ViewMode,
  STATS: 'stats' as ViewMode,
  CONFIG: 'config' as ViewMode,
  LOGS: 'logs' as ViewMode,
};

// 风险等级映射
export const RISK_LEVEL_MAP: Record<RiskLevel, { label: string; color: string; bg: string; text: string; ring: string }> = {
  low: { label: '低风险', color: 'text-blue-700', bg: 'bg-blue-100', text: 'text-blue-700', ring: 'ring-blue-400' },
  medium: { label: '中风险', color: 'text-yellow-700', bg: 'bg-yellow-100', text: 'text-yellow-700', ring: 'ring-yellow-400' },
  high: { label: '高风险', color: 'text-orange-700', bg: 'bg-orange-100', text: 'text-orange-700', ring: 'ring-orange-400' },
  major: { label: '重大风险', color: 'text-white', bg: 'bg-red-600', text: 'text-white', ring: 'ring-red-500' },
};

// 状态映射
export const STATUS_MAP: Record<HazardStatus, { label: string; text: string; color: string }> = {
  reported: { label: '待指派', text: '待指派', color: 'bg-red-50 text-red-600 border-red-200' },
  assigned: { label: '待整改', text: '待整改', color: 'bg-orange-50 text-orange-600 border-orange-200' },
  rectifying: { label: '整改中', text: '整改中', color: 'bg-blue-50 text-blue-600 border-blue-200' },
  verified: { label: '待验收', text: '待验收', color: 'bg-purple-50 text-purple-600 border-purple-200' },
  closed: { label: '已闭环', text: '已闭环', color: 'bg-green-50 text-green-600 border-green-200' },
};

// 处理策略名称映射（用于流程预览信息降噪）
export const STRATEGY_NAME_MAP: Record<string, string> = {
  'fixed': '固定人员',
  'reporter_manager': '上报人主管',
  'responsible_manager': '责任部门主管',
  'department_manager': '部门主管',
  'risk_match': '按风险等级',
  'responsible': '责任人',
  'reporter': '上报人',
};

// 根本原因分析分类选项
export const ROOT_CAUSE_OPTIONS = [
  { value: 'unsafe_act', label: '人的不安全行为 (Unsafe Act)' },
  { value: 'unsafe_condition', label: '物的不安全状态 (Unsafe Condition)' },
  { value: 'management_defect', label: '管理缺陷 (Management Defect)' },
  { value: 'environmental', label: '环境因素 (Environmental)' },
  { value: 'others', label: '其他 (Others)' },
] as const;

// 根本原因分类映射（用于显示）
export const ROOT_CAUSE_MAP: Record<string, string> = {
  'unsafe_act': '人的不安全行为',
  'unsafe_condition': '物的不安全状态',
  'management_defect': '管理缺陷',
  'environmental': '环境因素',
  'others': '其他',
};