'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Users, Calendar, BarChart } from 'lucide-react';
import { getAdminTasks } from '@/app/actions/training';

export default function TaskListPage() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAdminTasks().then(res => {
      if (res.success) setTasks(res.data);
      setLoading(false);
    });
  }, []);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">学习任务管理</h1>
        <Link
          href="/training/admin/tasks/create"
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
        >
          <Plus size={18} /> 发布任务
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="text-left p-4 font-medium text-slate-500">任务名称</th>
              <th className="text-left p-4 font-medium text-slate-500">学习内容</th>
              <th className="text-left p-4 font-medium text-slate-500">发布范围</th>
              <th className="text-left p-4 font-medium text-slate-500">期限</th>
              <th className="text-left p-4 font-medium text-slate-500">进度 (完成/总数)</th>
              <th className="text-left p-4 font-medium text-slate-500">发布人</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td colSpan={6} className="p-8 text-center text-slate-400">加载中...</td></tr>
            ) : tasks.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-slate-400">暂无任务</td></tr>
            ) : tasks.map(t => (
              <tr key={t.id} className="hover:bg-slate-50">
                <td className="p-4 font-medium text-slate-700">{t.title}</td>
                <td className="p-4 text-slate-600">{t.material?.title}</td>
                <td className="p-4">
                  <span className="bg-slate-100 px-2 py-1 rounded text-xs capitalize">
                    {t.targetType === 'all' ? '全体' : t.targetType === 'dept' ? '部门' : '指定人员'}
                  </span>
                </td>
                <td className="p-4 text-sm text-slate-500">
                  {new Date(t.startDate).toLocaleDateString()} - {new Date(t.endDate).toLocaleDateString()}
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-slate-200 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-green-500 h-full"
                        style={{ width: `${t._count?.assignments ? (t.completedCount / t._count.assignments * 100) : 0}%` }}
                      ></div>
                    </div>
                    <span className="text-xs text-slate-500">
                      {t.completedCount} / {t._count?.assignments}
                    </span>
                  </div>
                </td>
                <td className="p-4 text-slate-600">{t.publisher?.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
