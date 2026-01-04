// src/app/hidden-danger/_components/views/SystemLogView.tsx
"use client";
import { useState, useEffect } from 'react';
import { Clock, User, FileText, Eye, ChevronLeft, ChevronRight, AlertCircle, Filter, X } from 'lucide-react';
import { apiFetch } from '@/lib/apiClient';

interface SystemLog {
  id: string;
  action: string;
  targetType: string;
  targetId: string | null;
  userId: string;
  userName: string;
  details: string;
  snapshot: any;
  createdAt: string;
}

interface SystemLogViewProps {
  loading?: boolean;
}

export function SystemLogView({ loading }: SystemLogViewProps) {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedSnapshot, setSelectedSnapshot] = useState<any>(null);
  
  // 筛选条件
  const [filters, setFilters] = useState({
    action: '',
    startDate: '',
    endDate: '',
  });
  const [showFilters, setShowFilters] = useState(false);

  // 获取日志数据
  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        targetType: 'hazard',  // 使用targetType查询隐患日志
        page: page.toString(),
        pageSize: pageSize.toString(),
      });

      if (filters.action) params.append('action', filters.action);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);

      const res = await apiFetch(`/api/logs?${params}`);
      const data = await res.json();
      
      if (data.success && data.data) {
        setLogs(data.data.logs || []);
        setTotal(data.data.total || 0);
      } else {
        console.error('获取日志失败:', data.error || '未知错误');
        setLogs([]);
        setTotal(0);
      }
    } catch (error) {
      console.error('获取日志失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, filters]);

  // 应用筛选
  const applyFilters = () => {
    setPage(1);
    setShowFilters(false);
  };

  // 重置筛选
  const resetFilters = () => {
    setFilters({
      action: '',
      startDate: '',
      endDate: '',
    });
    setPage(1);
    setShowFilters(false);
  };

  // 格式化时间
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  // 获取操作类型的显示文本
  const getActionLabel = (action: string) => {
    const actionMap: Record<string, string> = {
      'hazard_reported': '上报隐患',
      'hazard_assigned': '指派处理',
      'hazard_rectified': '完成整改',
      'hazard_verified': '验收通过',
      'hazard_rejected': '验收驳回',
      'hazard_closed': '闭环',
      'hazard_deleted': '删除',
      'hazard_updated': '更新',
      'workflow_updated': '工作流配置更新',
      'config_updated': '系统配置更新',
    };
    return actionMap[action] || action;
  };

  // 获取操作类型的颜色
  const getActionColor = (action: string) => {
    if (action.includes('reported') || action.includes('assigned')) return 'text-blue-600 bg-blue-50';
    if (action.includes('rectified') || action.includes('verified')) return 'text-green-600 bg-green-50';
    if (action.includes('rejected')) return 'text-orange-600 bg-orange-50';
    if (action.includes('deleted')) return 'text-red-600 bg-red-50';
    if (action.includes('updated') || action.includes('config')) return 'text-purple-600 bg-purple-50';
    return 'text-slate-600 bg-slate-50';
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-4">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">系统操作日志</h2>
          <p className="text-sm text-slate-500 mt-1">记录所有隐患相关的关键操作</p>
        </div>
        
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
        >
          <Filter size={16} />
          筛选
          {(filters.action || filters.startDate || filters.endDate) && (
            <span className="ml-1 w-2 h-2 bg-blue-500 rounded-full"></span>
          )}
        </button>
      </div>

      {/* 筛选面板 */}
      {showFilters && (
        <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                操作类型
              </label>
              <input
                type="text"
                value={filters.action}
                onChange={(e) => setFilters({ ...filters, action: e.target.value })}
                placeholder="例如：hazard_reported"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                开始日期
              </label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => {
                  const newStartDate = e.target.value;
                  setFilters({ ...filters, startDate: newStartDate });
                  // 如果结束时间已设置且早于新的开始时间，提示用户
                  if (filters.endDate && newStartDate && new Date(filters.endDate) <= new Date(newStartDate)) {
                    alert('❌ 提示：结束时间必须晚于开始时间！');
                  }
                }}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                结束日期
              </label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => {
                  const newEndDate = e.target.value;
                  // 如果开始时间已设置且结束时间早于或等于开始时间，提示用户
                  if (filters.startDate && newEndDate && new Date(newEndDate) <= new Date(filters.startDate)) {
                    alert('❌ 错误：结束时间必须晚于开始时间！');
                    return; // 不更新结束时间
                  }
                  setFilters({ ...filters, endDate: newEndDate });
                }}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          
          <div className="flex gap-2 justify-end">
            <button
              onClick={resetFilters}
              className="px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-lg"
            >
              重置
            </button>
            <button
              onClick={applyFilters}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              应用筛选
            </button>
          </div>
        </div>
      )}

      {/* 日志表格 */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                  时间
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                  操作
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                  操作人
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                  详情
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                  快照
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                      加载中...
                    </div>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    <div className="flex flex-col items-center gap-2">
                      <AlertCircle size={24} className="text-slate-400" />
                      暂无日志记录
                    </div>
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Clock size={14} />
                        {formatTime(log.createdAt)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getActionColor(log.action)}`}>
                        {getActionLabel(log.action)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <User size={14} className="text-slate-400" />
                        <span className="text-sm text-slate-700">{log.userName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <FileText size={14} className="text-slate-400 flex-shrink-0" />
                        <span className="line-clamp-2" title={log.details || ''}>
                          {log.details || '-'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {log.snapshot && Object.keys(log.snapshot).length > 0 ? (
                        <button
                          onClick={() => setSelectedSnapshot(log.snapshot)}
                          className="flex items-center gap-1 text-blue-600 hover:text-blue-700 text-sm"
                        >
                          <Eye size={14} />
                          查看
                        </button>
                      ) : (
                        <span className="text-slate-400 text-sm">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 分页 */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between">
            <div className="text-sm text-slate-600">
              共 {total} 条记录，第 {page} / {totalPages} 页
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 快照查看弹窗 */}
      {selectedSnapshot && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            {/* 头部 */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">流程快照详情</h3>
              <button
                onClick={() => setSelectedSnapshot(null)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* 内容 */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-4">
                {/* 快照摘要信息 */}
                {selectedSnapshot.action && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="text-sm font-medium text-blue-900 mb-2">操作信息</div>
                    <div className="text-sm text-blue-700">
                      <strong>操作类型：</strong>{selectedSnapshot.action}
                    </div>
                    {selectedSnapshot.operatorName && (
                      <div className="text-sm text-blue-700 mt-1">
                        <strong>操作人：</strong>{selectedSnapshot.operatorName}
                      </div>
                    )}
                    {selectedSnapshot.operatedAt && (
                      <div className="text-sm text-blue-700 mt-1">
                        <strong>操作时间：</strong>{formatTime(selectedSnapshot.operatedAt)}
                      </div>
                    )}
                  </div>
                )}

                {/* 引擎派发结果 */}
                {selectedSnapshot.dispatchResult && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="text-sm font-medium text-green-900 mb-2">引擎派发结果</div>
                    {selectedSnapshot.dispatchResult.assignedTo && (
                      <div className="text-sm text-green-700">
                        <strong>指派给：</strong>
                        {Array.isArray(selectedSnapshot.dispatchResult.assignedTo) 
                          ? selectedSnapshot.dispatchResult.assignedTo.join(', ')
                          : selectedSnapshot.dispatchResult.assignedTo
                        }
                      </div>
                    )}
                    {selectedSnapshot.dispatchResult.ccTo && selectedSnapshot.dispatchResult.ccTo.length > 0 && (
                      <div className="text-sm text-green-700 mt-1">
                        <strong>抄送给：</strong>{selectedSnapshot.dispatchResult.ccTo.join(', ')}
                      </div>
                    )}
                    {selectedSnapshot.dispatchResult.matchedRules && (
                      <div className="text-sm text-green-700 mt-1">
                        <strong>匹配规则：</strong>{selectedSnapshot.dispatchResult.matchedRules}
                      </div>
                    )}
                  </div>
                )}

                {/* 完整JSON数据 */}
                <div>
                  <div className="text-sm font-medium text-slate-700 mb-2">完整快照数据</div>
                  <pre className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs overflow-x-auto">
                    {(() => {
                      try {
                        return JSON.stringify(selectedSnapshot, null, 2);
                      } catch (e) {
                        return `快照数据格式化失败: ${e instanceof Error ? e.message : '未知错误'}`;
                      }
                    })()}
                  </pre>
                </div>
              </div>
            </div>

            {/* 底部 */}
            <div className="px-6 py-4 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setSelectedSnapshot(null)}
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
