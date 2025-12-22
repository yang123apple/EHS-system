import { useState, useEffect } from 'react';
import { ShieldAlert, Search, RefreshCw } from 'lucide-react';

export default function SystemLogView() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/logs');
      if (res.ok) setLogs(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden">
      {/* 头部 */}
      <div className="p-6 bg-white border-b flex justify-between items-center shadow-sm z-10">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <ShieldAlert className="text-blue-600" /> 系统操作日志
          </h2>
          <p className="text-sm text-slate-500 mt-1">仅管理员可见 · 记录关键数据变更与审批操作</p>
        </div>
        <button 
          onClick={fetchLogs} 
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded text-slate-600 transition"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> 刷新
        </button>
      </div>

      {/* 表格区域 */}
      <div className="flex-1 overflow-auto p-6">
        <div className="bg-white rounded-lg border shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b text-slate-500">
              <tr>
                <th className="p-4 font-medium w-48">时间</th>
                <th className="p-4 font-medium w-32">操作人</th>
                <th className="p-4 font-medium w-48">动作类型</th>
                <th className="p-4 font-medium w-32">对象ID</th>
                <th className="p-4 font-medium">详情描述</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4 text-slate-500 font-mono text-xs">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="p-4 font-bold text-slate-700">
                    {log.userName || 'System'}
                    <div className="text-[10px] text-slate-400 font-normal">{log.userId}</div>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                      log.action.includes('DELETE') ? 'bg-red-100 text-red-700' :
                      log.action.includes('APPROVE') ? 'bg-green-100 text-green-700' :
                      'bg-blue-50 text-blue-700'
                    }`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="p-4 text-slate-400 text-xs font-mono select-all">
                    {log.targetId || '-'}
                  </td>
                  <td className="p-4 text-slate-600">
                    {log.details}
                  </td>
                </tr>
              ))}
              {logs.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400">暂无日志记录</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}