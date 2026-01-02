'use client';
import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import FileViewer from '@/components/training/FileViewer';
import { ArrowLeft, CheckCircle } from 'lucide-react';
import { apiFetch } from '@/lib/apiClient';

export default function LearnPage({ params }: { params: Promise<{ taskId: string }> }) {
  const router = useRouter();
  const { taskId } = use(params);
  const [assignment, setAssignment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    apiFetch(`/api/training/assignment/${taskId}`)
        .then(res => res.json())
        .then(data => {
            setAssignment(data);
            const material = data?.task?.material;
            const materialType = material?.type;
            const isVideo = materialType === 'video';
            const isDocument = materialType === 'pdf' || materialType === 'docx';
            
            // 判断是否完成：
            // - 已通过考试
            // - 无考试要求且：视频进度>=95% 或 文档进度=100%
            const isCompleted = data?.isPassed || (
                !material?.isExamRequired && (
                    (isVideo && data?.progress >= 95) || 
                    (isDocument && data?.progress === 100)
                )
            );
            
            if (isCompleted) {
                setCompleted(true);
            }
        })
        .catch(err => {
            console.error('Failed to load assignment:', err);
        })
        .finally(() => setLoading(false));

  }, [taskId]);

  const handleProgress = (progress: number) => {
      if (!assignment) return;
      const material = assignment.task?.material;
      const materialType = material?.type;
      const isVideo = materialType === 'video';
      
      // Only update if progress increased
      if (progress > assignment.progress) {
          // 对于视频，当进度>=95%时，也触发完成逻辑
          const shouldComplete = isVideo && progress >= 95 && !material?.isExamRequired;
          
          apiFetch(`/api/training/progress`, {
              method: 'POST',
              body: {
                  assignmentId: assignment.id,
                  progress: Math.floor(progress),
                  ...(shouldComplete ? { status: 'completed' } : {})
              }
          }).then(() => {
              // 如果是视频且达到95%，更新本地状态
              if (shouldComplete) {
                  setCompleted(true);
              }
          });
      }
  };

  const handleComplete = async () => {
      if (completed) return;
      
      // 更新后端进度和状态
      try {
          await apiFetch(`/api/training/progress`, {
              method: 'POST',
              body: {
                  assignmentId: assignment.id,
                  progress: 100,
                  status: 'completed'
              }
          });
          
          // 更新本地状态，显示完成覆盖层
          setCompleted(true);
      } catch (error) {
          console.error('标记学习完成失败:', error);
      }
  };

  if (loading) return <div className="p-10 text-center">加载中...</div>;
  if (!assignment) return <div className="p-10 text-center">任务不存在</div>;

  const { task } = assignment;
  const { material } = task;

  return (
    <div className="flex flex-col h-screen bg-black">
        <div className="h-16 bg-slate-900 text-white flex items-center px-6 justify-between shrink-0">
            <button onClick={() => router.back()} className="flex items-center gap-2 hover:text-slate-300">
                <ArrowLeft/> 退出学习
            </button>
            <h1 className="font-bold">{material.title}</h1>
            <div className="w-24"></div>
        </div>

        <div className="flex-1 overflow-hidden relative">
            <FileViewer
                url={material.convertedUrl || material.url}
                type={material.convertedUrl ? 'pdf' : material.type}
                onProgress={handleProgress}
                onComplete={handleComplete}
                isExamRequired={material.isExamRequired}
                onStartExam={() => {
                    // 跳转到考试页面
                    router.push(`/training/exam/${assignment.id}`);
                }}
            />

            {/* Completion Overlay / Exam Prompt */}
            {completed && (
                <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-10 backdrop-blur-sm">
                    <div className="bg-white p-8 rounded-xl max-w-md w-full text-center space-y-6 animate-in fade-in zoom-in">
                        <CheckCircle size={64} className="mx-auto text-green-500"/>
                        <h2 className="text-2xl font-bold text-slate-800">学习已完成!</h2>

                        {material.isExamRequired ? (
                            <div className="space-y-3">
                                <p className="text-slate-600 mb-6">该课程需要通过考试才能结业。</p>
                                <button onClick={() => router.push(`/training/exam/${assignment.id}`)} className="w-full py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-lg shadow-blue-200">
                                    进入考试
                                </button>
                                <button onClick={() => router.push('/training/my-tasks')} className="w-full py-3 bg-slate-100 text-slate-700 font-bold rounded-lg hover:bg-slate-200">
                                    返回任务列表
                                </button>
                            </div>
                        ) : (
                            <div>
                                <p className="text-slate-600 mb-6">恭喜，您已完成该课程。</p>
                                <button onClick={() => router.push('/training/my-tasks')} className="w-full py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-lg shadow-blue-200">
                                    返回任务列表
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    </div>
  );
}
