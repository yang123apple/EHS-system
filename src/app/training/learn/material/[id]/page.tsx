'use client';
import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import FileViewer from '@/components/training/FileViewer';
import { ArrowLeft, Download, BookOpen } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/apiClient';

export default function MaterialLearnPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { user } = useAuth();
  const { id } = use(params);
  const [material, setMaterial] = useState<any>(null);
  const [assignment, setAssignment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [hasTask, setHasTask] = useState(false);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    // 加载学习材料和相关任务
    Promise.all([
      apiFetch(`/api/training/materials/${id}`).then(res => res.json()),
      apiFetch(`/api/training/my-tasks?userId=${user.id}`).then(res => res.json())
    ]).then(([materialData, tasksData]) => {
      setMaterial(materialData);

      // 查找与此材料相关的任务
      const tasks = Array.isArray(tasksData) ? tasksData : [];
      const relatedAssignment = tasks.find((t: any) => t.task?.materialId === id);

      if (relatedAssignment) {
        setAssignment(relatedAssignment);
        setHasTask(true);
      } else {
        setHasTask(false);
      }

      // 注意：不再直接标记为已学习
      // 对于有考试要求的学习内容，必须通过考试才能标记为已学习
      // 对于没有考试要求的学习内容，会在学习完成时自动标记（通过 progress API）
    }).catch(err => {
      console.error('Failed to load material:', err);
    }).finally(() => setLoading(false));
  }, [id, user, router]);

  const handleStartExam = () => {
    if (hasTask && assignment) {
      // 如果有任务，跳转到任务考试页面
      router.push(`/training/exam/${assignment.id}`);
    } else {
      // 如果没有任务，跳转到材料考试页面
      router.push(`/training/exam/material/${id}`);
    }
  };

  if (loading) return <div className="p-10 text-center">加载中...</div>;
  if (!material) return <div className="p-10 text-center">学习内容不存在</div>;

  return (
    <div className="flex flex-col h-screen bg-black">
      <div className="h-16 bg-slate-900 text-white flex items-center px-6 justify-between shrink-0">
        <button onClick={() => router.back()} className="flex items-center gap-2 hover:text-slate-300">
          <ArrowLeft /> 退出学习
        </button>
        <div className="flex items-center gap-4">
          <h1 className="font-bold">{material.title}</h1>
          {!hasTask && (
            <span className="text-xs bg-yellow-600 px-2 py-1 rounded">自由学习模式</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {material.isExamRequired && (
            <button
              onClick={handleStartExam}
              className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium"
            >
              <BookOpen size={16} />
              开始考试
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative">
        <FileViewer
          url={material.url}
          type={material.type}
          onProgress={(progress) => {
            // 如果有任务，更新进度
            if (hasTask && assignment && progress > (assignment.progress || 0)) {
              apiFetch(`/api/training/progress`, {
                method: 'POST',
                body: {
                  assignmentId: assignment.id,
                  progress: Math.floor(progress)
                }
              }).catch(err => console.error('更新进度失败:', err));
            }
          }}
          onComplete={async () => {
            // 如果有任务，标记为完成
            if (hasTask && assignment) {
              try {
                await apiFetch(`/api/training/progress`, {
                  method: 'POST',
                  body: {
                    assignmentId: assignment.id,
                    progress: 100,
                    status: 'completed'
                  }
                });
                setCompleted(true);
              } catch (error) {
                console.error('标记学习完成失败:', error);
              }
            } else {
              // 自由学习模式，对于没有考试要求的内容，标记为已学习
              if (!material.isExamRequired && user) {
                try {
                  await apiFetch('/api/training/learned', {
                    method: 'POST',
                    body: {
                      userId: user.id,
                      materialId: id
                    }
                  });
                } catch (error) {
                  console.error('标记已学习失败:', error);
                  // 即使标记失败，也显示完成提示
                }
              }
              setCompleted(true);
            }
          }}
          isExamRequired={material.isExamRequired}
          onStartExam={handleStartExam}
        />
        
        {/* 完成提示覆盖层 */}
        {completed && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-10 backdrop-blur-sm">
            <div className="bg-white p-8 rounded-xl max-w-md w-full text-center space-y-6 animate-in fade-in zoom-in">
              <div className="text-green-500 text-6xl mb-4">✓</div>
              <h2 className="text-2xl font-bold text-slate-800">学习已完成!</h2>
              <p className="text-slate-600 mb-6">
                {hasTask ? '恭喜，您已完成该课程。' : '您已完成该学习内容的学习。'}
              </p>
              <button 
                onClick={() => router.back()} 
                className="w-full py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-lg shadow-blue-200"
              >
                返回
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
