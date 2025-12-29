// src/app/hidden-danger/layout.tsx
"use client";
import { AlertTriangle, TrafficCone, ListTodo, Search, Settings, BarChart3, FileText } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { ViewMode, VIEW_MODES } from '@/constants/hazard';
import { useState, ReactNode } from 'react';
import HiddenDangerPage from './page';

export default function HiddenDangerLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>(VIEW_MODES.OVERVIEW);

  // 权限检查辅助函数
  const hasPerm = (key: string) => 
    user?.role === 'admin' || user?.permissions?.['hidden_danger']?.includes(key);

  // 导航项配置
const navItems = [
  { 
    icon: <TrafficCone size={18}/>, 
    label: '隐患中心', 
    mode: VIEW_MODES.OVERVIEW,
    show: true 
  },
  { 
    icon: <ListTodo size={18}/>, 
    label: '我的任务', 
    mode: VIEW_MODES.MY_TASKS,
    show: true 
  },
  { 
    icon: <Search size={18}/>, 
    label: '隐患查询', 
    mode: VIEW_MODES.ALL_LIST,
    show: true 
  },
  { 
    icon: <BarChart3 size={18}/>, 
    label: '统计分析', 
    mode: VIEW_MODES.STATS,
    show: hasPerm('view_stats') 
  },
  { 
    icon: <FileText size={18}/>, 
    label: '操作日志', 
    mode: VIEW_MODES.LOGS,
    show: user?.role === 'admin'
  },
];

return (
  <div className="flex h-screen bg-gradient-to-br from-slate-50 to-slate-100/50 overflow-hidden">
{/* 侧边导航栏 */}
<div className="w-16 md:w-64 bg-white border-r border-slate-200 flex flex-col">
  {/* 内部容器加 padding，避免影响高度计算 */}
  <div className="p-4 flex flex-col h-full">
    {/* 固定头部：Logo / 标题 */}
    <div className="mb-6 flex items-center gap-2 text-slate-800 font-bold px-2">
      <AlertTriangle className="text-red-500" size={20} />
      <span className="hidden md:inline">隐患排查治理</span>
    </div>

    {/* 可滚动的导航区域：关键！ */}
    <nav className="space-y-1 overflow-y-auto py-1 flex-1">
      {navItems.filter(item => item.show).map((item) => (
        <NavItem 
          key={item.mode}
          icon={item.icon} 
          label={item.label} 
          active={viewMode === item.mode}
          onClick={() => setViewMode(item.mode)}
        />
      ))}
    </nav>

    {/* 固定底部：始终可见 */}
    {hasPerm('manage_config') && (
      <div className="border-t border-slate-200 pt-4 mt-4">
        <NavItem 
          icon={<Settings size={18}/>} 
          label="设置" 
          active={viewMode === VIEW_MODES.CONFIG}
          onClick={() => setViewMode(VIEW_MODES.CONFIG)}
        />
      </div>
    )}
  </div>
</div>

      {/* 主内容区域 - 使用 Page 组件并传递状态 */}
      <HiddenDangerPage 
        initialViewMode={viewMode}
        onViewModeChange={setViewMode}
      />
    </div>
  );
}

interface NavItemProps {
  icon: ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}

function NavItem({ icon, label, active = false, onClick }: NavItemProps) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
        active ? 'bg-red-50 text-red-700' : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      {icon}
      <span className="hidden md:inline text-sm font-medium">{label}</span>
    </button>
  );
}
