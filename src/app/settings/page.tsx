"use client";

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { 
  Users, 
  Network, 
  Settings, 
  ArrowRight,
  Shield,
  Database,
  Building2,
  UserCog,
  AlertCircle
} from 'lucide-react';
import { useEffect } from 'react';

export default function SettingsPage() {
  const { user } = useAuth();
  const router = useRouter();

  // 如果不是管理员，重定向到个人中心
  useEffect(() => {
    if (user && user.role !== 'admin') {
      router.push('/profile');
    }
  }, [user, router]);

  if (!user) {
    return null;
  }

  if (user.role !== 'admin') {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg p-8 text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">权限不足</h2>
          <p className="text-gray-600 mb-6">只有管理员可以访问系统设置</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            返回工作台
          </button>
        </div>
      </div>
    );
  }

  const adminMenus = [
    {
      id: 'account',
      title: '账户管理',
      description: '管理系统用户账户、角色和权限',
      icon: Users,
      path: '/admin/account',
      color: 'blue',
      features: ['用户列表', '新增用户', '角色管理', '权限配置'],
    },
    {
      id: 'org',
      title: '组织架构',
      description: '管理公司部门结构和组织关系',
      icon: Network,
      path: '/admin/org',
      color: 'green',
      features: ['部门树', '新增部门', '编辑部门', '删除部门'],
    },
    {
      id: 'system',
      title: '系统设置',
      description: '系统配置、备份恢复和安全管理',
      icon: Settings,
      path: '/admin/system',
      color: 'purple',
      features: ['数据备份', '系统日志', '安全设置', '参数配置'],
    },
  ];

  const getColorClasses = (color: string) => {
    const colors: Record<string, { bg: string; icon: string; badge: string }> = {
      blue: { 
        bg: 'bg-blue-50', 
        icon: 'text-blue-600',
        badge: 'bg-blue-100 text-blue-700'
      },
      green: { 
        bg: 'bg-green-50', 
        icon: 'text-green-600',
        badge: 'bg-green-100 text-green-700'
      },
      purple: { 
        bg: 'bg-purple-50', 
        icon: 'text-purple-600',
        badge: 'bg-purple-100 text-purple-700'
      },
    };
    return colors[color] || colors.blue;
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-3 mb-2">
          <Shield className="w-8 h-8 text-indigo-600" />
          <h1 className="text-3xl font-bold text-gray-800">管理中心</h1>
        </div>
        <p className="text-gray-600">
          管理系统用户、组织架构和系统配置
        </p>
      </div>

      {/* 快速统计 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <UserCog className="w-8 h-8 opacity-80" />
            <span className="text-2xl font-bold">管理员</span>
          </div>
          <p className="text-sm opacity-90">当前身份</p>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <Building2 className="w-8 h-8 opacity-80" />
            <span className="text-2xl font-bold">{user.department || '未分配'}</span>
          </div>
          <p className="text-sm opacity-90">所属部门</p>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <Database className="w-8 h-8 opacity-80" />
            <span className="text-2xl font-bold">正常</span>
          </div>
          <p className="text-sm opacity-90">系统状态</p>
        </div>
      </div>

      {/* 管理功能卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {adminMenus.map((menu) => {
          const Icon = menu.icon;
          const colors = getColorClasses(menu.color);

          return (
            <div
              key={menu.id}
              onClick={() => router.push(menu.path)}
              className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl hover:scale-105 transition-all cursor-pointer"
            >
              {/* 卡片头部 */}
              <div className={`${colors.bg} p-6`}>
                <div className="flex items-center gap-4 mb-3">
                  <div className={`p-3 rounded-lg bg-white shadow`}>
                    <Icon className={`w-8 h-8 ${colors.icon}`} />
                  </div>
                  <h3 className="text-xl font-bold text-gray-800">
                    {menu.title}
                  </h3>
                </div>
                <p className="text-sm text-gray-600">
                  {menu.description}
                </p>
              </div>

              {/* 功能列表 */}
              <div className="p-6">
                <div className="space-y-2 mb-4">
                  {menu.features.map((feature, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm text-gray-600">
                      <div className="w-1.5 h-1.5 rounded-full bg-gray-400"></div>
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>

                <button
                  className={`
                    w-full px-4 py-2 rounded-lg font-medium
                    flex items-center justify-center gap-2
                    ${colors.badge} hover:opacity-80 transition-opacity
                  `}
                >
                  进入管理
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* 底部提示 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">管理员权限说明</p>
            <p className="text-blue-700">
              作为系统管理员，您可以管理所有用户账户、组织架构和系统配置。
              请谨慎操作，重要操作会记录在系统日志中。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
