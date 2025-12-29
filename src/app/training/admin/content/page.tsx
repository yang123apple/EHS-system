'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Search, FileText, Video, MoreHorizontal, Calendar } from 'lucide-react';
import { getMaterials } from '@/app/actions/training';

export default function ContentListPage() {
  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMaterials();
  }, []);

  const loadMaterials = async () => {
    const res = await getMaterials();
    if (res.success) {
      setMaterials(res.data);
    }
    setLoading(false);
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">学习内容管理</h1>
        <Link
          href="/training/admin/content/create"
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
        >
          <Plus size={18} /> 上传内容
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="text-left p-4 font-medium text-slate-500">标题</th>
              <th className="text-left p-4 font-medium text-slate-500">类型</th>
              <th className="text-left p-4 font-medium text-slate-500">考试要求</th>
              <th className="text-left p-4 font-medium text-slate-500">题目数</th>
              <th className="text-left p-4 font-medium text-slate-500">上传人</th>
              <th className="text-left p-4 font-medium text-slate-500">上传时间</th>
              <th className="text-right p-4 font-medium text-slate-500">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td colSpan={7} className="p-8 text-center text-slate-400">加载中...</td></tr>
            ) : materials.length === 0 ? (
              <tr><td colSpan={7} className="p-8 text-center text-slate-400">暂无内容</td></tr>
            ) : materials.map(m => (
              <tr key={m.id} className="hover:bg-slate-50">
                <td className="p-4 font-medium text-slate-700">{m.title}</td>
                <td className="p-4">
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium capitalize
                    ${m.type === 'video' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}
                  `}>
                    {m.type === 'video' ? <Video size={12}/> : <FileText size={12}/>}
                    {m.type}
                  </span>
                </td>
                <td className="p-4">
                  {m.isExamRequired ?
                    <span className="text-green-600 bg-green-50 px-2 py-1 rounded text-xs">需要考试 ({m.passingScore}分)</span> :
                    <span className="text-slate-400">无</span>
                  }
                </td>
                <td className="p-4 text-slate-600">{m._count?.questions || 0}</td>
                <td className="p-4 text-slate-600">{m.uploader?.name || 'Unknown'}</td>
                <td className="p-4 text-slate-500 text-sm">
                  {new Date(m.createdAt).toLocaleDateString()}
                </td>
                <td className="p-4 text-right">
                  <button className="p-2 hover:bg-slate-200 rounded text-slate-500">
                    <MoreHorizontal size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
