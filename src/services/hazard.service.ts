// src/services/hazard.service.ts
import { HazardRecord, HazardConfig } from '@/types/hidden-danger';
import { api } from '@/lib/apiClient';

export const hazardService = {
  async getHazards(page?: number, limit?: number, filters?: any): Promise<any> {
    const params: Record<string, string> = {};
    if (page) params.page = page.toString();
    if (limit) params.limit = limit.toString();

    if (filters) {
        if (filters.type) params.filterType = filters.type;
        if (filters.area) params.area = filters.area;
        if (filters.status) params.status = filters.status;
        if (filters.risk) params.risk = filters.risk;
        if (filters.viewMode) params.viewMode = filters.viewMode;
        if (filters.userId) params.userId = filters.userId;
        // ✅ 添加时间筛选参数
        if (filters.startDate) params.startDate = filters.startDate;
        if (filters.endDate) params.endDate = filters.endDate;
        // ✅ 添加责任部门筛选参数
        if (filters.responsibleDept) params.responsibleDept = filters.responsibleDept;
    }

    return api.get('/api/hazards', params);
  },

  async getStats() {
    return api.get('/api/hazards', { type: 'stats' });
  },

  async getConfig(): Promise<HazardConfig> {
    return api.get('/api/hazards/config');
  },

  async updateHazard(payload: Partial<HazardRecord> & { id: string }) {
    return api.patch('/api/hazards', payload);
  },

  async createHazard(payload: any) {
    return api.post('/api/hazards', payload);
  },

  // 软删除（作废）- 默认操作
  async voidHazard(id: string, reason: string) {
    return api.post('/api/hazards/void', { hazardId: id, reason });
  },

  // 硬删除（永久删除）- 仅管理员特殊情况使用
  async destroyHazard(id: string) {
    return api.delete('/api/hazards/destroy', { id });
  },

  // 保留旧方法名作为别名，默认执行软删除
  async deleteHazard(id: string, reason: string = '管理员作废') {
    return this.voidHazard(id, reason);
  }
};
