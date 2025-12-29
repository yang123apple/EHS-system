'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, FileText, Video, Trash } from 'lucide-react';

export default function MaterialsPage() {
  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/training/materials')
      .then(res => res.json())
      .then(setMaterials)
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id: string) => {
      if (!confirm('确定删除该学习内容吗？')) return;
      await fetch(`/api/training/materials/${id}`, { method: 'DELETE' });
      setMaterials(materials.filter(m => m.id !== id));
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-2xl font-bold text-slate-800">学习内容库</h2>
        <Link href="/training/materials/upload" className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-blue-700 transition-colors">
          <Plus size={20}/> 上传新内容
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b text-slate-500 text-sm">
            <tr>
              <th className="p-4">标题</th>
              <th className="p-4">类型</th>
              <th className="p-4">考试要求</th>
              <th className="p-4">上传者</th>
              <th className="p-4">上传时间</th>
              <th className="p-4 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
                <tr><td colSpan={6} className="p-8 text-center text-slate-400">加载中...</td></tr>
            ) : materials.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-slate-400">暂无内容</td></tr>
            ) : (
                materials.map(m => (
                    <tr key={m.id} className="border-b last:border-0 hover:bg-slate-50">
                        <td className="p-4 font-medium">{m.title}</td>
                        <td className="p-4">
                            <span className="flex items-center gap-2 text-sm text-slate-600">
                                {m.type === 'video' ? <Video size={16} className="text-blue-500"/> : <FileText size={16} className="text-orange-500"/>}
                                {m.type.toUpperCase()}
                            </span>
                        </td>
                        <td className="p-4">
                            {m.isExamRequired ?
                                <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">需考试 (≥{m.passingScore}分)</span> :
                                <span className="text-slate-400 text-xs">无考试</span>
                            }
                        </td>
                        <td className="p-4 text-sm text-slate-600">{m.uploader.name}</td>
                        <td className="p-4 text-sm text-slate-600">{new Date(m.createdAt).toLocaleDateString()}</td>
                        <td className="p-4 text-right">
                            <button onClick={() => handleDelete(m.id)} className="text-slate-400 hover:text-red-500 p-2"><Trash size={18}/></button>
                        </td>
                    </tr>
                ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
