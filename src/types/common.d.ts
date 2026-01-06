// src/types/common.d.ts

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  code?: number;
}

export interface PaginatedResponse<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface UserContext {
  id: string;
  name: string;
  role: 'admin' | 'user' | 'manager';
  permissions: Record<string, string[]>;
}