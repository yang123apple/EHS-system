'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ChevronLeft, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { getAssignment, updateProgress, submitExam } from '@/app/actions/training';
import { useToast } from '@/components/common/Toast';

export default function LearningPage() {
  const params = useParams();
  const router = useRouter();
  const { showToast } = useToast();
  const assignmentId = params.assignmentId as string;

  const [assignment, setAssignment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'learn' | 'exam' | 'result'>('learn');

  // Learning State
  const [isReadyForExam, setIsReadyForExam] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const docContainerRef = useRef<HTMLDivElement>(null);

  // Exam State
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [examResult, setExamResult] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Again, assuming current user ID matches what getUserTasks uses.
    // In real app, secure this.
    getAssignment(assignmentId, 'admin').then(res => {
      if (res.success) {
        setAssignment(res.data);
        const status = res.data.status;
        if (status === 'passed' || status === 'failed') {
            setMode('result');
            setExamResult({ isPassed: status === 'passed', score: res.data.examScore });
        } else if (status === 'completed') {
             setIsReadyForExam(true);
        } else if (!res.data.task.material.isExamRequired && status === 'passed') {
             // Already done (no exam type)
             setMode('result');
             setExamResult({ isPassed: true });
        }
      } else {
        showToast('无法加载任务', 'error');
      }
      setLoading(false);
    });
  }, [assignmentId]);

  // --- Learning Logic ---

  const handleVideoUpdate = () => {
      if (!videoRef.current || isReadyForExam) return;
      const { currentTime, duration } = videoRef.current;
      if (duration - currentTime <= 30) {
          completeLearning();
      }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
      if (isReadyForExam) return;
      const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
      // Check if near bottom
      if (scrollTop + clientHeight >= scrollHeight - 50) {
          completeLearning();
      }
  };

  const completeLearning = async () => {
      if (isReadyForExam) return;
      setIsReadyForExam(true);

      const isExamReq = assignment.task.material.isExamRequired;

      // Update server
      await updateProgress(assignmentId, 100, true);

      if (!isExamReq) {
          setMode('result');
          setExamResult({ isPassed: true });
          showToast('学习完成', 'success');
      } else {
          showToast('学习完成，您可以开始考试了', 'success');
      }
  };

  // --- Exam Logic ---

  const handleStartExam = () => {
      setMode('exam');
      setAnswers({});
  };

  const handleAnswerChange = (qId: string, val: any, type: 'single' | 'multiple') => {
      if (type === 'single') {
          setAnswers(prev => ({ ...prev, [qId]: val }));
      } else {
          // Multi: toggle
          // Assuming val is just one option value
          // We need to manage array
          // But wait, the UI for multi needs to send the full array?
          // Let's implement simplified toggle logic
          // Actually, let's just use what CreatePage used: Index or Value?
          // I stored VALUE in CreatePage.

          setAnswers(prev => {
              const current = prev[qId] || [];
              const exists = current.includes(val);
              if (exists) return { ...prev, [qId]: current.filter((v: any) => v !== val) };
              else return { ...prev, [qId]: [...current, val] };
          });
      }
  };

  const handleSubmitExam = async () => {
      const questions = assignment.task.material.questions;
      if (questions.some((q: any) => !answers[q.id] || (Array.isArray(answers[q.id]) && answers[q.id].length === 0))) {
          if (!confirm('部分题目未作答，确定提交吗？')) return;
      }

      setSubmitting(true);
      const res = await submitExam(assignmentId, answers);
      if (res.success) {
          setExamResult(res);
          setMode('result');
      } else {
          showToast('提交失败', 'error');
      }
      setSubmitting(false);
  };

  const handleRetry = () => {
      setMode('exam');
      setAnswers({});
      setExamResult(null);
  };

  if (loading) return <div className="p-10 text-center">加载中...</div>;
  if (!assignment) return <div className="p-10 text-center">任务不存在</div>;

  const { material } = assignment.task;

  return (
    <div className="flex flex-col h-screen bg-slate-50">
       {/* Header */}
       <div className="bg-white border-b px-6 py-4 flex items-center justify-between shadow-sm z-10">
          <div className="flex items-center gap-4">
              <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 rounded-full">
                  <ChevronLeft size={20} />
              </button>
              <div>
                  <h1 className="font-bold text-lg">{assignment.task.title}</h1>
                  <p className="text-xs text-slate-500">{material.title}</p>
              </div>
          </div>
          <div>
              {mode === 'learn' && (
                  isReadyForExam && material.isExamRequired ? (
                      <button
                        onClick={handleStartExam}
                        className="bg-blue-600 text-white px-6 py-2 rounded-full font-bold hover:bg-blue-700 transition animate-pulse"
                      >
                          开始考试
                      </button>
                  ) : (
                      <span className="text-slate-400 text-sm">
                          {material.isExamRequired ? '请先完成学习' : '学习中...'}
                      </span>
                  )
              )}
          </div>
       </div>

       {/* Content */}
       <div className="flex-1 overflow-hidden relative">

           {/* LEARN MODE */}
           {mode === 'learn' && (
               <div className="h-full flex flex-col items-center justify-center bg-black/90 text-white overflow-y-auto" ref={docContainerRef} onScroll={material.type !== 'video' ? handleScroll : undefined}>
                   {material.type === 'video' ? (
                       <video
                         ref={videoRef}
                         src={material.url}
                         controls
                         className="max-w-full max-h-full"
                         onTimeUpdate={handleVideoUpdate}
                       />
                   ) : (
                       <div className="w-full max-w-4xl bg-white text-black min-h-full p-10 shadow-lg">
                           {/* PDF/DOC viewer */}
                           {/* If PDF, use iframe for native viewer or embed */}
                           {material.type === 'pdf' || material.convertedUrl ? (
                               <iframe src={material.convertedUrl || material.url} className="w-full h-[80vh]" />
                           ) : (
                               <div className="text-center py-20">
                                   <FileText size={48} className="mx-auto text-slate-400 mb-4" />
                                   <p>文档预览暂不可用，请<a href={material.url} className="text-blue-600 underline" download>下载查看</a>。</p>
                                   <div className="h-[1000px] border mt-10 flex items-center justify-center text-slate-300">
                                       (模拟长文档，请滚动到底部以完成学习)
                                   </div>
                               </div>
                           )}
                       </div>
                   )}

                   {/* Fallback "Start Exam" if re-entering */}
                   {material.isExamRequired && (assignment.status === 'completed' || assignment.status === 'failed') && (
                       <div className="absolute top-4 right-4">
                           <button onClick={handleStartExam} className="bg-blue-600 px-4 py-2 rounded text-white shadow-lg">
                               直接考试
                           </button>
                       </div>
                   )}
               </div>
           )}

           {/* EXAM MODE */}
           {mode === 'exam' && (
               <div className="h-full overflow-y-auto p-6 max-w-3xl mx-auto">
                   <div className="bg-white p-8 rounded-xl shadow-sm space-y-8 mb-10">
                       <h2 className="text-xl font-bold border-b pb-4">考试测评</h2>
                       {material.questions.map((q: any, idx: number) => (
                           <div key={q.id} className="space-y-4">
                               <div className="flex gap-2 font-medium text-lg">
                                   <span className="text-slate-400">{idx + 1}.</span>
                                   <p>{q.question} <span className="text-xs text-slate-400 font-normal">({q.score}分) {q.type === 'multiple' ? '[多选]' : ''}</span></p>
                               </div>
                               <div className="space-y-2 pl-6">
                                   {JSON.parse(q.options).map((opt: string, optIdx: number) => {
                                       const isSelected = q.type === 'single' ? answers[q.id] === opt : (answers[q.id] || []).includes(opt);
                                       return (
                                           <label key={optIdx} className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-slate-50 transition
                                                ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-slate-200'}
                                           `}>
                                               <input
                                                  type={q.type === 'single' ? 'radio' : 'checkbox'}
                                                  name={q.id}
                                                  checked={isSelected}
                                                  onChange={() => handleAnswerChange(q.id, opt, q.type as any)}
                                                  className="w-4 h-4 text-blue-600"
                                               />
                                               <span>{opt}</span>
                                           </label>
                                       )
                                   })}
                               </div>
                           </div>
                       ))}
                   </div>

                   <div className="flex justify-center pb-10">
                       <button
                         onClick={handleSubmitExam}
                         disabled={submitting}
                         className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition disabled:opacity-50"
                       >
                           {submitting ? '提交中...' : '提交试卷'}
                       </button>
                   </div>
               </div>
           )}

           {/* RESULT MODE */}
           {mode === 'result' && examResult && (
               <div className="h-full flex items-center justify-center bg-slate-50">
                   <div className="bg-white p-10 rounded-2xl shadow-xl text-center max-w-md w-full">
                       {examResult.isPassed ? (
                           <div className="text-green-500 mb-4 flex justify-center">
                               <CheckCircle size={80} />
                           </div>
                       ) : (
                           <div className="text-red-500 mb-4 flex justify-center">
                               <AlertCircle size={80} />
                           </div>
                       )}

                       <h2 className="text-2xl font-bold mb-2">
                           {examResult.isPassed ? '恭喜！考试通过' : '很遗憾，考试未通过'}
                       </h2>

                       {material.isExamRequired && (
                           <p className="text-slate-500 mb-8">
                               得分：<span className="text-3xl font-bold text-slate-800">{examResult.score}</span> / {material.passingScore} (及格分)
                           </p>
                       )}

                       <div className="flex gap-4 justify-center">
                           <button onClick={() => router.push('/training')} className="px-6 py-2 border rounded-lg hover:bg-slate-50">
                               返回中心
                           </button>
                           {!examResult.isPassed && (
                               <button onClick={handleRetry} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                                   重新考试
                               </button>
                           )}
                       </div>
                   </div>
               </div>
           )}

       </div>
    </div>
  );
}
