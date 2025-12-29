'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { PlayCircle, CheckCircle, Clock } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function MyTasksPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;

    fetch(`/api/training/my-tasks?userId=${user.id}`)
      .then(res => res.json())
      .then(setTasks)
      .finally(() => setLoading(false));
  }, [user?.id]);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h2 className="text-2xl font-bold mb-8 text-slate-800">我的学习任务</h2>

      <div className="grid gap-4">
        {loading ? (
             <div className="text-center py-10 text-slate-400">加载中...</div>
        ) : tasks.length === 0 ? (
             <div className="text-center py-10 text-slate-400">暂无学习任务</div>
        ) : (
            tasks.map(t => {
                const isPassed = t.status === 'passed';
                const isCompleted = t.status === 'completed'; // Should normalize to passed/failed/in-progress
                // Check if material has exam
                const hasExam = t.task.material.isExamRequired;

                return (
                    <div key={t.id} className="bg-white p-6 rounded-xl border shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <span className={`px-2 py-0.5 rounded text-xs font-bold border ${
                                    t.task.material.type === 'video' ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-orange-50 text-orange-600 border-orange-200'
                                }`}>
                                    {t.task.material.type.toUpperCase()}
                                </span>
                                <h3 className="font-bold text-lg text-slate-800">{t.task.title}</h3>
                            </div>
                            <div className="text-sm text-slate-500 flex items-center gap-4">
                                <span>截止日期: {new Date(t.task.endDate).toLocaleDateString()}</span>
                                <span>{hasExam ? `需考试 (≥${t.task.material.passingScore}分)` : '无需考试'}</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-6">
                            <div className="text-right">
                                <div className={`font-bold ${isPassed ? 'text-green-600' : 'text-slate-600'}`}>
                                    {isPassed ? '已完成' : t.status === 'failed' ? '考试未通过' : '进行中'}
                                </div>
                                {!isPassed && <div className="text-xs text-slate-400">进度: {t.progress}%</div>}
                            </div>

                            {isPassed ? (
                                <button disabled className="px-6 py-2 bg-green-100 text-green-700 rounded-lg font-bold flex items-center gap-2 cursor-default">
                                    <CheckCircle size={20}/> 通过
                                </button>
                            ) : (
                                <Link href={`/training/learn/${t.id}`} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold flex items-center gap-2 hover:bg-blue-700 shadow-lg shadow-blue-200">
                                    <PlayCircle size={20}/> {t.progress > 0 ? '继续学习' : '开始学习'}
                                </Link>
                            )}
                        </div>
                    </div>
                )
            })
        )}
      </div>
    </div>
  );
}
