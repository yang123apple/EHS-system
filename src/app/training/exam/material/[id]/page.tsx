'use client';
import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function MaterialExamPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { user } = useAuth();
  const { id } = use(params);
  const [material, setMaterial] = useState<any>(null);
  const [assignment, setAssignment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [hasTask, setHasTask] = useState(false);
  const [examStarted, setExamStarted] = useState(false);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [isPassed, setIsPassed] = useState(false);

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
        
        // 检查是否已经通过考试
        if (relatedAssignment.isPassed) {
          setSubmitted(true);
          setScore(relatedAssignment.examScore || 0);
          setIsPassed(true);
        }
      } else {
        setHasTask(false);
      }
    }).catch(err => {
      console.error('Failed to load material:', err);
    }).finally(() => setLoading(false));
  }, [id, user, router]);

  const handleAnswerChange = (questionId: string, answer: any) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  const handleSubmit = async () => {
    if (!material?.questions) return;

    // 计算分数
    let totalScore = 0;
    material.questions.forEach((q: any) => {
      const userAnswer = answers[q.id];
      let correctAnswer = JSON.parse(q.answer);
      
      // 确保 correctAnswer 是数组格式
      if (!Array.isArray(correctAnswer)) {
        correctAnswer = [correctAnswer];
      }
      
      if (q.type === 'single') {
        // 单选题：用户答案应该是字符串，正确答案数组应该只有一个元素
        if (correctAnswer.includes(userAnswer)) {
          totalScore += q.score;
        }
      } else if (q.type === 'multiple') {
        const userAnswerArray = userAnswer || [];
        
        if (
          userAnswerArray.length === correctAnswer.length &&
          userAnswerArray.every((a: any) => correctAnswer.includes(a))
        ) {
          totalScore += q.score;
        }
      }
    });

    setScore(totalScore);
    const passed = totalScore >= (material.passingScore || 60);
    setIsPassed(passed);
    setSubmitted(true);

    // 如果有任务，提交到服务器
    if (hasTask && assignment) {
      try {
        await fetch(`/api/training/assignment/${assignment.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'submit_exam',
            score: totalScore,
            isPassed: passed
          })
        });
      } catch (error) {
        console.error('Failed to submit exam:', error);
      }
    }
  };

  if (loading) return <div className="p-10 text-center">加载中...</div>;
  if (!material) return <div className="p-10 text-center">学习内容不存在</div>;
  if (!material.questions || material.questions.length === 0) {
    return <div className="p-10 text-center">此内容没有配置考试题目</div>;
  }

  if (!examStarted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-2xl w-full">
          <h2 className="text-2xl font-bold text-slate-800 mb-4">{material.title} - 考试</h2>
          
          {!hasTask && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="text-yellow-600 mt-0.5" size={20} />
                <div className="flex-1">
                  <p className="font-bold text-yellow-800 mb-1">自由学习模式</p>
                  <p className="text-sm text-yellow-700">
                    您当前处于自由学习模式，考试成绩不会计入任务统计。
                    如需正式考试，请通过学习任务进入。
                  </p>
                </div>
              </div>
            </div>
          )}
          
          <div className="space-y-4 mb-6">
            <div className="flex justify-between py-2 border-b">
              <span className="text-slate-600">题目数量:</span>
              <span className="font-bold">{material.questions.length} 题</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-slate-600">及格分数:</span>
              <span className="font-bold">{material.passingScore || 60} 分</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-slate-600">考试状态:</span>
              <span className={`font-bold ${hasTask ? 'text-green-600' : 'text-yellow-600'}`}>
                {hasTask ? '正式考试' : '练习模式'}
              </span>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="font-bold text-blue-800 mb-2">考试须知</h3>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• 请认真作答，提交后不可修改</li>
              <li>• 单选题选择一个答案，多选题可选择多个答案</li>
              <li>• 达到及格分数即视为通过考试</li>
              {hasTask && <li>• 通过考试后将完成学习任务</li>}
            </ul>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => router.back()}
              className="flex-1 py-3 border border-slate-300 text-slate-700 font-bold rounded-lg hover:bg-slate-50"
            >
              返回
            </button>
            <button
              onClick={() => setExamStarted(true)}
              className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700"
            >
              开始考试
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-2xl w-full text-center">
          {isPassed ? (
            <>
              <CheckCircle size={64} className="mx-auto text-green-500 mb-4" />
              <h2 className="text-2xl font-bold text-slate-800 mb-2">恭喜通过考试！</h2>
            </>
          ) : (
            <>
              <XCircle size={64} className="mx-auto text-red-500 mb-4" />
              <h2 className="text-2xl font-bold text-slate-800 mb-2">考试未通过</h2>
            </>
          )}

          <div className="my-6 p-6 bg-slate-50 rounded-lg">
            <div className="text-4xl font-bold mb-2" style={{ color: isPassed ? '#10b981' : '#ef4444' }}>
              {score} 分
            </div>
            <div className="text-slate-600">
              及格分数: {material.passingScore || 60} 分
            </div>
          </div>

          {!hasTask && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-yellow-700">
                注意：此为练习模式，成绩不会被记录。
              </p>
            </div>
          )}

          <div className="flex gap-4">
            {!isPassed && (
              <button
                onClick={() => {
                  setSubmitted(false);
                  setExamStarted(false);
                  setAnswers({});
                  setScore(0);
                }}
                className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700"
              >
                重新考试
              </button>
            )}
            <button
              onClick={() => router.push('/training/knowledge-base')}
              className="flex-1 py-3 border border-slate-300 text-slate-700 font-bold rounded-lg hover:bg-slate-50"
            >
              返回列表
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-8 py-4 flex items-center justify-between">
          <h1 className="font-bold text-lg">{material.title} - 考试</h1>
          {!hasTask && (
            <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">练习模式</span>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-8">
        <div className="space-y-6 mb-8">
          {material.questions.map((question: any, index: number) => {
            const options = JSON.parse(question.options);
            
            return (
              <div key={question.id} className="bg-white rounded-xl shadow-sm border p-6">
                <div className="flex gap-4 mb-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-bold text-slate-800">{question.question}</h3>
                      <span className="text-sm text-slate-500 ml-4">{question.score}分</span>
                    </div>
                    <div className="text-xs text-slate-500 mb-4">
                      {question.type === 'single' ? '[单选题]' : '[多选题]'}
                    </div>

                    <div className="space-y-3">
                      {options.map((option: any, optIndex: number) => {
                        const optionLabel = typeof option === 'object' ? option.label : String.fromCharCode(65 + optIndex);
                        const optionText = typeof option === 'object' ? option.text : option;
                        const isSelected = question.type === 'single'
                          ? answers[question.id] === optionLabel
                          : (answers[question.id] || []).includes(optionLabel);

                        return (
                          <label
                            key={optIndex}
                            className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                              isSelected
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <input
                              type={question.type === 'single' ? 'radio' : 'checkbox'}
                              name={`question-${question.id}`}
                              checked={isSelected}
                              onChange={() => {
                                if (question.type === 'single') {
                                  handleAnswerChange(question.id, optionLabel);
                                } else {
                                  const current = answers[question.id] || [];
                                  const newAnswer = current.includes(optionLabel)
                                    ? current.filter((a: string) => a !== optionLabel)
                                    : [...current, optionLabel];
                                  handleAnswerChange(question.id, newAnswer);
                                }
                              }}
                              className="mt-1"
                            />
                            <span className="flex-1">
                              <span className="font-bold mr-2">{optionLabel}.</span>
                              {optionText}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="sticky bottom-0 bg-white border-t p-6 flex gap-4">
          <button
            onClick={() => {
              if (confirm('确定要放弃考试吗？')) {
                router.back();
              }
            }}
            className="px-6 py-3 border border-slate-300 text-slate-700 font-bold rounded-lg hover:bg-slate-50"
          >
            放弃考试
          </button>
          <button
            onClick={() => {
              if (Object.keys(answers).length < material.questions.length) {
                if (!confirm('还有题目未作答，确定要提交吗？')) {
                  return;
                }
              }
              handleSubmit();
            }}
            className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700"
          >
            提交答卷
          </button>
        </div>
      </div>
    </div>
  );
}
