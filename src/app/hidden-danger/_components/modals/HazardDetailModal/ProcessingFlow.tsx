// src/app/(dashboard)/hidden-danger/_components/modals/HazardDetailModal/ProcessingFlow.tsx
import { History, CheckCircle2, Circle, User } from 'lucide-react';
import { HazardLog } from '@/types/hidden-danger';

export function ProcessingFlow({ logs }: { logs?: HazardLog[] }) {
  if (!logs || logs.length === 0) return <div className="text-slate-400 text-sm py-4">暂无流转记录</div>;

  // 从changes中提取处理人信息
  const extractHandler = (changes: string): string | null => {
    const match = changes.match(/处理人:\s*([^\n]+)/);
    return match ? match[1].trim() : null;
  };

  return (
    <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-slate-200 before:via-slate-200 before:to-transparent">
      {logs.map((log, index) => {
        const handler = extractHandler(log.changes || '');
        
        return (
          <div key={index} className="relative flex items-start gap-4 group">
            <div className="absolute left-0 w-10 flex justify-center">
              {index === 0 ? (
                <div className="w-4 h-4 rounded-full bg-blue-500 ring-4 ring-blue-50 z-10" />
              ) : (
                <div className="w-3 h-3 rounded-full bg-slate-300 z-10 mt-1" />
              )}
            </div>
            
            <div className="ml-10 flex-1 bg-white border border-slate-100 p-3 rounded-lg shadow-sm group-hover:border-slate-300 transition-colors">
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-bold text-slate-800">{log.action}</span>
                <span className="text-[10px] text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full">
                  {new Date(log.time).toLocaleString('zh-CN', { 
                    month: '2-digit', 
                    day: '2-digit', 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </span>
              </div>
              <div className="text-xs text-slate-600 space-y-1">
                <div className="flex items-center gap-1">
                  <span className="font-medium">{log.operatorName}</span>
                  {log.changes && <span className="text-slate-400">· {log.changes}</span>}
                </div>
                
                {/* 当前处理人高亮显示 */}
                {handler && (
                  <div className="flex items-center gap-1 text-[11px] text-blue-600 bg-blue-50 px-2 py-1 rounded inline-flex">
                    <User size={12} />
                    <span className="font-medium">处理人：{handler}</span>
                  </div>
                )}
                
                {log.ccUserNames && log.ccUserNames.length > 0 && (
                  <div className="text-[11px] text-slate-600 bg-slate-50 px-2 py-1 rounded inline-block">
                    📧 抄送：{log.ccUserNames.join('、')}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
