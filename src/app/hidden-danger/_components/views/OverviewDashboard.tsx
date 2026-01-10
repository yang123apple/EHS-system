
// src/app/hidden-danger/_components/views/OverviewDashboard.tsx
import { AlertTriangle, Clock, Plus, Inbox, Activity, CheckCircle2, Flame, Upload } from 'lucide-react';
import { HazardCard } from '../HazardCard';
import { HazardRecord } from '@/types/hidden-danger';
import { CardSkeleton } from '@/components/common/Loading';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface OverviewDashboardProps {
  hazards: HazardRecord[];
  onSelect: (hazard: HazardRecord) => void;
  onReport?: () => void;
  onBatchUpload?: () => void;
  loading?: boolean;
}

export function OverviewDashboard({ hazards, onSelect, onReport, onBatchUpload, loading }: OverviewDashboardProps) {
  const highRiskCount = hazards.filter(h => h.status === 'assigned' && (h.riskLevel === 'high' || h.riskLevel === 'major')).length;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* 统计卡片区 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <StatCard 
          label="待整改 (高风险)" 
          value={highRiskCount} 
          icon={<Flame className="w-5 h-5 text-red-600" />}
          theme="danger"
        />
        <StatCard 
          label="整改中" 
          value={hazards.filter(h => h.status === 'rectifying').length}
          icon={<Activity className="w-5 h-5 text-blue-600" />}
          theme="primary"
        />
        <StatCard 
          label="待验收" 
          value={hazards.filter(h => h.status === 'verified').length}
          icon={<Clock className="w-5 h-5 text-purple-600" />}
          theme="purple"
        />
        <StatCard 
          label="已闭环" 
          value={hazards.filter(h => h.status === 'closed').length}
          icon={<CheckCircle2 className="w-5 h-5 text-green-600" />}
          theme="success"
        />
      </div>

      {/* 快捷操作与列表 */}
      <div className="mt-8">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Clock size={20} className="text-slate-400" /> 最新上报
          </h3>
          {(loading || hazards.length > 0) && (
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={onBatchUpload} 
                className="gap-2 bg-white hover:bg-slate-50 border-slate-200 text-slate-700"
              >
                <Upload size={16} /> 批量上传
              </Button>
              <Button
                onClick={onReport} 
                className="gap-2 bg-red-600 hover:bg-red-700 text-white shadow-sm border-transparent"
              >
                <Plus size={16} /> 立即上报
              </Button>
            </div>
          )}
        </div>
        
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : hazards.length === 0 ? (
          <Card className="border-dashed border-slate-300 bg-slate-50/50">
             <CardContent className="flex flex-col items-center justify-center py-16 text-slate-400">
                <div className="bg-white p-4 rounded-full shadow-sm mb-4">
                    <Inbox size={48} className="text-slate-300" />
                </div>
                <p className="text-lg font-medium text-slate-600">暂无隐患记录</p>
                <p className="text-sm mt-1 mb-6">开始上报第一条隐患吧</p>
                <Button
                  onClick={onReport}
                  className="bg-red-600 hover:bg-red-700 gap-2"
                >
                  <Plus size={16} /> 立即上报
                </Button>
             </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
      border: 'border-red-100',
      iconBg: 'bg-red-50',
      text: 'text-red-600',
      decor: 'bg-red-500/5'
    },
    primary: {
      border: 'border-blue-100',
      iconBg: 'bg-blue-50',
      text: 'text-blue-600',
      decor: 'bg-blue-500/5'
    },
    purple: {
      border: 'border-purple-100',
      iconBg: 'bg-purple-50',
      text: 'text-purple-600',
      decor: 'bg-purple-500/5'
    },
    success: {
      border: 'border-green-100',
      iconBg: 'bg-green-50',
      text: 'text-green-600',
      decor: 'bg-green-500/5'
    }
  };

  const style = themes[theme];

  return (
    <Card className={cn("relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1 bg-white border", style.border)}>
        {/* Background Decor */}
        <div className={cn("absolute -right-6 -top-6 w-24 h-24 rounded-full pointer-events-none transition-transform duration-500 group-hover:scale-110", style.decor)} />

        <CardContent className="p-6 relative z-10">
            <div className="flex items-start justify-between mb-4">
                <div className={cn("p-2.5 rounded-lg", style.iconBg)}>
                    {icon}
                </div>
            </div>
            <div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                    {label}
                </div>
                <div className={cn("text-3xl font-bold tracking-tight", style.text)}>
                    {value}
                </div>
            </div>
        </CardContent>
    </Card>
  );
}
