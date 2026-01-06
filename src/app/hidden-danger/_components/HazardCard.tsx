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
      className="bg-white border border-slate-200 rounded-2xl shadow-md hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 cursor-pointer overflow-hidden group"
    >
      {/* 顶部徽章区域 - 不显示照片 */}
      <div className="relative p-4 bg-gradient-to-br from-slate-50 to-white border-b border-slate-100">
        <div className="flex justify-between items-start">
          <div className="flex gap-2">
            <RiskBadge level={data.riskLevel} />
          </div>
          <div className="flex flex-col items-end gap-2">
            <StatusBadge status={data.status} />
            <div className="text-xs text-slate-400">
              {new Date(data.reportTime).toLocaleDateString()}
            </div>
          </div>
        </div>
      </div>
      
      {/* 内容区域 - 增加行高和间距 */}
      <div className="p-5 space-y-4">
        {/* 标题 */}
        <h4 className="font-bold text-slate-900 text-base leading-relaxed line-clamp-2 group-hover:text-red-600 transition-colors">
          {data.desc}
        </h4>

        {/* 位置和类型信息 */}
        <div className="space-y-2 text-sm text-slate-600">
          <div className="flex items-center gap-2">
            <MapPin size={14} className="text-slate-400 flex-shrink-0" />
            <span className="truncate">{data.location}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3.5 h-3.5 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            </div>
            <span className="truncate">{data.type}</span>
          </div>
        </div>

        {/* 责任人信息 */}
        {data.responsibleName && (
          <div className="pt-3 border-t border-slate-100">
            <div className="text-xs text-slate-500 mb-1">责任人</div>
            <div className="font-medium text-slate-700">{data.responsibleName}</div>
          </div>
        )}

        {/* Hover显示的查看详情按钮 */}
        <div className="pt-3 border-t border-slate-100 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <button className="w-full bg-gradient-to-r from-red-600 to-orange-600 text-white py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 hover:shadow-lg transition-shadow">
            <Eye size={16} />
            <span>查看详情</span>
            <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
}
