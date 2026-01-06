// src/app/hidden-danger/_components/modals/HazardDetailModal/ActionForms/AssignForm.tsx
import { useState } from 'react';
import { HazardRecord, SimpleUser } from '@/types/hidden-danger';
import { Calendar, Wand2 } from 'lucide-react';

interface AssignFormProps {
  hazard: HazardRecord;
  allUsers: SimpleUser[];
  onProcess: (action: string, hazard: HazardRecord, data: any) => void;
}

export function AssignForm({ hazard, allUsers, onProcess }: AssignFormProps) {
  const [data, setData] = useState({ 
    deadline: '',
    rectifyRequirement: hazard.rectifyRequirement || ''
  });

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
      <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
        <div className="flex items-start gap-3">
          <Wand2 size={20} className="text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h4 className="font-bold text-blue-900 mb-1">自动派发责任人</h4>
            <p className="text-xs text-blue-700">
              系统将根据工作流配置自动匹配最合适的责任人，无需手动选择。
            </p>
          </div>
        </div>
      </div>

      {/* 截止时间 */}
      <div>
        <label className="block text-xs font-bold text-slate-600 mb-1 flex items-center gap-1">
          <Calendar size={14}/> 整改截止日期 *
        </label>
        <input 
          type="date" 
          className="w-full border rounded-lg p-2.5 text-sm"
          value={data.deadline}
          onChange={e => setData({...data, deadline: e.target.value})}
        />
      </div>

      {/* 整改要求 */}
      <div>
        <label className="block text-xs font-bold text-slate-600 mb-1">具体整改要求</label>
        <textarea 
          className="w-full border rounded-lg p-2.5 text-sm h-24"
          placeholder="请输入具体的技术规范或现场要求..."
          value={data.rectifyRequirement}
          onChange={e => setData({...data, rectifyRequirement: e.target.value})}
        />
      </div>

      <button 
        onClick={() => onProcess('assign', hazard, { deadline: data.deadline, rectifyRequirement: data.rectifyRequirement })}
        disabled={!data.deadline}
        className={`w-full py-3 rounded-lg font-bold shadow-lg transition-all ${
          !data.deadline
            ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
            : 'bg-slate-800 text-white hover:bg-slate-900'
        }`}
      >
        <div className="flex items-center justify-center gap-2">
          <Wand2 size={18} />
          <span>自动派发并下发任务</span>
        </div>
      </button>
    </div>
  );
}
