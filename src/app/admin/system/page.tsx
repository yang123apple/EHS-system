"use client";

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { 
  Shield, 
  Database, 
  Settings, 
  Bell,
  Lock,
  FileText,
  Activity,
  Server,
  HardDrive,
  Clock,
  AlertCircle,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';

export default function SystemPage() {
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
            <p className="text-gray-600">只有管理员可以访问系统设置</p>
          </div>
        </div>
      </div>
    );
  }

  const systemModules = [
    {
      id: 'backup',
      title: '数据灾备中心',
      description: '数据备份、恢复和灾难恢复管理',
      icon: Database,
      color: 'blue',
      path: '/admin/system/backup',
      features: ['自动备份', '手动备份', '数据恢复', '备份验证'],
      status: 'active',
    },
    {
      id: 'logs',
      title: '系统日志',
      description: '查看和分析系统操作日志',
      icon: FileText,
      color: 'green',
      path: '/admin/system/logs',
      features: ['操作日志', '错误日志', '审计追踪', '日志导出'],
      status: 'planned',
    },
    {
      id: 'monitor',
      title: '系统监控',
      description: '实时监控系统性能和健康状态',
      icon: Activity,
      color: 'purple',
      path: '/admin/system/monitor',
      features: ['性能监控', '资源使用', '告警通知', '健康检查'],
      status: 'planned',
    },
    {
      id: 'security',
      title: '安全设置',
      description: '系统安全策略和权限配置',
      icon: Lock,
      color: 'red',
      path: '/admin/system/security',
      features: ['密码策略', '访问控制', '会话管理', '安全审计'],
      status: 'planned',
    },
    {
      id: 'notification',
      title: '通知配置',
      description: '配置系统通知和消息推送',
      icon: Bell,
      color: 'yellow',
      path: '/admin/system/notification',
      features: ['邮件通知', '短信通知', '站内消息', '推送规则'],
      status: 'planned',
    },
    {
      id: 'config',
      title: '系统配置',
      description: '基础系统参数和功能配置',
      icon: Settings,
      color: 'gray',
      path: '/admin/system/config',
      features: ['基础设置', '功能开关', '参数配置', '模板管理'],
      status: 'planned',
    },
  ];

  const getColorClasses = (color: string) => {
    const colors: Record<string, { bg: string; icon: string; hover: string; badge: string }> = {
      blue: { 
        bg: 'bg-blue-50', 
        icon: 'text-blue-600', 
        hover: 'hover:bg-blue-100',
        badge: 'bg-blue-100 text-blue-700'
      },
      green: { 
        bg: 'bg-green-50', 
        icon: 'text-green-600', 
        hover: 'hover:bg-green-100',
        badge: 'bg-green-100 text-green-700'
      },
      purple: { 
        bg: 'bg-purple-50', 
        icon: 'text-purple-600', 
        hover: 'hover:bg-purple-100',
        badge: 'bg-purple-100 text-purple-700'
      },
      red: { 
        bg: 'bg-red-50', 
        icon: 'text-red-600', 
        hover: 'hover:bg-red-100',
        badge: 'bg-red-100 text-red-700'
      },
      yellow: { 
        bg: 'bg-yellow-50', 
        icon: 'text-yellow-600', 
        hover: 'hover:bg-yellow-100',
        badge: 'bg-yellow-100 text-yellow-700'
      },
      gray: { 
        bg: 'bg-gray-50', 
        icon: 'text-gray-600', 
        hover: 'hover:bg-gray-100',
        badge: 'bg-gray-100 text-gray-700'
      },
    };
    return colors[color] || colors.gray;
  };

  const handleModuleClick = (module: typeof systemModules[0]) => {
    if (module.status === 'active') {
      router.push(module.path);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* 页面标题 */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Server className="w-8 h-8 text-indigo-600" />
            <h1 className="text-3xl font-bold text-gray-800">系统设置</h1>
          </div>
          <p className="text-gray-600">管理系统配置、数据备份、安全设置和监控</p>
        </div>

        {/* 系统状态卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {/* 系统状态 */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">系统状态</p>
                <p className="text-lg font-bold text-green-600 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5" />
                  正常运行
                </p>
              </div>
              <Activity className="w-10 h-10 text-green-500" />
            </div>
          </div>

          {/* 数据库状态 */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">数据库状态</p>
                <p className="text-lg font-bold text-blue-600 flex items-center gap-2">
                  <HardDrive className="w-5 h-5" />
                  WAL 模式
                </p>
              </div>
              <Database className="w-10 h-10 text-blue-500" />
            </div>
          </div>

          {/* 运行时间 */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">备份任务</p>
                <p className="text-lg font-bold text-purple-600 flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  每日 2:00
                </p>
              </div>
              <Shield className="w-10 h-10 text-purple-500" />
            </div>
          </div>
        </div>

        {/* 功能模块网格 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {systemModules.map((module) => {
            const Icon = module.icon;
            const colors = getColorClasses(module.color);
            const isActive = module.status === 'active';

            return (
              <div
                key={module.id}
                onClick={() => handleModuleClick(module)}
                className={`
                  bg-white rounded-xl shadow-lg overflow-hidden transition-all
                  ${isActive ? 'cursor-pointer hover:shadow-xl hover:scale-105' : 'opacity-60 cursor-not-allowed'}
                `}
              >
                {/* 模块头部 */}
                <div className={`${colors.bg} p-6`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className={`p-3 rounded-lg ${colors.bg} ${colors.hover}`}>
                      <Icon className={`w-8 h-8 ${colors.icon}`} />
                    </div>
                    {module.status === 'active' ? (
                      <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                        已启用
                      </span>
                    ) : (
                      <span className="px-3 py-1 bg-gray-100 text-gray-600 text-xs font-semibold rounded-full">
                        即将推出
                      </span>
                    )}
                  </div>
                  <h3 className="text-xl font-bold text-gray-800 mb-2">
                    {module.title}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {module.description}
                  </p>
                </div>

                {/* 功能列表 */}
                <div className="p-6">
                  <div className="space-y-2 mb-4">
                    {module.features.map((feature, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm text-gray-600">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>

                  {isActive && (
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
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* 底部提示 */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">系统设置说明</p>
              <ul className="list-disc list-inside space-y-1 text-blue-700">
                <li>目前已启用：数据灾备中心</li>
                <li>其他功能模块正在开发中，敬请期待</li>
                <li>如需帮助，请查看相关文档或联系技术支持</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
