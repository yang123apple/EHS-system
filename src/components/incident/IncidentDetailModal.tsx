'use client';

/**
 * 事故详情模态框
 * 根据状态显示不同的操作表单
 */

import { useState, useEffect } from 'react';
import { X, FileText, Calendar, MapPin, User, AlertTriangle, CheckCircle, XCircle, Upload } from 'lucide-react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { useAuth } from '@/context/AuthContext';
import { submitInvestigation, closeIncident, updateIncident } from '@/actions/incident';
import { IncidentTypeLabels, IncidentSeverityLabels, IncidentStatusLabels } from '@/types/incident';
import type { Incident } from '@/types/incident';
import FileUploader from '@/components/storage/FileUploader';
import { getIncidentById } from '@/actions/incident';
import PeopleSelector from '@/components/common/PeopleSelector';
import SignatureManager from '@/components/common/SignatureManager';

interface IncidentDetailModalProps {
  incident: Incident;
  isOpen: boolean;
  onClose: () => void;
}

export default function IncidentDetailModal({ incident: initialIncident, isOpen, onClose }: IncidentDetailModalProps) {
  const { user } = useAuth();
  const [incident, setIncident] = useState<Incident>(initialIncident);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'basic' | 'investigation' | 'actions'>('basic');
  const [showUserSelector, setShowUserSelector] = useState(false);
  const [signatureValue, setSignatureValue] = useState<string>('');

  // 调查表单数据
  const [investigationData, setInvestigationData] = useState({
    directCause: '',
    indirectCause: '',
    managementCause: '',
    rootCause: '',
    correctiveActions: [{ action: '', deadline: '', responsibleId: '' }],
    preventiveActions: [{ action: '', deadline: '', responsibleId: '' }],
    actionDeadline: '',
    actionResponsibleId: '',
    actionResponsibleName: '',
    investigationReport: '',
    photos: [] as string[],
    attachments: [] as string[],
  });

  // 刷新事故数据
  useEffect(() => {
    if (isOpen) {
      refreshIncident();
    }
  }, [isOpen, initialIncident.id]);

  const refreshIncident = async () => {
    try {
      const updated = await getIncidentById(initialIncident.id);
      setIncident(updated as any);
      
      // 如果已有调查数据，填充表单
      if (updated.directCause) {
        setInvestigationData({
          directCause: updated.directCause || '',
          indirectCause: updated.indirectCause || '',
          managementCause: updated.managementCause || '',
          rootCause: updated.rootCause || '',
          correctiveActions: updated.correctiveActions ? JSON.parse(updated.correctiveActions) : [{ action: '', deadline: '', responsibleId: '' }],
          preventiveActions: updated.preventiveActions ? JSON.parse(updated.preventiveActions) : [{ action: '', deadline: '', responsibleId: '' }],
          actionDeadline: updated.actionDeadline ? format(new Date(updated.actionDeadline), "yyyy-MM-dd'T'HH:mm") : '',
          actionResponsibleId: updated.actionResponsibleId || '',
          actionResponsibleName: updated.actionResponsibleName || '',
          investigationReport: updated.investigationReport || '',
          photos: updated.photos ? JSON.parse(updated.photos) : [],
          attachments: updated.attachments ? JSON.parse(updated.attachments) : [],
        });
      }
    } catch (error) {
      console.error('获取事故详情失败:', error);
    }
  };

  // 提交调查报告
  const handleSubmitInvestigation = async () => {
    if (!user) return;

    if (!investigationData.directCause || !investigationData.indirectCause || 
        !investigationData.managementCause || !investigationData.rootCause) {
      alert('请填写完整的调查信息（直接原因、间接原因、管理原因、根本原因）');
      return;
    }

    if (!investigationData.actionDeadline || !investigationData.actionResponsibleId) {
      alert('请设置整改期限和负责人');
      return;
    }

    if (!signatureValue) {
      alert('请先进行数字签名');
      return;
    }

    setLoading(true);
    try {
      const result = await submitInvestigation(
        incident.id,
        {
          ...investigationData,
          actionDeadline: new Date(investigationData.actionDeadline),
          correctiveActions: investigationData.correctiveActions
            .filter(a => a.action.trim())
            .map(a => ({
              action: a.action,
              deadline: a.deadline ? new Date(a.deadline) : undefined,
              responsibleId: a.responsibleId || undefined,
            })),
          preventiveActions: investigationData.preventiveActions
            .filter(a => a.action.trim())
            .map(a => ({
              action: a.action,
              deadline: a.deadline ? new Date(a.deadline) : undefined,
              responsibleId: a.responsibleId || undefined,
            })),
          signature: signatureValue, // 传递签名数据
        },
        user.id
      );

      if (result.success) {
        alert('调查报告提交成功，等待审批');
        await refreshIncident();
        setActiveTab('basic');
        setSignatureValue(''); // 重置签名
      } else {
        alert(result.error || '提交失败，请重试');
      }
    } catch (error) {
      console.error('提交调查报告失败:', error);
      alert('提交失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  // 结案事故
  const handleCloseIncident = async () => {
    if (!user) return;

    const reason = prompt('请输入结案原因：');
    if (!reason || reason.trim().length === 0) {
      return;
    }

    setLoading(true);
    try {
      const result = await closeIncident(incident.id, reason, user.id);

      if (result.success) {
        alert('事故已结案');
        await refreshIncident();
      } else {
        alert(result.error || '结案失败，请重试');
      }
    } catch (error) {
      console.error('结案事故失败:', error);
      alert('结案失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const photos = incident.photos ? JSON.parse(incident.photos) : [];
  const attachments = incident.attachments ? JSON.parse(incident.attachments) : [];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* 头部 */}
        <div className="p-6 border-b flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-800">事故详情</h2>
            <p className="text-sm text-slate-500 mt-1">
              编号: {incident.code || incident.id.slice(0, 8)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
          >
            <X size={24} />
          </button>
        </div>

        {/* 标签页 */}
        <div className="border-b flex gap-4 px-6">
          <button
            onClick={() => setActiveTab('basic')}
            className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'basic' 
                ? 'border-blue-600 text-blue-600' 
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            基本信息
          </button>
          {(incident.status === 'reported' || incident.status === 'investigating') && (
            <button
              onClick={() => setActiveTab('investigation')}
              className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'investigation' 
                  ? 'border-blue-600 text-blue-600' 
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              调查报告
            </button>
          )}
          {incident.status === 'reviewed' && user?.role === 'admin' && (
            <button
              onClick={() => setActiveTab('actions')}
              className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'actions' 
                  ? 'border-blue-600 text-blue-600' 
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              审批操作
            </button>
          )}
        </div>

        {/* 内容区域 */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'basic' && (
            <div className="space-y-6">
              {/* 状态标签 */}
              <div className="flex items-center gap-4">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  incident.status === 'reported' ? 'bg-blue-100 text-blue-700' :
                  incident.status === 'investigating' ? 'bg-yellow-100 text-yellow-700' :
                  incident.status === 'reviewed' ? 'bg-purple-100 text-purple-700' :
                  incident.status === 'closed' ? 'bg-green-100 text-green-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {IncidentStatusLabels[incident.status as keyof typeof IncidentStatusLabels]}
                </span>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  incident.severity === 'minor' ? 'bg-green-100 text-green-700' :
                  incident.severity === 'moderate' ? 'bg-yellow-100 text-yellow-700' :
                  incident.severity === 'serious' ? 'bg-orange-100 text-orange-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {IncidentSeverityLabels[incident.severity as keyof typeof IncidentSeverityLabels]}
                </span>
              </div>

              {/* 基本信息网格 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-lg">
                  <div className="text-sm text-slate-500 mb-1">事故类型</div>
                  <div className="font-medium text-slate-900">
                    {IncidentTypeLabels[incident.type as keyof typeof IncidentTypeLabels]}
                  </div>
                </div>
                <div className="bg-slate-50 p-4 rounded-lg">
                  <div className="text-sm text-slate-500 mb-1">发生时间</div>
                  <div className="font-medium text-slate-900">
                    {format(new Date(incident.occurredAt), 'yyyy-MM-dd HH:mm', { locale: zhCN })}
                  </div>
                </div>
                <div className="bg-slate-50 p-4 rounded-lg col-span-2">
                  <div className="text-sm text-slate-500 mb-1">发生地点</div>
                  <div className="font-medium text-slate-900">{incident.location}</div>
                </div>
                <div className="bg-slate-50 p-4 rounded-lg">
                  <div className="text-sm text-slate-500 mb-1">上报人</div>
                  <div className="font-medium text-slate-900">{incident.reporterName}</div>
                </div>
                <div className="bg-slate-50 p-4 rounded-lg">
                  <div className="text-sm text-slate-500 mb-1">上报时间</div>
                  <div className="font-medium text-slate-900">
                    {format(new Date(incident.reportTime), 'yyyy-MM-dd HH:mm', { locale: zhCN })}
                  </div>
                </div>
              </div>

              {/* 事故描述 */}
              <div>
                <h3 className="text-lg font-semibold text-slate-800 mb-3">事故描述</h3>
                <div className="bg-slate-50 p-4 rounded-lg text-slate-700 whitespace-pre-wrap">
                  {incident.description}
                </div>
              </div>

              {/* 调查详情（如果有） */}
              {incident.rootCause && (
                <div>
                  <h3 className="text-lg font-semibold text-slate-800 mb-3">调查详情</h3>
                  <div className="space-y-4">
                    <div>
                      <div className="text-sm font-medium text-slate-700 mb-1">直接原因</div>
                      <div className="bg-slate-50 p-3 rounded-lg text-slate-700">{incident.directCause}</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-slate-700 mb-1">间接原因</div>
                      <div className="bg-slate-50 p-3 rounded-lg text-slate-700">{incident.indirectCause}</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-slate-700 mb-1">管理原因</div>
                      <div className="bg-slate-50 p-3 rounded-lg text-slate-700">{incident.managementCause}</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-slate-700 mb-1">根本原因</div>
                      <div className="bg-slate-50 p-3 rounded-lg text-slate-700">{incident.rootCause}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* 整改措施（如果有） */}
              {incident.correctiveActions && (
                <div>
                  <h3 className="text-lg font-semibold text-slate-800 mb-3">整改措施</h3>
                  <div className="space-y-3">
                    {JSON.parse(incident.correctiveActions).map((action: any, index: number) => (
                      <div key={index} className="bg-slate-50 p-3 rounded-lg">
                        <div className="font-medium text-slate-900">{action.action}</div>
                        {action.deadline && (
                          <div className="text-sm text-slate-500 mt-1">
                            期限: {format(new Date(action.deadline), 'yyyy-MM-dd')}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 现场照片 */}
              {photos.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-slate-800 mb-3">现场照片</h3>
                  <div className="grid grid-cols-3 gap-4">
                    {photos.map((photo: string, index: number) => (
                      <img
                        key={index}
                        src={photo}
                        alt={`现场照片 ${index + 1}`}
                        className="w-full h-32 object-cover rounded-lg border border-slate-200"
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* 附件 */}
              {attachments.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-slate-800 mb-3">附件</h3>
                  <div className="space-y-2">
                    {attachments.map((attachment: string, index: number) => (
                      <a
                        key={index}
                        href={attachment}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-blue-600 hover:text-blue-700"
                      >
                        <FileText size={16} />
                        <span>附件 {index + 1}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 调查报告表单 */}
          {activeTab === 'investigation' && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-blue-800">
                  请根据5Why分析法填写调查信息，包括直接原因、间接原因、管理原因和根本原因。
                </p>
              </div>

              {/* 直接原因 */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  直接原因 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={investigationData.directCause}
                  onChange={(e) => setInvestigationData({ ...investigationData, directCause: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="描述导致事故发生的直接原因"
                  required
                />
              </div>

              {/* 间接原因 */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  间接原因 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={investigationData.indirectCause}
                  onChange={(e) => setInvestigationData({ ...investigationData, indirectCause: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="描述导致事故发生的间接原因"
                  required
                />
              </div>

              {/* 管理原因 */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  管理原因 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={investigationData.managementCause}
                  onChange={(e) => setInvestigationData({ ...investigationData, managementCause: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="描述管理层面的原因"
                  required
                />
              </div>

              {/* 根本原因 */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  根本原因 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={investigationData.rootCause}
                  onChange={(e) => setInvestigationData({ ...investigationData, rootCause: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                  rows={4}
                  placeholder="综合分析得出的根本原因"
                  required
                />
              </div>

              {/* 纠正措施 */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  纠正措施 <span className="text-red-500">*</span>
                </label>
                {investigationData.correctiveActions.map((action, index) => (
                  <div key={index} className="mb-3 p-3 border rounded-lg">
                    <textarea
                      value={action.action}
                      onChange={(e) => {
                        const newActions = [...investigationData.correctiveActions];
                        newActions[index].action = e.target.value;
                        setInvestigationData({ ...investigationData, correctiveActions: newActions });
                      }}
                      className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 mb-2"
                      rows={2}
                      placeholder="描述纠正措施"
                    />
                    <div className="flex gap-2">
                      <input
                        type="datetime-local"
                        value={action.deadline}
                        onChange={(e) => {
                          const newActions = [...investigationData.correctiveActions];
                          newActions[index].deadline = e.target.value;
                          setInvestigationData({ ...investigationData, correctiveActions: newActions });
                        }}
                        className="flex-1 px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="完成期限"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const newActions = investigationData.correctiveActions.filter((_, i) => i !== index);
                          setInvestigationData({ ...investigationData, correctiveActions: newActions });
                        }}
                        className="px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setInvestigationData({
                      ...investigationData,
                      correctiveActions: [...investigationData.correctiveActions, { action: '', deadline: '', responsibleId: '' }]
                    });
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 text-sm"
                >
                  + 添加纠正措施
                </button>
              </div>

              {/* 预防措施 */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  预防措施
                </label>
                {investigationData.preventiveActions.map((action, index) => (
                  <div key={index} className="mb-3 p-3 border rounded-lg">
                    <textarea
                      value={action.action}
                      onChange={(e) => {
                        const newActions = [...investigationData.preventiveActions];
                        newActions[index].action = e.target.value;
                        setInvestigationData({ ...investigationData, preventiveActions: newActions });
                      }}
                      className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 mb-2"
                      rows={2}
                      placeholder="描述预防措施"
                    />
                    <div className="flex gap-2">
                      <input
                        type="datetime-local"
                        value={action.deadline}
                        onChange={(e) => {
                          const newActions = [...investigationData.preventiveActions];
                          newActions[index].deadline = e.target.value;
                          setInvestigationData({ ...investigationData, preventiveActions: newActions });
                        }}
                        className="flex-1 px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="完成期限"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const newActions = investigationData.preventiveActions.filter((_, i) => i !== index);
                          setInvestigationData({ ...investigationData, preventiveActions: newActions });
                        }}
                        className="px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setInvestigationData({
                      ...investigationData,
                      preventiveActions: [...investigationData.preventiveActions, { action: '', deadline: '', responsibleId: '' }]
                    });
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 text-sm"
                >
                  + 添加预防措施
                </button>
              </div>

              {/* 整改期限和负责人 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    整改期限 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={investigationData.actionDeadline}
                    onChange={(e) => setInvestigationData({ ...investigationData, actionDeadline: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    负责人 <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={investigationData.actionResponsibleName || ''}
                      readOnly
                      className="flex-1 px-3 py-2 border rounded-lg outline-none bg-slate-50 cursor-pointer"
                      placeholder="点击选择负责人"
                      onClick={() => setShowUserSelector(true)}
                      required
                    />
                    {investigationData.actionResponsibleId && (
                      <button
                        type="button"
                        onClick={() => setInvestigationData({ ...investigationData, actionResponsibleId: '', actionResponsibleName: '' })}
                        className="px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 text-sm"
                      >
                        清除
                      </button>
                    )}
                  </div>
                  {/* 隐藏的负责人ID字段（用于提交） */}
                  <input
                    type="hidden"
                    value={investigationData.actionResponsibleId}
                    required
                  />
                </div>
              </div>

              {/* 数字签名 */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  调查报告签名 <span className="text-red-500">*</span>
                </label>
                <div className="border rounded-lg p-4 bg-slate-50">
                  <SignatureManager
                    value={signatureValue}
                    onChange={(value) => setSignatureValue(Array.isArray(value) ? value[0] : value)}
                    allowMultiple={false}
                    readonly={false}
                  />
                  {!signatureValue && (
                    <p className="text-sm text-slate-500 mt-2">
                      请在上方签名，签名后将用于调查报告的电子签名记录
                    </p>
                  )}
                </div>
              </div>

              {/* 调查报告文件 */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  调查报告
                </label>
                <FileUploader
                  bucket="private"
                  prefix="incidents/reports"
                  accept=".pdf,.doc,.docx"
                  onUploadSuccess={(objectName, url) => {
                    const dbRecord = `private:${objectName}`;
                    setInvestigationData({ ...investigationData, investigationReport: dbRecord });
                  }}
                />
                {investigationData.investigationReport && (
                  <div className="mt-2 text-sm text-green-600">
                    调查报告已上传
                  </div>
                )}
              </div>

              {/* 调查照片 */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  调查照片
                </label>
                <FileUploader
                  bucket="private"
                  prefix="incidents/photos"
                  accept="image/*"
                  multiple={true}
                  onUploadSuccess={(objectName, url) => {
                    const dbRecord = `private:${objectName}`;
                    setInvestigationData({
                      ...investigationData,
                      photos: [...investigationData.photos, dbRecord]
                    });
                  }}
                />
                {investigationData.photos.length > 0 && (
                  <div className="mt-2 text-sm text-slate-500">
                    已上传 {investigationData.photos.length} 张照片
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 审批操作 */}
          {activeTab === 'actions' && incident.status === 'reviewed' && (
            <div className="space-y-6">
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <p className="text-sm text-purple-800">
                  调查报告已提交，请审批。审批通过后可以结案。
                </p>
              </div>

              {incident.reviewComment && (
                <div>
                  <h3 className="text-lg font-semibold text-slate-800 mb-2">审批意见</h3>
                  <div className="bg-slate-50 p-4 rounded-lg text-slate-700">
                    {incident.reviewComment}
                  </div>
                  <div className="text-sm text-slate-500 mt-2">
                    审批人: {incident.reviewerName} | 审批时间: {incident.reviewTime ? format(new Date(incident.reviewTime), 'yyyy-MM-dd HH:mm', { locale: zhCN }) : ''}
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleCloseIncident}
                  disabled={loading}
                  className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {loading ? '处理中...' : '审批通过并结案'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="p-6 border-t flex justify-end gap-3">
          {activeTab === 'investigation' && (incident.status === 'reported' || incident.status === 'investigating') && (
            <button
              onClick={handleSubmitInvestigation}
              disabled={loading}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {loading ? '提交中...' : '提交调查报告'}
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700"
          >
            关闭
          </button>
        </div>
      </div>

      {/* 用户选择器 */}
      <PeopleSelector
        isOpen={showUserSelector}
        onClose={() => setShowUserSelector(false)}
        mode="dept_then_user"
        multiSelect={false}
        onConfirm={(selection) => {
          if (Array.isArray(selection) && selection.length > 0) {
            // @ts-ignore - selection is UserLite[] in dept_then_user mode
            const selectedUser = selection[0];
            setInvestigationData({
              ...investigationData,
              actionResponsibleId: selectedUser.id,
              actionResponsibleName: selectedUser.name,
            });
          }
          setShowUserSelector(false);
        }}
        title="选择整改负责人"
      />
    </div>
  );
}

