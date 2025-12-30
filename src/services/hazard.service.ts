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

  async deleteHazard(id: string) {
    return api.delete('/api/hazards', { id });
  }
};
