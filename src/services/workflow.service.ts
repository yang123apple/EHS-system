// src/services/workflow.service.ts
import { CCRule, EmergencyPlanRule } from '@/types/hidden-danger';

export const workflowService = {
  /**
   * 获取所有工作流规则
   */
  async getRules(): Promise<{ ccRules: CCRule[], emergencyPlanRules: EmergencyPlanRule[] }> {
    const res = await fetch('/api/hazards/workflow');
    if (!res.ok) throw new Error('获取工作流规则失败');
    return res.json();
  },

  /**
   * 保存或更新工作流规则
   */
  async saveRules(rules: { ccRules: CCRule[], emergencyPlanRules: EmergencyPlanRule[] }) {
    const res = await fetch('/api/hazards/workflow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rules),
    });
    if (!res.ok) throw new Error('保存规则失败');
    return res.json();
  }
};