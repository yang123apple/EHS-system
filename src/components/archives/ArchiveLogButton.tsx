'use client';

import { useState } from 'react';
import { FileText } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import ArchiveLogView from './ArchiveLogView';

export default function ArchiveLogButton() {
  const { user } = useAuth();
  const [showLogs, setShowLogs] = useState(false);

  // 只有管理员可以看到日志入口
  if (!user || user.role !== 'admin') {
    return null;
  }

  return (
    <>
      <button
        onClick={() => setShowLogs(true)}
        className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
        title="查看档案库操作日志（仅管理员）"
      >
        <FileText size={18} />
        <span>操作日志</span>
      </button>

      {showLogs && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-6xl h-[90vh] flex flex-col">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800">档案库操作日志</h2>
              <button
                onClick={() => setShowLogs(false)}
                className="text-slate-400 hover:text-slate-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <ArchiveLogView />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

