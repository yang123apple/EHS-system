// src/app/(dashboard)/hidden-danger/_components/modals/HazardDetailModal/ExtensionCard.tsx
import { useState } from 'react';
import { CalendarClock, AlertCircle } from 'lucide-react';

export function ExtensionCard({ hazard, onProcess, canRequest, canApprove }: any) {
  const [showForm, setShowForm] = useState(false);
  const [data, setData] = useState({ extensionReason: '', newDeadline: '' });

  // 检查是否临近截止日期 (<=3天)
  const isNear = () => {
    if (!hazard.deadline) return false;
    const diff = Math.ceil((new Date(hazard.deadline).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
    return diff <= 3;
  };

  if (hazard.isExtensionRequested) {
    return (
      <div className="bg-orange-50 border border-orange-200 p-3 rounded-lg animate-pulse">
        <h6 className="font-bold text-orange-700 text-xs flex items-center gap-1">
          <CalendarClock size={14}/> 延期申请处理中
        </h6>
        <p className="text-[10px] text-slate-500 mt-1">原因：{hazard.extensionReason}</p>
        
        {canApprove && (
          <div className="mt-3 space-y-2 border-t border-orange-200 pt-2">
            <input 
              type="date" 
              className="w-full border p-1 text-xs rounded" 
              onChange={e => setData({...data, newDeadline: e.target.value})}
            />
            <button 
              onClick={() => onProcess('approve_extension', hazard, data)}
              className="w-full bg-orange-500 text-white py-1 rounded text-xs font-bold"
            >
              批准延期
            </button>
          </div>
        )}
      </div>
    );
  }

  // 只有有申请权限的用户才能看到延期申请按钮
  if (canRequest && isNear() && !showForm) {
    return (
      <button 
        onClick={() => setShowForm(true)}
        className="w-full border border-orange-300 text-orange-600 py-2 rounded text-xs hover:bg-orange-50 flex items-center justify-center gap-1"
      >
        <AlertCircle size={14}/> 申请延期 (即将到期)
      </button>
    );
  }

  if (canRequest && showForm) {
    return (
      <div className="p-3 border border-orange-200 rounded-lg bg-white">
        <textarea 
          className="w-full border p-2 text-xs mb-2 rounded h-16" 
          placeholder="请说明延期原因..." 
          onChange={e => setData({...data, extensionReason: e.target.value})}
        />
        <div className="flex gap-2">
          <button onClick={() => setShowForm(false)} className="flex-1 text-xs text-slate-500">取消</button>
          <button onClick={() => onProcess('request_extension', hazard, data)} className="flex-1 bg-orange-500 text-white py-1 rounded text-xs">提交</button>
        </div>
      </div>
    );
  }

  return null;
}
