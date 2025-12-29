'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Library, Play, FileText, Search, Edit, CheckCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const ITEMS_PER_PAGE = 10;

export default function KnowledgeBasePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [materials, setMaterials] = useState<any[]>([]);
  const [filteredMaterials, setFilteredMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [categories, setCategories] = useState<string[]>([]);
  const [learnedMaterialIds, setLearnedMaterialIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    Promise.all([
      fetch('/api/training/materials?publicOnly=true').then(res => res.json()),
      fetch('/api/training/settings').then(res => res.json())
    ]).then(([materialsData, settingsData]) => {
      const materials = Array.isArray(materialsData) ? materialsData : [];
      setMaterials(materials);
      setFilteredMaterials(materials);
      setCategories(settingsData.categories || []);
    }).catch(error => {
      console.error('Error loading knowledge base:', error);
      setMaterials([]);
      setFilteredMaterials([]);
    }).finally(() => setLoading(false));
  }, []);

  // 当筛选后的材料或页码变化时，加载该页材料的已学习状态
  useEffect(() => {
    if (!user?.id || filteredMaterials.length === 0) return;

    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const currentPageMaterials = filteredMaterials.slice(startIndex, endIndex);
    const materialIds = currentPageMaterials.map(m => m.id).join(',');

    if (materialIds) {
      fetch(`/api/training/learned?userId=${user.id}&materialIds=${materialIds}`)
        .then(res => res.json())
        .then(data => {
          setLearnedMaterialIds(new Set(data.learnedMaterialIds || []));
        })
        .catch(error => {
          console.error('Error loading learned status:', error);
        });
    }
  }, [user?.id, filteredMaterials, currentPage]);

  useEffect(() => {
    let filtered = materials;
    
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(m => m.category === selectedCategory);
    }
    
    if (searchTerm) {
      filtered = filtered.filter(m => 
        m.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.description && m.description.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }
    
    setFilteredMaterials(filtered);
    setCurrentPage(1); // 重置到第一页
  }, [searchTerm, selectedCategory, materials]);

  const handleLearn = async (material: any) => {
    if (!user) {
      alert('请先登录');
      return;
    }
    router.push(`/training/learn/material/${material.id}`);
  };

  const handleEdit = (material: any) => {
    router.push(`/training/materials/edit/${material.id}`);
  };

  const canEdit = (material: any) => {
    if (!user) return false;
    return user.role === 'admin' || material.uploaderId === user.id;
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'video':
        return <Play size={20} className="text-blue-600" />;
      case 'pdf':
      case 'pptx':
      case 'docx':
        return <FileText size={20} className="text-green-600" />;
      default:
        return <FileText size={20} className="text-slate-600" />;
    }
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      video: '视频',
      pdf: 'PDF',
      pptx: 'PPT',
      docx: 'Word'
    };
    return labels[type] || type;
  };

  // 分页计算
  const totalPages = Math.ceil(filteredMaterials.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentPageMaterials = filteredMaterials.slice(startIndex, endIndex);

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Library className="text-blue-600" size={32} />
        <h2 className="text-2xl font-bold text-slate-800">公共知识库</h2>
      </div>

      {/* 搜索和筛选 */}
      <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
        <div className="flex gap-4 flex-wrap">
          <div className="flex-1 min-w-[300px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="搜索学习内容..."
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            className="border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">全部类型</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 内容列表 */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">加载中...</div>
      ) : filteredMaterials.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          {searchTerm || selectedCategory !== 'all' ? '没有找到匹配的内容' : '暂无公共学习内容'}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
            {currentPageMaterials.map(material => (
              <div
                key={material.id}
                className="bg-white rounded-xl shadow-sm border hover:shadow-md transition-shadow"
              >
                <div className="p-6">
                  <div className="flex items-start gap-3 mb-3">
                    {getTypeIcon(material.type)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-slate-800 truncate">{material.title}</h3>
                        {learnedMaterialIds.has(material.id) && (
                          <span title="已学习">
                            <CheckCircle size={18} className="text-green-600 flex-shrink-0" />
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        {material.category && (
                          <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded">{material.category}</span>
                        )}
                        {material.isExamRequired && (
                          <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded">需考试</span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {material.description && (
                    <p className="text-sm text-slate-600 mb-4 line-clamp-2">{material.description}</p>
                  )}
                  
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-4">
                    <span>上传者: {material.uploader?.name || '未知'}</span>
                    {material.duration && (
                      <span>{Math.floor(material.duration / 60)}分钟</span>
                    )}
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleLearn(material)}
                      className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700 transition-colors"
                    >
                      开始学习
                    </button>
                    {canEdit(material) && (
                      <button
                        onClick={() => handleEdit(material)}
                        className="px-3 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors flex items-center justify-center"
                        title="编辑"
                      >
                        <Edit size={18} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 分页控件 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-2 rounded-lg border hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={20} />
              </button>
              
              <div className="flex gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => goToPage(page)}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      currentPage === page
                        ? 'bg-blue-600 text-white'
                        : 'border hover:bg-slate-50'
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>
              
              <button
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg border hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          )}

          {/* 显示当前页信息 */}
          <div className="text-center text-sm text-slate-500 mt-4">
            显示 {startIndex + 1}-{Math.min(endIndex, filteredMaterials.length)} 条，共 {filteredMaterials.length} 条
          </div>
        </>
      )}
    </div>
  );
}
