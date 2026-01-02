// src/services/user.service.ts
import { SimpleUser } from '@/types/hidden-danger';
import { apiFetch } from '@/lib/apiClient';

export const userService = {
  async getAllUsers(): Promise<SimpleUser[]> {
    const res = await apiFetch('/api/users');
    if (!res.ok) throw new Error('获取用户列表失败');
    return res.json();
  },
  
  // 提取部门列表
  getDepartments(users: SimpleUser[]): string[] {
    return Array.from(new Set(users.map(u => u.department).filter(Boolean) as string[]));
  }
};
