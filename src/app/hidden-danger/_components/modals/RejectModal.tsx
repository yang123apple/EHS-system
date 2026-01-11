'use client';

import { useState, useRef } from 'react';
import { X, Upload, Image as ImageIcon } from 'lucide-react';

interface RejectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string, photos: string[]) => void;
  title?: string;
  description?: string;
}

export function RejectModal({
  isOpen,
  onClose,
  onConfirm,
  title = '驳回',
  description = '请说明驳回原因，并提供相关凭证图片（可选）。'
}: RejectModalProps) {
  const [rejectReason, setRejectReason] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 验证文件格式
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    const fileExtension = file.name.toLowerCase().split('.').pop() || '';
    const allowedExtensions = ['jpg', 'jpeg', 'png'];

    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
      alert('仅支持上传 JPG、PNG、JPEG 格式的照片');
      e.target.value = '';
      return;
    }

    // 验证文件大小（5MB）
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      alert('图片大小不能超过 5MB');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      const result = evt.target?.result as string;
      setPhotos(prev => [...prev, result]);
    };
    reader.readAsDataURL(file);

    // 清空 input，允许重复上传同一文件
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleConfirm = () => {
    if (!rejectReason.trim()) {
      alert('请填写驳回原因');
      return;
    }
    onConfirm(rejectReason.trim(), photos);
    // 重置表单
    setRejectReason('');
    setPhotos([]);
  };

  const handleClose = () => {
    setRejectReason('');
    setPhotos([]);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-800">{title}</h3>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <p className="text-sm text-slate-600 mb-4">{description}</p>

        {/* 驳回原因输入 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            驳回原因 <span className="text-red-500">*</span>
          </label>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            className="w-full border border-slate-300 rounded-lg p-3 text-sm h-32 focus:ring-2 focus:ring-red-200 focus:border-red-300 outline-none resize-none"
            placeholder="请输入驳回原因..."
          />
        </div>

        {/* 图片上传 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            驳回凭证 <span className="text-slate-400 text-xs">(可选)</span>
          </label>
          
          {/* 上传按钮 */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 rounded-lg p-4 text-center cursor-pointer hover:border-red-300 hover:bg-red-50/50 transition-colors"
          >
            <Upload size={20} className="mx-auto mb-2 text-slate-400" />
            <p className="text-sm text-slate-600">点击上传图片</p>
            <p className="text-xs text-slate-400 mt-1">支持 JPG、PNG 格式，最大 5MB</p>
          </div>
          
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png"
            onChange={handleFileUpload}
            className="hidden"
          />

          {/* 图片预览 */}
          {photos.length > 0 && (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {photos.map((photo, index) => (
                <div key={index} className="relative group">
                  <img
                    src={photo}
                    alt={`凭证 ${index + 1}`}
                    className="w-full h-24 object-cover rounded-lg border border-slate-200"
                  />
                  <button
                    onClick={() => handleRemovePhoto(index)}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="flex gap-3 justify-end">
          <button
            onClick={handleClose}
            className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm font-medium text-slate-700 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            disabled={!rejectReason.trim()}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              !rejectReason.trim()
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-red-500 text-white hover:bg-red-600'
            }`}
          >
            确认驳回
          </button>
        </div>
      </div>
    </div>
  );
}

