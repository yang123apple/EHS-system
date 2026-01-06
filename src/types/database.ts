// src/types/database.ts

export type UserRole = 'admin' | 'user';

export interface UserPermissions {
  [moduleKey: string]: string[];
}

export interface User {
  id: string;
  username: string;
  name: string;
  password: string;
  avatar: string;
  role: UserRole;
  department: string;
  departmentId?: string;
  jobTitle?: string;
  directManagerId?: string;
  permissions: UserPermissions;
}

export interface DepartmentNode {
  id: string;
  name: string;
  parentId: string | null;
  managerId?: string;
  level: number;
  children?: DepartmentNode[];
}

// 隐患相关
export interface HazardLog { operatorId: string; operatorName: string; action: string; time: string; changes?: string; }
export interface HazardRecord {
  id: string; status: string; riskLevel: string; type: string; location: string; desc: string; photos: string[];
  reporterId: string; reporterName: string; reportTime: string;
  responsibleDept?: string; responsibleId?: string; responsibleName?: string; deadline?: string;
  logs: HazardLog[];
  [key: string]: any;
}
export interface HazardConfig { types: string[]; areas: string[]; }