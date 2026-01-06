// src/services/workflow.service.ts
import { CCRule, EmergencyPlanRule, HazardWorkflowConfig } from '@/types/hidden-danger';
import { apiFetch } from '@/lib/apiClient';

export const workflowService = {
  /**
   * 获取所有工作流规则
   * 注意：API 返回的是 HazardWorkflowConfig，但为了兼容性，我们返回 { ccRules, emergencyPlanRules } 格式
   */
  async getRules(): Promise<{ ccRules: CCRule[], emergencyPlanRules: EmergencyPlanRule[] }> {
    const res = await apiFetch('/api/hazards/workflow');
    if (!res.ok) throw new Error('获取工作流规则失败');
    const result = await res.json();
    
    // API 返回格式: { success: true, data: HazardWorkflowConfig }
    const config: HazardWorkflowConfig = result.data || result;
    
    // 为了兼容性，返回空数组（实际使用中可能直接使用 config.steps）
    return {
      ccRules: [],
      emergencyPlanRules: []
    };
  },

  /**
   * 获取工作流配置（新方法，返回完整的 HazardWorkflowConfig）
   */
  async getConfig(): Promise<HazardWorkflowConfig> {
    const res = await apiFetch('/api/hazards/workflow');
    if (!res.ok) throw new Error('获取工作流配置失败');
    const result = await res.json();
    return result.data || result;
  },

  /**
   * 保存或更新工作流规则
   */
  async saveRules(rules: { ccRules: CCRule[], emergencyPlanRules: EmergencyPlanRule[] }) {
    const res = await apiFetch('/api/hazards/workflow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rules),
    });
    if (!res.ok) throw new Error('保存规则失败');
    return res.json();
  }
};