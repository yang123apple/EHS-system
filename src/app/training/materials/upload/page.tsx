'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ExamEditor from '@/components/training/ExamEditor';
import { useAuth } from '@/context/AuthContext';

export default function UploadPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Form Data
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [type, setType] = useState('video');
  const [category, setCategory] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [isExam, setIsExam] = useState(false);
  const [passingScore, setPassingScore] = useState(60);
  const [questions, setQuestions] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    if (!user) {
        // Handle redirect if needed, or rely on layout
        // router.push('/login');
    }
    // Load categories from settings
    fetch('/api/training/settings')
      .then(res => res.json())
      .then(data => {
        if (data.categories) {
          setCategories(data.categories);
        }
      })
      .catch(console.error);
  }, [user]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const f = e.target.files[0];
          
          // 检查文件大小（500MB限制）
          const maxSize = 500 * 1024 * 1024;
          if (f.size > maxSize) {
              alert('文件大小超过500MB限制，请选择较小的文件');
              e.target.value = '';
              return;
          }
          
          setFile(f);
          // Auto detect type
          if (f.type.includes('video')) setType('video');
          else if (f.type.includes('pdf')) setType('pdf');
          else if (f.name.endsWith('.docx')) setType('docx');
          else if (f.name.endsWith('.pptx')) setType('pptx');
      }
  };

  const handleSubmit = async () => {
      if (!file || !title) return alert('请完善信息');

      setUploading(true);
      try {
          if (!user?.id) {
              alert('登录状态失效，请重新登录');
              setUploading(false);
              return;
          }

          // 1. Upload File
          const formData = new FormData();
          formData.append('file', file);
          const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
          const { url } = await uploadRes.json();

          // 2. Create Material
          const body = {
              title,
              description: desc,
              type,
              category,
              url,
              duration: type === 'video' ? 300 : null, // Placeholder duration
              isExamRequired: isExam,
              passingScore,
              isPublic,
              questions: isExam ? questions : [],
              uploaderId: user.id
          };

          const res = await fetch('/api/training/materials', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body)
          });

          if (res.ok) {
              router.push('/training/materials');
          } else {
              alert('Failed');
          }
      } catch (e) {
          console.error(e);
          alert('Error');
      } finally {
          setUploading(false);
      }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">上传学习内容</h2>

      <div className="bg-white rounded-xl shadow-sm border p-6">
        {step === 1 && (
            <div className="space-y-6">
                <div>
                    <label className="block font-bold mb-2">标题</label>
                    <input className="w-full border rounded p-2" value={title} onChange={e => setTitle(e.target.value)} />
                </div>
                <div>
                    <label className="block font-bold mb-2">描述</label>
                    <textarea className="w-full border rounded p-2" value={desc} onChange={e => setDesc(e.target.value)} />
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
                <div>
                    <label className="block font-bold mb-2">文件 (MP4, PDF, DOCX, PPTX)</label>
                    <input type="file" onChange={handleFileChange} className="block w-full text-sm text-slate-500
                        file:mr-4 file:py-2 file:px-4
                        file:rounded-full file:border-0
                        file:text-sm file:font-semibold
                        file:bg-blue-50 file:text-blue-700
                        hover:file:bg-blue-100
                    "/>
                    {file && (
                        <div className="mt-2 space-y-1">
                            <div className="text-sm text-blue-600">已识别类型: {type}</div>
                            <div className="text-sm text-slate-600">
                                文件大小: {(file.size / 1024 / 1024).toFixed(2)} MB
                            </div>
                        </div>
                    )}
                </div>

                <div className="space-y-4">
                    <div className="flex items-center gap-2">
                        <input 
                            type="checkbox" 
                            id="isPublic"
                            checked={isPublic} 
                            onChange={e => setIsPublic(e.target.checked)} 
                            className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            style={{
                                appearance: 'none',
                                WebkitAppearance: 'none',
                                width: '22px',
                                height: '22px',
                                border: '2px solid #d1d5db',
                                borderRadius: '6px',
                                outline: 'none',
                                cursor: 'pointer',
                                position: 'relative',
                                backgroundColor: isPublic ? '#3b82f6' : 'white'
                            }}
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

                <div className="flex justify-end pt-6">
                    {isExam ? (
                        <button onClick={() => setStep(2)} className="bg-blue-600 text-white px-6 py-2 rounded font-bold">下一步：编辑考题</button>
                    ) : (
                        <button onClick={handleSubmit} disabled={uploading} className="bg-blue-600 text-white px-6 py-2 rounded font-bold">
                            {uploading ? '上传中...' : '提交'}
                        </button>
                    )}
                </div>
            </div>
        )}

        {step === 2 && (
            <div>
                <ExamEditor questions={questions} onChange={setQuestions} />
                <div className="flex justify-between pt-6 mt-6 border-t">
                    <button onClick={() => setStep(1)} className="text-slate-500 hover:bg-slate-100 px-4 py-2 rounded">上一步</button>
                    <button onClick={handleSubmit} disabled={uploading} className="bg-blue-600 text-white px-6 py-2 rounded font-bold">
                        {uploading ? '上传中...' : '完成并提交'}
                    </button>
                </div>
            </div>
        )}
      </div>
    </div>
  );
}
