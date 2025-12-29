'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, BarChart2, Users, Eye } from 'lucide-react';

export default function TasksPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/training/tasks')
      .then(res => res.json())
      .then(setTasks)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-2xl font-bold text-slate-800">学习任务管理</h2>
        <Link href="/training/tasks/create" className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-blue-700 transition-colors">
          <Plus size={20}/> 发布新任务
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b text-slate-500 text-sm">
            <tr>
              <th className="p-4">任务标题</th>
              <th className="p-4">学习内容</th>
              <th className="p-4">发布人</th>
              <th className="p-4">期限</th>
              <th className="p-4">完成情况</th>
              <th className="p-4">状态</th>
              <th className="p-4">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
                <tr><td colSpan={6} className="p-8 text-center text-slate-400">加载中...</td></tr>
            ) : tasks.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-slate-400">暂无任务</td></tr>
            ) : (
                tasks.map(t => {
                    const total = t.assignments.length;
                    const completed = t.assignments.filter((a: any) => a.status === 'passed').length; // passed is final
                    // Or status === completed? The logic in API uses 'passed' for successful exam or video completion.

                    return (
                        <tr key={t.id} className="border-b last:border-0 hover:bg-slate-50">
                            <td className="p-4 font-medium">{t.title}</td>
                            <td className="p-4 text-blue-600">{t.material.title}</td>
                            <td className="p-4 text-sm text-slate-600">{t.publisher.name}</td>
                            <td className="p-4 text-sm text-slate-600">
                                {new Date(t.startDate).toLocaleDateString()} - {new Date(t.endDate).toLocaleDateString()}
                            </td>
                            <td className="p-4">
                                <div className="flex items-center gap-2 text-sm">
                                    <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
                                        <div className="h-full bg-green-500" style={{ width: `${total ? (completed/total)*100 : 0}%` }}></div>
                                    </div>
                                    <span>{completed}/{total}</span>
                                </div>
                            </td>
                            <td className="p-4">
                                {new Date() > new Date(t.endDate) ?
                                    <span className="text-red-500 text-xs font-bold">已结束</span> :
                                    <span className="text-green-600 text-xs font-bold">进行中</span>
                                }
                            </td>
                            <td className="p-4">
                                <button
                                    onClick={() => router.push(`/training/tasks/${t.id}`)}
                                    className="flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium text-sm"
                                >
                                    <Eye size={16} />
                                    查看详情
                                </button>
                            </td>
                        </tr>
                    )
                })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
