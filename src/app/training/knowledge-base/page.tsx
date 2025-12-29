'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Library, Play, FileText, Search } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function KnowledgeBasePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [materials, setMaterials] = useState<any[]>([]);
  const [filteredMaterials, setFilteredMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    Promise.all([
      fetch('/api/training/materials?publicOnly=true').then(res => res.json()),
      fetch('/api/training/settings').then(res => res.json())
    ]).then(([materialsData, settingsData]) => {
      // 确保materialsData是数组
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

  useEffect(() => {
    let filtered = materials;
    
    // 按类型筛选
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(m => m.category === selectedCategory);
    }
    
    // 按搜索词筛选
    if (searchTerm) {
      filtered = filtered.filter(m => 
        m.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.description && m.description.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }
    
    setFilteredMaterials(filtered);
  }, [searchTerm, selectedCategory, materials]);

  const handleLearn = async (material: any) => {
    if (!user) {
      alert('请先登录');
      return;
    }

    // 检查是否有相关任务
    try {
      const res = await fetch(`/api/training/my-tasks`);
      const tasks = await res.json();
      
      // 查找与此材料相关的任务
      const relatedTask = tasks.find((t: any) => t.materialId === material.id);
      
      if (relatedTask) {
        // 如果有任务，跳转到任务学习页面
        if (material.isExamRequired) {
          router.push(`/training/exam/${relatedTask.id}`);
        } else {
          router.push(`/training/learn/${relatedTask.id}`);
        }
      } else {
        // 没有任务，直接查看内容（暂时跳转到学习页面，但不记录进度）
        alert('此内容暂无学习任务，您可以自由查看');
        // 可以考虑创建一个临时学习页面或直接打开文件
        window.open(material.url, '_blank');
      }
    } catch (error) {
      console.error(error);
      window.open(material.url, '_blank');
    }
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMaterials.map(material => (
            <div
              key={material.id}
              className="bg-white rounded-xl shadow-sm border hover:shadow-md transition-shadow"
            >
              <div className="p-6">
                <div className="flex items-start gap-3 mb-3">
                  {getTypeIcon(material.type)}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-slate-800 mb-1 truncate">{material.title}</h3>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="bg-slate-100 px-2 py-1 rounded">{getTypeLabel(material.type)}</span>
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
                
                <button
                  onClick={() => handleLearn(material)}
                  className="w-full bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700 transition-colors"
                >
                  {material.isExamRequired ? '开始学习并考试' : '开始学习'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
