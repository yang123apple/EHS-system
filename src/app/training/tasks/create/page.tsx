'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DepartmentSelectModal from '@/components/work-permit/moduls/DepartmentSelectModal';
import UserSelectModal from '@/components/training/UserSelectModal';
import { useAuth } from '@/context/AuthContext';

export default function CreateTaskPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form
  const [title, setTitle] = useState('');
  const [materialId, setMaterialId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [targetType, setTargetType] = useState('all'); // all, dept, user
  const [targetConfig, setTargetConfig] = useState<any[]>([]); // ids

  // Modals
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [displayTargets, setDisplayTargets] = useState<string[]>([]);

  useEffect(() => {
    fetch('/api/training/materials')
      .then(res => res.json())
      .then(data => {
          setMaterials(data);
          if (data.length > 0) setMaterialId(data[0].id);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async () => {
    if (!title || !materialId || !startDate || !endDate) return alert('请完善信息');
    if (targetType !== 'all' && targetConfig.length === 0) return alert('请选择目标对象');
    if (!user?.id) return alert('登录状态失效');

    setSubmitting(true);
    try {
        const res = await fetch('/api/training/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title,
                description: '',
                startDate,
                endDate,
                materialId,
                publisherId: user.id,
                targetType,
                targetConfig
            })
        });

        if (res.ok) router.push('/training/tasks');
        else alert('Failed');
    } catch (e) {
        console.error(e);
        alert('Error');
    } finally {
        setSubmitting(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">发布学习任务</h2>

      <div className="bg-white rounded-xl shadow-sm border p-6 space-y-6">
          <div>
              <label className="block font-bold mb-2">任务标题</label>
              <input className="w-full border rounded p-2" value={title} onChange={e => setTitle(e.target.value)} />
          </div>

          <div>
              <label className="block font-bold mb-2">学习内容</label>
              <select className="w-full border rounded p-2" value={materialId} onChange={e => setMaterialId(e.target.value)}>
                  {materials.map(m => (
                      <option key={m.id} value={m.id}>{m.title} ({m.type})</option>
                  ))}
              </select>
          </div>

          <div className="flex gap-4">
              <div className="flex-1">
                  <label className="block font-bold mb-2">开始日期</label>
                  <input type="date" className="w-full border rounded p-2" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
              <div className="flex-1">
                  <label className="block font-bold mb-2">结束日期</label>
                  <input type="date" className="w-full border rounded p-2" value={endDate} onChange={e => setEndDate(e.target.value)} />
              </div>
          </div>

          <div>
              <label className="block font-bold mb-2">任务范围</label>
              <div className="flex gap-4 mb-4">
                  <label className="flex items-center gap-2">
                      <input type="radio" name="scope" value="all" checked={targetType === 'all'} onChange={() => { setTargetType('all'); setTargetConfig([]); setDisplayTargets([]); }} />
                      全体员工
                  </label>
                  <label className="flex items-center gap-2">
                      <input type="radio" name="scope" value="dept" checked={targetType === 'dept'} onChange={() => { setTargetType('dept'); setTargetConfig([]); setDisplayTargets([]); }} />
                      指定部门
                  </label>
                  <label className="flex items-center gap-2">
                      <input type="radio" name="scope" value="user" checked={targetType === 'user'} onChange={() => { setTargetType('user'); setTargetConfig([]); setDisplayTargets([]); }} />
                      指定用户
                  </label>
              </div>

              {targetType === 'dept' && (
                  <div className="border p-4 rounded bg-slate-50">
                      <div className="flex flex-wrap gap-2 mb-2">
                          {displayTargets.map((name, i) => (
                              <span key={i} className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">{name}</span>
                          ))}
                          <button onClick={() => setShowDeptModal(true)} className="bg-white border px-3 py-1 rounded text-sm hover:bg-slate-100">+ 添加部门</button>
                      </div>
                      <div className="text-xs text-slate-400">已选择 {targetConfig.length} 个部门</div>
                  </div>
              )}

              {targetType === 'user' && (
                  <div className="border p-4 rounded bg-slate-50">
                      <div className="flex flex-wrap gap-2 mb-2">
                           {displayTargets.map((name, i) => (
                              <span key={i} className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">{name}</span>
                          ))}
                          <button onClick={() => setShowUserModal(true)} className="bg-white border px-3 py-1 rounded text-sm hover:bg-slate-100">+ 添加人员</button>
                      </div>
                       <div className="text-xs text-slate-400">已选择 {targetConfig.length} 人</div>
                  </div>
              )}
          </div>

          <div className="pt-6 border-t flex justify-end">
              <button onClick={handleSubmit} disabled={submitting} className="bg-blue-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-blue-700">
                  {submitting ? '发布中...' : '确认发布'}
              </button>
          </div>
      </div>

      {/* Dept Modal */}
      <DepartmentSelectModal
          isOpen={showDeptModal}
          onClose={() => setShowDeptModal(false)}
          onSelect={(id, name) => {
              if (!targetConfig.includes(id)) {
                  setTargetConfig([...targetConfig, id]);
                  setDisplayTargets([...displayTargets, name]);
              }
              setShowDeptModal(false);
          }}
      />

      {/* User Modal */}
      <UserSelectModal
          isOpen={showUserModal}
          onClose={() => setShowUserModal(false)}
          onConfirm={(users) => {
              const newIds = users.map(u => u.id).filter(id => !targetConfig.includes(id));
              setTargetConfig([...targetConfig, ...newIds]);
              setDisplayTargets([...displayTargets, ...users.map(u => u.name).filter(n => !displayTargets.includes(n))]); // Simple name filter
              setShowUserModal(false);
          }}
      />
    </div>
  );
}
