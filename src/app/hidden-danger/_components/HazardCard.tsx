// src/app/hidden-danger/_components/HazardCard.tsx
import { HazardRecord } from '@/types/hidden-danger';
import { StatusBadge, RiskBadge } from './Badges';

interface HazardCardProps {
  data: HazardRecord;
  onClick: () => void;
}

export function HazardCard({ data, onClick }: HazardCardProps) {
  const isVoided = data.isVoided || false;
  
  // 截断描述文字，超过10个字显示...
  const truncateDesc = (text: string, maxLength: number = 10) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  // 根据风险等级获取卡片背景色
  const getCardBgColor = () => {
    if (isVoided) return 'bg-slate-50/50';
    
    switch (data.riskLevel) {
      case 'low':
        return 'bg-blue-50/30';
      case 'medium':
        return 'bg-yellow-50/40';
      case 'high':
        return 'bg-orange-50/40';
      case 'major':
        return 'bg-red-50/40';
      default:
        return 'bg-white';
    }
  };

  return (
    <div 
      onClick={onClick} 
      className={`relative ${getCardBgColor()} border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 cursor-pointer overflow-hidden group ${
        isVoided ? 'opacity-60 grayscale-[0.3]' : ''
      }`}
    >
      {/* 已作废标识 */}
      {isVoided && (
        <div className="absolute top-2 right-2 z-10">
          <div className="bg-gray-500 text-white px-2 py-0.5 rounded text-xs font-semibold">
            已作废
          </div>
        </div>
      )}
      
      {/* 卡片内容 */}
      <div className="p-4 space-y-2.5">
        {/* 第一行：隐患编号和日期 + 风险等级 + 整改情况 */}
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 flex-1 min-w-0">
            {data.code && (
              <div className="text-xs font-mono font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded whitespace-nowrap inline-block">
                {data.code}
              </div>
            )}
            <div className="text-xs text-slate-500 px-2">
              {new Date(data.reportTime).toLocaleDateString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
              })}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <RiskBadge level={data.riskLevel} />
            <StatusBadge status={data.status} />
          </div>
        </div>

        {/* 第二行：隐患类型 */}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-500">类型：</span>
          <span className="font-medium text-slate-700">{data.type}</span>
        </div>

        {/* 第四行：责任部门 */}
        {data.responsibleDeptName && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-500">部门：</span>
            <span className="font-medium text-slate-700 truncate">{data.responsibleDeptName}</span>
          </div>
        )}

        {/* 第五行：责任人 */}
        {data.responsibleName && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-500">责任人：</span>
            <span className="font-medium text-slate-700">{data.responsibleName}</span>
          </div>
        )}

        {/* 第六行：隐患描述 */}
        <div className="pt-2 border-t border-slate-100">
          <div className="text-sm text-slate-700 leading-relaxed">
            {truncateDesc(data.desc, 10)}
          </div>
        </div>
      </div>

      {/* Hover效果：底部提示 */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 to-purple-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300" />
    </div>
  );
}
