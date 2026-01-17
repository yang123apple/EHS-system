/**
 * 测试辅助工具函数和 Mock 数据
 */

import { HazardRecord, HazardWorkflowStep, SimpleUser } from '@/types/hidden-danger';
import type { Department } from '@/utils/departmentUtils';
import { User } from '@prisma/client';

/**
 * 创建模拟用户
 */
export function createMockUser(overrides?: Partial<User>): User {
  return {
    id: overrides?.id || 'user-001',
    username: overrides?.username || 'testuser',
    name: overrides?.name || '测试用户',
    email: overrides?.email || 'test@example.com',
    password: overrides?.password || 'hashed_password',
    role: overrides?.role || 'user',
    permissions: overrides?.permissions || {},
    departmentId: overrides?.departmentId || null,
    department: null,
    createdAt: overrides?.createdAt || new Date(),
    updatedAt: overrides?.updatedAt || new Date(),
    ...overrides,
  } as User;
}

/**
 * 创建模拟管理员用户
 */
export function createMockAdmin(overrides?: Partial<User>): User {
  return createMockUser({
    id: 'admin-001',
    username: 'admin',
    name: '管理员',
    role: 'admin',
    permissions: {},
    ...overrides,
  });
}

/**
 * 创建模拟 SimpleUser
 */
export function createMockSimpleUser(overrides?: Partial<SimpleUser>): SimpleUser {
  return {
    id: overrides?.id || 'user-001',
    name: overrides?.name || '测试用户',
    username: overrides?.username || 'testuser',
    email: overrides?.email || 'test@example.com',
    role: overrides?.role || 'user',
    departmentId: overrides?.departmentId || null,
    departmentName: overrides?.departmentName || null,
    ...overrides,
  };
}

/**
 * 创建模拟隐患记录
 */
export function createMockHazard(overrides?: Partial<HazardRecord>): HazardRecord {
  const now = new Date().toISOString();
  return {
    id: overrides?.id || 'hazard-001',
    code: overrides?.code || 'Hazard20250112001',
    status: overrides?.status || 'reported',
    riskLevel: overrides?.riskLevel || 'low',
    type: overrides?.type || '安全隐患',
    location: overrides?.location || '测试地点',
    desc: overrides?.desc || '测试描述',
    photos: overrides?.photos || [],
    reporterId: overrides?.reporterId || 'user-001',
    reporterName: overrides?.reporterName || '测试用户',
    reportTime: overrides?.reportTime || now,
    currentStepIndex: overrides?.currentStepIndex ?? 0,
    currentStepId: overrides?.currentStepId || 'report',
    ...overrides,
  };
}

/**
 * 创建模拟工作流步骤
 */
export function createMockWorkflowSteps(): HazardWorkflowStep[] {
  return [
    {
      id: 'report',
      name: '上报并指派',
      description: '隐患上报，执行人强制为发起人',
      handlerStrategy: {
        type: 'fixed',
        description: '执行人：上报人（系统自动）',
        fixedUsers: [],
        approvalMode: 'OR',
      },
      ccRules: [],
    },
    {
      id: 'assign',
      name: '开始整改',
      description: '指派整改责任人',
      handlerStrategy: {
        type: 'role',
        description: '默认：管理员角色',
        roleName: '管理员',
        approvalMode: 'OR',
      },
      ccRules: [],
    },
    {
      id: 'rectify',
      name: '提交整改',
      description: '整改责任人提交整改结果',
      handlerStrategy: {
        type: 'fixed',
        description: '执行人：整改责任人（系统自动）',
        fixedUsers: [],
        approvalMode: 'OR',
      },
      ccRules: [],
    },
    {
      id: 'verify',
      name: '验收闭环',
      description: '验收整改结果',
      handlerStrategy: {
        type: 'role',
        description: '默认：管理员角色',
        roleName: '管理员',
        approvalMode: 'OR',
      },
      ccRules: [],
    },
  ];
}

/**
 * 创建模拟部门
 */
export function createMockDepartments(): Department[] {
  return [
    {
      id: 'dept-001',
      name: '技术部',
      parentId: null,
      level: 0,
      path: '/技术部',
      children: [],
    },
    {
      id: 'dept-002',
      name: '安全部',
      parentId: null,
      level: 0,
      path: '/安全部',
      children: [],
    },
  ];
}

/**
 * 等待指定时间（用于测试异步操作）
 */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 生成随机字符串
 */
export function randomString(length: number = 8): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * 模拟日期（用于测试编号生成）
 */
export function mockDate(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day);
}
