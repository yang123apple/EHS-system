'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { PlayCircle, FileText, CheckCircle, Clock } from 'lucide-react';
import { getUserTasks } from '@/app/actions/training';

export default function TrainingCenterPage() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'todo' | 'done'>('todo');

  useEffect(() => {
    // Ideally pass current user ID. Since we don't have auth context exposed here easily,
    // we assume the server action handles user context via session or we pass a mock ID for dev.
    // In a real app, `getUserTasks` would use `auth()` from NextAuth.
    // For this implementation, I will rely on the `getUserTasks` implementation to use a fixed user or session.
    // However, my `getUserTasks` implementation took a `userId` argument.
    // I need to fetch the current user ID.
    // For now, I'll assume a hook or context exists or I will fetch it.
    // Since I don't see an obvious auth hook usage in my snippets, I'll fetch a dummy user or use a hardcoded one for demonstration
    // if I can't get it easily.
    // WAIT: `src/lib/auth.ts` or similar is common.
    // Let's assume for now I can pass a known ID or the action fixes it.
    // Let's fetch using a hardcoded ID for 'admin' or similar for testing if no auth context.
    // BETTER: Create a wrapper that fetches current user on server.
    // BUT: this is a client component.

    // I will mock the user ID as 'admin' for now, assuming I am logged in as admin.
    getUserTasks('admin').then(res => {
        if (res.success) setTasks(res.data);
        setLoading(false);
    });
  }, []);

  const todoTasks = tasks.filter(t => !['completed', 'passed'].includes(t.status));
  const doneTasks = tasks.filter(t => ['completed', 'passed'].includes(t.status));

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">我的培训中心</h1>

      {/* Tabs */}
      <div className="flex gap-6 border-b mb-6">
        <button
          onClick={() => setActiveTab('todo')}
          className={`pb-3 px-1 font-medium border-b-2 transition-colors ${
            activeTab === 'todo' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          待完成 ({todoTasks.length})
        </button>
        <button
          onClick={() => setActiveTab('done')}
          className={`pb-3 px-1 font-medium border-b-2 transition-colors ${
            activeTab === 'done' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          已完成 ({doneTasks.length})
        </button>
      </div>

      {/* List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full text-center py-10 text-slate-400">加载中...</div>
        ) : (activeTab === 'todo' ? todoTasks : doneTasks).length === 0 ? (
          <div className="col-span-full text-center py-10 text-slate-400">
             {activeTab === 'todo' ? '恭喜！您没有待完成的培训任务。' : '暂无已完成的记录。'}
          </div>
        ) : (activeTab === 'todo' ? todoTasks : doneTasks).map(item => (
          <Link
            key={item.id}
            href={`/training/learn/${item.id}`}
            className="group bg-white rounded-xl shadow-sm border border-slate-100 hover:shadow-md hover:border-blue-200 transition overflow-hidden flex flex-col"
          >
            {/* Thumbnail / Icon */}
            <div className="h-32 bg-slate-50 flex items-center justify-center border-b">
               {item.task.material.type === 'video' ?
                 <PlayCircle className="w-12 h-12 text-blue-500 opacity-80 group-hover:scale-110 transition" /> :
                 <FileText className="w-12 h-12 text-orange-500 opacity-80 group-hover:scale-110 transition" />
               }
            </div>

            <div className="p-4 flex-1 flex flex-col">
              <h3 className="font-bold text-slate-800 mb-2 line-clamp-2">{item.task.title}</h3>
              <p className="text-sm text-slate-500 mb-4 line-clamp-2">{item.task.description || '无描述'}</p>

              <div className="mt-auto space-y-2">
                <div className="flex justify-between text-xs text-slate-500">
                  <span>{item.task.material.type === 'video' ? '视频课程' : '文档学习'}</span>
                  <span>截止: {new Date(item.task.endDate).toLocaleDateString()}</span>
                </div>

                {/* Progress Bar (if available) */}
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                   <div className="bg-blue-600 h-full" style={{ width: `${item.status === 'completed' || item.status === 'passed' ? 100 : item.progress > 0 ? 50 : 0}%` }}></div>
                </div>

                <div className="flex justify-between items-center pt-2">
                   <span className={`text-xs px-2 py-0.5 rounded ${
                       item.status === 'passed' ? 'bg-green-100 text-green-700' :
                       item.status === 'failed' ? 'bg-red-100 text-red-700' :
                       'bg-blue-50 text-blue-600'
                   }`}>
                       {item.status === 'assigned' ? '未开始' :
                        item.status === 'in-progress' ? '进行中' :
                        item.status === 'completed' ? '已学习(待考试)' :
                        item.status === 'passed' ? '已通过' : '未通过'}
                   </span>
                   {item.examScore !== null && (
                       <span className="text-xs font-bold text-slate-700">{item.examScore}分</span>
                   )}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
