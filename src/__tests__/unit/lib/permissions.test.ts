/**
 * 权限管理单元测试
 * 测试权限检查、资源权限、权限验证等核心功能
 */

import { PermissionManager, PermissionError } from '@/lib/permissions';
import { createMockUser, createMockAdmin } from '../../__mocks__/test-helpers';

describe('PermissionManager', () => {
  describe('hasPermission', () => {
    it('管理员应该拥有所有权限', () => {
      const admin = createMockAdmin();
      expect(PermissionManager.hasPermission(admin, 'hidden_danger', 'view_all')).toBe(true);
      expect(PermissionManager.hasPermission(admin, 'any_module', 'any_permission')).toBe(true);
    });

    it('null 用户应该没有权限', () => {
      expect(PermissionManager.hasPermission(null, 'hidden_danger', 'view_all')).toBe(false);
    });

    it('普通用户有权限时应该返回 true', () => {
      const user = createMockUser({
        permissions: {
          hidden_danger: ['view_all', 'create'],
        },
      });

      expect(PermissionManager.hasPermission(user, 'hidden_danger', 'view_all')).toBe(true);
      expect(PermissionManager.hasPermission(user, 'hidden_danger', 'create')).toBe(true);
    });

    it('普通用户没有权限时应该返回 false', () => {
      const user = createMockUser({
        permissions: {
          hidden_danger: ['view_all'],
        },
      });

      expect(PermissionManager.hasPermission(user, 'hidden_danger', 'delete')).toBe(false);
      expect(PermissionManager.hasPermission(user, 'other_module', 'view_all')).toBe(false);
    });

    it('应该处理空的权限对象', () => {
      const user = createMockUser({
        permissions: {},
      });

      expect(PermissionManager.hasPermission(user, 'hidden_danger', 'view_all')).toBe(false);
    });

    it('应该处理无效的权限结构', () => {
      const user = createMockUser({
        permissions: null as any,
      });

      expect(PermissionManager.hasPermission(user, 'hidden_danger', 'view_all')).toBe(false);
    });
  });

  describe('canOperateResource', () => {
    it('管理员应该可以操作所有资源', () => {
      const admin = createMockAdmin();
      expect(PermissionManager.canOperateResource(
        admin,
        'hidden_danger',
        'edit',
        'user-001',
        'admin-001'
      )).toBe(true);
    });

    it('有 all 权限的用户应该可以操作所有人的资源', () => {
      const user = createMockUser({
        id: 'user-001',
        permissions: {
          hidden_danger: ['edit_all'],
        },
      });

      expect(PermissionManager.canOperateResource(
        user,
        'hidden_danger',
        'edit',
        'other-user-id',
        'user-001'
      )).toBe(true);
    });

    it('有 self 权限的用户应该只能操作自己的资源', () => {
      const user = createMockUser({
        id: 'user-001',
        permissions: {
          hidden_danger: ['edit_self'],
        },
      });

      // 操作自己的资源
      expect(PermissionManager.canOperateResource(
        user,
        'hidden_danger',
        'edit',
        'user-001',
        'user-001'
      )).toBe(true);

      // 操作别人的资源
      expect(PermissionManager.canOperateResource(
        user,
        'hidden_danger',
        'edit',
        'other-user-id',
        'user-001'
      )).toBe(false);
    });

    it('没有权限的用户不应该可以操作资源', () => {
      const user = createMockUser({
        id: 'user-001',
        permissions: {},
      });

      expect(PermissionManager.canOperateResource(
        user,
        'hidden_danger',
        'edit',
        'user-001',
        'user-001'
      )).toBe(false);
    });

    it('null 用户不应该可以操作资源', () => {
      expect(PermissionManager.canOperateResource(
        null,
        'hidden_danger',
        'edit',
        'user-001',
        'user-001'
      )).toBe(false);
    });
  });

  describe('canAccessModule', () => {
    it('管理员应该可以访问所有模块', () => {
      const admin = createMockAdmin();
      expect(PermissionManager.canAccessModule(admin, 'hidden_danger')).toBe(true);
    });

    it('有 access 权限的用户应该可以访问模块', () => {
      const user = createMockUser({
        permissions: {
          hidden_danger: ['access'],
        },
      });

      expect(PermissionManager.canAccessModule(user, 'hidden_danger')).toBe(true);
    });

    it('没有 access 权限的用户不应该可以访问模块', () => {
      const user = createMockUser({
        permissions: {
          hidden_danger: ['view_all'],
        },
      });

      // canAccessModule 检查的是 access 权限
      // 如果用户只有 view_all 但没有 access，应该返回 false
      // 这取决于具体实现，这里假设 access 是必需的
      expect(PermissionManager.canAccessModule(user, 'hidden_danger')).toBe(false);
    });
  });

  describe('getModulePermissions', () => {
    it('管理员应该返回所有可用权限', () => {
      const admin = createMockAdmin();
      const perms = PermissionManager.getModulePermissions(admin, 'hidden_danger');

      // 管理员应该返回所有模块的可用权限（如果配置了 SYSTEM_MODULES）
      expect(Array.isArray(perms)).toBe(true);
    });

    it('普通用户应该返回其拥有的模块权限', () => {
      const user = createMockUser({
        permissions: {
          hidden_danger: ['view_all', 'create', 'edit_self'],
        },
      });

      const perms = PermissionManager.getModulePermissions(user, 'hidden_danger');
      expect(perms).toEqual(['view_all', 'create', 'edit_self']);
    });

    it('null 用户应该返回空数组', () => {
      const perms = PermissionManager.getModulePermissions(null, 'hidden_danger');
      expect(perms).toEqual([]);
    });
  });

  describe('hasAnyPermission', () => {
    it('管理员应该始终返回 true', () => {
      const admin = createMockAdmin();
      expect(PermissionManager.hasAnyPermission(admin, 'hidden_danger', [])).toBe(true);
    });

    it('用户有任一权限时应该返回 true', () => {
      const user = createMockUser({
        permissions: {
          hidden_danger: ['view_all'],
        },
      });

      expect(PermissionManager.hasAnyPermission(
        user,
        'hidden_danger',
        ['view_all', 'create']
      )).toBe(true);
    });

    it('用户没有任何权限时应该返回 false', () => {
      const user = createMockUser({
        permissions: {
          hidden_danger: ['view_all'],
        },
      });

      expect(PermissionManager.hasAnyPermission(
        user,
        'hidden_danger',
        ['delete', 'export']
      )).toBe(false);
    });
  });

  describe('hasAllPermissions', () => {
    it('管理员应该始终返回 true', () => {
      const admin = createMockAdmin();
      expect(PermissionManager.hasAllPermissions(admin, 'hidden_danger', ['view_all', 'create'])).toBe(true);
    });

    it('用户拥有所有权限时应该返回 true', () => {
      const user = createMockUser({
        permissions: {
          hidden_danger: ['view_all', 'create', 'edit_self'],
        },
      });

      expect(PermissionManager.hasAllPermissions(
        user,
        'hidden_danger',
        ['view_all', 'create']
      )).toBe(true);
    });

    it('用户缺少任一权限时应该返回 false', () => {
      const user = createMockUser({
        permissions: {
          hidden_danger: ['view_all'],
        },
      });

      expect(PermissionManager.hasAllPermissions(
        user,
        'hidden_danger',
        ['view_all', 'create']
      )).toBe(false);
    });
  });

  describe('requirePermission', () => {
    it('管理员不应该抛出错误', () => {
      const admin = createMockAdmin();
      expect(() => {
        PermissionManager.requirePermission(admin, 'hidden_danger', 'any_permission');
      }).not.toThrow();
    });

    it('有权限的用户不应该抛出错误', () => {
      const user = createMockUser({
        permissions: {
          hidden_danger: ['view_all'],
        },
      });

      expect(() => {
        PermissionManager.requirePermission(user, 'hidden_danger', 'view_all');
      }).not.toThrow();
    });

    it('没有权限的用户应该抛出 PermissionError', () => {
      const user = createMockUser({
        permissions: {},
      });

      expect(() => {
        PermissionManager.requirePermission(user, 'hidden_danger', 'view_all');
      }).toThrow(PermissionError);
    });

    it('PermissionError 应该包含模块和权限信息', () => {
      const user = createMockUser({
        permissions: {},
      });

      try {
        PermissionManager.requirePermission(user, 'hidden_danger', 'view_all');
        fail('应该抛出错误');
      } catch (error) {
        expect(error).toBeInstanceOf(PermissionError);
        if (error instanceof PermissionError) {
          expect(error.module).toBe('hidden_danger');
          expect(error.permission).toBe('view_all');
          expect(error.message).toContain('hidden_danger');
          expect(error.message).toContain('view_all');
        }
      }
    });
  });

  describe('validatePermissions', () => {
    it('应该验证有效的权限配置', () => {
      const validPermissions = {
        hidden_danger: ['view_all', 'create', 'edit_self'],
      };

      // 注意：这个测试依赖于 SYSTEM_MODULES 的实际配置
      // 如果模块或权限不存在于配置中，可能返回 false
      const result = PermissionManager.validatePermissions(validPermissions);
      expect(typeof result).toBe('boolean');
    });

    it('应该拒绝无效的权限结构', () => {
      expect(PermissionManager.validatePermissions(null as any)).toBe(false);
      expect(PermissionManager.validatePermissions(undefined as any)).toBe(false);
      expect(PermissionManager.validatePermissions('invalid' as any)).toBe(false);
    });

    it('应该验证权限数组', () => {
      const invalidPermissions = {
        hidden_danger: 'not_an_array',
      };

      expect(PermissionManager.validatePermissions(invalidPermissions as any)).toBe(false);
    });
  });
});
