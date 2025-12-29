'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { PlayCircle, CheckCircle, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const ITEMS_PER_PAGE = 10;

export default function MyTasksPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [learnedMaterialIds, setLearnedMaterialIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user?.id) return;

    fetch(`/api/training/my-tasks?userId=${user.id}`)
      .then(res => res.json())
      .then(setTasks)
      .finally(() => setLoading(false));
  }, [user?.id]);

  // 加载当前页任务的已学习状态
  useEffect(() => {
    if (!user?.id || tasks.length === 0) return;

    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const currentPageTasks = tasks.slice(startIndex, endIndex);
    const materialIds = currentPageTasks.map(t => t.task.materialId).join(',');

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
  }, [user?.id, tasks, currentPage]);

  // 分页计算
  const totalPages = Math.ceil(tasks.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentPageTasks = tasks.slice(startIndex, endIndex);

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h2 className="text-2xl font-bold mb-8 text-slate-800">我的学习任务</h2>

      {loading ? (
        <div className="text-center py-10 text-slate-400">加载中...</div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-10 text-slate-400">暂无学习任务</div>
      ) : (
        <>
          <div className="grid gap-4 mb-6">
            {currentPageTasks.map(t => {
              const isPassed = t.status === 'passed';
              const isCompleted = t.status === 'completed';
              const hasExam = t.task.material.isExamRequired;
              const isLearned = learnedMaterialIds.has(t.task.materialId);

              return (
                <div key={t.id} className="bg-white p-6 rounded-xl border shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold border ${
                        t.task.material.type === 'video' ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-orange-50 text-orange-600 border-orange-200'
                      }`}>
                        {t.task.material.type.toUpperCase()}
                      </span>
                      <h3 className="font-bold text-lg text-slate-800">{t.task.title}</h3>
                      {isLearned && (
                        <span title="已学习">
                          <CheckCircle size={18} className="text-green-600" />
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-slate-500 flex items-center gap-4">
                      <span>截止日期: {new Date(t.task.endDate).toLocaleDateString()}</span>
                      <span>{hasExam ? `需考试 (≥${t.task.material.passingScore}分)` : '无需考试'}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <div className={`font-bold ${isPassed ? 'text-green-600' : 'text-slate-600'}`}>
                        {isPassed ? '已完成' : t.status === 'failed' ? '考试未通过' : '进行中'}
                      </div>
                      {!isPassed && <div className="text-xs text-slate-400">进度: {t.progress}%</div>}
                    </div>

                    {isPassed ? (
                      <button disabled className="px-6 py-2 bg-green-100 text-green-700 rounded-lg font-bold flex items-center gap-2 cursor-default">
                        <CheckCircle size={20}/> 通过
                      </button>
                    ) : (
                      <Link href={`/training/learn/${t.id}`} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold flex items-center gap-2 hover:bg-blue-700 shadow-lg shadow-blue-200">
                        <PlayCircle size={20}/> {t.progress > 0 ? '继续学习' : '开始学习'}
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
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
            显示 {startIndex + 1}-{Math.min(endIndex, tasks.length)} 条，共 {tasks.length} 条
          </div>
        </>
      )}
    </div>
  );
}
