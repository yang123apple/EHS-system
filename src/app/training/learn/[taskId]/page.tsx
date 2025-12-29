'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import FileViewer from '@/components/training/FileViewer';
import { ArrowLeft, CheckCircle } from 'lucide-react';

export default function LearnPage({ params }: { params: { taskId: string } }) {
  const router = useRouter();
  const [assignment, setAssignment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    // Fetch assignment details (reuse my-tasks logic or new endpoint)
    // Actually I need assignment ID. params.taskId here refers to the dynamic route param [taskId] which might be assignment ID based on my Link.
    // Let's verify: Link href={`/training/learn/${t.id}`}. t.id is Assignment ID. Correct.

    // I need an endpoint to get single assignment.
    // I can reuse `/api/training/my-tasks` with filter or just list all and find (inefficient) or add detail endpoint.
    // I added `/api/training/assignment/[id]` for POST. I should add GET there too?
    // Let's assume I can get it. I'll quickly patch the API if needed.
    // Actually, I didn't add GET to `src/app/api/training/assignment/[id]/route.ts`.
    // I will fetch the list and find locally for now to save a step, or better, add GET.
    // I'll add GET to `src/app/api/training/assignment/[id]/route.ts`.

    fetch(`/api/training/assignment/${params.taskId}`)
        .then(res => res.json())
        .then(data => {
            setAssignment(data);
            if (data.isPassed || (data.progress === 100 && !data.task.material.isExamRequired)) {
                setCompleted(true);
            }
        })
        .finally(() => setLoading(false));

  }, [params.taskId]);

  const handleProgress = (progress: number) => {
      // Throttle updates?
      if (!assignment) return;
      if (progress > assignment.progress) {
          fetch(`/api/training/assignment/${assignment.id}`, {
              method: 'POST',
              body: JSON.stringify({ action: 'update_progress', progress: Math.floor(progress) })
          });
      }
  };

  const handleComplete = () => {
      setCompleted(true);
      // Update backend to 100%
      handleProgress(100);
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
            />

            {/* Completion Overlay / Exam Prompt */}
            {completed && (
                <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-10 backdrop-blur-sm">
                    <div className="bg-white p-8 rounded-xl max-w-md w-full text-center space-y-6 animate-in fade-in zoom-in">
                        <CheckCircle size={64} className="mx-auto text-green-500"/>
                        <h2 className="text-2xl font-bold text-slate-800">学习已完成!</h2>

                        {material.isExamRequired ? (
                            <div>
                                <p className="text-slate-600 mb-6">该课程需要通过考试才能结业。</p>
                                <button onClick={() => router.push(`/training/exam/${assignment.id}`)} className="w-full py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-lg shadow-blue-200">
                                    进入考试
                                </button>
                            </div>
                        ) : (
                            <div>
                                <p className="text-slate-600 mb-6">恭喜，您已完成该课程。</p>
                                <button onClick={() => router.back()} className="w-full py-3 bg-slate-100 text-slate-700 font-bold rounded-lg hover:bg-slate-200">
                                    返回列表
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
