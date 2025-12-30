'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, Users, Building2, UserCheck, ArrowLeft, Sparkles, FileText, Clock } from 'lucide-react';
import PeopleSelector from '@/components/common/PeopleSelector';
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

  const selectedMaterial = materials.find(m => m.id === materialId);

  return (
    <div className="min-h-screen bg-[#F8FAFC] px-8 py-10">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="group flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-4 transition-colors duration-200"
          >
            <ArrowLeft size={18} className="group-hover:-translate-x-0.5 transition-transform duration-200" />
            <span className="text-sm font-medium">返回任务列表</span>
          </button>
          
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl shadow-lg shadow-blue-600/20">
              <Sparkles size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">发布学习任务</h1>
              <p className="text-sm text-slate-500 mt-1">创建新的学习计划并分配给指定人员</p>
            </div>
          </div>
        </div>

        {/* Main Form Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 space-y-8">
          
          {/* Task Title */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-3">
              <FileText size={16} className="text-slate-400" />
              任务标题
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="例如：2024年Q1安全生产培训"
              className="w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-xl 
                       text-slate-900 placeholder:text-slate-400
                       focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 
                       transition-all duration-200"
            />
          </div>

          {/* Learning Material */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-3">
              <FileText size={16} className="text-slate-400" />
              学习内容
            </label>
            <select
              value={materialId}
              onChange={e => setMaterialId(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-xl 
                       text-slate-900 appearance-none cursor-pointer
                       focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 
                       transition-all duration-200"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%2394a3b8' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 1rem center'
              }}
            >
              {loading ? (
                <option>加载中...</option>
              ) : materials.length === 0 ? (
                <option>暂无可用学习内容</option>
              ) : (
                materials.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.title} · {m.type === 'VIDEO' ? '视频课程' : m.type === 'PDF' ? 'PDF文档' : 'PPT课件'}
                  </option>
                ))
              )}
            </select>
            
            {selectedMaterial && (
              <div className="mt-3 p-4 bg-blue-50/50 border border-blue-100 rounded-xl">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <FileText size={16} className="text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900">{selectedMaterial.title}</p>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500">
                      <span className={`px-2 py-0.5 rounded-full font-medium ${
                        selectedMaterial.type === 'VIDEO' ? 'bg-purple-100 text-purple-700' :
                        selectedMaterial.type === 'PDF' ? 'bg-rose-100 text-rose-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {selectedMaterial.type === 'VIDEO' ? '视频' : selectedMaterial.type === 'PDF' ? 'PDF' : 'PPT'}
                      </span>
                      {selectedMaterial.category && (
                        <span className="text-slate-400">· {selectedMaterial.category}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-3">
                <Calendar size={16} className="text-slate-400" />
                开始日期
              </label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-xl 
                         text-slate-900
                         focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 
                         transition-all duration-200"
              />
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-3">
                <Clock size={16} className="text-slate-400" />
                结束日期
              </label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-xl 
                         text-slate-900
                         focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 
                         transition-all duration-200"
              />
            </div>
          </div>

          {/* Target Audience */}
          <div className="space-y-4">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Users size={16} className="text-slate-400" />
              任务范围
            </label>
            
            {/* Radio Options */}
            <div className="grid grid-cols-3 gap-3">
              <label className={`
                relative flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer
                transition-all duration-200
                ${targetType === 'all' 
                  ? 'bg-blue-50 border-blue-500 shadow-sm shadow-blue-500/10' 
                  : 'bg-slate-50/50 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }
              `}>
                <input
                  type="radio"
                  name="scope"
                  value="all"
                  checked={targetType === 'all'}
                  onChange={() => { setTargetType('all'); setTargetConfig([]); setDisplayTargets([]); }}
                  className="sr-only"
                />
                <div className={`
                  w-5 h-5 rounded-full border-2 flex items-center justify-center
                  transition-all duration-200
                  ${targetType === 'all' ? 'border-blue-600 bg-blue-600' : 'border-slate-300'}
                `}>
                  {targetType === 'all' && (
                    <div className="w-2 h-2 bg-white rounded-full" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <UserCheck size={16} className={targetType === 'all' ? 'text-blue-600' : 'text-slate-400'} />
                    <span className={`text-sm font-medium ${targetType === 'all' ? 'text-blue-900' : 'text-slate-700'}`}>
                      全体员工
                    </span>
                  </div>
                </div>
              </label>

              <label className={`
                relative flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer
                transition-all duration-200
                ${targetType === 'dept' 
                  ? 'bg-blue-50 border-blue-500 shadow-sm shadow-blue-500/10' 
                  : 'bg-slate-50/50 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }
              `}>
                <input
                  type="radio"
                  name="scope"
                  value="dept"
                  checked={targetType === 'dept'}
                  onChange={() => { setTargetType('dept'); setTargetConfig([]); setDisplayTargets([]); }}
                  className="sr-only"
                />
                <div className={`
                  w-5 h-5 rounded-full border-2 flex items-center justify-center
                  transition-all duration-200
                  ${targetType === 'dept' ? 'border-blue-600 bg-blue-600' : 'border-slate-300'}
                `}>
                  {targetType === 'dept' && (
                    <div className="w-2 h-2 bg-white rounded-full" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Building2 size={16} className={targetType === 'dept' ? 'text-blue-600' : 'text-slate-400'} />
                    <span className={`text-sm font-medium ${targetType === 'dept' ? 'text-blue-900' : 'text-slate-700'}`}>
                      指定部门
                    </span>
                  </div>
                </div>
              </label>

              <label className={`
                relative flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer
                transition-all duration-200
                ${targetType === 'user' 
                  ? 'bg-blue-50 border-blue-500 shadow-sm shadow-blue-500/10' 
                  : 'bg-slate-50/50 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }
              `}>
                <input
                  type="radio"
                  name="scope"
                  value="user"
                  checked={targetType === 'user'}
                  onChange={() => { setTargetType('user'); setTargetConfig([]); setDisplayTargets([]); }}
                  className="sr-only"
                />
                <div className={`
                  w-5 h-5 rounded-full border-2 flex items-center justify-center
                  transition-all duration-200
                  ${targetType === 'user' ? 'border-blue-600 bg-blue-600' : 'border-slate-300'}
                `}>
                  {targetType === 'user' && (
                    <div className="w-2 h-2 bg-white rounded-full" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Users size={16} className={targetType === 'user' ? 'text-blue-600' : 'text-slate-400'} />
                    <span className={`text-sm font-medium ${targetType === 'user' ? 'text-blue-900' : 'text-slate-700'}`}>
                      指定用户
                    </span>
                  </div>
                </div>
              </label>
            </div>

            {/* Department Selection */}
            {targetType === 'dept' && (
              <div className="p-5 bg-gradient-to-br from-slate-50 to-slate-50/50 border border-slate-200 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-slate-700">
                    已选择 {targetConfig.length} 个部门
                  </span>
                  <button
                    onClick={() => setShowDeptModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg
                             text-sm font-medium text-slate-700
                             hover:bg-slate-50 hover:border-slate-300 
                             active:scale-95
                             transition-all duration-200 shadow-sm"
                  >
                    <Building2 size={14} />
                    添加部门
                  </button>
                </div>
                {displayTargets.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {displayTargets.map((name, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium"
                      >
                        <Building2 size={12} />
                        {name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* User Selection */}
            {targetType === 'user' && (
              <div className="p-5 bg-gradient-to-br from-slate-50 to-slate-50/50 border border-slate-200 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-slate-700">
                    已选择 {targetConfig.length} 人
                  </span>
                  <button
                    onClick={() => setShowUserModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg
                             text-sm font-medium text-slate-700
                             hover:bg-slate-50 hover:border-slate-300 
                             active:scale-95
                             transition-all duration-200 shadow-sm"
                  >
                    <Users size={14} />
                    添加人员
                  </button>
                </div>
                {displayTargets.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {displayTargets.map((name, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium"
                      >
                        <UserCheck size={12} />
                        {name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            onClick={() => router.back()}
            className="px-6 py-3 bg-white border border-slate-200 rounded-xl
                     text-sm font-semibold text-slate-700
                     hover:bg-slate-50 hover:border-slate-300
                     active:scale-95
                     transition-all duration-200 shadow-sm"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !title || !materialId || !startDate || !endDate}
            className="group relative px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 
                     rounded-xl text-white font-semibold text-sm
                     shadow-lg shadow-blue-600/25
                     hover:shadow-xl hover:shadow-blue-600/30 hover:scale-[1.02]
                     active:scale-95
                     disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
                     transition-all duration-200 overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-blue-700 to-indigo-700 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
            <span className="relative flex items-center gap-2">
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  发布中...
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  确认发布
                </>
              )}
            </span>
          </button>
        </div>
      </div>

      {/* Dept Modal */}
      <PeopleSelector
          isOpen={showDeptModal}
          onClose={() => setShowDeptModal(false)}
          mode="dept"
          onConfirm={(selection) => {
              if (Array.isArray(selection) && selection.length > 0) {
                  // @ts-ignore
                  const dept = selection[0];
                   if (!targetConfig.includes(dept.id)) {
                      setTargetConfig([...targetConfig, dept.id]);
                      setDisplayTargets([...displayTargets, dept.name]);
                  }
              }
              setShowDeptModal(false);
          }}
          title="选择部门"
      />

      {/* User Modal */}
      <PeopleSelector
          isOpen={showUserModal}
          onClose={() => setShowUserModal(false)}
          mode="user"
          multiSelect={true}
          onConfirm={(selection) => {
              // @ts-ignore
              const users = selection as any[];
              const newIds = users.map(u => u.id).filter(id => !targetConfig.includes(id));
              setTargetConfig([...targetConfig, ...newIds]);
              // Note: Using simple name tracking, might duplicate names but good enough for display
              const newNames = users.map(u => u.name);
              setDisplayTargets(prev => Array.from(new Set([...prev, ...newNames])));
              setShowUserModal(false);
          }}
          title="选择人员"
      />
    </div>
  );
}
