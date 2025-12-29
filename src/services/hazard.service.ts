// src/services/hazard.service.ts
import { HazardRecord, HazardConfig } from '@/types/hidden-danger';

export const hazardService = {
  async getHazards(page?: number, limit?: number, filters?: any): Promise<any> {
    const params = new URLSearchParams();
    if (page) params.append('page', page.toString());
    if (limit) params.append('limit', limit.toString());

    if (filters) {
        if (filters.type) params.append('filterType', filters.type);
        if (filters.area) params.append('area', filters.area);
        if (filters.status) params.append('status', filters.status);
        if (filters.risk) params.append('risk', filters.risk);
        if (filters.viewMode) params.append('viewMode', filters.viewMode);
        if (filters.userId) params.append('userId', filters.userId);
    }

    const queryString = params.toString();
    const url = queryString ? `/api/hazards?${queryString}` : '/api/hazards';

    const res = await fetch(url);
    return res.json();
  },

  async getStats() {
    const res = await fetch('/api/hazards?type=stats');
    return res.json();
  },

  async getConfig(): Promise<HazardConfig> {
    const res = await fetch('/api/hazards/config');
    return res.json();
  },

  async updateHazard(payload: Partial<HazardRecord> & { id: string }) {
    const res = await fetch('/api/hazards', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const error = await res.text();
      console.error('更新失败:', res.status, error);
      throw new Error(`更新失败: ${res.status} ${error}`);
    }
    return res.json();
  },

  async createHazard(payload: any) {
    const res = await fetch('/api/hazards', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('创建失败');
    return res.json();
  },

  async deleteHazard(id: string) {
    const res = await fetch(`/api/hazards?id=${id}`, { 
      method: 'DELETE' 
    });
    if (!res.ok) throw new Error('删除失败');
    return res.json();
  }
};
