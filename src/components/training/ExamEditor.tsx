import { useState } from 'react';
import { Plus, Trash, CheckCircle } from 'lucide-react';

interface Question {
  type: 'single' | 'multiple';
  question: string;
  options: { label: string; text: string }[];
  answer: string[]; // ['A'] or ['A', 'B']
  score: number;
}

interface Props {
  questions: Question[];
  onChange: (qs: Question[]) => void;
}

export default function ExamEditor({ questions, onChange }: Props) {

  const addQuestion = () => {
    onChange([...questions, {
      type: 'single',
      question: '',
      options: [
          { label: 'A', text: '' },
          { label: 'B', text: '' },
          { label: 'C', text: '' },
          { label: 'D', text: '' }
      ],
      answer: [],
      score: 5
    }]);
  };

  const updateQuestion = (index: number, field: keyof Question, value: any) => {
    const newQs = [...questions];
    newQs[index] = { ...newQs[index], [field]: value };
    // Clear answers if type changes to prevent inconsistencies
    if (field === 'type') {
        newQs[index].answer = [];
    }
    onChange(newQs);
  };

  const updateOption = (qIndex: number, oIndex: number, text: string) => {
    const newQs = [...questions];
    newQs[qIndex].options[oIndex].text = text;
    onChange(newQs);
  };

  const toggleAnswer = (qIndex: number, label: string) => {
      const newQs = [...questions];
      const q = newQs[qIndex];

      if (q.type === 'single') {
          q.answer = [label];
      } else {
          if (q.answer.includes(label)) {
              q.answer = q.answer.filter(a => a !== label);
          } else {
              q.answer = [...q.answer, label].sort();
          }
      }
      onChange(newQs);
  };

  const removeQuestion = (index: number) => {
      onChange(questions.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
       {questions.map((q, i) => (
           <div key={i} className="border p-4 rounded-lg bg-slate-50 relative group">
               <button onClick={() => removeQuestion(i)} className="absolute top-2 right-2 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                   <Trash size={18}/>
               </button>

               <div className="flex gap-4 mb-3">
                   <div className="flex-1">
                       <label className="text-xs font-bold text-slate-500 block mb-1">题目 {i+1}</label>
                       <input
                           className="w-full border rounded px-2 py-1"
                           value={q.question}
                           onChange={e => updateQuestion(i, 'question', e.target.value)}
                           placeholder="输入题干..."
                       />
                   </div>
                   <div className="w-24">
                       <label className="text-xs font-bold text-slate-500 block mb-1">分值</label>
                       <input
                           type="number"
                           className="w-full border rounded px-2 py-1"
                           value={q.score}
                           onChange={e => updateQuestion(i, 'score', parseInt(e.target.value) || 0)}
                       />
                   </div>
                   <div className="w-24">
                       <label className="text-xs font-bold text-slate-500 block mb-1">类型</label>
                       <select
                           className="w-full border rounded px-2 py-1"
                           value={q.type}
                           onChange={e => updateQuestion(i, 'type', e.target.value)}
                       >
                           <option value="single">单选</option>
                           <option value="multiple">多选</option>
                       </select>
                   </div>
               </div>

               <div className="space-y-2">
                   {q.options.map((opt, oIdx) => {
                       const isCorrect = q.answer.includes(opt.label);
                       return (
                           <div key={opt.label} className="flex items-center gap-2">
                               <button
                                   onClick={() => toggleAnswer(i, opt.label)}
                                   className={`w-6 h-6 rounded-full border flex items-center justify-center font-bold text-xs transition-colors
                                       ${isCorrect ? 'bg-green-600 text-white border-green-600' : 'bg-white text-slate-500 hover:bg-slate-100'}
                                   `}
                               >
                                   {opt.label}
                               </button>
                               <input
                                   className="flex-1 border-b border-dashed bg-transparent outline-none py-1 text-sm focus:border-blue-400"
                                   value={opt.text}
                                   onChange={e => updateOption(i, oIdx, e.target.value)}
                                   placeholder={`选项 ${opt.label} 内容`}
                               />
                               {isCorrect && <CheckCircle size={16} className="text-green-600" />}
                           </div>
                       )
                   })}
               </div>
           </div>
       ))}

       <button onClick={addQuestion} className="w-full py-3 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 hover:border-blue-400 hover:text-blue-600 flex items-center justify-center gap-2 font-bold transition-colors">
           <Plus size={20}/> 添加题目
       </button>
    </div>
  );
}
