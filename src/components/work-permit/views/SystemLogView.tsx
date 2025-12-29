import { useState, useEffect } from 'react';
import { ShieldAlert, Search, RefreshCw, Filter, Eye, X } from 'lucide-react';

export default function SystemLogView() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 50;

  // Filters
  const [targetType, setTargetType] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchLogs = async (pageNum = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: limit.toString(),
      });
      if (targetType) params.append('targetType', targetType);
      if (actionFilter) params.append('action', actionFilter);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const res = await fetch(`/api/logs?${params.toString()}`);
      if (res.ok) {
          const data = await res.json();
          if (data.data) {
              setLogs(data.data);
              setTotalPages(data.meta.totalPages);
              setPage(pageNum);
          } else {
              setLogs(data); // Fallback
          }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(1);
  }, [targetType, actionFilter, startDate, endDate]);

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden">
      {/* 头部 */}
      <div className="p-6 bg-white border-b shadow-sm z-10">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <ShieldAlert className="text-blue-600" /> 系统操作日志
            </h2>
            <p className="text-sm text-slate-500 mt-1">仅管理员可见 · 记录关键数据变更与审批操作</p>
          </div>
          <button 
            onClick={() => fetchLogs(1)}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded text-slate-600 transition"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> 刷新
          </button>
        </div>

        {/* 筛选条件 */}
        <div className="flex gap-3 flex-wrap">
          <select
            value={targetType}
            onChange={(e) => setTargetType(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">全部类型</option>
            <option value="hazard">隐患排查</option>
            <option value="document">文档管理</option>
            <option value="permit">作业许可</option>
            <option value="config">系统配置</option>
            <option value="user">用户管理</option>
            <option value="org">组织架构</option>
          </select>

          <input
            type="text"
            placeholder="操作类型关键词..."
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 w-48"
          />

          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="flex items-center text-slate-400">至</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />

          {(targetType || actionFilter || startDate || endDate) && (
            <button
              onClick={() => {
                setTargetType('');
                setActionFilter('');
                setStartDate('');
                setEndDate('');
              }}
              className="px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              清空筛选
            </button>
          )}
        </div>
      </div>

      {/* 表格区域 */}
      <div className="flex-1 overflow-auto p-6 flex flex-col">
        <div className="bg-white rounded-lg border shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b text-slate-500">
              <tr>
                <th className="p-4 font-medium w-48">时间</th>
                <th className="p-4 font-medium w-32">操作人</th>
                <th className="p-4 font-medium w-32">类型</th>
                <th className="p-4 font-medium w-40">动作</th>
                <th className="p-4 font-medium w-32">对象ID</th>
                <th className="p-4 font-medium">详情描述</th>
                <th className="p-4 font-medium w-24">操作</th>
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
                    {log.targetType && (
                      <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">
                        {log.targetType}
                      </span>
                    )}
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                      log.action.includes('DELETE') ? 'bg-red-100 text-red-700' :
                      log.action.includes('APPROVE') ? 'bg-green-100 text-green-700' :
                      log.action.includes('ASSIGN') ? 'bg-purple-100 text-purple-700' :
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
                  <td className="p-4">
                    {log.snapshot && (
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="p-1.5 hover:bg-blue-50 rounded text-blue-600 transition-colors"
                        title="查看快照"
                      >
                        <Eye size={16} />
                      </button>
                    )}
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

        {/* Pagination Controls */}
        {totalPages > 1 && (
            <div className="mt-4 flex justify-center items-center gap-4">
                <button
                    onClick={() => fetchLogs(page - 1)}
                    disabled={page === 1}
                    className="px-3 py-1 bg-white border rounded disabled:opacity-50 hover:bg-slate-50 text-sm"
                >
                    上一页
                </button>
                <span className="text-sm text-slate-600">第 {page} 页 / 共 {totalPages} 页</span>
                <button
                    onClick={() => fetchLogs(page + 1)}
                    disabled={page === totalPages}
                    className="px-3 py-1 bg-white border rounded disabled:opacity-50 hover:bg-slate-50 text-sm"
                >
                    下一页
                </button>
            </div>
        )}
      </div>

      {/* 快照查看弹窗 */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl">
            <div className="p-6 border-b flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold text-slate-900">操作快照详情</h3>
                <p className="text-sm text-slate-500 mt-1">
                  {new Date(selectedLog.createdAt).toLocaleString()} · {selectedLog.userName || 'System'}
                </p>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-2 hover:bg-slate-100 rounded-full text-slate-500"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-6">
              <div className="space-y-4">
                {/* 基本信息 */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-slate-500">操作类型</label>
                    <div className="mt-1">
                      <span className={`inline-block px-3 py-1 rounded text-sm font-bold ${
                        selectedLog.action.includes('DELETE') ? 'bg-red-100 text-red-700' :
                        selectedLog.action.includes('APPROVE') ? 'bg-green-100 text-green-700' :
                        selectedLog.action.includes('ASSIGN') ? 'bg-purple-100 text-purple-700' :
                        'bg-blue-50 text-blue-700'
                      }`}>
                        {selectedLog.action}
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500">目标类型</label>
                    <div className="mt-1 text-sm text-slate-900">
                      {selectedLog.targetType || '-'}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500">目标ID</label>
                    <div className="mt-1 text-sm text-slate-900 font-mono">
                      {selectedLog.targetId || '-'}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500">操作人</label>
                    <div className="mt-1 text-sm text-slate-900">
                      {selectedLog.userName || 'System'}
                    </div>
                  </div>
                </div>

                {/* 详情描述 */}
                {selectedLog.details && (
                  <div>
                    <label className="text-xs font-medium text-slate-500">操作描述</label>
                    <div className="mt-1 p-3 bg-slate-50 rounded-lg text-sm text-slate-700">
                      {selectedLog.details}
                    </div>
                  </div>
                )}

                {/* 快照数据 */}
                {selectedLog.snapshot && (
                  <div>
                    <label className="text-xs font-medium text-slate-500 mb-2 block">流程快照</label>
                    <div className="p-4 bg-slate-900 rounded-lg overflow-auto max-h-96">
                      <pre className="text-xs text-green-400 font-mono">
                        {JSON.stringify(JSON.parse(selectedLog.snapshot), null, 2)}
                      </pre>
                    </div>
                    <p className="text-xs text-slate-400 mt-2">
                      💡 快照记录了当时引擎的解析结果，包括候选人员、派发规则、执行时间等关键信息
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 border-t bg-slate-50 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
