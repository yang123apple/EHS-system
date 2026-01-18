/* eslint-disable @typescript-eslint/no-explicit-any */
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
          <Card variant="clay" className="border-dashed border-slate-300/60 bg-gradient-to-br from-slate-50/80 via-white/60 to-slate-100/40">
             <CardContent className="flex flex-col items-center justify-center py-20 text-slate-400">
                <div className="bg-white/80 backdrop-blur-sm p-5 rounded-3xl shadow-[0_8px_24px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.9)] mb-6">
                    <Inbox size={48} className="text-slate-400" />
                </div>
                <p className="text-xl font-bold text-slate-700 tracking-tight">暂无隐患记录</p>
                <p className="text-sm mt-2 mb-8 text-slate-500 font-medium">开始上报第一条隐患吧</p>
                <Button
                  onClick={onReport}
                  className="bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 gap-2 shadow-[0_8px_24px_rgba(239,68,68,0.3)] hover:shadow-[0_12px_32px_rgba(239,68,68,0.4)] transition-all duration-300 font-semibold rounded-2xl px-6 py-3"
                >
                  <Plus size={18} /> 立即上报
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
      iconBg: 'bg-gradient-to-br from-red-50 to-orange-50',
      iconBorder: 'border-red-200/50',
      iconShadow: 'shadow-[0_4px_12px_rgba(239,68,68,0.15),inset_0_1px_0_rgba(255,255,255,0.9)]',
      text: 'text-red-600',
      decor: 'bg-gradient-to-br from-red-200/30 to-orange-200/20',
      glow: 'from-red-100/40 to-orange-100/30'
    },
    primary: {
      iconBg: 'bg-gradient-to-br from-blue-50 to-cyan-50',
      iconBorder: 'border-blue-200/50',
      iconShadow: 'shadow-[0_4px_12px_rgba(59,130,246,0.15),inset_0_1px_0_rgba(255,255,255,0.9)]',
      text: 'text-blue-600',
      decor: 'bg-gradient-to-br from-blue-200/30 to-cyan-200/20',
      glow: 'from-blue-100/40 to-cyan-100/30'
    },
    purple: {
      iconBg: 'bg-gradient-to-br from-purple-50 to-pink-50',
      iconBorder: 'border-purple-200/50',
      iconShadow: 'shadow-[0_4px_12px_rgba(147,51,234,0.15),inset_0_1px_0_rgba(255,255,255,0.9)]',
      text: 'text-purple-600',
      decor: 'bg-gradient-to-br from-purple-200/30 to-pink-200/20',
      glow: 'from-purple-100/40 to-pink-100/30'
    },
    success: {
      iconBg: 'bg-gradient-to-br from-green-50 to-emerald-50',
      iconBorder: 'border-green-200/50',
      iconShadow: 'shadow-[0_4px_12px_rgba(34,197,94,0.15),inset_0_1px_0_rgba(255,255,255,0.9)]',
      text: 'text-green-600',
      decor: 'bg-gradient-to-br from-green-200/30 to-emerald-200/20',
      glow: 'from-green-100/40 to-emerald-100/30'
    }
  };

  const style = themes[theme];

  return (
    <Card 
      variant="clay"
      className="relative overflow-hidden group"
    >
        {/* Background Decor - 渐变光晕 */}
        <div className={cn(
          "absolute -right-10 -top-10 w-32 h-32 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br",
          style.glow
        )} />

        <CardContent className="p-7 relative z-10">
            <div className="flex items-start justify-between mb-5">
                <div className={cn(
                  "p-3.5 rounded-2xl border backdrop-blur-sm transition-transform duration-300 group-hover:scale-110",
                  style.iconBg,
                  style.iconBorder,
                  style.iconShadow
                )}>
                    {icon}
                </div>
            </div>
            <div className="space-y-2">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
                    {label}
                </div>
                <div className={cn("text-4xl font-bold tracking-tight leading-none", style.text)}>
                    {value}
                </div>
            </div>
        </CardContent>
    </Card>
  );
}
