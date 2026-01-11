'use client';

/**
 * 事故上报模态框
 */

import { useState } from 'react';
import { X, Upload, Camera } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { reportIncident } from '@/actions/incident';
import { IncidentTypeLabels, IncidentSeverityLabels } from '@/types/incident';
import FileUploader from '@/components/storage/FileUploader';
import PeopleSelector from '@/components/common/PeopleSelector';

interface IncidentReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function IncidentReportModal({ isOpen, onClose }: IncidentReportModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    type: 'injury' as 'injury' | 'near_miss' | 'property_damage' | 'environmental',
    severity: 'minor' as 'minor' | 'moderate' | 'serious' | 'critical',
    occurredAt: '',
    location: '',
    description: '',
    departmentId: '',
    departmentName: '',
  });
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
  const [uploadedAttachments, setUploadedAttachments] = useState<string[]>([]);
  const [showDeptSelector, setShowDeptSelector] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!formData.occurredAt || !formData.location || !formData.description) {
      alert('请填写完整的事故信息');
      return;
    }

    setLoading(true);
    try {
      const result = await reportIncident(
        {
          ...formData,
          occurredAt: new Date(formData.occurredAt),
          reporterId: user.id,
          photos: uploadedPhotos,
          attachments: uploadedAttachments,
        },
        user.id
      );

      if (result.success) {
        alert('事故上报成功');
        onClose();
        // 重置表单
        setFormData({
          type: 'injury',
          severity: 'minor',
          occurredAt: '',
          location: '',
          description: '',
          departmentId: '',
          departmentName: '',
        });
        setUploadedPhotos([]);
        setUploadedAttachments([]);
      } else {
        alert(result.error || '上报失败，请重试');
      }
    } catch (error) {
      console.error('上报事故失败:', error);
      alert('上报失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* 头部 */}
        <div className="p-6 border-b flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800">上报事故</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
          >
            <X size={24} />
          </button>
        </div>

        {/* 表单内容 */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* 事故类型 */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              事故类型 <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
              className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              {Object.entries(IncidentTypeLabels).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          {/* 严重程度 */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              严重程度 <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.severity}
              onChange={(e) => setFormData({ ...formData, severity: e.target.value as any })}
              className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              {Object.entries(IncidentSeverityLabels).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          {/* 发生时间 */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              发生时间 <span className="text-red-500">*</span>
            </label>
            <input
              type="datetime-local"
              value={formData.occurredAt}
              onChange={(e) => setFormData({ ...formData, occurredAt: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* 发生地点 */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              发生地点 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="请输入事故发生地点"
              required
            />
          </div>

          {/* 事故描述 */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              事故描述 <span className="text-red-500">*</span>
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
              rows={4}
              placeholder="请详细描述事故情况"
              required
            />
          </div>

          {/* 责任部门（可选） */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              责任部门
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={formData.departmentName || ''}
                readOnly
                className="flex-1 px-3 py-2 border rounded-lg outline-none bg-slate-50 cursor-pointer"
                placeholder="点击选择部门（可选）"
                onClick={() => setShowDeptSelector(true)}
              />
              {formData.departmentId && (
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, departmentId: '', departmentName: '' })}
                  className="px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 text-sm"
                >
                  清除
                </button>
              )}
            </div>
          </div>

          {/* 现场照片 */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              现场照片
            </label>
            <FileUploader
              bucket="private"
              prefix="incidents/photos"
              accept="image/*"
              multiple={true}
              onUploadSuccess={(objectName, url) => {
                // objectName 是 MinIO 路径，需要格式化为 dbRecord 格式
                const dbRecord = `private:${objectName}`;
                setUploadedPhotos(prev => [...prev, dbRecord]);
              }}
            />
            {uploadedPhotos.length > 0 && (
              <div className="mt-2 text-sm text-slate-500">
                已上传 {uploadedPhotos.length} 张照片
              </div>
            )}
          </div>

          {/* 其他附件 */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              其他附件
            </label>
            <FileUploader
              bucket="private"
              prefix="incidents/attachments"
              accept=".pdf,.doc,.docx"
              multiple={true}
              onUploadSuccess={(objectName, url) => {
                const dbRecord = `private:${objectName}`;
                setUploadedAttachments(prev => [...prev, dbRecord]);
              }}
            />
            {uploadedAttachments.length > 0 && (
              <div className="mt-2 text-sm text-slate-500">
                已上传 {uploadedAttachments.length} 个附件
              </div>
            )}
          </div>
        </form>

        {/* 底部按钮 */}
        <div className="p-6 border-t flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700"
            disabled={loading}
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '提交中...' : '提交上报'}
          </button>
        </div>
      </div>

      {/* 部门选择器 */}
      <PeopleSelector
        isOpen={showDeptSelector}
        onClose={() => setShowDeptSelector(false)}
        mode="dept"
        onConfirm={(selection) => {
          if (Array.isArray(selection) && selection.length > 0) {
            // @ts-ignore - selection is OrgNode[] in dept mode
            const dept = selection[0];
            setFormData({ ...formData, departmentId: dept.id, departmentName: dept.name });
          }
          setShowDeptSelector(false);
        }}
        title="选择责任部门"
      />
    </div>
  );
}

