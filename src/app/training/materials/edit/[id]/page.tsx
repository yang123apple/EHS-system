'use client';
import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import ExamEditor from '@/components/training/ExamEditor';
import { useAuth } from '@/context/AuthContext';

export default function EditMaterialPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { user } = useAuth();
  const { id } = use(params);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [material, setMaterial] = useState<any>(null);

  // Form Data
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [category, setCategory] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [isExam, setIsExam] = useState(false);
  const [passingScore, setPassingScore] = useState(60);
  const [questions, setQuestions] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    // Load material and categories
    Promise.all([
      fetch(`/api/training/materials/${id}`).then(res => res.json()),
      fetch('/api/training/settings').then(res => res.json())
    ]).then(([materialData, settingsData]) => {
      // Check permission
      if (user.role !== 'admin' && materialData.uploaderId !== user.id) {
        alert('您没有权限编辑此内容');
        router.push('/training/knowledge-base');
        return;
      }

      setMaterial(materialData);
      setTitle(materialData.title);
      setDesc(materialData.description || '');
      setCategory(materialData.category || '');
      setIsPublic(materialData.isPublic);
      setIsExam(materialData.isExamRequired);
      setPassingScore(materialData.passingScore || 60);
      
      // Load questions if exist
      if (materialData.questions && materialData.questions.length > 0) {
        const loadedQuestions = materialData.questions.map((q: any) => ({
          type: q.type,
          question: q.question,
          options: JSON.parse(q.options),
          answer: JSON.parse(q.answer),
          score: q.score
        }));
        setQuestions(loadedQuestions);
      }

      setCategories(settingsData.categories || []);
    }).catch(err => {
      console.error('Failed to load material:', err);
      alert('加载失败');
      router.push('/training/knowledge-base');
    }).finally(() => setLoading(false));
  }, [id, user, router]);

  const handleSubmit = async () => {
    if (!title) return alert('请填写标题');

    setSaving(true);
    try {
      const body = {
        title,
        description: desc,
        category,
        isPublic,
        isExamRequired: isExam,
        passingScore,
        questions: isExam ? questions : []
      };

      const res = await fetch(`/api/training/materials/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
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
                  <input type="number" value={passingScore} onChange={e => setPassingScore(parseInt(e.target.value))} className="border rounded w-20 p-1"/>
                </div>
              )}
            </div>
          </div>

          {isExam && (
            <div>
              <h3 className="font-bold mb-4">考试题目</h3>
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
