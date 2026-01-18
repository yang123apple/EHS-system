// src/app/hidden-danger/_components/HazardCard.tsx
import { MapPin, Camera, Eye, ArrowRight } from 'lucide-react';
import { HazardRecord } from '@/types/hidden-danger';
import { StatusBadge, RiskBadge } from './Badges';

interface HazardCardProps {
  data: HazardRecord;
  onClick: () => void;
}

export function HazardCard({ data, onClick }: HazardCardProps) {
  return (
    <div 
      onClick={onClick} 
      className="relative bg-gradient-to-br from-white via-slate-50/50 to-slate-100/30 border-0 rounded-3xl shadow-[0_8px_24px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.9)] hover:shadow-[0_16px_48px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.95)] transition-all duration-300 hover:-translate-y-1.5 cursor-pointer overflow-hidden group"
    >
      {/* 背景光晕装饰 */}
      <div className="absolute -right-12 -top-12 w-32 h-32 rounded-full bg-gradient-to-br from-red-100/30 to-orange-100/20 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      
      {/* 顶部徽章区域 */}
      <div className="relative p-6 bg-gradient-to-br from-white/80 to-slate-50/60 backdrop-blur-sm border-b border-slate-200/40">
        <div className="flex justify-between items-start">
          <div className="flex gap-2">
            <RiskBadge level={data.riskLevel} />
          </div>
          <div className="flex flex-col items-end gap-2">
            <StatusBadge status={data.status} />
            <div className="text-xs text-slate-500 font-medium bg-white/60 backdrop-blur-sm px-2.5 py-1 rounded-lg shadow-sm">
              {new Date(data.reportTime).toLocaleDateString()}
            </div>
          </div>
        </div>
      </div>
      
      {/* 内容区域 */}
      <div className="p-7 space-y-5 relative z-10">
        {/* 标题 */}
        <h4 className="font-bold text-slate-900 text-lg leading-relaxed line-clamp-2 group-hover:text-red-600 transition-colors tracking-tight">
          {data.desc}
        </h4>

        {/* 位置和类型信息 */}
        <div className="space-y-3 text-sm text-slate-600">
          <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/60 backdrop-blur-sm shadow-sm">
            <div className="p-1.5 rounded-lg bg-slate-100/80">
              <MapPin size={14} className="text-slate-500 flex-shrink-0" />
            </div>
            <span className="truncate font-medium">{data.location}</span>
          </div>
          <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/60 backdrop-blur-sm shadow-sm">
            <div className="w-4 h-4 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center flex-shrink-0 shadow-sm">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
            </div>
            <span className="truncate font-medium">{data.type}</span>
          </div>
        </div>

        {/* 责任人信息 */}
        {data.responsibleName && (
          <div className="pt-4 border-t border-slate-200/60">
            <div className="text-xs text-slate-500 mb-2 font-semibold uppercase tracking-wider">责任人</div>
            <div className="font-bold text-slate-800 text-base">{data.responsibleName}</div>
          </div>
        )}

        {/* Hover显示的查看详情按钮 */}
        <div className="pt-4 border-t border-slate-200/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <button className="w-full bg-gradient-to-r from-red-600 via-red-500 to-orange-600 text-white py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 hover:shadow-[0_8px_24px_rgba(239,68,68,0.4)] transition-all duration-300 hover:scale-[1.02] text-sm tracking-tight">
            <Eye size={18} />
            <span>查看详情</span>
            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform duration-300" />
          </button>
        </div>
      </div>
    </div>
  );
}
