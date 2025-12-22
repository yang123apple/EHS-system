import { useState, useRef } from 'react';
import { Hash, Paperclip, X, Briefcase } from 'lucide-react';
import { ProjectService } from '@/services/workPermitService';
import DepartmentSelectModal from './DepartmentSelectModal';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function NewProjectModal({ isOpen, onClose, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  // 🟢 新增：部门选择弹窗状态
  const [showDeptModal, setShowDeptModal] = useState(false);
  // 🟢 新增：附件状态
  const [attachments, setAttachments] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: '',
    location: '',
    startDate: '',
    endDate: '',
    requestDept: '',     // 存储部门名称
    requestDeptId: '',   // 存储部门ID (可选，如果后端支持)
    supplierName: '',
  });

  // 🟢 处理附件选择
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.size > 50 * 1024 * 1024) {
        alert('附件大小不能超过 50MB');
        return;
      }
      const reader = new FileReader();
      reader.onload = (evt) => {
        setAttachments((prev) => [
          ...prev,
          {
            name: file.name,
            size: (file.size / 1024).toFixed(1) + ' KB',
            type: file.type,
            content: evt.target?.result,
          },
        ]);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const start = new Date(formData.startDate);
    const end = new Date(formData.endDate);
    if (end < start) {
      alert("❌ 错误：结束日期不能早于开始日期！");
      return;
    }

    setLoading(true);
    try {
      // 🟢 提交时带上 attachments
      await ProjectService.create({
        ...formData,
        attachments: attachments, 
      });
      alert("创建成功");
      onSuccess();
    } catch (error) {
      console.error(error);
      alert("创建失败");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl">
        <h3 className="text-xl font-bold mb-6">新建项目</h3>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-6">
          <div className="col-span-2 bg-blue-50 p-3 rounded border border-blue-100 text-blue-800 text-sm flex items-center gap-2">
            <Hash size={16} /><span>项目编号将由系统自动生成</span>
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-bold mb-1">工程名称</label>
            <input
              required
              className="w-full border rounded p-2"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-bold mb-1">地点</label>
            <input
              required
              className="w-full border rounded p-2"
              value={formData.location}
              onChange={e => setFormData({ ...formData, location: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-bold mb-1">开始日期</label>
            <input
              type="date"
              required
              className="w-full border rounded p-2"
              value={formData.startDate}
              onChange={e => setFormData({ ...formData, startDate: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-bold mb-1">结束日期</label>
            <input
              type="date"
              required
              className="w-full border rounded p-2"
              value={formData.endDate}
              onChange={e => setFormData({ ...formData, endDate: e.target.value })}
            />
          </div>

          {/* 🟢 修改：申请部门改为点击选择 */}
          <div className="col-span-2">
            <label className="block text-sm font-bold mb-1">申请部门</label>
            <div 
                onClick={() => setShowDeptModal(true)}
                className="w-full border rounded p-2 flex items-center gap-2 cursor-pointer bg-white hover:border-blue-400 transition-colors"
            >
                <Briefcase size={16} className="text-slate-400" />
                <span className={formData.requestDept ? "text-slate-700" : "text-slate-400"}>
                    {formData.requestDept || "点击选择部门..."}
                </span>
            </div>
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-bold mb-1">供应商</label>
            <input
              required
              className="w-full border rounded p-2"
              value={formData.supplierName}
              onChange={e => setFormData({ ...formData, supplierName: e.target.value })}
            />
          </div>

          {/* 🟢 新增：附件上传区域 */}
          <div className="col-span-2 border-t border-slate-100 pt-4 mt-2">
            <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-700 text-sm">项目附件</span>
                    <span className="text-xs text-slate-400">(合同、图纸等，最大50MB)</span>
                </div>
                <div className="flex items-center gap-3">
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        onChange={handleFileSelect}
                    />
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-1 text-xs bg-slate-50 hover:bg-slate-100 text-slate-700 px-3 py-1.5 rounded border border-slate-200 transition-colors"
                    >
                        <Paperclip size={14} /> 添加附件
                    </button>
                </div>
            </div>
            {attachments.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                    {attachments.map((file, idx) => (
                        <div
                            key={idx}
                            className="flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1.5 rounded text-xs border border-blue-100"
                        >
                            <Paperclip size={12} />
                            <span className="max-w-[200px] truncate" title={file.name}>{file.name}</span>
                            <button
                                type="button"
                                onClick={() => handleRemoveAttachment(idx)}
                                className="hover:text-red-500 ml-1"
                            >
                                <X size={12} />
                            </button>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-xs text-slate-400 italic bg-slate-50 p-2 rounded text-center">暂无附件</div>
            )}
          </div>

          <div className="col-span-2 flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded hover:bg-slate-50"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? '提交中...' : '创建'}
            </button>
          </div>
        </form>
      </div>

      {/* 🟢 部门选择弹窗 */}
      <DepartmentSelectModal
        isOpen={showDeptModal}
        onClose={() => setShowDeptModal(false)}
        onSelect={(deptId, deptName) => {
            setFormData(prev => ({ ...prev, requestDept: deptName, requestDeptId: deptId }));
            setShowDeptModal(false);
        }}
        selectedDeptId={formData.requestDeptId}
      />
    </div>
  );
}