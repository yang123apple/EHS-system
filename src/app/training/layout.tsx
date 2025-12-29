import Link from 'next/link';
import { BookOpen, Upload, Calendar, BarChart } from 'lucide-react';

export default function TrainingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-slate-50">
      <div className="w-64 bg-white border-r flex flex-col">
        <div className="p-4 border-b">
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <BookOpen className="text-blue-600" />
            EHS培训系统
          </h1>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <div className="text-xs font-bold text-slate-400 uppercase mb-2 px-2">我的学习</div>
          <Link href="/training/my-tasks" className="flex items-center gap-3 p-2 text-slate-700 hover:bg-slate-100 rounded-lg">
             <BookOpen size={18}/> 我的任务
          </Link>

          <div className="text-xs font-bold text-slate-400 uppercase mt-6 mb-2 px-2">管理中心</div>
          <Link href="/training/materials" className="flex items-center gap-3 p-2 text-slate-700 hover:bg-slate-100 rounded-lg">
             <Upload size={18}/> 学习内容库
          </Link>
          <Link href="/training/tasks" className="flex items-center gap-3 p-2 text-slate-700 hover:bg-slate-100 rounded-lg">
             <Calendar size={18}/> 任务发布
          </Link>
        </nav>
      </div>

      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  );
}
