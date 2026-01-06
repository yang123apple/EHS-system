'use client';
import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import ExamEditor from '@/components/training/ExamEditor';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/apiClient';
import { Download, Upload } from 'lucide-react';

export default function EditMaterialPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { user } = useAuth();
  const { id } = use(params);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [material, setMaterial] = useState<any>(null);

  // Form Data - 使用初始值避免undefined -> defined警告
  const [title, setTitle] = useState<string>('');
  const [desc, setDesc] = useState<string>('');
  const [category, setCategory] = useState<string>('');
  const [isPublic, setIsPublic] = useState<boolean>(true);
  const [isExam, setIsExam] = useState<boolean>(false);
  const [passingScore, setPassingScore] = useState<number>(60);
  const [examMode, setExamMode] = useState<string>('standard');
  const [randomQuestionCount, setRandomQuestionCount] = useState<number>(10);
  const [questions, setQuestions] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [importing, setImporting] = useState<boolean>(false);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    // Load material and categories
    Promise.all([
      apiFetch(`/api/training/materials/${id}`).then(res => {
        if (!res.ok) throw new Error('获取材料失败');
        return res.json();
      }),
      apiFetch('/api/training/settings').then(res => {
        if (!res.ok) throw new Error('获取设置失败');
        return res.json();
      })
    ]).then(([data, settingsData]) => {
      console.log('[Edit Page] 加载的材料数据:', data);
      console.log('[Edit Page] 加载的设置数据:', settingsData);
      
      // Check permission
      if (user.role !== 'admin' && data.uploaderId !== user.id) {
        alert('您没有权限编辑此内容');
        router.push('/training/materials');
        return;
      }

      setMaterial(data);
      setTitle(data.title || '');
      setDesc(data.description || '');
      setCategory(data.category || '');
      setIsPublic(data.isPublic !== false);
      setIsExam(data.isExamRequired || false);
      setPassingScore(data.passingScore || 60);
      setExamMode(data.examMode || 'standard');
      setRandomQuestionCount(data.randomQuestionCount || 10);
      
      console.log('[Edit Page] 设置的表单数据:', {
        title: data.title,
        desc: data.description,
        category: data.category,
        isPublic: data.isPublic,
        isExam: data.isExamRequired,
        passingScore: data.passingScore
      });
      
      // Load questions if exist
      if (data.questions && data.questions.length > 0) {
        console.log('[Edit Page] 原始题目数据:', data.questions);
        const loadedQuestions = data.questions.map((q: any) => ({
          type: q.type,
          question: q.question,
          options: typeof q.options === 'string' ? JSON.parse(q.options) : q.options,
          answer: typeof q.correctAnswer === 'string' ? JSON.parse(q.correctAnswer) : q.correctAnswer,
          score: q.score || 10
        }));
        console.log('[Edit Page] 转换后的题目:', loadedQuestions);
        setQuestions(loadedQuestions);
      }

      const availableCategories = settingsData.categories || [];
      setCategories(availableCategories);
      console.log('[Edit Page] 可用类别:', availableCategories);
    }).catch(err => {
      console.error('[Edit Page] 加载失败:', err);
      alert('加载失败: ' + err.message);
      router.push('/training/materials');
    }).finally(() => setLoading(false));
  }, [id, user, router]);

  const handleSubmit = async () => {
    if (!title) return alert('请填写标题');

    setSaving(true);
    try {
      const body = {
        title,
        description: desc,
        category: category || null,
        isPublic,
        isExamRequired: isExam,
        passingScore,
        examMode: isExam ? examMode : 'standard',
        randomQuestionCount: isExam && examMode === 'random' ? randomQuestionCount : null,
        questions: isExam ? questions.map(q => ({
          type: q.type,
          question: q.question,
          options: q.options,
          correctAnswer: q.answer,
          score: q.score || 10
        })) : []
      };

      const res = await apiFetch(`/api/training/materials/${id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      if (res.ok) {
        alert('保存成功');
        router.push('/training/knowledge-base');
      } else {
        alert('保存失败');
      }
    } catch (e) {
      console.error(e);
      alert('保存失败');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-10 text-center">加载中...</div>;
  }

  if (!material) {
    return <div className="p-10 text-center">内容不存在</div>;
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">编辑学习内容</h2>

      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="space-y-6">
          <div>
            <label className="block font-bold mb-2">标题</label>
            <input className="w-full border rounded p-2" value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          
          <div>
            <label className="block font-bold mb-2">描述</label>
            <textarea className="w-full border rounded p-2" value={desc} onChange={e => setDesc(e.target.value)} rows={3} />
          </div>
          
          <div>
            <label className="block font-bold mb-2">学习类型</label>
            <select 
              className="w-full border rounded p-2" 
              value={category} 
              onChange={e => setCategory(e.target.value)}
            >
              <option value="">请选择类型</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <input 
                type="checkbox" 
                id="isPublic"
                checked={isPublic} 
                onChange={e => setIsPublic(e.target.checked)} 
                className="w-5 h-5"
              />
              <label htmlFor="isPublic" className="font-bold cursor-pointer">放入公共知识库</label>
            </div>
            
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={isExam} onChange={e => setIsExam(e.target.checked)} className="w-5 h-5"/>
                <span className="font-bold">需要考试</span>
              </label>

              {isExam && (
                <div className="flex items-center gap-2">
                  <span className="text-sm">及格分数:</span>
                  <input type="number" value={passingScore} onChange={e => setPassingScore(parseInt(e.target.value) || 60)} className="border rounded w-20 p-1"/>
                </div>
              )}
            </div>

            {isExam && (
              <div className="space-y-4 border-t pt-4">
                <div>
                  <label className="block font-bold mb-2">考试模式</label>
                  <select 
                    className="w-full border rounded p-2" 
                    value={examMode} 
                    onChange={e => setExamMode(e.target.value)}
                  >
                    <option value="standard">标准模式（包含所有题目）</option>
                    <option value="random">随机题库模式（随机抽取题目）</option>
                  </select>
                </div>

                {examMode === 'random' && (
                  <div>
                    <label className="block font-bold mb-2">
                      抽取题目数量
                      <span className="text-sm text-slate-500 font-normal ml-2">
                        （当前题库共 {questions.length} 道题）
                      </span>
                    </label>
                    <input 
                      type="number" 
                      className="w-full border rounded p-2" 
                      value={randomQuestionCount} 
                      onChange={e => {
                        const count = parseInt(e.target.value) || 1;
                        const maxCount = questions.length || 1;
                        setRandomQuestionCount(Math.min(Math.max(1, count), maxCount));
                      }}
                      min={1}
                      max={questions.length || 1}
                    />
                    {questions.length > 0 && randomQuestionCount > questions.length && (
                      <p className="text-sm text-red-500 mt-1">
                        抽取数量不能超过题库总数（{questions.length}）
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {isExam && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold">考试题目</h3>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      try {
                        const res = await apiFetch(`/api/training/materials/${id}/download-template`);
                        if (!res.ok) throw new Error('下载失败');
                        const blob = await res.blob();
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `题目导入模板_${new Date().toISOString().split('T')[0]}.xlsx`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        window.URL.revokeObjectURL(url);
                      } catch (e) {
                        console.error(e);
                        alert('下载模板失败');
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2 border rounded hover:bg-slate-50 text-sm"
                  >
                    <Download size={16} />
                    下载导入模板
                  </button>
                  <label className="flex items-center gap-2 px-4 py-2 border rounded hover:bg-slate-50 text-sm cursor-pointer">
                    <Upload size={16} />
                    批量导入题目
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;

                        setImporting(true);
                        try {
                          const formData = new FormData();
                          formData.append('file', file);

                          const res = await apiFetch(`/api/training/materials/${id}/import-questions`, {
                            method: 'POST',
                            body: formData
                          });

                          const result = await res.json();

                          if (res.ok) {
                            alert(`导入成功！共导入 ${result.imported} 道题目${result.errors ? `，${result.errors.length} 条错误` : ''}`);
                            // 重新加载题目
                            const materialRes = await apiFetch(`/api/training/materials/${id}`);
                            const materialData = await materialRes.json();
                            if (materialData.questions && materialData.questions.length > 0) {
                              const loadedQuestions = materialData.questions.map((q: any) => ({
                                type: q.type,
                                question: q.question,
                                options: typeof q.options === 'string' ? JSON.parse(q.options) : q.options,
                                answer: typeof q.answer === 'string' ? JSON.parse(q.answer) : q.answer,
                                score: q.score || 10
                              }));
                              setQuestions(loadedQuestions);
                            }
                          } else {
                            alert(`导入失败: ${result.error}${result.errors ? '\n' + result.errors.join('\n') : ''}`);
                          }
                        } catch (error: any) {
                          console.error(error);
                          alert('导入失败: ' + (error.message || '未知错误'));
                        } finally {
                          setImporting(false);
                          // 清空文件输入
                          e.target.value = '';
                        }
                      }}
                      disabled={importing}
                    />
                  </label>
                </div>
              </div>
              <ExamEditor questions={questions} onChange={setQuestions} />
            </div>
          )}

          <div className="flex justify-between pt-6 border-t">
            <button onClick={() => router.back()} className="text-slate-500 hover:bg-slate-100 px-4 py-2 rounded">取消</button>
            <button onClick={handleSubmit} disabled={saving} className="bg-blue-600 text-white px-6 py-2 rounded font-bold hover:bg-blue-700 disabled:opacity-50">
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
