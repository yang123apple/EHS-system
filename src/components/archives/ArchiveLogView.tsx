'use client';

import { useState, useEffect } from 'react';
import { FileText, RefreshCw, Eye, X, Calendar } from 'lucide-react';
import { apiFetch } from '@/lib/apiClient';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface ArchiveLog {
  id: string;
  userId?: string;
  userName?: string;
  userRole?: string;
  userDepartment?: string;
  action: string;
  actionLabel?: string;
  module: string;
  targetId?: string;
  targetType?: string;
  targetLabel?: string;
  details?: string;
  createdAt: string;
}

export default function ArchiveLogView() {
  const [logs, setLogs] = useState<ArchiveLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedLog, setSelectedLog] = useState<ArchiveLog | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 50;

  // Filters
  const [targetType, setTargetType] = useState('');
  const [targetIdFilter, setTargetIdFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchLogs = async (pageNum = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: limit.toString(),
        module: 'ARCHIVE', // 只显示档案库模块的日志
      });

      if (targetType) params.append('targetType', targetType);
      if (targetIdFilter) params.append('targetId', targetIdFilter);
      if (actionFilter) params.append('action', actionFilter);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const res = await apiFetch(`/api/logs?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data) {
          setLogs(data.data.logs || []);
          setTotalPages(data.meta?.totalPages || 1);
          setPage(pageNum);
        } else {
          console.error('获取日志失败:', data.error || '未知错误');
          setLogs([]);
          setTotalPages(1);
        }
      } else {
        console.error('获取日志失败: HTTP', res.status);
        setLogs([]);
        setTotalPages(1);
      }
    } catch (error) {
      console.error('获取日志失败:', error);
      setLogs([]);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(1);
  }, [targetType, targetIdFilter, actionFilter, startDate, endDate]);

  const getActionColor = (action: string) => {
    const colorMap: Record<string, string> = {
      'UPLOAD': 'bg-violet-100 text-violet-700',
      'DELETE': 'bg-red-100 text-red-700',
      'DESTROY': 'bg-red-100 text-red-700',
      'VOID': 'bg-red-100 text-red-700',
      'CREATE': 'bg-green-100 text-green-700',
      'UPDATE': 'bg-blue-100 text-blue-700',
      'CONFIG': 'bg-amber-100 text-amber-700',
      'DOWNLOAD': 'bg-sky-100 text-sky-700',
      'EXPORT': 'bg-indigo-100 text-indigo-700',
      'IMPORT': 'bg-teal-100 text-teal-700',
      'ARCHIVE': 'bg-stone-100 text-stone-700',
      'RESTORE': 'bg-lime-100 text-lime-700',
    };
    return colorMap[action] || 'bg-slate-100 text-slate-700';
  };

  const getTargetTypeLabel = (type?: string) => {
    const labelMap: Record<string, string> = {
      'archive_file': '档案文件',
      'equipment': '设备',
      'archive_config': '档案配置',
      'config': '档案配置', // 兼容旧数据中的 'config' 值
    };
    return labelMap[type || ''] || type || '未知';
  };

  const parseDetails = (details?: string) => {
    if (!details) return null;
    try {
      return typeof details === 'string' ? JSON.parse(details) : details;
    } catch {
      return details;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden">
      {/* 头部 */}
      <div className="p-6 bg-white border-b shadow-sm z-10">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <FileText className="text-blue-600" /> 档案库操作日志
            </h2>
            <p className="text-sm text-slate-500 mt-1">仅管理员可见 · 记录档案库所有操作</p>
          </div>
          <button 
            onClick={() => fetchLogs(1)}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-600 transition-colors disabled:opacity-50"
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
            <option value="archive_file">档案文件</option>
            <option value="equipment">设备</option>
            <option value="archive_config">档案配置</option>
          </select>

          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">全部操作</option>
            <option value="UPLOAD">上传</option>
            <option value="DELETE">删除</option>
            <option value="CREATE">创建</option>
            <option value="UPDATE">更新</option>
            <option value="CONFIG">配置</option>
          </select>

          <input
            type="text"
            placeholder="目标ID筛选"
            value={targetIdFilter}
            onChange={(e) => setTargetIdFilter(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />

          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-slate-400" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="开始日期"
            />
            <span className="text-slate-400">至</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="结束日期"
            />
          </div>

          {(targetType || targetIdFilter || actionFilter || startDate || endDate) && (
            <button
              onClick={() => {
                setTargetType('');
                setTargetIdFilter('');
                setActionFilter('');
                setStartDate('');
                setEndDate('');
              }}
              className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-600 text-sm"
            >
              <X size={14} /> 清除筛选
            </button>
          )}
        </div>
      </div>

      {/* 日志列表 */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="animate-spin text-slate-400" size={24} />
            <span className="ml-2 text-slate-500">加载中...</span>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            <FileText size={48} className="mb-4 opacity-50" />
            <p>暂无日志记录</p>
          </div>
        ) : (
          <div className="space-y-3">
            {logs.map((log) => (
              <div
                key={log.id}
                className="bg-white rounded-lg border border-slate-200 p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getActionColor(log.action)}`}>
                        {log.actionLabel || log.action}
                      </span>
                      <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">
                        {getTargetTypeLabel(log.targetType)}
                      </span>
                      <span className="text-xs text-slate-400">
                        {format(new Date(log.createdAt), 'yyyy-MM-dd HH:mm:ss', { locale: zhCN })}
                      </span>
                    </div>
                    <div className="text-sm text-slate-700">
                      <span className="font-medium">{log.userName || '系统'}</span>
                      {log.userDepartment && (
                        <span className="text-slate-400 ml-2">· {log.userDepartment}</span>
                      )}
                    </div>
                    {log.targetLabel && (
                      <div className="text-sm text-slate-600 mt-1">
                        目标: <span className="font-medium">{log.targetLabel}</span>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      setSelectedLog(log);
                      setShowDetails(true);
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Eye size={14} /> 详情
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="p-6 bg-white border-t flex items-center justify-between">
          <div className="text-sm text-slate-500">
            第 {page} 页 / 共 {totalPages} 页
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => fetchLogs(page - 1)}
              disabled={page === 1 || loading}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              上一页
            </button>
            <button
              onClick={() => fetchLogs(page + 1)}
              disabled={page === totalPages || loading}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              下一页
            </button>
          </div>
        </div>
      )}

      {/* 详情模态框 */}
      {showDetails && selectedLog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">日志详情</h3>
              <button
                onClick={() => {
                  setShowDetails(false);
                  setSelectedLog(null);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-slate-500">操作类型</label>
                  <div className="mt-1">
                    <span className={`px-2 py-1 rounded text-sm font-medium ${getActionColor(selectedLog.action)}`}>
                      {selectedLog.actionLabel || selectedLog.action}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-500">操作人</label>
                  <div className="mt-1 text-slate-700">
                    {selectedLog.userName || '系统'}
                    {selectedLog.userRole && (
                      <span className="text-slate-400 ml-2">({selectedLog.userRole})</span>
                    )}
                  </div>
                  {selectedLog.userDepartment && (
                    <div className="text-sm text-slate-500 mt-1">{selectedLog.userDepartment}</div>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-500">目标类型</label>
                  <div className="mt-1 text-slate-700">{getTargetTypeLabel(selectedLog.targetType)}</div>
                </div>
                {selectedLog.targetLabel && (
                  <div>
                    <label className="text-sm font-medium text-slate-500">目标对象</label>
                    <div className="mt-1 text-slate-700">{selectedLog.targetLabel}</div>
                  </div>
                )}
                {selectedLog.targetId && (
                  <div>
                    <label className="text-sm font-medium text-slate-500">目标ID</label>
                    <div className="mt-1 text-slate-700 font-mono text-sm">{selectedLog.targetId}</div>
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium text-slate-500">操作时间</label>
                  <div className="mt-1 text-slate-700">
                    {format(new Date(selectedLog.createdAt), 'yyyy-MM-dd HH:mm:ss', { locale: zhCN })}
                  </div>
                </div>
                {selectedLog.details && (
                  <div>
                    <label className="text-sm font-medium text-slate-500">详细信息</label>
                    <div className="mt-1 bg-slate-50 rounded-lg p-4">
                      <pre className="text-xs text-slate-700 whitespace-pre-wrap">
                        {JSON.stringify(parseDetails(selectedLog.details), null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="p-6 border-t flex justify-end">
              <button
                onClick={() => {
                  setShowDetails(false);
                  setSelectedLog(null);
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700"
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

