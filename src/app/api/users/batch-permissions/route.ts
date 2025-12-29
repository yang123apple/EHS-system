import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// POST: 批量更新用户权限
export async function POST(req: Request) {
  try {
    const { userIds, permissions, mode } = await req.json();
    
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json({ error: '未选择用户' }, { status: 400 });
    }
    
    if (!permissions || typeof permissions !== 'object') {
      return NextResponse.json({ error: '权限数据格式错误' }, { status: 400 });
    }
    
    // mode: 'overwrite' (覆盖), 'merge' (合并), 'remove' (移除)
    const updateMode = mode || 'overwrite';
    
    const results = {
      success: [] as string[],
      failed: [] as Array<{ userId: string; reason: string }>,
    };
    
    for (const userId of userIds) {
      try {
        const user = await db.getUserById(userId);
        if (!user) {
          results.failed.push({ userId, reason: '用户不存在' });
          continue;
        }
        
        if (user.username === 'admin') {
          results.failed.push({ userId, reason: '无法修改超级管理员权限' });
          continue;
        }
        
        let newPermissions = { ...user.permissions };
        
        if (updateMode === 'overwrite') {
          // 覆盖模式：直接替换
          newPermissions = permissions;
        } else if (updateMode === 'merge') {
          // 合并模式：将新权限合并到现有权限
          Object.keys(permissions).forEach(module => {
            if (permissions[module] && Array.isArray(permissions[module])) {
              const existing = newPermissions[module] || [];
              const combined = [...new Set([...existing, ...permissions[module]])];
              newPermissions[module] = combined;
            }
          });
        } else if (updateMode === 'remove') {
          // 移除模式：从现有权限中移除指定权限
          Object.keys(permissions).forEach(module => {
            if (permissions[module] && Array.isArray(permissions[module])) {
              const existing = newPermissions[module] || [];
              newPermissions[module] = existing.filter(
                (perm: string) => !permissions[module].includes(perm)
              );
              if (newPermissions[module].length === 0) {
                delete newPermissions[module];
              }
            }
          });
        }
        
        const updated = await db.updateUser(userId, { permissions: newPermissions });
        
        if (updated) {
          results.success.push(userId);
        } else {
          results.failed.push({ userId, reason: '更新失败' });
        }
      } catch (error) {
        results.failed.push({ userId, reason: '系统错误' });
      }
    }
    
    return NextResponse.json({
      success: true,
      results,
      message: `成功更新 ${results.success.length} 个用户，失败 ${results.failed.length} 个`,
    });
  } catch (error) {
    console.error('批量更新权限错误:', error);
    return NextResponse.json({ error: '批量更新失败' }, { status: 500 });
  }
}
