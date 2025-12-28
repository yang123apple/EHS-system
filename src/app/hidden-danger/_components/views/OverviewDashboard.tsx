// src/app/hidden-danger/_components/views/OverviewDashboard.tsx
import { AlertTriangle, Clock, Plus, Inbox, Activity, CheckCircle2, Flame, Upload } from 'lucide-react';
import { HazardCard } from '../HazardCard';
import { HazardRecord } from '@/types/hidden-danger';
import { CardSkeleton } from '@/components/common/Loading';

interface OverviewDashboardProps {
  hazards: HazardRecord[];
  onSelect: (hazard: HazardRecord) => void;
  onReport?: () => void;
  onBatchUpload?: () => void;
  loading?: boolean;
}

export function OverviewDashboard({ hazards, onSelect, onReport, onBatchUpload, loading }: OverviewDashboardProps) {
  // 统计逻辑提取
  const highRiskCount = hazards.filter(h => h.status === 'assigned' && (h.riskLevel === 'high' || h.riskLevel === 'major')).length;

  return (
    <div className="space-y-8">
      {/* 统计卡片区 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <StatCard 
          label="待整改 (高风险)" 
          value={highRiskCount} 
          icon={<Flame className="w-6 h-6 text-red-600" />}
          theme="danger"
        />
        <StatCard 
          label="整改中" 
          value={hazards.filter(h => h.status === 'rectifying').length}
          icon={<Activity className="w-6 h-6 text-blue-600" />}
          theme="primary"
        />
        <StatCard 
          label="待验收" 
          value={hazards.filter(h => h.status === 'verified').length}
          icon={<Clock className="w-6 h-6 text-purple-600" />}
          theme="purple"
        />
        <StatCard 
          label="已闭环" 
          value={hazards.filter(h => h.status === 'closed').length}
          icon={<CheckCircle2 className="w-6 h-6 text-green-600" />}
          theme="success"
        />
      </div>

      {/* 快捷操作与列表 */}
      <div className="mt-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-slate-700 flex items-center gap-2">
            <Clock size={18} /> 最新上报
          </h3>
          {/* 修改后的代码：仅在非空或加载中显示 */}
          {(loading || hazards.length > 0) && (
            <div className="flex gap-2">
              <button 
                onClick={onBatchUpload} 
                className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors shadow-sm"
              >
                <Upload size={18} /> 批量上传
              </button>
              <button 
                onClick={onReport} 
                className="bg-red-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-red-700 transition-colors shadow-sm"
              >
                <Plus size={18} /> 立即上报
              </button>
            </div>
          )}
        </div>
        
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : hazards.length === 0 ? (
          <div className="bg-white rounded-xl border p-12 flex flex-col items-center justify-center text-slate-400">
            <Inbox size={64} className="mb-4" />
            <p className="text-lg font-medium">暂无隐患记录</p>
            <p className="text-sm mt-2 mb-6">开始上报第一条隐患吧</p>
            <button 
              onClick={onReport}
              className="bg-red-600 text-white px-6 py-2 rounded-lg flex items-center gap-2 hover:bg-red-700 transition-colors"
            >
              <Plus size={18} /> 立即上报
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {hazards.slice(0, 6).map(h => (
              <HazardCard key={h.id} data={h} onClick={() => onSelect(h)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  theme?: 'danger' | 'primary' | 'purple' | 'success';
}

function StatCard({ label, value, icon, theme = 'primary' }: StatCardProps) {
  const themes = {
   danger: {
      bg: 'bg-white',
      text: 'text-slate-800',
      iconBg: 'bg-red-50',        // 浅红色图标背景
      labelColor: 'text-slate-500',
      valueColor: 'text-red-600', // 红色数值突出风险
      border: 'border border-red-100',
      decorCircle: 'bg-red-50'    // 浅红色装饰圆环
    },
    primary: {
      bg: 'bg-white',
      text: 'text-slate-800',
      iconBg: 'bg-blue-50',
      labelColor: 'text-slate-500',
      valueColor: 'text-blue-600',
      border: 'border border-blue-100',
      decorCircle: 'bg-blue-50'
    },
    purple: {
      bg: 'bg-white',
      text: 'text-slate-800',
      iconBg: 'bg-purple-50',
      labelColor: 'text-slate-500',
      valueColor: 'text-purple-600',
      border: 'border border-purple-100',
      decorCircle: 'bg-purple-100'
    },
    success: {
      bg: 'bg-white',
      text: 'text-slate-800',
      iconBg: 'bg-green-50',
      labelColor: 'text-slate-500',
      valueColor: 'text-green-600',
      border: 'border border-green-100',
      decorCircle: 'bg-green-50'
    }
  };

  const style = themes[theme];

  return (
    <div className={`${style.bg} ${style.border} p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 relative overflow-hidden group`}>
      {/* 装饰性背景圆环 */}
      <div className={`absolute -right-6 -top-6 w-32 h-32 ${style.decorCircle} rounded-full opacity-50 group-hover:scale-110 transition-transform duration-500`} />
      <div className={`absolute -right-2 -bottom-2 w-20 h-20 ${style.decorCircle} rounded-full opacity-30 group-hover:scale-110 transition-transform duration-500`} />
      
      {/* 内容区 */}
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className={`${style.iconBg} p-3 rounded-xl backdrop-blur-sm`}>
            {icon}
          </div>
        </div>
        <div className={`${style.labelColor} text-sm font-medium mb-2 tracking-wide`}>
          {label}
        </div>
        <div className={`${style.valueColor} text-3xl font-bold tracking-tight`}>
          {value}
        </div>
      </div>
    </div>
  );
}
