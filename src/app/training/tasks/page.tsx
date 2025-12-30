'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Calendar, Users, FileText, Eye, ChevronRight, Sparkles, Clock, TrendingUp, Edit } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/apiClient';

interface Task {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  targetType: string;
  material: {
    title: string;
    type: string;
  };
  assignments: Array<{ status: string }>;
}

export default function TasksPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  // 权限检查：是否可以编辑任务
  const canEditTask = user?.role === 'admin' || user?.permissions?.training?.edit_task === true;

  useEffect(() => {
    api.get<Task[]>('/api/training/tasks')
      .then(data => {
        // Ensure data is always an array
        if (Array.isArray(data)) {
          setTasks(data);
        } else {
          console.error('Invalid API response (expected array):', data);
          setTasks([]);
        }
      })
      .catch(error => {
        console.error('Failed to fetch tasks:', error);
        setTasks([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const getTargetLabel = (type: string) => {
    switch (type) {
      case 'all': return '全体员工';
      case 'dept': return '指定部门';
      case 'user': return '指定人员';
      default: return type;
    }
  };

  const getStatusInfo = (task: Task) => {
    const now = new Date();
    const start = new Date(task.startDate);
    const end = new Date(task.endDate);
    
    if (now < start) {
      return { label: '未开始', color: 'slate', icon: Clock };
    } else if (now > end) {
      return { label: '已结束', color: 'gray', icon: Calendar };
    } else {
      return { label: '进行中', color: 'emerald', icon: TrendingUp };
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] px-8 py-10">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-slate-200 rounded-xl w-48" />
            <div className="h-32 bg-slate-200 rounded-2xl" />
            <div className="h-32 bg-slate-200 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] px-8 py-10">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl shadow-lg shadow-blue-600/20">
              <Sparkles size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">学习任务</h1>
              <p className="text-sm text-slate-500 mt-1">管理和发布培训任务</p>
            </div>
          </div>
          
          <Link
            href="/training/tasks/create"
            className="group flex items-center gap-2 px-6 py-3 
                     bg-gradient-to-r from-blue-600 to-indigo-600 
                     text-white rounded-xl font-semibold text-sm
                     shadow-lg shadow-blue-600/25
                     hover:shadow-xl hover:shadow-blue-600/30 hover:scale-[1.02]
                     active:scale-95
                     transition-all duration-200"
          >
            <Plus size={18} />
            <span>发布新任务</span>
          </Link>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 mb-1">总任务数</p>
                <p className="text-3xl font-bold text-slate-900">{tasks.length}</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-xl">
                <FileText size={24} className="text-blue-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 mb-1">进行中</p>
                <p className="text-3xl font-bold text-emerald-600">
                  {tasks.filter(t => {
                    const now = new Date();
                    return now >= new Date(t.startDate) && now <= new Date(t.endDate);
                  }).length}
                </p>
              </div>
              <div className="p-3 bg-emerald-50 rounded-xl">
                <TrendingUp size={24} className="text-emerald-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 mb-1">已结束</p>
                <p className="text-3xl font-bold text-slate-400">
                  {tasks.filter(t => new Date() > new Date(t.endDate)).length}
                </p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <Calendar size={24} className="text-slate-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Tasks Table */}
        {tasks.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center shadow-sm">
            <div className="flex flex-col items-center gap-4">
              <div className="p-6 bg-slate-50 rounded-2xl">
                <FileText size={48} className="text-slate-300" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">暂无学习任务</h3>
                <p className="text-sm text-slate-500 mb-6">开始发布第一个培训任务吧</p>
                <Link
                  href="/training/tasks/create"
                  className="inline-flex items-center gap-2 px-6 py-3 
                           bg-gradient-to-r from-blue-600 to-indigo-600 
                           text-white rounded-xl font-semibold text-sm
                           shadow-lg shadow-blue-600/25
                           hover:shadow-xl hover:shadow-blue-600/30 hover:scale-[1.02]
                           active:scale-95
                           transition-all duration-200"
                >
                  <Plus size={18} />
                  创建任务
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-200">
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">
                      任务信息
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">
                      学习内容
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">
                      任务时间
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">
                      覆盖范围
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">
                      状态
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-slate-600 uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tasks.map((task) => {
                    const status = getStatusInfo(task);
                    const StatusIcon = status.icon;
                    
                    return (
                      <tr 
                        key={task.id}
                        className="hover:bg-slate-50/50 transition-colors duration-150"
                      >
                        <td className="px-6 py-5">
                          <div className="flex items-start gap-3">
                            <div className="p-2 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg">
                              <FileText size={16} className="text-blue-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-slate-900 truncate">
                                {task.title}
                              </p>
                              <p className="text-xs text-slate-500 mt-0.5">
                                ID: {task.id.slice(0, 8)}
                              </p>
                            </div>
                          </div>
                        </td>
                        
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-2">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                              task.material.type === 'VIDEO' 
                                ? 'bg-purple-100 text-purple-700' 
                                : task.material.type === 'PDF'
                                ? 'bg-rose-100 text-rose-700'
                                : 'bg-amber-100 text-amber-700'
                            }`}>
                              {task.material.type === 'VIDEO' ? '视频' : task.material.type === 'PDF' ? 'PDF' : 'PPT'}
                            </span>
                            <span className="text-sm text-slate-700 truncate max-w-[200px]">
                              {task.material.title}
                            </span>
                          </div>
                        </td>
                        
                        <td className="px-6 py-5">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-xs text-slate-600">
                              <Calendar size={12} className="text-slate-400" />
                              <span>{new Date(task.startDate).toLocaleDateString('zh-CN')}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-600">
                              <Clock size={12} className="text-slate-400" />
                              <span>{new Date(task.endDate).toLocaleDateString('zh-CN')}</span>
                            </div>
                          </div>
                        </td>
                        
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-2">
                            <Users size={14} className="text-slate-400" />
                            <span className="text-sm text-slate-700">
                              {getTargetLabel(task.targetType)}
                            </span>
                            <span className="text-xs text-slate-400">
                              ({task.assignments?.length || 0} 人)
                            </span>
                          </div>
                        </td>
                        
                        <td className="px-6 py-5">
                          <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
                            status.color === 'emerald' 
                              ? 'bg-emerald-100 text-emerald-700' 
                              : status.color === 'slate'
                              ? 'bg-slate-100 text-slate-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            <StatusIcon size={12} />
                            {status.label}
                          </div>
                        </td>
                        
                        <td className="px-6 py-5">
                          <div className="flex items-center justify-end gap-2">
                            {canEditTask && (
                              <Link
                                href={`/training/tasks/${task.id}/edit`}
                                className="group flex items-center gap-1.5 px-4 py-2 
                                         bg-amber-50 text-amber-600 rounded-lg text-sm font-medium
                                         hover:bg-amber-100 
                                         active:scale-95
                                         transition-all duration-200"
                              >
                                <Edit size={14} />
                                编辑
                              </Link>
                            )}
                            <Link
                              href={`/training/tasks/${task.id}`}
                              className="group flex items-center gap-1.5 px-4 py-2 
                                       bg-blue-50 text-blue-600 rounded-lg text-sm font-medium
                                       hover:bg-blue-100 
                                       active:scale-95
                                       transition-all duration-200"
                            >
                              <Eye size={14} />
                              查看详情
                              <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform duration-200" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
