// src/app/admin/account/[id]/page.tsx
"use client";
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
// 🟢 修正：从常量文件导入，不再依赖 mockDb
import { SYSTEM_MODULES } from '@/lib/constants'; 
import { Save, ArrowLeft, Shield, CheckSquare, Info } from 'lucide-react';
import Link from 'next/link';
import { apiFetch } from '@/lib/apiClient';

// 定义接口
interface User {
  id: string;
  name: string;
  department: string;
  permissions: any;
}

export default function PermissionConfigPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;

  const [user, setUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<any>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      if (!userId) return;
      try {
        const res = await apiFetch(`/api/users/${userId}`);
        if (res.ok) {
          const userData = await res.json();
          setUser(userData);
          setPermissions(JSON.parse(JSON.stringify(userData.permissions || {})));
        } else {
          if (res.status === 401) {
            alert("未授权访问，请先登录");
          } else {
            alert("未找到该用户");
          }
          router.push('/admin/account');
        }
      } catch (error) {
        console.error(error);
        alert("加载用户信息失败");
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [userId, router]);

  // 1. 切换模块总开关
  const toggleModule = (moduleKey: string) => {
    setPermissions((prev: any) => {
      const next = { ...prev };
      if (next[moduleKey]) {
        delete next[moduleKey]; // 删除即禁用
      } else {
        next[moduleKey] = []; // 初始化为空数组即启用
      }
      return next;
    });
  };

  // 2. 切换具体单个权限
  const togglePermission = (moduleKey: string, permKey: string) => {
    setPermissions((prev: any) => {
      const next = { ...prev };
      if (!next[moduleKey]) next[moduleKey] = [];
      const currentPerms = next[moduleKey];
      if (currentPerms.includes(permKey)) {
        next[moduleKey] = currentPerms.filter((p: string) => p !== permKey);
      } else {
        next[moduleKey] = [...currentPerms, permKey];
      }
      return next;
    });
  };

  // 3. 模块全选功能
  const toggleAllInModule = (moduleKey: string, allPermKeys: string[]) => {
    setPermissions((prev: any) => {
      const next = { ...prev };
      if (!next[moduleKey]) next[moduleKey] = [];
      const currentPerms = next[moduleKey];
      if (currentPerms.length === allPermKeys.length) {
        next[moduleKey] = [];
      } else {
        next[moduleKey] = [...allPermKeys];
      }
      return next;
    });
  };

  // 使用 apiFetch PUT 保存权限
  const handleSave = async () => {
    if (!user) return;
    try {
      const res = await apiFetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions })
      });
      if (res.ok) {
        alert(`[${user.name}] 的权限配置已保存`);
        router.push('/admin/account');
      } else {
        if (res.status === 401) {
          alert('未授权访问，请先登录');
        } else if (res.status === 403) {
          alert('权限不足，需要管理员权限');
        } else {
          alert('保存失败');
        }
      }
    } catch (error) {
      console.error(error);
      alert('网络错误');
    }
  };

  if (isLoading) return <div className="p-8 text-center text-slate-500">正在加载权限配置...</div>;
  if (!user) return <div className="p-8 text-red-500 text-center">未找到用户</div>;

  return (
    <div className="max-w-6xl mx-auto pb-20">
      {/* 顶部导航栏 */}
      <div className="flex items-center justify-between mb-8 sticky top-0 bg-slate-50 py-4 z-10 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/account"
            className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500"
            title="返回列表"
          >
            <ArrowLeft size={24} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Shield className="text-hytzer-blue" />
              权限配置中心
            </h1>
            <div className="text-sm text-slate-500 mt-1 flex items-center gap-4">
              <span>
                当前配置用户: <strong>{user.name}</strong> ({user.department})
              </span>
              <span className="bg-slate-200 px-2 rounded text-xs py-0.5">ID: {user.id}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => router.push('/admin/account')}
            className="px-6 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 font-medium"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2.5 bg-hytzer-blue text-white rounded-lg hover:bg-blue-600 shadow-lg shadow-blue-500/30 font-medium flex items-center gap-2"
          >
            <Save size={18} />
            保存配置
          </button>
        </div>
      </div>

      {/* 权限配置卡片 */}
      <div className="space-y-6">
        <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg flex gap-3 text-blue-800 text-sm mb-6">
          <Info size={20} className="shrink-0" />
          <p>
            说明：先勾选左侧“启用子系统”，右侧的细分权限才会生效。您可以点击“全选”快速授予某模块下的所有权限。
          </p>
        </div>
        {SYSTEM_MODULES.map(module => {
          const isModuleEnabled = permissions[module.key] !== undefined;
          const currentModulePerms = permissions[module.key] || [];
          const isAllSelected =
            currentModulePerms.length === module.permissions.length && module.permissions.length > 0;
          return (
            <div
              key={module.key}
              className={`bg-white rounded-xl border transition-all duration-200 ${
                isModuleEnabled
                  ? 'border-hytzer-blue shadow-md ring-1 ring-blue-100'
                  : 'border-slate-200 opacity-80'
              }`}
            >
              {/* 模块头部 */}
              <div
                className={`px-6 py-4 border-b flex items-center justify-between ${
                  isModuleEnabled ? 'bg-blue-50/50' : 'bg-slate-50'
                }`}
              >
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <div
                    className={`w-6 h-6 border-2 rounded-md flex items-center justify-center transition-colors ${
                      isModuleEnabled
                        ? 'bg-hytzer-blue border-hytzer-blue'
                        : 'border-slate-300 bg-white'
                    }`}
                    onClick={() => toggleModule(module.key)}
                  >
                    {isModuleEnabled && <CheckSquare size={16} className="text-white" />}
                  </div>
                  <div>
                    <span
                      className={`text-lg font-bold ${
                        isModuleEnabled ? 'text-slate-900' : 'text-slate-500'
                      }`}
                    >
                      {module.name}
                    </span>
                    <div className="text-xs text-slate-400 font-normal">
                      {isModuleEnabled
                        ? '已启用 · 可配置详细权限'
                        : '该子系统对用户不可见'}
                    </div>
                  </div>
                </label>
                {/* 模块内全选按钮 */}
                {isModuleEnabled && (
                  <button
                    onClick={() =>
                      toggleAllInModule(
                        module.key,
                        module.permissions.map(p => p.key)
                      )
                    }
                    className="text-xs font-medium text-hytzer-blue hover:underline"
                  >
                    {isAllSelected ? '取消全选' : '本组全选'}
                  </button>
                )}
              </div>
              {/* 细分权限列表 */}
              <div className={`p-6 transition-all ${isModuleEnabled ? 'block' : 'hidden'}`}>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {module.permissions.map(perm => {
                    const isChecked = currentModulePerms.includes(perm.key);
                    return (
                      <label
                        key={perm.key}
                        className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all hover:shadow-sm ${
                          isChecked
                            ? 'bg-blue-50 border-blue-200'
                            : 'bg-white border-slate-100 hover:border-slate-300'
                        }`}
                      >
                        <div
                          className={`w-5 h-5 border rounded mt-0.5 flex items-center justify-center shrink-0 transition-colors ${
                            isChecked
                              ? 'bg-blue-600 border-blue-600'
                              : 'border-slate-300 bg-white'
                          }`}
                          onClick={e => {
                            e.preventDefault();
                            togglePermission(module.key, perm.key);
                          }}
                        >
                          {isChecked && <CheckSquare size={12} className="text-white" />}
                        </div>
                        <span
                          className={`text-sm ${
                            isChecked ? 'text-slate-900 font-medium' : 'text-slate-600'
                          }`}
                        >
                          {perm.name}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}