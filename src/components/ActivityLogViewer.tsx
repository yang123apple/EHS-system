// src/components/ActivityLogViewer.tsx
/**
 * 增强的活动日志查看器组件
 * 支持查看用户快照、字段变更对比等详细信息
 */

"use client";

import { useState, useEffect } from 'react';
import { 
  X, Filter, Download, Eye, Calendar, User, FileText, 
  Activity, ChevronDown, ChevronUp, RefreshCw, Search 
} from 'lucide-react';
import { apiFetch } from '@/lib/apiClient';

interface FieldChange {
  field: string;
  fieldLabel?: string;
  oldValue: any;
  newValue: any;
  changeType: 'added' | 'modified' | 'deleted';
}

interface ActivityLog {
  id: string;
  // 用户信息
  userId?: string;
  userName?: string;
  userRole?: string;
  userDepartment?: string;
  userJobTitle?: string;
  
  // 操作信息
  action: string;
  actionLabel?: string;
  module?: string;
  
  // 目标对象
  targetId?: string;
  targetType?: string;
  targetLabel?: string;
  
  // 详情
  details?: string;
  beforeData?: any;
  afterData?: any;
  changes?: FieldChange[];
  snapshot?: any;
  
  // 其他
  ip?: string;
  userAgent?: string;
  createdAt: string;
}

interface ActivityLogViewerProps {
  targetType?: string;  // 如果指定，只显示特定类型的日志
  targetId?: string;    // 如果指定，只显示特定对象的日志
  module?: string;      // 如果指定，只显示特定模块的日志
  showFilters?: boolean;
  pageSize?: number;
}

export default function ActivityLogViewer({
  targetType,
  targetId,
  module,
  showFilters = true,
  pageSize = 20,
}: ActivityLogViewerProps) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  // 筛选条件
  const [actionFilter, setActionFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // 详情查看
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [viewingDetail, setViewingDetail] = useState<ActivityLog | null>(null);

  useEffect(() => {
    loadLogs();
  }, [page, actionFilter, userFilter, startDate, endDate, targetType, targetId, module]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
      });

      if (targetType) params.append('targetType', targetType);
      if (targetId) params.append('targetId', targetId);
      if (module) params.append('module', module);
      if (actionFilter) params.append('action', actionFilter);
      if (userFilter) params.append('userId', userFilter);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const res = await apiFetch(`/api/logs?${params}`);
      const data = await res.json();

      if (data.success && data.data) {
        setLogs(data.data.logs || []);
        setTotal(data.data.total || 0);
      } else {
        console.error('加载日志失败:', data.error);
        setLogs([]);
        setTotal(0);
      }
    } catch (error) {
      console.error('加载日志失败:', error);
      setLogs([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  const getActionColor = (action: string) => {
    const colorMap: Record<string, string> = {
      CREATE: 'bg-green-100 text-green-700',
      UPDATE: 'bg-blue-100 text-blue-700',
      DELETE: 'bg-red-100 text-red-700',
      APPROVE: 'bg-purple-100 text-purple-700',
      REJECT: 'bg-orange-100 text-orange-700',
      EXPORT: 'bg-indigo-100 text-indigo-700',
      IMPORT: 'bg-teal-100 text-teal-700',
      LOGIN: 'bg-slate-100 text-slate-700',
      LOGOUT: 'bg-slate-100 text-slate-700',
    };
    return colorMap[action] || 'bg-slate-100 text-slate-700';
  };

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
  };

  const exportLogs = () => {
    const csv = [
      ['时间', '操作人', '角色', '部门', '操作类型', '模块', '目标对象', '详情'].join(','),
      ...logs.map(log => [
        new Date(log.createdAt).toLocaleString('zh-CN'),
        log.userName || '-',
        log.userRole || '-',
        log.userDepartment || '-',
        log.actionLabel || log.action,
        log.module || '-',
        log.targetLabel || log.targetType || '-',
        (log.details || '').replace(/,/g, '；')
      ].join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `活动日志_${new Date().toLocaleDateString()}.csv`;
    link.click();
  };

  return (
    <div className="flex flex-col h-full">
      {/* 头部 */}
      <div className="p-6 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Activity size={24} className="text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">操作日志</h2>
              <p className="text-sm text-slate-600">共 {total} 条记录</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportLogs}
              className="px-4 py-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 flex items-center gap-2 text-sm"
            >
              <Download size={16} />
              导出
            </button>
            <button
              onClick={loadLogs}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm disabled:opacity-50"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              刷新
            </button>
          </div>
        </div>

        {/* 筛选条件 */}
        {showFilters && (
          <div className="grid grid-cols-4 gap-3">
            <input
              type="text"
              placeholder="搜索操作类型"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
            <input
              type="text"
              placeholder="搜索用户"
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
            <input
              type="date"
              placeholder="开始日期"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
            <input
              type="date"
              placeholder="结束日期"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate || ''}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>
        )}
      </div>

      {/* 日志列表 */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="text-center py-20">
            <div className="inline-block w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
            <p className="text-slate-500 mt-4">加载中...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-20">
            <FileText size={48} className="mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500">暂无操作日志</p>
          </div>
        ) : (
          <div className="space-y-3">
            {logs.map((log) => (
              <div
                key={log.id}
                className="bg-white border border-slate-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* 第一行：操作类型和时间 */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getActionColor(log.action)}`}>
                          {log.actionLabel || log.action}
                        </span>
                        {log.module && (
                          <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs">
                            {log.module}
                          </span>
                        )}
                        <span className="text-xs text-slate-500">
                          {new Date(log.createdAt).toLocaleString('zh-CN')}
                        </span>
                      </div>

                      {/* 第二行：用户信息 */}
                      <div className="flex items-center gap-4 text-sm text-slate-600 mb-2">
                        <div className="flex items-center gap-1">
                          <User size={14} />
                          <span className="font-medium">{log.userName || '未知用户'}</span>
                        </div>
                        {log.userRole && (
                          <span className="text-xs">角色：{log.userRole}</span>
                        )}
                        {log.userDepartment && (
                          <span className="text-xs">部门：{log.userDepartment}</span>
                        )}
                        {log.userJobTitle && (
                          <span className="text-xs">职位：{log.userJobTitle}</span>
                        )}
                      </div>

                      {/* 第三行：操作详情 */}
                      <div className="text-sm text-slate-700">
                        {log.targetLabel && (
                          <span className="font-medium">{log.targetLabel}</span>
                        )}
                        {log.details && (
                          <span className="ml-2">{log.details}</span>
                        )}
                      </div>

                      {/* 变更数量提示 */}
                      {log.changes && log.changes.length > 0 && (
                        <div className="mt-2 text-xs text-blue-600">
                          变更了 {log.changes.length} 个字段
                        </div>
                      )}
                    </div>

                    {/* 操作按钮 */}
                    <div className="flex items-center gap-2">
                      {(log.changes && log.changes.length > 0 || log.beforeData || log.afterData) && (
                        <button
                          onClick={() => setViewingDetail(log)}
                          className="px-3 py-1 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
                        >
                          <Eye size={14} className="inline mr-1" />
                          查看详情
                        </button>
                      )}
                      <button
                        onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                        className="p-2 hover:bg-slate-100 rounded"
                      >
                        {expandedLogId === log.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </div>
                  </div>

                  {/* 展开的详细信息 */}
                  {expandedLogId === log.id && (
                    <div className="mt-4 pt-4 border-t border-slate-200 space-y-3">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-slate-500">操作人ID：</span>
                          <span className="font-mono">{log.userId || '-'}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">目标ID：</span>
                          <span className="font-mono">{log.targetId || '-'}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">IP地址：</span>
                          <span className="font-mono">{log.ip || '-'}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">目标类型：</span>
                          <span>{log.targetType || '-'}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 分页 */}
        {!loading && logs.length > 0 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 border border-slate-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
            >
              上一页
            </button>
            <span className="px-4 py-2 text-sm text-slate-600">
              第 {page} 页，共 {Math.ceil(total / pageSize)} 页
            </span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={page >= Math.ceil(total / pageSize)}
              className="px-4 py-2 border border-slate-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
            >
              下一页
            </button>
          </div>
        )}
      </div>

      {/* 详情弹窗 */}
      {viewingDetail && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">
            {/* 弹窗头部 */}
            <div className="p-6 border-b">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">操作详情</h3>
                  <p className="text-sm text-slate-500 mt-1">
                    {new Date(viewingDetail.createdAt).toLocaleString('zh-CN')}
                  </p>
                </div>
                <button
                  onClick={() => setViewingDetail(null)}
                  className="p-2 hover:bg-slate-100 rounded-full"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* 弹窗内容 */}
            <div className="flex-1 overflow-auto p-6 space-y-6">
              {/* 用户信息 */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="text-sm font-bold text-blue-900 mb-3">操作人信息</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-slate-600">姓名：</span>
                    <span className="font-medium">{viewingDetail.userName || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-600">角色：</span>
                    <span className="font-medium">{viewingDetail.userRole || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-600">部门：</span>
                    <span className="font-medium">{viewingDetail.userDepartment || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-600">职位：</span>
                    <span className="font-medium">{viewingDetail.userJobTitle || '-'}</span>
                  </div>
                </div>
              </div>

              {/* 字段变更对比 */}
              {viewingDetail.changes && viewingDetail.changes.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <h4 className="text-sm font-bold text-amber-900 mb-3">字段变更</h4>
                  <div className="space-y-3">
                    {viewingDetail.changes.map((change, idx) => (
                      <div key={idx} className="bg-white rounded p-3 border border-amber-100">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-medium text-slate-900">
                            {change.fieldLabel || change.field}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            change.changeType === 'added' ? 'bg-green-100 text-green-700' :
                            change.changeType === 'modified' ? 'bg-blue-100 text-blue-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {change.changeType === 'added' ? '新增' : 
                             change.changeType === 'modified' ? '修改' : '删除'}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <div className="text-xs text-slate-500 mb-1">原值</div>
                            <div className="bg-red-50 rounded p-2 font-mono text-xs">
                              {formatValue(change.oldValue)}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-500 mb-1">新值</div>
                            <div className="bg-green-50 rounded p-2 font-mono text-xs">
                              {formatValue(change.newValue)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 完整数据快照 */}
              {(viewingDetail.beforeData || viewingDetail.afterData) && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <h4 className="text-sm font-bold text-slate-900 mb-3">数据快照</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {viewingDetail.beforeData && (
                      <div>
                        <div className="text-xs text-slate-500 mb-2">操作前</div>
                        <pre className="bg-white rounded p-3 text-xs overflow-auto max-h-60 border border-slate-200">
                          {JSON.stringify(viewingDetail.beforeData, null, 2)}
                        </pre>
                      </div>
                    )}
                    {viewingDetail.afterData && (
                      <div>
                        <div className="text-xs text-slate-500 mb-2">操作后</div>
                        <pre className="bg-white rounded p-3 text-xs overflow-auto max-h-60 border border-slate-200">
                          {JSON.stringify(viewingDetail.afterData, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 其他快照信息 */}
              {viewingDetail.snapshot && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <h4 className="text-sm font-bold text-slate-900 mb-3">其他信息</h4>
                  <pre className="bg-white rounded p-3 text-xs overflow-auto max-h-60 border border-slate-200">
                    {JSON.stringify(viewingDetail.snapshot, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
