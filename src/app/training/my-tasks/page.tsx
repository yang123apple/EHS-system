'use client';
import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { PlayCircle, CheckCircle, Clock, ChevronLeft, ChevronRight, Calendar, Award, AlertCircle, Film, FileText } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { api, apiFetch } from '@/lib/apiClient';
import { toLocaleDateString } from '@/utils/dateUtils';

const ITEMS_PER_PAGE = 10;

export default function MyTasksPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'in-progress' | 'completed'>('in-progress');
  const [currentPage, setCurrentPage] = useState(1);
  const [learnedMaterialIds, setLearnedMaterialIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user?.id) return;

    api.get('/api/training/my-tasks', { userId: user.id })
      .then(data => {
        // Ensure we always set an array
        if (Array.isArray(data)) {
          setTasks(data);
        } else {
          console.warn('API returned non-array response, using empty array');
          setTasks([]);
        }
      })
      .catch(error => {
        console.error('Error fetching tasks:', error);
        setTasks([]);
      })
      .finally(() => setLoading(false));
  }, [user?.id]);

  // 切换标签页时重置页码
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab]);

  // 过滤任务：根据标签页状态（使用useMemo优化性能）
  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (activeTab === 'completed') {
        return t.status === 'passed';
      } else {
        return t.status !== 'passed';
      }
    });
  }, [tasks, activeTab]);

  // 计算各标签页的任务数量（使用useMemo优化性能）
  const taskCounts = useMemo(() => {
    const completed = tasks.filter(t => t.status === 'passed').length;
    const inProgress = tasks.length - completed;
    return { completed, inProgress };
  }, [tasks]);

  // 加载当前页任务的已学习状态
  useEffect(() => {
    if (!user?.id || filteredTasks.length === 0) return;

    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const currentPageTasks = filteredTasks.slice(startIndex, endIndex);
    const materialIds = currentPageTasks.map(t => t.task.materialId).join(',');

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
  }, [user?.id, filteredTasks, currentPage]);

  // 分页计算（基于过滤后的任务）
  const totalPages = Math.ceil(filteredTasks.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentPageTasks = filteredTasks.slice(startIndex, endIndex);

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
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
        label: 'PDF', 
        color: 'text-rose-600', 
        bgColor: 'bg-rose-50/80 border-rose-100' 
      },
    };
    return configs[type] || { 
      icon: FileText, 
      label: type.toUpperCase(), 
      color: 'text-slate-600', 
      bgColor: 'bg-slate-50/80 border-slate-100' 
    };
  };

  const formatDeadline = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return { text: '已过期', color: 'text-red-600', urgent: true };
    if (diffDays === 0) return { text: '今天到期', color: 'text-orange-600', urgent: true };
    if (diffDays === 1) return { text: '明天到期', color: 'text-orange-600', urgent: true };
    if (diffDays <= 3) return { text: `${diffDays}天后到期`, color: 'text-orange-600', urgent: true };
    if (diffDays <= 7) return { text: `${diffDays}天后到期`, color: 'text-slate-600', urgent: false };
    return { text: toLocaleDateString(date), color: 'text-slate-500', urgent: false };
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="max-w-6xl mx-auto px-8 py-10">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">我的学习任务</h1>
          <p className="text-slate-500 text-sm font-medium">完成您的培训任务并追踪学习进度</p>
        </div>

        {/* Tab Switcher */}
        {!loading && tasks.length > 0 && (
          <div className="mb-6 flex gap-3">
            <button
              onClick={() => setActiveTab('in-progress')}
              className={`px-6 py-3 rounded-lg font-semibold text-sm transition-all duration-200 border ${
                activeTab === 'in-progress'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-500/30'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
              }`}
            >
              进行中 ({taskCounts.inProgress})
            </button>
            <button
              onClick={() => setActiveTab('completed')}
              className={`px-6 py-3 rounded-lg font-semibold text-sm transition-all duration-200 border ${
                activeTab === 'completed'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-500/30'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
              }`}
            >
              已完成 ({taskCounts.completed})
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="w-12 h-12 border-3 border-slate-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
            <p className="text-slate-500 font-medium">加载中...</p>
          </div>
        ) : tasks.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 py-24 shadow-sm">
            <div className="text-center">
              <Clock className="mx-auto text-slate-300 mb-4" size={64} />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">暂无学习任务</h3>
              <p className="text-slate-500 font-medium">当前没有待完成的学习任务</p>
            </div>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 py-24 shadow-sm">
            <div className="text-center">
              <CheckCircle className="mx-auto text-slate-300 mb-4" size={64} />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                {activeTab === 'completed' ? '暂无已完成的任务' : '暂无进行中的任务'}
              </h3>
              <p className="text-slate-500 font-medium">
                {activeTab === 'completed' ? '您还没有完成任何学习任务' : '当前没有进行中的学习任务'}
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Tasks List */}
            <div className="space-y-4 mb-8">
              {currentPageTasks.map(t => {
                const isPassed = t.status === 'passed';
                const isFailed = t.status === 'failed';
                const hasExam = t.task.material.isExamRequired;
                const isLearned = learnedMaterialIds.has(t.task.materialId);
                const typeConfig = getTypeConfig(t.task.material.type);
                const TypeIcon = typeConfig.icon;
                const deadline = formatDeadline(t.task.endDate);

                return (
                  <div 
                    key={t.id} 
                    className="group bg-white p-6 rounded-2xl border border-slate-200 
                      hover:shadow-[0_10px_30px_-5px_rgba(0,0,0,0.08)] hover:border-slate-300 
                      transition-all duration-300"
                  >
                    <div className="flex items-start justify-between gap-6">
                      {/* Left: Content */}
                      <div className="flex-1 min-w-0">
                        {/* Title & Badges */}
                        <div className="flex items-start gap-3 mb-3">
                          {/* Type Badge */}
                          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${typeConfig.bgColor} flex-shrink-0`}>
                            <TypeIcon size={13} className={typeConfig.color} />
                            <span className={`text-xs font-semibold ${typeConfig.color}`}>
                              {typeConfig.label}
                            </span>
                          </div>
                          
                          {/* Title */}
                          <h3 className="font-bold text-lg text-slate-900 leading-snug flex-1">
                            {t.task.title}
                          </h3>

                          {/* Learned Badge */}
                          {isLearned && (
                            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-100 flex-shrink-0">
                              <CheckCircle size={13} />
                              <span className="text-xs font-semibold">已学习</span>
                            </div>
                          )}
                        </div>

                        {/* Meta Info */}
                        <div className="flex items-center gap-5 text-sm">
                          {/* Deadline */}
                          <div className={`flex items-center gap-1.5 font-medium ${deadline.color}`}>
                            <Calendar size={14} />
                            <span>{deadline.text}</span>
                            {deadline.urgent && (
                              <AlertCircle size={14} className="text-orange-500" />
                            )}
                          </div>

                          {/* Exam Info */}
                          {hasExam && (
                            <div className="flex items-center gap-1.5 text-slate-600 font-medium">
                              <Award size={14} />
                              <span>需考试 (≥{t.task.material.passingScore}分)</span>
                            </div>
                          )}

                          {/* Progress */}
                          {!isPassed && (
                            <div className="text-slate-500 font-medium">
                              进度: {t.progress}%
                            </div>
                          )}
                        </div>

                        {/* Progress Bar */}
                        {!isPassed && t.progress > 0 && (
                          <div className="mt-4 w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div 
                              className="bg-gradient-to-r from-blue-600 to-indigo-600 h-full rounded-full transition-all duration-500"
                              style={{ width: `${t.progress}%` }}
                            />
                          </div>
                        )}
                      </div>

                      {/* Right: Status & Action */}
                      <div className="flex items-center gap-4 flex-shrink-0">
                        {/* Status */}
                        <div className="text-right min-w-[80px]">
                          <div className={`font-bold text-sm mb-1 ${
                            isPassed ? 'text-emerald-600' : 
                            isFailed ? 'text-red-600' : 
                            'text-slate-600'
                          }`}>
                            {isPassed ? '已完成' : isFailed ? '考试未通过' : '进行中'}
                          </div>
                        </div>

                        {/* Action Button */}
                        {isPassed ? (
                          <button 
                            disabled 
                            className="px-5 py-2.5 bg-emerald-50 text-emerald-700 rounded-lg 
                              font-semibold flex items-center gap-2 cursor-default border border-emerald-200"
                          >
                            <CheckCircle size={18} />
                            <span>已通过</span>
                          </button>
                        ) : (
                          <Link 
                            href={`/training/learn/${t.id}`} 
                            className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 
                              text-white rounded-lg font-semibold flex items-center gap-2 
                              hover:from-blue-700 hover:to-indigo-700 active:scale-[0.98]
                              shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30
                              transition-all duration-200"
                          >
                            <PlayCircle size={18} />
                            <span>{t.progress > 0 ? '继续学习' : '开始学习'}</span>
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-slate-600 font-medium">
                    显示 <span className="font-bold text-slate-900">{startIndex + 1}</span> - 
                    <span className="font-bold text-slate-900"> {Math.min(endIndex, filteredTasks.length)}</span> 条，
                    共 <span className="font-bold text-slate-900">{filteredTasks.length}</span> 条
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => goToPage(currentPage - 1)}
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
                            onClick={() => goToPage(page)}
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
                      onClick={() => goToPage(currentPage + 1)}
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
