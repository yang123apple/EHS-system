'use client';
import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import FileViewer from '@/components/training/FileViewer';
import { ArrowLeft, Download, BookOpen } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function MaterialLearnPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { user } = useAuth();
  const { id } = use(params);
  const [material, setMaterial] = useState<any>(null);
  const [assignment, setAssignment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [hasTask, setHasTask] = useState(false);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    // 加载学习材料和相关任务
    Promise.all([
      fetch(`/api/training/materials/${id}`).then(res => res.json()),
      fetch(`/api/training/my-tasks?userId=${user.id}`).then(res => res.json())
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

      // 标记为已学习
      fetch('/api/training/learned', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          materialId: id
        })
      }).catch(err => {
        console.error('Failed to mark as learned:', err);
      });
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
        />
      </div>
    </div>
  );
}
