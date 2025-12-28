// src/constants/hazard.ts
import { HazardStatus, RiskLevel } from '@/types/hidden-danger';

// 视图模式定义
export type ViewMode = 'overview' | 'my_tasks' | 'all_list' | 'stats' | 'config';

export const VIEW_MODES = {
  OVERVIEW: 'overview' as ViewMode,
  MY_TASKS: 'my_tasks' as ViewMode,
  ALL_LIST: 'all_list' as ViewMode,
  STATS: 'stats' as ViewMode,
  CONFIG: 'config' as ViewMode,
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
