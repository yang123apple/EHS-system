import { useState, useEffect } from 'react';
import { CalendarDays } from 'lucide-react';
import { Project } from '@/types/work-permit';
import { ProjectService } from '@/services/workPermitService';
import { useDateRange } from '@/hooks/useDateRange';
import { toDateString } from '@/utils/dateUtils';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    project: Project;
    onSuccess: () => void;
}

export default function AdjustDateModal({ isOpen, onClose, project, onSuccess }: Props) {
    // 使用日期范围 Hook 自动处理开始和结束日期的关联
    const { startDate, endDate, setStartDate, setEndDate, endDateMin, isValid } = useDateRange({
        initialStartDate: project ? toDateString(project.startDate) : '',
        initialEndDate: project ? toDateString(project.endDate) : '',
    });

    useEffect(() => {
        if (project) {
            setStartDate(toDateString(project.startDate));
            setEndDate(toDateString(project.endDate));
        }
    }, [project, setStartDate, setEndDate]);

    const handleSave = async () => {
        if (!isValid) {
            alert('❌ 错误：结束日期必须晚于开始日期！');
            return;
        }
        
        try {
            await ProjectService.update(project.id, { startDate, endDate });
            alert("工期调整成功");
            onSuccess();
        } catch (e) {
            alert("调整失败");
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-2xl">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><CalendarDays className="text-orange-500"/> 工期调整</h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">开始日期</label>
                        <input 
                            type="date" 
                            className="w-full border rounded p-2" 
                            value={startDate} 
                            onChange={e => setStartDate(e.target.value)} 
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">结束日期</label>
                        <input 
                            type="date" 
                            className="w-full border rounded p-2" 
                            value={endDate} 
                            onChange={e => setEndDate(e.target.value)}
                            min={endDateMin}
                        />
                    </div>
                </div>
                <div className="flex justify-end gap-3 mt-6 border-t pt-4">
                    <button onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded">取消</button>
                    <button onClick={handleSave} className="px-6 py-2 bg-orange-600 text-white rounded hover:bg-orange-700">确认调整</button>
                </div>
            </div>
        </div>
    );
}