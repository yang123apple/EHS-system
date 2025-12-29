'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, FileText, Video, Trash, CheckCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const ITEMS_PER_PAGE = 10;

export default function MaterialsPage() {
  const { user } = useAuth();
  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [learnedMaterials, setLearnedMaterials] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch('/api/training/materials')
      .then(res => res.json())
      .then(setMaterials)
      .finally(() => setLoading(false));
  }, []);

  // 加载当前页材料的已学习状态
  useEffect(() => {
    if (!user || materials.length === 0) return;

    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const currentPageMaterials = materials.slice(startIndex, endIndex);
    const materialIds = currentPageMaterials.map(m => m.id).join(',');

    if (materialIds) {
      fetch(`/api/training/learned?userId=${user.id}&materialIds=${materialIds}`)
        .then(res => res.json())
        .then(data => {
          setLearnedMaterials(new Set(data.learnedMaterialIds || []));
        })
        .catch(err => console.error('加载已学习状态失败:', err));
    }
  }, [user, materials, currentPage]);

  const handleDelete = async (id: string) => {
      if (!confirm('确定删除该学习内容吗？')) return;
      await fetch(`/api/training/materials/${id}`, { method: 'DELETE' });
      setMaterials(materials.filter(m => m.id !== id));
  };

  const totalPages = Math.ceil(materials.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentPageMaterials = materials.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
            ) : currentPageMaterials.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-slate-400">暂无内容</td></tr>
            ) : (
                currentPageMaterials.map(m => (
                    <tr key={m.id} className="border-b last:border-0 hover:bg-slate-50">
                        <td className="p-4 font-medium">
                          <div className="flex items-center gap-2">
                            {m.title}
                            {learnedMaterials.has(m.id) && (
                              <span title="已学习">
                                <CheckCircle size={18} className="text-green-500 flex-shrink-0" />
                              </span>
                            )}
                          </div>
                        </td>
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

      {/* 分页控件 */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-6">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-3 py-2 rounded-lg border disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
          >
            <ChevronLeft size={20} />
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
            <button
              key={page}
              onClick={() => handlePageChange(page)}
              className={`px-4 py-2 rounded-lg border ${
                currentPage === page
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'hover:bg-slate-50'
              }`}
            >
              {page}
            </button>
          ))}

          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="px-3 py-2 rounded-lg border disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      )}

      {/* 分页信息 */}
      {materials.length > 0 && (
        <div className="text-center text-sm text-slate-500 mt-4">
          共 {materials.length} 条记录，当前第 {currentPage}/{totalPages} 页
        </div>
      )}
    </div>
  );
}
