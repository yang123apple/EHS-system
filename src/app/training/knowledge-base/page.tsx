'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Library, 
  Play, 
  FileText, 
  Search, 
  Edit, 
  CheckCircle, 
  ChevronLeft, 
  ChevronRight,
  Film,
  File,
  Calendar,
  User,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/apiClient';

const ITEMS_PER_PAGE = 9;

// 类型筛选器配置
const typeFilters = [
  { value: 'all', label: '全部', icon: Sparkles },
  { value: 'video', label: '视频', icon: Film },
  { value: 'pdf', label: 'PDF', icon: FileText },
  { value: 'pptx', label: 'PPT', icon: File }
];

export default function KnowledgeBasePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [materials, setMaterials] = useState<any[]>([]);
  const [filteredMaterials, setFilteredMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [categories, setCategories] = useState<string[]>([]);
  const [learnedMaterialIds, setLearnedMaterialIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (!user) return;
    
    Promise.all([
      apiFetch('/api/training/materials?publicOnly=true').then(res => res.json()),
      apiFetch('/api/training/settings').then(res => res.json())
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
  }, [user]);

  useEffect(() => {
    if (!user?.id || filteredMaterials.length === 0) return;

    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const currentPageMaterials = filteredMaterials.slice(startIndex, endIndex);
    const materialIds = currentPageMaterials.map(m => m.id).join(',');

    if (materialIds) {
      apiFetch(`/api/training/learned?userId=${user.id}&materialIds=${materialIds}`)
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

    if (selectedType !== 'all') {
      filtered = filtered.filter(m => m.type === selectedType);
    }
    
    if (searchTerm) {
      filtered = filtered.filter(m => 
        m.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.description && m.description.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }
    
    setFilteredMaterials(filtered);
    setCurrentPage(1);
  }, [searchTerm, selectedCategory, selectedType, materials]);

  const handleLearn = async (material: any) => {
    if (!user) {
      alert('请先登录');
      return;
    }
    router.push(`/training/learn/material/${material.id}`);
  };

  const getTypeConfig = (type: string) => {
    const configs: Record<string, { icon: any; label: string; color: string; bgColor: string }> = {
      video: { 
        icon: Film, 
        label: '视频课程', 
        color: 'text-purple-600', 
        bgColor: 'bg-purple-50/80 border-purple-100' 
      },
      pdf: { 
        icon: FileText, 
        label: 'PDF 文档', 
        color: 'text-rose-600', 
        bgColor: 'bg-rose-50/80 border-rose-100' 
      },
      pptx: { 
        icon: File, 
        label: 'PPT 演示', 
        color: 'text-amber-600', 
        bgColor: 'bg-amber-50/80 border-amber-100' 
      },
      docx: { 
        icon: FileText, 
        label: 'Word 文档', 
        color: 'text-blue-600', 
        bgColor: 'bg-blue-50/80 border-blue-100' 
      }
    };
    return configs[type] || { 
      icon: File, 
      label: '文档', 
      color: 'text-slate-600', 
      bgColor: 'bg-slate-50/80 border-slate-100' 
    };
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return '今天';
    if (diffDays === 1) return '昨天';
    if (diffDays < 7) return `${diffDays}天前`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}周前`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}月前`;
    return `${Math.floor(diffDays / 365)}年前`;
  };

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
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Header Section with Background */}
      <div className="bg-slate-50/50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-8 py-6">
          {/* Title & Search Row */}
          <div className="flex items-center justify-between gap-6 mb-4">
            <div className="flex items-center gap-4 flex-shrink-0">
              <div className="p-2.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/20">
                <Library className="text-white" size={26} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">公共知识库</h1>
                <p className="text-slate-500 text-xs mt-1 font-medium">探索并学习企业安全培训资源</p>
              </div>
            </div>
            
            {/* Compact Search Bar */}
            <div className="relative group flex-1 max-w-[500px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-blue-500" size={18} />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="搜索课程..."
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10 transition-all duration-200 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm hover:shadow-md"
              />
            </div>
          </div>

          {/* Combined Filters - Compact Tag Style */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Type Filters - Left Side */}
            <div className="flex items-center gap-2 flex-wrap">
              {typeFilters.map(filter => {
                const Icon = filter.icon;
                const isActive = selectedType === filter.value;
                return (
                  <button
                    key={filter.value}
                    onClick={() => setSelectedType(filter.value)}
                    className={`
                      flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
                      transition-all duration-200
                      ${isActive 
                        ? 'bg-blue-100 text-blue-700 border border-blue-300 shadow-sm' 
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                      }
                    `}
                  >
                    <Icon size={14} />
                    {filter.label}
                  </button>
                );
              })}
            </div>

            {/* Divider */}
            {categories.length > 0 && (
              <div className="w-px h-5 bg-slate-200" />
            )}

            {/* Category Filters - Right Side */}
            {categories.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={`
                    px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200
                    ${selectedCategory === 'all' 
                      ? 'bg-slate-900 text-white shadow-sm' 
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                    }
                  `}
                >
                  全部
                </button>
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`
                      px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200
                      ${selectedCategory === cat 
                        ? 'bg-slate-900 text-white shadow-sm' 
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                      }
                    `}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="max-w-7xl mx-auto px-8 py-6">

        {/* Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="w-12 h-12 border-3 border-slate-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
            <p className="text-slate-500 font-medium">加载中...</p>
          </div>
        ) : filteredMaterials.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 py-24 shadow-sm">
            <div className="text-center">
              <Library className="mx-auto text-slate-300 mb-4" size={64} />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">暂无内容</h3>
              <p className="text-slate-500 font-medium">
                {searchTerm || selectedCategory !== 'all' || selectedType !== 'all' 
                  ? '没有找到匹配的课程，请尝试其他筛选条件' 
                  : '暂无公共学习内容'}
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Cards Grid - Increased Density */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
              {currentPageMaterials.map(material => {
                const typeConfig = getTypeConfig(material.type);
                const TypeIcon = typeConfig.icon;
                const isLearned = learnedMaterialIds.has(material.id);
                
                return (
                  <div
                    key={material.id}
                    className="group bg-white rounded-xl border border-slate-200 overflow-hidden 
                      hover:shadow-[0_10px_30px_-5px_rgba(0,0,0,0.08)] hover:-translate-y-1 
                      hover:border-slate-300 transition-all duration-300 cursor-pointer flex flex-col"
                    onClick={() => handleLearn(material)}
                  >
                    {/* Thumbnail */}
                    <div className="relative aspect-video bg-gradient-to-br from-slate-50 to-slate-100 overflow-hidden">
                      {material.thumbnail ? (
                        <>
                          <img 
                            src={material.thumbnail} 
                            alt={material.title}
                            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        </>
                      ) : (
                        <>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <TypeIcon className="text-slate-300 transition-all duration-300 group-hover:text-slate-400 group-hover:scale-110" size={56} />
                          </div>
                        </>
                      )}
                      
                      {/* Type Badge - Enhanced */}
                      <div className="absolute top-2.5 left-2.5">
                        <div className={`flex items-center gap-1 px-2.5 py-1 rounded-md border backdrop-blur-sm ${typeConfig.bgColor} shadow-md`}>
                          <TypeIcon size={12} className={typeConfig.color} />
                          <span className={`text-[10px] font-bold ${typeConfig.color}`}>
                            {typeConfig.label}
                          </span>
                        </div>
                      </div>

                      {/* Learned Badge - Enhanced */}
                      {isLearned && (
                        <div className="absolute top-2.5 right-2.5">
                          <div className="flex items-center gap-1 px-2.5 py-1 bg-emerald-500/95 text-white rounded-md backdrop-blur-sm shadow-lg border border-emerald-400/30">
                            <CheckCircle size={12} />
                            <span className="text-[10px] font-bold">已学习</span>
                          </div>
                        </div>
                      )}

                      {/* Exam Required Badge - Enhanced */}
                      {material.isExamRequired && !isLearned && (
                        <div className="absolute top-2.5 right-2.5">
                          <div className="px-2.5 py-1 bg-orange-500/95 text-white rounded-md backdrop-blur-sm shadow-lg border border-orange-400/30">
                            <span className="text-[10px] font-bold">需考试</span>
                          </div>
                        </div>
                      )}

                      {/* Duration Badge - Enhanced */}
                      {material.duration && (
                        <div className="absolute bottom-2.5 right-2.5">
                          <div className="px-2 py-1 bg-black/70 text-white rounded-md backdrop-blur-sm shadow-md border border-white/10">
                            <span className="text-[10px] font-bold">
                              {Math.floor(material.duration / 60)}:
                              {String(material.duration % 60).padStart(2, '0')}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Card Content - Flex Grow for Bottom Alignment */}
                    <div className="p-4 flex flex-col flex-grow">
                      {/* Title & Category */}
                      <div className="mb-3 space-y-2">
                        <h3 className="font-bold text-slate-900 text-sm leading-snug line-clamp-2 
                          group-hover:text-blue-600 transition-colors duration-200">
                          {material.title}
                        </h3>
                        {material.category && (
                          <span className="inline-block px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] 
                            font-semibold rounded border border-indigo-200">
                            {material.category}
                          </span>
                        )}
                      </div>

                      {/* Description */}
                      {material.description && (
                        <p className="text-xs text-slate-600 mb-4 line-clamp-2 leading-relaxed flex-grow">
                          {material.description}
                        </p>
                      )}

                      {/* Bottom Section - Author, Date & Button */}
                      <div className="mt-auto pt-4 border-t border-slate-100 bg-slate-50/50 -mx-4 -mb-4 px-4 pb-4">
                        {/* Footer: Author & Date */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 
                              flex items-center justify-center text-white font-bold text-[9px] shadow-sm">
                              {material.uploader?.name?.charAt(0) || 'U'}
                            </div>
                            <div className="flex flex-col -space-y-0.5">
                              <span className="text-[11px] font-semibold text-slate-900">
                                {material.uploader?.name || '未知'}
                              </span>
                              <div className="flex items-center gap-1 text-[10px] text-slate-500">
                                <Calendar size={9} />
                                <span>{material.createdAt ? formatDate(material.createdAt) : '未知'}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* CTA Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLearn(material);
                          }}
                          className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white 
                            py-2.5 rounded-lg font-semibold text-sm hover:from-blue-700 hover:to-indigo-700 
                            active:scale-[0.98] shadow-md shadow-blue-500/20 hover:shadow-lg 
                            hover:shadow-blue-500/30 transition-all duration-200 
                            flex items-center justify-center gap-2 group/btn"
                        >
                          <span>开始学习</span>
                          <ArrowRight size={14} className="group-hover/btn:translate-x-1 transition-transform duration-200" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="text-xs text-slate-600 font-medium">
                    显示 <span className="font-bold text-slate-900">{startIndex + 1}</span> - 
                    <span className="font-bold text-slate-900"> {Math.min(endIndex, filteredMaterials.length)}</span> 条，
                    共 <span className="font-bold text-slate-900">{filteredMaterials.length}</span> 条
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => goToPage(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 
                        disabled:opacity-40 disabled:cursor-not-allowed transition-all 
                        active:scale-95 hover:border-slate-300"
                    >
                      <ChevronLeft size={16} className="text-slate-600" />
                    </button>
                    
                    <div className="flex gap-1">
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
                            onClick={() => goToPage(page)}
                            className={`
                              min-w-[32px] px-2.5 py-1.5 rounded-lg font-semibold text-xs 
                              transition-all duration-200 border
                              ${currentPage === page 
                                ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20' 
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
                      onClick={() => goToPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 
                        disabled:opacity-40 disabled:cursor-not-allowed transition-all 
                        active:scale-95 hover:border-slate-300"
                    >
                      <ChevronRight size={16} className="text-slate-600" />
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
