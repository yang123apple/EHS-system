// src/lib/mockDb.ts
// ⚠️ 本文件现已重构为 Prisma 的代理层，原有的内存/JSON逻辑已被 src/lib/db.ts 接管
// ⚠️ 保留部分类型导出以兼容现有代码，但逻辑已转发

import { db as prismaDb } from './db';
import { User, DepartmentNode, HazardRecord, HazardConfig } from '@/types/database';

// ==========================================
// 1. 系统模块与权限定义 (常量保持不变)
// ==========================================
export const SYSTEM_MODULES = [
  {
    key: 'work_permit',
    name: '作业许可系统',
    permissions: [
      { key: 'create_project', name: '新建工程' },
      { key: 'delete_project', name: '删除工程' },
      { key: 'adjust_schedule', name: '工期调整' },
      { key: 'create_permit', name: '新建关联表单' },
      { key: 'delete_permit', name: '删除关联表单' },
      { key: 'upload_template', name: '上传模板' },
      { key: 'edit_template', name: '编辑模板' },
      { key: 'lock_template', name: '锁定模板' },
      { key: 'delete_template', name: '删除模板' },
      { key: 'approve_permit', name: '审批作业票' },
    ],
  },
  {
    key: 'hidden_danger',
    name: '隐患排查治理系统',
    permissions: [
      { key: 'report', name: '隐患上报' },
      { key: 'handle', name: '整改/验收隐患' },
      { key: 'assign', name: '指派责任人 (管理)' },
      { key: 'view_stats', name: '查看统计报表' },
      { key: 'manage_config', name: '配置基础数据 (Admin)' },
      { key: 'delete', name: '删除隐患记录 (Admin)' },
    ],
  },
  {
    key: 'doc_sys',
    name: 'EHS文档管理系统',
    permissions: [
      { key: 'upload', name: '上传文件 (DOCX/PDF)' },
      { key: 'down_docx_l123', name: '下载 DOCX (1-3级体系文件)' },
      { key: 'down_docx_l4', name: '下载 DOCX (4级记录表格)' },
      { key: 'down_pdf', name: '下载 PDF 源文件' },
      { key: 'delete', name: '删除文件' },
      { key: 'edit', name: '编辑文件信息' },
    ],
  },
];

// ==========================================
// 2. 类型导出 (直接复用 database.ts，减少重复定义)
// ==========================================
export type { User, UserRole, UserPermissions, DepartmentNode, HazardRecord, HazardLog, HazardConfig } from '@/types/database';

// ==========================================
// 3. 数据库操作对象 (转发到 prismaDb)
// ==========================================

export const db = {
  // === 用户相关 ===
  getUsers: async () => prismaDb.getUsers(),

  getUserByUsername: async (username: string) => {
    const users = await prismaDb.getUsers();
    return users.find((u) => u.username === username);
  },

  getUserById: async (id: string) => prismaDb.getUserById(id),

  updateUser: async (id: string, data: Partial<User>) => prismaDb.updateUser(id, data),

  createUser: async (data: any) => prismaDb.saveUser(data),

  deleteUser: async (id: string) => prismaDb.deleteUser(id),

  // === 组织架构相关 ===
  getDepartments: async () => prismaDb.getDepartments(),

  getOrgTree: async () => prismaDb.getOrgTree(),

  createDepartment: async (data: { name: string; parentId: string | null; managerId?: string; level: number }) => {
    return prismaDb.createDepartment(data);
  },

  updateDepartment: async (id: string, data: Partial<DepartmentNode>) => prismaDb.updateDepartment(id, data),

  deleteDepartment: async (id: string) => prismaDb.deleteDepartment(id),

  // === 隐患相关 ===
  getHazards: async () => prismaDb.getHazards(),

  createHazard: async (data: any) => prismaDb.createHazard(data),

  updateHazard: async (id: string, data: Partial<HazardRecord>) => prismaDb.updateHazard(id, data),

  deleteHazard: async (id: string) => prismaDb.deleteHazard(id),

  getHazardConfig: async () => prismaDb.getHazardConfig(),

  updateHazardConfig: async (data: Partial<HazardConfig>) => prismaDb.updateHazardConfig(data),
};

// ==========================================
// 4. 辅助函数 (兼容旧 API)
// ==========================================
// 注意：这些函数原本是同步返回数组，但现在数据在数据库里，必须变为异步或者仅供特殊场景使用
// 为了兼容，我们这里只能抛出错误或提供临时实现，但根据 grep 结果，这些函数主要用于 userDb 内部，
// 而 userDb 我们也会重构。

export const getUsers = () => {
    console.warn("Call to deprecated synchronous getUsers(). This may fail.");
    return [];
};
export const saveUsers = (newUsers: User[]) => { console.warn("Call to deprecated saveUsers(). Ignored."); };
export const generateUniqueId = () => Math.floor(10000000 + Math.random() * 90000000).toString();
