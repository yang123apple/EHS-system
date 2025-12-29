'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, XCircle } from 'lucide-react';

export default function ExamPage({ params }: { params: { taskId: string } }) {
  const router = useRouter();
  const [assignment, setAssignment] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [answers, setAnswers] = useState<Record<string, string[]>>({}); // qId -> ['A']
  const [result, setResult] = useState<{ score: number, passed: boolean } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Fetch assignment to check if allowed
    // 2. Fetch questions
    // Using a combined endpoint or separate?
    // I need the questions. The material endpoint returns them.
    // I need to fetch assignment first to get materialId.

    // I'll assume I can fetch assignment with material & questions.
    // I need to update the GET route for assignment to include questions? No, security.
    // Ideally questions should be fetched separately and answers verified on server.
    // But for this MVP (and typical simple training systems), checking on client or sending answers to server is fine.
    // Plan: Fetch assignment -> material -> questions.
    // Wait, `material.questions` might not be included in the nested `task.material` query in `my-tasks`.
    // I will use `GET /api/training/materials/[id]` to get questions.

    async function load() {
        try {
            const assignRes = await fetch(`/api/training/assignment/${params.taskId}`); // Need to add GET support here first!
            const assignData = await assignRes.json();
            setAssignment(assignData);

            const matRes = await fetch(`/api/training/materials/${assignData.task.materialId}`);
            const matData = await matRes.json();

            // Parse options if string
            const parsedQuestions = matData.questions.map((q: any) => ({
                ...q,
                options: typeof q.options === 'string' ? JSON.parse(q.options) : q.options,
                answer: typeof q.answer === 'string' ? JSON.parse(q.answer) : q.answer
            }));

            setQuestions(parsedQuestions);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }
    load();
  }, [params.taskId]);

  const toggleAnswer = (qId: string, label: string, type: string) => {
      const current = answers[qId] || [];
      if (type === 'single') {
          setAnswers({ ...answers, [qId]: [label] });
      } else {
          if (current.includes(label)) {
              setAnswers({ ...answers, [qId]: current.filter(a => a !== label) });
          } else {
              setAnswers({ ...answers, [qId]: [...current, label].sort() });
          }
      }
  };

  const handleSubmit = async () => {
      if (Object.keys(answers).length < questions.length) {
          if (!confirm('还有题目未完成，确定提交吗？')) return;
      }

      // Calculate Score
      let score = 0;
      questions.forEach(q => {
          const userAns = answers[q.id] || [];
          const correctAns = q.answer; // Array

          // Simple exact match
          if (userAns.length === correctAns.length && userAns.every(a => correctAns.includes(a))) {
              score += q.score;
          }
      });

      const passed = score >= assignment.task.material.passingScore;
      setResult({ score, passed });

      // Save to backend
      await fetch(`/api/training/assignment/${assignment.id}`, {
          method: 'POST',
          body: JSON.stringify({
              action: 'complete_exam',
              examScore: score,
              isPassed: passed
          })
      });
  };

  if (loading) return <div className="p-10 text-center">加载试卷中...</div>;
  if (!assignment) return <div>Error</div>;

  if (result) {
      return (
          <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
              <div className="bg-white p-8 rounded-xl shadow-xl max-w-md w-full text-center">
                  {result.passed ? <CheckCircle size={64} className="mx-auto text-green-500 mb-4"/> : <XCircle size={64} className="mx-auto text-red-500 mb-4"/>}
                  <h2 className="text-2xl font-bold text-slate-800 mb-2">{result.passed ? '考试通过' : '考试未通过'}</h2>
                  <div className="text-4xl font-black text-blue-600 mb-6">{result.score} <span className="text-sm text-slate-400 font-normal">分</span></div>

                  <div className="space-y-3">
                      <button onClick={() => router.push('/training/my-tasks')} className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg">
                          返回任务列表
                      </button>
                      {!result.passed && (
                          <button onClick={() => window.location.reload()} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-lg shadow-blue-200">
                              重新考试
                          </button>
                      )}
                  </div>
              </div>
          </div>
      )
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <div className="bg-white border-b px-6 py-4 sticky top-0 z-10 shadow-sm flex justify-between items-center">
          <div>
              <h1 className="font-bold text-lg">{assignment.task.material.title} - 考试</h1>
              <div className="text-xs text-slate-500">及格分: {assignment.task.material.passingScore}</div>
          </div>
          <div className="text-sm font-mono bg-slate-100 px-3 py-1 rounded">
             已答: {Object.keys(answers).length}/{questions.length}
          </div>
      </div>

      <div className="max-w-3xl mx-auto p-6 space-y-6">
          {questions.map((q, idx) => (
              <div key={q.id} className="bg-white p-6 rounded-xl shadow-sm border">
                  <div className="flex gap-2 mb-4">
                      <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-bold h-fit shrink-0 mt-1">
                          {q.type === 'single' ? '单选' : '多选'} {q.score}分
                      </span>
                      <h3 className="font-bold text-lg text-slate-800">{idx + 1}. {q.question}</h3>
                  </div>

                  <div className="space-y-3 pl-2">
                      {q.options.map((opt: any) => {
                          const isSelected = (answers[q.id] || []).includes(opt.label);
                          return (
                              <div
                                  key={opt.label}
                                  onClick={() => toggleAnswer(q.id, opt.label, q.type)}
                                  className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer border transition-all
                                      ${isSelected ? 'bg-blue-50 border-blue-400' : 'bg-slate-50 border-transparent hover:bg-slate-100'}
                                  `}
                              >
                                  <div className={`w-6 h-6 rounded-full border flex items-center justify-center text-xs font-bold
                                      ${isSelected ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500'}
                                  `}>
                                      {opt.label}
                                  </div>
                                  <span className="text-slate-700">{opt.text}</span>
                              </div>
                          )
                      })}
                  </div>
              </div>
          ))}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 flex justify-center">
          <button onClick={handleSubmit} className="px-12 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg hover:bg-blue-700 hover:shadow-xl transition-all">
              提交试卷
          </button>
      </div>
    </div>
  );
}
