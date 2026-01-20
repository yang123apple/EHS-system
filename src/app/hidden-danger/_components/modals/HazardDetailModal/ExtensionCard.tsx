// src/app/(dashboard)/hidden-danger/_components/modals/HazardDetailModal/ExtensionCard.tsx
'use client';

import { useState, useEffect } from 'react';
import { CalendarClock, AlertCircle, Check, X, Clock, Calendar } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/apiClient';
import { HazardExtension } from '@/types/hidden-danger';

interface ExtensionCardProps {
  hazard: any;
  onProcess?: (action: string, hazard: any, data?: any) => void;
  canRequest: boolean;
  canApprove: boolean;
}

export function ExtensionCard({ hazard, onProcess, canRequest, canApprove }: ExtensionCardProps) {
  const { user } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [extensionReason, setExtensionReason] = useState('');
  const [newDeadline, setNewDeadline] = useState('');
  const [extensions, setExtensions] = useState<HazardExtension[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingExtensions, setLoadingExtensions] = useState(true);

  // 加载延期记录函数（提取到组件级别以便复用）
  const loadExtensions = async () => {
    try {
      setLoadingExtensions(true);
      const response = await apiFetch(`/api/hazards/extension?hazardId=${hazard.id}`);
      const data = await response.json();
      if (data.success) {
        setExtensions(data.data || []);
      }
    } catch (error) {
      console.error('加载延期记录失败:', error);
    } finally {
      setLoadingExtensions(false);
    }
  };

  // 初始加载延期记录
  useEffect(() => {
    loadExtensions();
  }, [hazard.id]);

  // 查找待审批的延期申请
  const pendingExtension = extensions.find(ext => ext.status === 'pending');

  // 检查是否临近截止日期 (<=3天)
  const isNearDeadline = () => {
    if (!hazard.deadline) return false;
    const diff = Math.ceil((new Date(hazard.deadline).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
    return diff <= 3;
  };

  // 处理申请延期
  const handleRequestExtension = async () => {
    if (!extensionReason.trim() || !newDeadline) {
      alert('请填写延期原因和新截止日期');
      return;
    }

    if (!hazard.deadline) {
      alert('隐患没有截止日期，无法申请延期');
      return;
    }

    const oldDeadline = new Date(hazard.deadline);
    const newDeadlineDate = new Date(newDeadline);
    if (newDeadlineDate <= oldDeadline) {
      alert('新截止日期必须晚于原截止日期');
      return;
    }

    try {
      setLoading(true);
      const response = await apiFetch('/api/hazards/extension', {
        method: 'POST',
        body: {
          hazardId: hazard.id,
          newDeadline,
          reason: extensionReason.trim()
        }
      });

      const data = await response.json();
      if (data.success) {
        // 重新加载延期记录
        await loadExtensions();
        // 重置表单
        setShowForm(false);
        setExtensionReason('');
        setNewDeadline('');
        // 触发父组件刷新
        if (onProcess) {
          onProcess('request_extension', hazard, {});
        }
        alert('延期申请已提交');
      } else {
        alert(data.error || '申请延期失败');
      }
    } catch (error: any) {
      console.error('申请延期失败:', error);
      alert(error.message || '申请延期失败');
    } finally {
      setLoading(false);
    }
  };

  // 处理审批延期
  const handleApproveExtension = async (approved: boolean) => {
    if (!pendingExtension) return;

    try {
      setLoading(true);
      const response = await apiFetch('/api/hazards/extension', {
        method: 'PATCH',
        body: {
          extensionId: pendingExtension.id,
          approved
        }
      });

      const data = await response.json();
      if (data.success) {
        // 重新加载延期记录
        await loadExtensions();
        // 触发父组件刷新
        if (onProcess) {
          onProcess(approved ? 'approve_extension' : 'reject_extension', hazard, {});
        }
        alert(approved ? '已批准延期' : '已拒绝延期');
      } else {
        alert(data.error || '审批失败');
      }
    } catch (error: any) {
      console.error('审批延期失败:', error);
      alert(error.message || '审批失败');
    } finally {
      setLoading(false);
    }
  };

  // 格式化日期
  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
  };

  // 格式化日期时间
  const formatDateTime = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleString('zh-CN', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // 获取状态标签和颜色
  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'pending':
        return { label: '待审批', color: 'text-orange-600 bg-orange-50 border-orange-200' };
      case 'approved':
        return { label: '已批准', color: 'text-green-600 bg-green-50 border-green-200' };
      case 'rejected':
        return { label: '已拒绝', color: 'text-red-600 bg-red-50 border-red-200' };
      default:
        return { label: status, color: 'text-slate-600 bg-slate-50 border-slate-200' };
    }
  };

  return (
    <div className="space-y-3">
      {/* 延期申请卡片 */}
      <div className="border border-orange-200 rounded-lg bg-orange-50/50">
        {/* 待审批的延期申请 */}
        {pendingExtension && (
          <div className="p-3 space-y-3">
            <div className="flex items-center justify-between">
              <h6 className="font-bold text-sm text-orange-700 flex items-center gap-1.5">
                <CalendarClock size={16} />
                延期申请待审批
              </h6>
              <span className="text-xs px-2 py-1 rounded border bg-orange-100 text-orange-700 border-orange-300">
                待审批
              </span>
            </div>

            <div className="text-xs space-y-1.5 bg-white rounded p-2 border border-orange-100">
              <div>
                <span className="text-slate-500">原截止日期：</span>
                <span className="font-medium text-slate-800">{formatDate(pendingExtension.oldDeadline)}</span>
              </div>
              <div>
                <span className="text-slate-500">新截止日期：</span>
                <span className="font-medium text-orange-600">{formatDate(pendingExtension.newDeadline)}</span>
              </div>
              <div>
                <span className="text-slate-500">延期原因：</span>
                <span className="text-slate-800">{pendingExtension.reason}</span>
              </div>
              <div>
                <span className="text-slate-500">申请时间：</span>
                <span className="text-slate-600">{formatDateTime(pendingExtension.createdAt)}</span>
              </div>
            </div>

            {/* 审批按钮 - 仅审批人有权限 */}
            {canApprove && (
              <div className="flex gap-2 pt-2 border-t border-orange-200">
                <button
                  onClick={() => handleApproveExtension(false)}
                  disabled={loading}
                  className="flex-1 bg-red-500 text-white py-1.5 rounded text-xs font-medium hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                >
                  <X size={14} />
                  拒绝
                </button>
                <button
                  onClick={() => handleApproveExtension(true)}
                  disabled={loading}
                  className="flex-1 bg-green-500 text-white py-1.5 rounded text-xs font-medium hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                >
                  <Check size={14} />
                  同意
                </button>
              </div>
            )}
          </div>
        )}

        {/* 申请延期表单 */}
        {!pendingExtension && canRequest && (
          <>
            {!showForm ? (
              <button
                onClick={() => setShowForm(true)}
                className={`w-full p-3 border-2 border-dashed rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                  isNearDeadline()
                    ? 'border-orange-400 text-orange-600 bg-orange-50 hover:bg-orange-100'
                    : 'border-orange-300 text-orange-600 bg-white hover:bg-orange-50'
                }`}
              >
                <AlertCircle size={16} />
                申请延期
                {isNearDeadline() && <span className="text-xs">(即将到期)</span>}
              </button>
            ) : (
              <div className="p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <h6 className="font-bold text-sm text-orange-700 flex items-center gap-1.5">
                    <CalendarClock size={16} />
                    申请延期
                  </h6>
                  <button
                    onClick={() => {
                      setShowForm(false);
                      setExtensionReason('');
                      setNewDeadline('');
                    }}
                    className="text-slate-400 hover:text-slate-600 text-xs"
                  >
                    取消
                  </button>
                </div>

                <div className="space-y-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      新截止日期 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={newDeadline}
                      onChange={(e) => setNewDeadline(e.target.value)}
                      min={hazard.deadline ? new Date(hazard.deadline).toISOString().split('T')[0] : undefined}
                      className="w-full border border-slate-300 rounded p-2 text-xs focus:ring-2 focus:ring-orange-200 focus:border-orange-300 outline-none"
                    />
                    {hazard.deadline && (
                      <p className="text-xs text-slate-500 mt-1">
                        原截止日期：{formatDate(hazard.deadline)}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      延期原因 <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={extensionReason}
                      onChange={(e) => setExtensionReason(e.target.value)}
                      className="w-full border border-slate-300 rounded p-2 text-xs h-20 focus:ring-2 focus:ring-orange-200 focus:border-orange-300 outline-none resize-none"
                      placeholder="请详细说明延期原因..."
                    />
                  </div>
                </div>

                <button
                  onClick={handleRequestExtension}
                  disabled={loading || !extensionReason.trim() || !newDeadline}
                  className="w-full bg-orange-500 text-white py-2 rounded text-xs font-medium hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      提交中...
                    </>
                  ) : (
                    <>
                      <CalendarClock size={14} />
                      提交申请
                    </>
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* 延期历史记录 */}
      {extensions.length > 0 && (
        <div className="border border-slate-200 rounded-lg bg-slate-50/50">
          <div className="p-3 border-b border-slate-200">
            <h6 className="font-bold text-sm text-slate-700 flex items-center gap-1.5">
              <Clock size={16} />
              延期历史记录
            </h6>
          </div>
          <div className="p-3 space-y-2 max-h-60 overflow-y-auto">
            {loadingExtensions ? (
              <div className="text-xs text-slate-500 text-center py-4">加载中...</div>
            ) : extensions.length === 0 ? (
              <div className="text-xs text-slate-500 text-center py-4">暂无延期记录</div>
            ) : (
              extensions.map((ext) => {
                const statusInfo = getStatusInfo(ext.status);
                return (
                  <div
                    key={ext.id}
                    className="bg-white rounded border border-slate-200 p-2.5 text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className={`px-2 py-0.5 rounded border text-xs font-medium ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                      <span className="text-slate-400">{formatDateTime(ext.createdAt)}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 text-slate-600">
                      <div>
                        <span className="text-slate-500">原日期：</span>
                        <span className="font-medium">{formatDate(ext.oldDeadline)}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">新日期：</span>
                        <span className={`font-medium ${ext.status === 'approved' ? 'text-green-600' : ''}`}>
                          {formatDate(ext.newDeadline)}
                        </span>
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-500">原因：</span>
                      <span className="text-slate-800">{ext.reason}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
