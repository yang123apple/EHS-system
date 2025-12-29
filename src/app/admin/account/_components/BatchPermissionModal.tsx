"use client";
import { useState, useEffect } from 'react';
import { X, Users, CheckCircle, AlertCircle, Shield, Plus, Minus, RefreshCw } from 'lucide-react';
import { SYSTEM_MODULES } from '@/lib/constants';
import PeopleSelector from '@/components/common/PeopleSelector';

interface User {
  id: string;
  username: string;
  name: string;
  department: string;
  permissions?: Record<string, string[]>;
}

interface BatchPermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  allUsers: User[];
  onSuccess: () => void;
}

export default function BatchPermissionModal({ 
  isOpen, 
  onClose, 
  allUsers,
  onSuccess 
}: BatchPermissionModalProps) {
  const [mode, setMode] = useState<'overwrite' | 'merge' | 'remove'>('merge');
  const [selectedPermissions, setSelectedPermissions] = useState<Record<string, string[]>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // 三种选人模式
  const [selectionMode, setSelectionMode] = useState<'all' | 'department' | 'individual'>('all');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedDepartmentName, setSelectedDepartmentName] = useState('');
  const [localSelectedUsers, setLocalSelectedUsers] = useState<string[]>([]);
  
  // PeopleSelector 弹窗控制
  const [showDeptSelector, setShowDeptSelector] = useState(false);
  const [showUserSelector, setShowUserSelector] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSelectedPermissions({});
      setMode('merge');
      setSelectionMode('all');
      setSelectedDepartment('');
      setLocalSelectedUsers(allUsers.filter(u => u.username !== 'admin').map(u => u.id));
    }
  }, [isOpen, allUsers]);

  if (!isOpen) return null;

  const departments = Array.from(new Set(allUsers.map(u => u.department)));

  // 根据选人模式计算实际选中的用户
  const getActualSelectedUsers = () => {
    if (selectionMode === 'all') {
      return allUsers.filter(u => u.username !== 'admin').map(u => u.id);
    } else if (selectionMode === 'department') {
      return selectedDepartment 
        ? allUsers.filter(u => u.department === selectedDepartment && u.username !== 'admin').map(u => u.id)
        : [];
    } else {
      return localSelectedUsers;
    }
  };

  const actualSelectedUserIds = getActualSelectedUsers();
  const filteredUsers = selectionMode === 'department' && selectedDepartment
    ? allUsers.filter(u => u.department === selectedDepartment)
    : allUsers;

  const toggleUser = (userId: string) => {
    setLocalSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const selectAll = () => {
    setLocalSelectedUsers(allUsers.filter(u => u.username !== 'admin').map(u => u.id));
  };

  const deselectAll = () => {
    setLocalSelectedUsers([]);
  };

  const togglePermission = (moduleKey: string, permKey: string) => {
    setSelectedPermissions(prev => {
      const current = prev[moduleKey] || [];
      const updated = current.includes(permKey)
        ? current.filter(p => p !== permKey)
        : [...current, permKey];
      
      if (updated.length === 0) {
        const { [moduleKey]: _, ...rest } = prev;
        return rest;
      }
      
      return { ...prev, [moduleKey]: updated };
    });
  };

  // 选择基础权限（访问该系统的权限）
  const toggleBasePermission = (moduleKey: string, basePermKey: string) => {
    setSelectedPermissions(prev => {
      const current = prev[moduleKey] || [];
      const hasBase = current.includes(basePermKey);
      
      if (hasBase) {
        // 移除基础权限
        const updated = current.filter(p => p !== basePermKey);
        if (updated.length === 0) {
          const { [moduleKey]: _, ...rest } = prev;
          return rest;
        }
        return { ...prev, [moduleKey]: updated };
      } else {
        // 添加基础权限（只添加基础权限，不包含其他操作权限）
        return { ...prev, [moduleKey]: [...current, basePermKey] };
      }
    });
  };

  // 全选该模块所有权限
  const selectAllModulePermissions = (moduleKey: string, allPerms: string[]) => {
    setSelectedPermissions(prev => {
      return { ...prev, [moduleKey]: allPerms };
    });
  };

  // 取消选择该模块所有权限
  const deselectAllModulePermissions = (moduleKey: string) => {
    setSelectedPermissions(prev => {
      const { [moduleKey]: _, ...rest } = prev;
      return rest;
    });
  };

  const handleSubmit = async () => {
    if (actualSelectedUserIds.length === 0) {
      alert('请至少选择一个用户');
      return;
    }

    const hasPermissions = Object.keys(selectedPermissions).length > 0;
    if (!hasPermissions) {
      alert('请至少选择一项权限');
      return;
    }

    const modeLabels = {
      overwrite: '覆盖',
      merge: '添加',
      remove: '移除',
    };

    const selectedUserNames = allUsers
      .filter(u => actualSelectedUserIds.includes(u.id))
      .map(u => u.name)
      .slice(0, 5)
      .join('、');
    const moreCount = actualSelectedUserIds.length - 5;

    const permissionSummary = Object.entries(selectedPermissions)
      .map(([moduleKey, perms]) => {
        const module = SYSTEM_MODULES.find(m => m.key === moduleKey);
        return `${module?.name}: ${perms.length} 项`;
      })
      .join('\n');

    const confirmed = confirm(
      `确认${modeLabels[mode]}权限？\n\n` +
      `对象：${selectedUserNames}${moreCount > 0 ? ` 等 ${actualSelectedUserIds.length} 人` : ''}\n\n` +
      `操作：${modeLabels[mode]}\n\n` +
      `权限：\n${permissionSummary}`
    );

    if (!confirmed) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/users/batch-permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userIds: actualSelectedUserIds,
          permissions: selectedPermissions,
          mode,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        alert(
          `✅ ${data.message}\n\n` +
          (data.results.failed.length > 0
            ? `失败详情：\n${data.results.failed.slice(0, 5).map((f: any) => {
                const user = allUsers.find(u => u.id === f.userId);
                return `• ${user?.name || f.userId}: ${f.reason}`;
              }).join('\n')}${data.results.failed.length > 5 ? `\n... 还有 ${data.results.failed.length - 5} 个` : ''}`
            : '')
        );
        onSuccess();
        onClose();
      } else {
        alert(`❌ ${data.error || '批量更新失败'}`);
      }
    } catch (error) {
      console.error(error);
      alert('❌ 网络错误');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 处理部门选择器确认
  const handleDeptSelect = (depts: any[]) => {
    if (depts.length > 0) {
      const dept = depts[0]; // 单选模式，只取第一个
      setSelectedDepartment(dept.name);
      setSelectedDepartmentName(dept.name);
    }
  };

  // 处理用户选择器确认
  const handleUserSelect = (users: any[]) => {
    const userIds = users.map(u => u.id).filter(id => {
      const user = allUsers.find(u => u.id === id);
      return user && user.username !== 'admin'; // 排除admin
    });
    setLocalSelectedUsers(userIds);
  };

  return (
    <>
      {/* 部门选择器弹窗 */}
      <PeopleSelector
        isOpen={showDeptSelector}
        onClose={() => setShowDeptSelector(false)}
        onConfirm={handleDeptSelect}
        mode="dept"
        multiSelect={false}
        title="选择部门"
      />

      {/* 用户选择器弹窗（先选部门再选人） */}
      <PeopleSelector
        isOpen={showUserSelector}
        onClose={() => setShowUserSelector(false)}
        onConfirm={handleUserSelect}
        mode="dept_then_user"
        multiSelect={true}
        title="选择人员"
      />

      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* 标题栏 */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center">
              <Shield className="text-white" size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">批量权限管理</h2>
              <p className="text-sm text-slate-500">已选 {actualSelectedUserIds.length} 人</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/50 rounded-lg transition-colors"
          >
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* 操作模式选择 */}
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
            <label className="block text-sm font-semibold text-slate-700 mb-3">
              操作模式
            </label>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setMode('merge')}
                className={`p-3 rounded-lg border-2 transition-all ${
                  mode === 'merge'
                    ? 'border-green-500 bg-green-50'
                    : 'border-slate-200 bg-white hover:border-green-300'
                }`}
              >
                <Plus className={`mx-auto mb-1 ${mode === 'merge' ? 'text-green-600' : 'text-slate-400'}`} size={20} />
                <div className={`text-sm font-medium ${mode === 'merge' ? 'text-green-700' : 'text-slate-600'}`}>
                  添加权限
                </div>
                <div className="text-xs text-slate-500 mt-1">保留原有 + 新增</div>
              </button>
              <button
                onClick={() => setMode('overwrite')}
                className={`p-3 rounded-lg border-2 transition-all ${
                  mode === 'overwrite'
                    ? 'border-orange-500 bg-orange-50'
                    : 'border-slate-200 bg-white hover:border-orange-300'
                }`}
              >
                <RefreshCw className={`mx-auto mb-1 ${mode === 'overwrite' ? 'text-orange-600' : 'text-slate-400'}`} size={20} />
                <div className={`text-sm font-medium ${mode === 'overwrite' ? 'text-orange-700' : 'text-slate-600'}`}>
                  覆盖权限
                </div>
                <div className="text-xs text-slate-500 mt-1">替换为新权限</div>
              </button>
              <button
                onClick={() => setMode('remove')}
                className={`p-3 rounded-lg border-2 transition-all ${
                  mode === 'remove'
                    ? 'border-red-500 bg-red-50'
                    : 'border-slate-200 bg-white hover:border-red-300'
                }`}
              >
                <Minus className={`mx-auto mb-1 ${mode === 'remove' ? 'text-red-600' : 'text-slate-400'}`} size={20} />
                <div className={`text-sm font-medium ${mode === 'remove' ? 'text-red-700' : 'text-slate-600'}`}>
                  移除权限
                </div>
                <div className="text-xs text-slate-500 mt-1">从原有中删除</div>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            {/* 左侧：用户选择 */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-700">选择用户</h3>
              
              {/* 三种选人模式 */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setSelectionMode('all')}
                  className={`p-2 rounded-lg border-2 text-xs font-medium transition-all ${
                    selectionMode === 'all'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300'
                  }`}
                >
                  <Users className="mx-auto mb-1" size={16} />
                  全体员工
                </button>
                <button
                  onClick={() => setSelectionMode('department')}
                  className={`p-2 rounded-lg border-2 text-xs font-medium transition-all ${
                    selectionMode === 'department'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300'
                  }`}
                >
                  <Users className="mx-auto mb-1" size={16} />
                  指定部门
                </button>
                <button
                  onClick={() => setSelectionMode('individual')}
                  className={`p-2 rounded-lg border-2 text-xs font-medium transition-all ${
                    selectionMode === 'individual'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300'
                  }`}
                >
                  <Users className="mx-auto mb-1" size={16} />
                  指定人员
                </button>
              </div>

              {/* 模式1：全体员工 */}
              {selectionMode === 'all' && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-2 text-blue-700">
                    <Users size={16} />
                    <span className="text-sm font-medium">
                      已选择全体员工（{allUsers.filter(u => u.username !== 'admin').length} 人）
                    </span>
                  </div>
                  <p className="text-xs text-blue-600 mt-1">
                    将对除admin外的所有用户进行权限管理
                  </p>
                </div>
              )}

              {/* 模式2：指定部门 */}
              {selectionMode === 'department' && (
                <div className="space-y-2">
                  <button
                    onClick={() => setShowDeptSelector(true)}
                    className="w-full px-3 py-2 border-2 border-blue-300 bg-blue-50 rounded-lg text-sm font-medium text-blue-700 hover:bg-blue-100 transition-colors flex items-center justify-center gap-2"
                  >
                    <Users size={16} />
                    {selectedDepartmentName ? `已选择: ${selectedDepartmentName}` : '点击选择部门'}
                  </button>
                  {selectedDepartment && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center gap-2 text-green-700">
                        <CheckCircle size={16} />
                        <span className="text-sm font-medium">
                          {selectedDepartmentName}（{filteredUsers.filter(u => u.username !== 'admin').length} 人）
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 模式3：指定人员 */}
              {selectionMode === 'individual' && (
                <div className="space-y-2">
                  <button
                    onClick={() => setShowUserSelector(true)}
                    className="w-full px-3 py-2 border-2 border-blue-300 bg-blue-50 rounded-lg text-sm font-medium text-blue-700 hover:bg-blue-100 transition-colors flex items-center justify-center gap-2"
                  >
                    <Users size={16} />
                    {localSelectedUsers.length > 0 ? `已选择 ${localSelectedUsers.length} 人` : '点击选择人员'}
                  </button>
                  {localSelectedUsers.length > 0 && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 text-green-700">
                          <CheckCircle size={16} />
                          <span className="text-sm font-medium">
                            已选择 {localSelectedUsers.length} 人
                          </span>
                        </div>
                        <button
                          onClick={deselectAll}
                          className="text-xs text-red-500 hover:text-red-700 hover:underline"
                        >
                          清空
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {localSelectedUsers.slice(0, 10).map(userId => {
                          const user = allUsers.find(u => u.id === userId);
                          return user ? (
                            <span key={userId} className="inline-flex items-center gap-1 px-2 py-1 bg-white rounded text-xs text-slate-700 border border-green-200">
                              {user.name}
                            </span>
                          ) : null;
                        })}
                        {localSelectedUsers.length > 10 && (
                          <span className="inline-flex items-center px-2 py-1 text-xs text-slate-500">
                            ... 还有 {localSelectedUsers.length - 10} 人
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 右侧：权限选择 */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-700">选择权限</h3>
              <div className="space-y-3 border rounded-lg p-3 max-h-96 overflow-y-auto bg-slate-50">
                {SYSTEM_MODULES.map(module => {
                  const modulePerms = module.permissions.map(p => p.key);
                  const basePermKey = module.basePermission || 'access'; // 基础权限key
                  const selected = selectedPermissions[module.key] || [];
                  const allSelected = modulePerms.every(p => selected.includes(p));
                  const hasBasePermission = selected.includes(basePermKey);

                  return (
                    <div key={module.key} className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                      <div className="px-3 py-2 flex items-center justify-between bg-slate-50">
                        <span className="text-sm font-semibold text-slate-700">
                          {module.name}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500">
                            {selected.length}/{module.permissions.length}
                          </span>
                          {/* 基础权限复选框 */}
                          <button
                            onClick={() => toggleBasePermission(module.key, basePermKey)}
                            className="flex items-center gap-1 px-2 py-1 text-xs bg-white border border-slate-300 rounded hover:bg-slate-50 transition-colors"
                            title="基础权限：能访问该系统（不包含具体操作权限）"
                          >
                            <div className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center ${
                              hasBasePermission
                                ? 'bg-green-500 border-green-500'
                                : 'border-slate-300'
                            }`}>
                              {hasBasePermission && <CheckCircle className="text-white" size={10} />}
                            </div>
                            <span className="text-slate-600">基础</span>
                          </button>
                          {/* 全选/取消按钮 */}
                          {allSelected ? (
                            <button
                              onClick={() => deselectAllModulePermissions(module.key)}
                              className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                            >
                              取消全选
                            </button>
                          ) : (
                            <button
                              onClick={() => selectAllModulePermissions(module.key, modulePerms)}
                              className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                            >
                              全选
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="px-3 pb-2 space-y-1">
                        {module.permissions.map(perm => (
                          <label
                            key={perm.key}
                            className="flex items-center gap-2 py-1 cursor-pointer hover:bg-slate-50 px-2 rounded"
                          >
                            <input
                              type="checkbox"
                              checked={selected.includes(perm.key)}
                              onChange={() => togglePermission(module.key, perm.key)}
                              className="w-3.5 h-3.5 text-blue-600 rounded"
                            />
                            <span className="text-xs text-slate-700">{perm.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-between items-center">
          <div className="text-sm text-slate-600">
            <AlertCircle className="inline mr-1" size={14} />
            {mode === 'merge' && '将添加选中的权限，保留原有权限'}
            {mode === 'overwrite' && '将完全替换为选中的权限'}
            {mode === 'remove' && '将移除选中的权限'}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="px-5 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              取消
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || actualSelectedUserIds.length === 0}
              className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-lg shadow-blue-500/30 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="animate-spin" size={16} />
                  处理中...
                </>
              ) : (
                <>
                  <CheckCircle size={16} />
                  确认执行
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
