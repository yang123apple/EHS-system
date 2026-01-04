"use client";
import { useState, useEffect } from 'react';
import { X, Filter, Download, Eye, Calendar, User, FileText, Activity } from 'lucide-react';
import { apiFetch } from '@/lib/apiClient';

interface SystemLog {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  userId: string;
  userName: string;
  details: string;
  snapshot?: any;
  createdAt: string;
}

interface SystemLogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SystemLogModal({ isOpen, onClose }: SystemLogModalProps) {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize] = useState(20);
  
  // 筛选状态
  const [actionFilter, setActionFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [userFilter, setUserFilter] = useState('');
  
  // 快照查看
  const [viewingSnapshot, setViewingSnapshot] = useState<any>(null);
  const [showSnapshotModal, setShowSnapshotModal] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadLogs();
    }
  }, [isOpen, page, actionFilter, startDate, endDate, userFilter]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        targetType: 'training'  // 使用targetType查询培训日志
      });
      
      if (actionFilter) params.append('action', actionFilter);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (userFilter) params.append('userId', userFilter);

      const res = await apiFetch(`/api/logs?${params}`);
      const data = await res.json();
      
      if (data.success && data.data) {
        setLogs(data.data.logs || []);
        setTotal(data.data.total || 0);
      } else {
        console.error('加载日志失败:', data.error || '未知错误');
        setLogs([]);
        setTotal(0);
      }
    } catch (error) {
      console.error('加载日志失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewSnapshot = (snapshot: any) => {
    try {
      // 确保快照是对象格式
      const parsedSnapshot = typeof snapshot === 'string' ? JSON.parse(snapshot) : snapshot;
      setViewingSnapshot(parsedSnapshot);
      setShowSnapshotModal(true);
    } catch (e) {
      console.error('解析快照数据失败:', e);
      alert('快照数据格式错误，无法显示');
    }
  };

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      'training.create_material': '创建学习内容',
      'training.edit_material': '编辑学习内容',
      'training.delete_material': '删除学习内容',
      'training.create_task': '创建培训任务',
      'training.edit_task': '编辑培训任务',
      'training.delete_task': '删除培训任务',
      'training.update_settings': '更新系统设置',
      'training.complete_exam': '完成考试',
      'training.update_progress': '更新学习进度'
    };
    return labels[action] || action;
  };

  const getActionColor = (action: string) => {
    const colors: Record<string, string> = {
      'training.create_material': 'bg-green-100 text-green-700',
      'training.edit_material': 'bg-blue-100 text-blue-700',
      'training.delete_material': 'bg-red-100 text-red-700',
      'training.create_task': 'bg-purple-100 text-purple-700',
      'training.edit_task': 'bg-orange-100 text-orange-700',
      'training.delete_task': 'bg-red-100 text-red-700',
      'training.update_settings': 'bg-indigo-100 text-indigo-700',
      'training.complete_exam': 'bg-emerald-100 text-emerald-700',
      'training.update_progress': 'bg-cyan-100 text-cyan-700'
    };
    return colors[action] || 'bg-gray-100 text-gray-700';
  };

  const exportLogs = () => {
    const csv = [
      ['时间', '操作', '操作人', '详情'].join(','),
      ...logs.map(log => [
        new Date(log.createdAt).toLocaleString('zh-CN'),
        getActionLabel(log.action),
        log.userName,
        log.details.replace(/,/g, '；')
      ].join(','))
    ].join('\n');
    
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `培训系统操作日志_${new Date().toLocaleDateString()}.csv`;
    link.click();
  };

  // 计算结束日期的最小值（不能早于开始日期）
  const endDateMin = startDate || '';

  if (!isOpen) return null;

  return (
    <>
      {/* 主日志弹窗 */}
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
        <div className="bg-white rounded-xl w-full max-w-6xl h-[90vh] flex flex-col shadow-2xl">
          {/* 头部 */}
          <div className="p-6 border-b bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Activity size={24} className="text-blue-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">培训系统操作日志</h2>
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
                  onClick={onClose}
                  className="p-2 hover:bg-white/50 rounded-lg transition-colors"
                >
                  <X size={24} className="text-slate-600" />
                </button>
              </div>
            </div>

            {/* 筛选器 */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-slate-600 mb-1 block">操作类型</label>
                <select
                  value={actionFilter}
                  onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm"
                >
                  <option value="">全部操作</option>
                  <option value="create_material">创建学习内容</option>
                  <option value="edit_material">编辑学习内容</option>
                  <option value="delete_material">删除学习内容</option>
                  <option value="create_task">创建培训任务</option>
                  <option value="edit_task">编辑培训任务</option>
                  <option value="delete_task">删除培训任务</option>
                  <option value="update_settings">更新系统设置</option>
                  <option value="complete_exam">完成考试</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-600 mb-1 block">开始时间</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setPage(1);
                  }}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="text-xs text-slate-600 mb-1 block">结束时间</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setPage(1);
                  }}
                  min={endDateMin}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm"
                />
              </div>

              <div className="flex items-end">
                {(actionFilter || startDate || endDate) && (
                  <button
                    onClick={() => {
                      setActionFilter('');
                      setStartDate('');
                      setEndDate('');
                      setPage(1);
                    }}
                    className="w-full px-3 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 text-sm"
                  >
                    清空筛选
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 日志列表 */}
          <div className="flex-1 overflow-y-auto p-6">
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
                    className="bg-white border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getActionColor(log.action)}`}>
                            {getActionLabel(log.action)}
                          </span>
                          <span className="text-xs text-slate-400">
                            {new Date(log.createdAt).toLocaleString('zh-CN')}
                          </span>
                        </div>
                        
                        <p className="text-sm text-slate-700 mb-2" title={log.details || ''}>
                          {log.details || '-'}
                        </p>
                        
                        <div className="flex items-center gap-4 text-xs text-slate-500">
                          <div className="flex items-center gap-1">
                            <User size={12} />
                            {log.userName}
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar size={12} />
                            {new Date(log.createdAt).toLocaleDateString('zh-CN')}
                          </div>
                        </div>
                      </div>

                      {log.snapshot && (typeof log.snapshot === 'object' ? Object.keys(log.snapshot).length > 0 : log.snapshot) && (
                        <button
                          onClick={() => handleViewSnapshot(log.snapshot)}
                          className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 text-xs font-medium flex items-center gap-1 shrink-0"
                        >
                          <Eye size={14} />
                          查看快照
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 分页 */}
          {total > pageSize && (
            <div className="p-4 border-t bg-slate-50 rounded-b-xl">
              <div className="flex items-center justify-between">
                <div className="text-sm text-slate-600">
                  共 {total} 条，第 {page} / {Math.ceil(total / pageSize)} 页
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-4 py-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    上一页
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(Math.ceil(total / pageSize), p + 1))}
                    disabled={page >= Math.ceil(total / pageSize)}
                    className="px-4 py-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    下一页
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 快照查看弹窗 */}
      {showSnapshotModal && viewingSnapshot && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-3xl max-h-[80vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-gradient-to-r from-indigo-50 to-purple-50 p-4 border-b rounded-t-xl flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">操作快照详情</h3>
              <button
                onClick={() => setShowSnapshotModal(false)}
                className="p-1 hover:bg-white/50 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* 基本信息 */}
              {viewingSnapshot.action && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="text-sm font-bold text-blue-900 mb-2">操作信息</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-slate-600">操作类型：</span>
                      <span className="font-medium">{getActionLabel(viewingSnapshot.action)}</span>
                    </div>
                    {viewingSnapshot.userName && (
                      <div>
                        <span className="text-slate-600">操作人：</span>
                        <span className="font-medium">{viewingSnapshot.userName}</span>
                      </div>
                    )}
                    {viewingSnapshot.timestamp && (
                      <div>
                        <span className="text-slate-600">操作时间：</span>
                        <span className="font-medium">
                          {new Date(viewingSnapshot.timestamp).toLocaleString('zh-CN')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 完整JSON数据 */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <h4 className="text-sm font-bold text-slate-900 mb-2">完整快照数据</h4>
                <pre className="text-xs bg-slate-900 text-green-400 p-4 rounded-lg overflow-x-auto font-mono">
                  {(() => {
                    try {
                      return JSON.stringify(viewingSnapshot, null, 2);
                    } catch (e) {
                      return `快照数据格式化失败: ${e instanceof Error ? e.message : '未知错误'}`;
                    }
                  })()}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

