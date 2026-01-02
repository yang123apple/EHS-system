"use client";

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { 
  Users, 
  Network, 
  Settings, 
  FileText,
  Bell,
  Bot,
  AlertCircle,
  ArrowRight,
  Shield,
  Activity,
  Database,
  MessageSquare,
  Zap,
  TrendingUp
} from 'lucide-react';

export default function AdminPage() {
  const { user } = useAuth();
  const router = useRouter();

  // 权限检查
  if (user && user.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-800 mb-2">权限不足</h2>
            <p className="text-gray-600">只有管理员可以访问管理中心</p>
          </div>
        </div>
      </div>
    );
  }

  const adminModules = [
    {
      id: 'account',
      title: '账户管理',
      description: '用户账户管理、权限配置和角色分配',
      icon: Users,
      color: 'blue',
      gradient: 'from-blue-500 to-blue-600',
      path: '/admin/account',
      features: ['用户管理', '角色权限', '账户审核', '密码重置'],
      status: 'active',
      stats: { label: '活跃用户', value: '68' },
    },
    {
      id: 'org',
      title: '组织架构',
      description: '组织架构管理、部门设置和人员调配',
      icon: Network,
      color: 'green',
      gradient: 'from-green-500 to-green-600',
      path: '/admin/org',
      features: ['部门管理', '层级结构', '人员分配', '批量导入'],
      status: 'active',
      stats: { label: '部门数', value: '18' },
    },
    {
      id: 'system',
      title: '系统设置',
      description: '系统配置、数据备份和基础参数设置',
      icon: Settings,
      color: 'purple',
      gradient: 'from-purple-500 to-purple-600',
      path: '/admin/system',
      features: ['系统配置', '数据备份', '参数设置', '功能开关'],
      status: 'active',
      stats: { label: '系统健康', value: '良好' },
    },
    {
      id: 'logs',
      title: '系统日志',
      description: '查看系统日志、用户登录记录和操作审计',
      icon: FileText,
      color: 'orange',
      gradient: 'from-orange-500 to-orange-600',
      path: '/admin/logs',
      features: ['登录日志', '操作日志', '审计追踪', '统计分析'],
      status: 'active',
      stats: { label: '今日日志', value: '156' },
    },
    {
      id: 'notifications',
      title: '通知管理',
      description: '站内信模板编辑和通知触发条件配置',
      icon: Bell,
      color: 'pink',
      gradient: 'from-pink-500 to-pink-600',
      path: '/admin/notifications',
      features: ['模板编辑', '变量占位符', '触发条件', '推送规则'],
      status: 'active',
      stats: { label: '模板数', value: '12' },
    },
    {
      id: 'ai-api',
      title: 'AI API管理',
      description: 'AI接口配置、调用日志和限流策略管理',
      icon: Bot,
      color: 'indigo',
      gradient: 'from-indigo-500 to-indigo-600',
      path: '/admin/ai-api',
      features: ['接口配置', '调用日志', '限流策略', '使用统计'],
      status: 'active',
      stats: { label: '今日调用', value: '342' },
    },
  ];

  const getIconColor = (color: string) => {
    const colors: any = {
      blue: 'text-blue-600',
      green: 'text-green-600',
      purple: 'text-purple-600',
      orange: 'text-orange-600',
      pink: 'text-pink-600',
      indigo: 'text-indigo-600',
    };
    return colors[color] || 'text-gray-600';
  };

  const getBgColor = (color: string) => {
    const colors: any = {
      blue: 'bg-blue-50',
      green: 'bg-green-50',
      purple: 'bg-purple-50',
      orange: 'bg-orange-50',
      pink: 'bg-pink-50',
      indigo: 'bg-indigo-50',
    };
    return colors[color] || 'bg-gray-50';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* 页头 */}
        <div className="mb-12">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-gray-800 mb-2">管理中心</h1>
              <p className="text-lg text-gray-600">系统管理、数据配置和监控中心</p>
            </div>
          </div>

          {/* 快速统计 */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-8">
            <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-blue-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">系统状态</p>
                  <p className="text-2xl font-bold text-gray-800">正常运行</p>
                </div>
                <Activity className="w-10 h-10 text-blue-500 opacity-20" />
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-green-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">在线用户</p>
                  <p className="text-2xl font-bold text-gray-800">23</p>
                </div>
                <Users className="w-10 h-10 text-green-500 opacity-20" />
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-purple-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">今日操作</p>
                  <p className="text-2xl font-bold text-gray-800">1,247</p>
                </div>
                <TrendingUp className="w-10 h-10 text-purple-500 opacity-20" />
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-orange-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">数据库大小</p>
                  <p className="text-2xl font-bold text-gray-800">2.3 GB</p>
                </div>
                <Database className="w-10 h-10 text-orange-500 opacity-20" />
              </div>
            </div>
          </div>
        </div>

        {/* 功能模块网格 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {adminModules.map((module) => {
            const Icon = module.icon;
            return (
              <div
                key={module.id}
                onClick={() => router.push(module.path)}
                className="group bg-white rounded-2xl shadow-md hover:shadow-2xl transition-all duration-300 cursor-pointer overflow-hidden border border-gray-100 hover:border-transparent hover:scale-[1.02]"
              >
                {/* 渐变顶部条 */}
                <div className={`h-2 bg-gradient-to-r ${module.gradient}`}></div>

                <div className="p-6">
                  {/* 图标和标题 */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className={`${getBgColor(module.color)} p-3 rounded-xl group-hover:scale-110 transition-transform duration-300`}>
                        <Icon className={`w-7 h-7 ${getIconColor(module.color)}`} />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-gray-800 mb-1">{module.title}</h3>
                        <div className="flex items-center gap-2">
                          <span className={`inline-block w-2 h-2 rounded-full bg-${module.color}-500 animate-pulse`}></span>
                          <span className="text-xs text-gray-500">{module.status === 'active' ? '已启用' : '计划中'}</span>
                        </div>
                      </div>
                    </div>
                    <ArrowRight className={`w-5 h-5 ${getIconColor(module.color)} opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-300`} />
                  </div>

                  {/* 描述 */}
                  <p className="text-gray-600 text-sm mb-4 leading-relaxed">
                    {module.description}
                  </p>

                  {/* 统计信息 */}
                  <div className={`${getBgColor(module.color)} rounded-lg p-3 mb-4`}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600">{module.stats.label}</span>
                      <span className={`text-lg font-bold ${getIconColor(module.color)}`}>{module.stats.value}</span>
                    </div>
                  </div>

                  {/* 功能列表 */}
                  <div className="grid grid-cols-2 gap-2">
                    {module.features.map((feature, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${getIconColor(module.color)}`}></div>
                        <span className="text-xs text-gray-600">{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 底部悬浮效果 */}
                <div className={`h-1 bg-gradient-to-r ${module.gradient} transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left`}></div>
              </div>
            );
          })}
        </div>

        {/* 底部提示 */}
        <div className="mt-12 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-100">
          <div className="flex items-start gap-4">
            <div className="bg-blue-100 p-3 rounded-xl">
              <MessageSquare className="w-6 h-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">管理中心说明</h3>
              <p className="text-gray-600 text-sm leading-relaxed mb-3">
                这里是系统管理的核心区域，您可以：配置用户权限、管理组织架构、查看系统日志、
                编辑通知模板、配置AI接口等。所有操作都会被记录在系统日志中以供审计。
              </p>
              <div className="flex items-center gap-2 text-sm">
                <Zap className="w-4 h-4 text-blue-600" />
                <span className="text-blue-600 font-medium">点击任意模块卡片即可进入管理页面</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
