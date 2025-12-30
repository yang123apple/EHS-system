'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, FileText, Video, Trash, CheckCircle, ChevronLeft, ChevronRight, Film, File, Edit, Eye, Upload as UploadIcon, Award } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { api, apiFetch } from '@/lib/apiClient';

const ITEMS_PER_PAGE = 10;

export default function MaterialsPage() {
  const { user } = useAuth();
  const router = useRouter();
  
  // 权限检查：admin或有上传学习内容权限的用户
  const hasPermission = user?.role === 'admin' || 
    (user?.permissions && JSON.parse(user.permissions).includes('upload_training_content'));
  
  useEffect(() => {
    if (user && !hasPermission) {
      alert('您没有权限访问此页面');
      router.push('/training/my-tasks');
    }
  }, [user, hasPermission, router]);

  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [learnedMaterials, setLearnedMaterials] = useState<Set<string>>(new Set());

  useEffect(() => {
    api.get('/api/training/materials')
      .then(data => {
        if (Array.isArray(data)) {
          setMaterials(data);
        } else {
          console.warn('API returned non-array response, using empty array');
          setMaterials([]);
        }
      })
      .catch(error => {
        console.error('Error fetching materials:', error);
        setMaterials([]);
      })
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
      api.get('/api/training/learned', { userId: user.id, materialIds })
        .then(data => {
          setLearnedMaterials(new Set(data.learnedMaterialIds || []));
        })
        .catch(err => console.error('加载已学习状态失败:', err));
    }
  }, [user, materials, currentPage]);

  const handleDelete = async (id: string) => {
      if (!confirm('确定删除该学习内容吗？')) return;
      try {
        await api.delete(`/api/training/materials/${id}`);
        setMaterials(materials.filter(m => m.id !== id));
      } catch (error) {
        console.error('删除失败:', error);
        alert('删除失败，请重试');
      }
  };

  const totalPages = Math.ceil(materials.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentPageMaterials = materials.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getTypeConfig = (type: string) => {
    const configs: Record<string, { icon: any; label: string; color: string; bgColor: string }> = {
      video: { 
        icon: Film, 
        label: '视频', 
        color: 'text-purple-600', 
        bgColor: 'bg-purple-50/80 border-purple-100' 
      },
      pdf: { 
        icon: FileText, 
        label: 'PDF', 
        color: 'text-rose-600', 
        bgColor: 'bg-rose-50/80 border-rose-100' 
      },
      pptx: { 
        icon: File, 
        label: 'PPT', 
        color: 'text-amber-600', 
        bgColor: 'bg-amber-50/80 border-amber-100' 
      },
    };
    return configs[type] || { 
      icon: FileText, 
      label: type.toUpperCase(), 
      color: 'text-slate-600', 
      bgColor: 'bg-slate-50/80 border-slate-100' 
    };
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="max-w-7xl mx-auto px-8 py-10">
        {/* Header */}
        <div className="flex justify-between items-start mb-10">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">学习内容库</h1>
            <p className="text-slate-500 text-sm font-medium">管理所有培训学习内容</p>
          </div>
          <Link 
            href="/training/materials/upload" 
            className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-semibold flex items-center gap-2 hover:from-blue-700 hover:to-indigo-700 active:scale-[0.98] shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 transition-all duration-200"
          >
            <Plus size={18} strokeWidth={2.5} />
            <span>上传新内容</span>
          </Link>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="w-12 h-12 border-3 border-slate-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
            <p className="text-slate-500 font-medium">加载中...</p>
          </div>
        ) : materials.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 py-24 shadow-sm">
            <div className="text-center">
              <UploadIcon className="mx-auto text-slate-300 mb-4" size={64} />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">暂无学习内容</h3>
              <p className="text-slate-500 font-medium mb-6">开始上传您的第一个培训内容</p>
              <Link 
                href="/training/materials/upload"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white 
                  rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                <Plus size={18} />
                <span>上传内容</span>
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/50">
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">
                        标题
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">
                        类型
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">
                        考试要求
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">
                        上传者
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">
                        上传时间
                      </th>
                      <th className="px-6 py-4 text-right text-xs font-bold text-slate-600 uppercase tracking-wider">
                        操作
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {currentPageMaterials.map((m, index) => {
                      const typeConfig = getTypeConfig(m.type);
                      const TypeIcon = typeConfig.icon;
                      const isLearned = learnedMaterials.has(m.id);
                      
                      return (
                        <tr 
                          key={m.id} 
                          className="hover:bg-slate-50/50 transition-colors duration-150"
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <span className="font-semibold text-slate-900">
                                {m.title}
                              </span>
                              {isLearned && (
                                <div className="flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-md border border-emerald-100">
                                  <CheckCircle size={12} />
                                  <span className="text-xs font-semibold">已学习</span>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${typeConfig.bgColor}`}>
                              <TypeIcon size={13} className={typeConfig.color} />
                              <span className={`text-xs font-semibold ${typeConfig.color}`}>
                                {typeConfig.label}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {m.isExamRequired ? (
                              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-100">
                                <Award size={13} />
                                <span className="text-xs font-semibold">
                                  需考试 (≥{m.passingScore}分)
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400 font-medium">无考试</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                                {m.uploader.name?.charAt(0) || 'U'}
                              </div>
                              <span className="text-sm font-medium text-slate-700">
                                {m.uploader.name}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm text-slate-600 font-medium">
                              {new Date(m.createdAt).toLocaleDateString()}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-end gap-2">
                              <Link
                                href={`/training/learn/material/${m.id}`}
                                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 
                                  rounded-lg transition-all duration-200 active:scale-95"
                                title="预览"
                              >
                                <Eye size={18} />
                              </Link>
                              <Link
                                href={`/training/materials/edit/${m.id}`}
                                className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 
                                  rounded-lg transition-all duration-200 active:scale-95"
                                title="编辑"
                              >
                                <Edit size={18} />
                              </Link>
                              <button
                                onClick={() => handleDelete(m.id)}
                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 
                                  rounded-lg transition-all duration-200 active:scale-95"
                                title="删除"
                              >
                                <Trash size={18} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm mt-6">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-slate-600 font-medium">
                    显示 <span className="font-bold text-slate-900">{startIndex + 1}</span> - 
                    <span className="font-bold text-slate-900"> {Math.min(endIndex, materials.length)}</span> 条，
                    共 <span className="font-bold text-slate-900">{materials.length}</span> 条
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 
                        disabled:opacity-40 disabled:cursor-not-allowed transition-all 
                        active:scale-95 hover:border-slate-300"
                    >
                      <ChevronLeft size={18} className="text-slate-600" />
                    </button>
                    
                    <div className="flex gap-1.5">
                      {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                        let page;
                        if (totalPages <= 7) {
                          page = i + 1;
                        } else if (currentPage <= 4) {
                          page = i + 1;
                        } else if (currentPage >= totalPages - 3) {
                          page = totalPages - 6 + i;
                        } else {
                          page = currentPage - 3 + i;
                        }
                        
                        return (
                          <button
                            key={page}
                            onClick={() => handlePageChange(page)}
                            className={`
                              min-w-[38px] px-3.5 py-2 rounded-lg font-semibold text-sm 
                              transition-all duration-200 border
                              ${currentPage === page 
                                ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-500/30 scale-105' 
                                : 'border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 active:scale-95'
                              }
                            `}
                          >
                            {page}
                          </button>
                        );
                      })}
                    </div>
                    
                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 
                        disabled:opacity-40 disabled:cursor-not-allowed transition-all 
                        active:scale-95 hover:border-slate-300"
                    >
                      <ChevronRight size={18} className="text-slate-600" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
