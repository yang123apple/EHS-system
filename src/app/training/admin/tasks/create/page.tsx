'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Calendar, BookOpen, Save } from 'lucide-react';
import PeopleSelector from '@/components/common/PeopleSelector';
import { getMaterials, createTrainingTask } from '@/app/actions/training';
import { useToast } from '@/components/common/Toast';

export default function CreateTaskPage() {
  const router = useRouter();
  const { showToast } = useToast();

  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Form
  const [title, setTitle] = useState('');
  const [materialId, setMaterialId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [targetType, setTargetType] = useState<'all' | 'dept' | 'user'>('all');

  // Selector
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [selectedTargets, setSelectedTargets] = useState<any[]>([]);

  useEffect(() => {
    getMaterials().then(res => {
      if (res.success) setMaterials(res.data);
    });
  }, []);

  const handleTargetConfirm = (targets: any[]) => {
    setSelectedTargets(targets);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !materialId || !startDate || !endDate) {
      showToast('请完善所有必填信息', 'error');
      return;
    }

    // Prepare target config
    const targetConfig: any = {};
    if (targetType === 'dept') {
      targetConfig.deptIds = selectedTargets.map(t => t.id);
    } else if (targetType === 'user') {
      targetConfig.userIds = selectedTargets.map(t => t.id);
    }

    if (targetType !== 'all' && selectedTargets.length === 0) {
      showToast('请选择目标对象', 'error');
      return;
    }

    setLoading(true);
    try {
      const res = await createTrainingTask({
        title,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        materialId,
        publisherId: 'admin', // Should be current user
        targetType,
        targetConfig
      });

      if (res.success) {
        showToast('发布成功', 'success');
        router.push('/training/admin/tasks');
      } else {
        showToast('发布失败', 'error');
      }
    } catch (e) {
      showToast('系统错误', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <Users className="w-6 h-6" /> 发布学习任务
      </h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white p-6 rounded-xl shadow-sm space-y-4">

          <div>
            <label className="block text-sm font-medium mb-1">任务名称</label>
            <input
              required
              className="w-full border rounded p-2"
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">学习内容</label>
            <select
              required
              className="w-full border rounded p-2"
              value={materialId}
              onChange={e => setMaterialId(e.target.value)}
            >
              <option value="">请选择...</option>
              {materials.map(m => (
                <option key={m.id} value={m.id}>{m.title} ({m.type})</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">开始日期</label>
              <input
                type="date"
                required
                className="w-full border rounded p-2"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">结束日期</label>
              <input
                type="date"
                required
                className="w-full border rounded p-2"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div>
             <label className="block text-sm font-medium mb-2">发布范围</label>
             <div className="flex gap-4 mb-4">
               <label className="flex items-center gap-2 cursor-pointer">
                 <input
                   type="radio"
                   name="targetType"
                   value="all"
                   checked={targetType === 'all'}
                   onChange={() => { setTargetType('all'); setSelectedTargets([]); }}
                 />
                 <span>全体员工</span>
               </label>
               <label className="flex items-center gap-2 cursor-pointer">
                 <input
                   type="radio"
                   name="targetType"
                   value="dept"
                   checked={targetType === 'dept'}
                   onChange={() => { setTargetType('dept'); setSelectedTargets([]); }}
                 />
                 <span>指定部门</span>
               </label>
               <label className="flex items-center gap-2 cursor-pointer">
                 <input
                   type="radio"
                   name="targetType"
                   value="user"
                   checked={targetType === 'user'}
                   onChange={() => { setTargetType('user'); setSelectedTargets([]); }}
                 />
                 <span>指定人员</span>
               </label>
             </div>

             {targetType !== 'all' && (
               <div className="border p-4 rounded bg-slate-50">
                 <div className="flex flex-wrap gap-2 mb-2">
                   {selectedTargets.map(t => (
                     <span key={t.id} className="bg-white border px-2 py-1 rounded text-sm flex items-center gap-1">
                       {t.name}
                     </span>
                   ))}
                 </div>
                 <button
                   type="button"
                   onClick={() => setSelectorOpen(true)}
                   className="text-blue-600 text-sm hover:underline"
                 >
                   + 选择{targetType === 'dept' ? '部门' : '人员'}
                 </button>
               </div>
             )}
          </div>

        </div>

        <div className="flex justify-end gap-4">
           <button
             type="button"
             onClick={() => router.back()}
             className="px-6 py-2 rounded border hover:bg-slate-50"
           >
             取消
           </button>
           <button
             type="submit"
             disabled={loading}
             className="px-6 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
           >
             {loading ? '发布中...' : <><Save size={18} /> 发布任务</>}
           </button>
        </div>
      </form>

      <PeopleSelector
        isOpen={selectorOpen}
        onClose={() => setSelectorOpen(false)}
        onConfirm={handleTargetConfirm}
        mode={targetType === 'dept' ? 'dept' : 'user'} // Simplified for now
        multiSelect={true}
        title={targetType === 'dept' ? '选择部门' : '选择人员'}
      />
    </div>
  );
}
