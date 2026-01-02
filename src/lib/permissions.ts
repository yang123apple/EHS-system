// src/lib/permissions.ts
/**
 * 权限管理工具类
 * 提供统一的权限检查、验证和管理功能
 */

import { SYSTEM_MODULES } from './constants';

export interface User {
  id: string;
  username: string;
  name: string;
  role: 'admin' | 'user';
  permissions: Record<string, string[]>;
  [key: string]: any;
}

export class PermissionManager {
  /**
   * 检查用户是否拥有指定模块的指定权限
   */
  static hasPermission(user: User | null, module: string, permission: string): boolean {
    if (!user) return false;
    
    // Admin 拥有所有权限
    if (user.role === 'admin') return true;
    
    // 检查权限对象
    if (!user.permissions || typeof user.permissions !== 'object') return false;
    
    // 检查模块权限
    const modulePermissions = user.permissions[module];
    if (!modulePermissions || !Array.isArray(modulePermissions)) return false;
    
    return modulePermissions.includes(permission);
  }

  /**
   * 检查用户是否可以操作指定资源（支持创建人权限检查）
   * @param user 用户对象
   * @param module 模块名
   * @param permissionBase 权限基础名称（如 'edit_material'）
   * @param creatorId 资源创建人ID
   * @param currentUserId 当前用户ID
   * @returns true 如果用户有权限操作该资源
   */
  static canOperateResource(
    user: User | null,
    module: string,
    permissionBase: string,
    creatorId: string | null | undefined,
    currentUserId: string | null | undefined
  ): boolean {
    if (!user || !currentUserId) return false;
    
    // Admin 拥有所有权限
    if (user.role === 'admin') return true;
    
    // 检查是否有 all 权限（可以操作所有人的资源）
    if (this.hasPermission(user, module, `${permissionBase}_all`)) {
      return true;
    }
    
    // 检查是否是创建人，且有 self 权限
    if (creatorId && creatorId === currentUserId) {
      return this.hasPermission(user, module, `${permissionBase}_self`);
    }
    
    return false;
  }

  /**
   * 检查用户是否可以访问指定模块（基础权限）
   */
  static canAccessModule(user: User | null, module: string): boolean {
    return this.hasPermission(user, module, 'access');
  }

  /**
   * 获取用户在指定模块的所有权限
   */
  static getModulePermissions(user: User | null, module: string): string[] {
    if (!user) return [];
    
    // Admin 拥有所有权限
    if (user.role === 'admin') {
      const moduleConfig = SYSTEM_MODULES.find(m => m.key === module);
      if (moduleConfig) {
        return [moduleConfig.basePermission, ...moduleConfig.permissions.map(p => p.key)];
      }
      return [];
    }
    
    // 返回用户的模块权限
    if (!user.permissions || typeof user.permissions !== 'object') return [];
    return user.permissions[module] || [];
  }

  /**
   * 检查用户是否拥有指定模块的任一权限
   */
  static hasAnyPermission(user: User | null, module: string, permissions: string[]): boolean {
    if (!user) return false;
    if (user.role === 'admin') return true;
    
    return permissions.some(perm => this.hasPermission(user, module, perm));
  }

  /**
   * 检查用户是否拥有指定权限的 self 或 all 版本
   * 用于判断用户是否有操作权限（不区分资源）
   */
  static hasResourcePermission(user: User | null, module: string, permissionBase: string): boolean {
    if (!user) return false;
    if (user.role === 'admin') return true;
    
    return this.hasPermission(user, module, `${permissionBase}_self`) ||
           this.hasPermission(user, module, `${permissionBase}_all`);
  }

  /**
   * 检查用户是否拥有指定模块的所有权限
   */
  static hasAllPermissions(user: User | null, module: string, permissions: string[]): boolean {
    if (!user) return false;
    if (user.role === 'admin') return true;
    
    return permissions.every(perm => this.hasPermission(user, module, perm));
  }

  /**
   * 要求用户拥有指定权限，否则抛出错误
   */
  static requirePermission(user: User | null, module: string, permission: string): void {
    if (!this.hasPermission(user, module, permission)) {
      throw new PermissionError(
        `权限不足: 需要 ${module}.${permission} 权限`,
        module,
        permission
      );
    }
  }

  /**
   * 验证权限配置的有效性
   */
  static validatePermissions(permissions: Record<string, string[]>): boolean {
    if (!permissions || typeof permissions !== 'object') return false;
    
    for (const [module, perms] of Object.entries(permissions)) {
      // 检查模块是否存在
      const moduleConfig = SYSTEM_MODULES.find(m => m.key === module);
      if (!moduleConfig) continue;
      
      // 检查权限是否有效
      if (!Array.isArray(perms)) return false;
      
      const validPerms = [
        moduleConfig.basePermission,
        ...moduleConfig.permissions.map(p => p.key)
      ];
      
      for (const perm of perms) {
        if (!validPerms.includes(perm)) return false;
      }
    }
    
    return true;
  }

  /**
   * 获取所有可用的模块和权限
   */
  static getAllModules() {
    return SYSTEM_MODULES;
  }

  /**
   * 获取指定模块的所有可用权限
   */
  static getModuleAvailablePermissions(module: string): string[] {
    const moduleConfig = SYSTEM_MODULES.find(m => m.key === module);
    if (!moduleConfig) return [];
    
    return [moduleConfig.basePermission, ...moduleConfig.permissions.map(p => p.key)];
  }
}

/**
 * 权限错误类
 */
export class PermissionError extends Error {
  module: string;
  permission: string;
  
  constructor(message: string, module: string, permission: string) {
    super(message);
    this.name = 'PermissionError';
    this.module = module;
    this.permission = permission;
  }
}

/**
 * 便捷函数：创建权限检查器
 */
export function createPermissionChecker(user: User | null) {
  return {
    has: (module: string, permission: string) => 
      PermissionManager.hasPermission(user, module, permission),
    
    canAccess: (module: string) => 
      PermissionManager.canAccessModule(user, module),
    
    hasAny: (module: string, permissions: string[]) => 
      PermissionManager.hasAnyPermission(user, module, permissions),
    
    hasAll: (module: string, permissions: string[]) => 
      PermissionManager.hasAllPermissions(user, module, permissions),
    
    require: (module: string, permission: string) => 
      PermissionManager.requirePermission(user, module, permission),
    
    getModulePerms: (module: string) => 
      PermissionManager.getModulePermissions(user, module),
  };
}
