// src/app/(dashboard)/hidden-danger/_components/modals/HazardDetailModal/ActionForms/RectifyForm.tsx
import { useState, useRef } from 'react';
import { Camera, Image as ImageIcon, Send, XCircle, Upload, X } from 'lucide-react';

export function RectifyForm({ hazard, onProcess, user }: any) {
  const [data, setData] = useState({ rectificationNotes: '', rectificationPhotos: [] as string[] });
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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
      setData(prev => ({ ...prev, rectificationPhotos: [...prev.rectificationPhotos, result] }));
    };
    reader.readAsDataURL(file);

    // 清空 input，允许重复上传同一文件
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemovePhoto = (index: number) => {
    setData(prev => ({
      ...prev,
      rectificationPhotos: prev.rectificationPhotos.filter((_, i) => i !== index)
    }));
  };

  const handleReject = () => {
    if (!rejectReason.trim()) {
      alert('请填写驳回原因');
      return;
    }
    onProcess('reject_by_responsible', hazard, { rejectReason }, user);
    setShowRejectModal(false);
  };

  return (
    <>
      <div className="space-y-4 p-4 bg-blue-50/50 rounded-lg border border-blue-100">
        <h5 className="font-bold text-sm text-blue-800 flex items-center gap-2">
          <Camera size={16}/> 提交整改结果
        </h5>
        
        {/* 整改完成后的照片上传 */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            整改完成后的照片 <span className="text-slate-400 text-xs">(可选)</span>
          </label>
          
          {/* 已有照片预览 */}
          {data.rectificationPhotos.length > 0 && (
            <div className="grid grid-cols-4 gap-2 mb-2">
              {data.rectificationPhotos.map((p, i) => (
                <div key={i} className="relative group">
                  <img 
                    src={p} 
                    className="w-full h-20 object-cover rounded-lg border border-blue-200" 
                    alt={`整改照片 ${i + 1}`}
                  />
                  <button
                    onClick={() => handleRemovePhoto(i)}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* 上传按钮 */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-blue-300 rounded-lg p-4 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors"
          >
            <Upload size={20} className="mx-auto mb-2 text-blue-400" />
            <p className="text-sm text-slate-600">点击上传整改照片</p>
            <p className="text-xs text-slate-400 mt-1">支持 JPG、PNG 格式，最大 5MB</p>
          </div>
          
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png"
            capture="environment"
            onChange={handlePhotoUpload}
            className="hidden"
          />
        </div>

        <textarea
          className="w-full border p-2 text-sm h-24 rounded focus:ring-2 focus:ring-blue-200 outline-none"
          placeholder="请详细描述已采取的整改措施..."
          onChange={e => setData({...data, rectificationNotes: e.target.value})}
        />

        <div className="flex gap-2">
          <button 
            onClick={() => onProcess('finish_rectify', hazard, data, user)}
            className="flex-1 bg-blue-600 text-white py-2 rounded text-sm font-bold shadow hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
          >
            <Send size={16}/> 提交整改
          </button>
          
          <button 
            onClick={() => setShowRejectModal(true)}
            className="flex-1 bg-orange-600 text-white py-2 rounded text-sm font-bold shadow hover:bg-orange-700 transition-colors flex items-center justify-center gap-2"
          >
            <XCircle size={16}/> 驳回任务
          </button>
        </div>
      </div>

      {/* 驳回原因弹窗 */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full">
            <h3 className="text-lg font-bold mb-4 text-slate-800">驳回整改任务</h3>
            <p className="text-sm text-slate-600 mb-4">
              请说明驳回原因，任务将回退到"已指派"状态，需要重新处理。
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full border border-slate-300 rounded-lg p-3 text-sm h-32 focus:ring-2 focus:ring-orange-200 outline-none resize-none"
              placeholder="例如：整改要求不明确、资源不足、需要调整方案等..."
            />
            <div className="flex gap-3 justify-end mt-4">
              <button 
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason('');
                }}
                className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm"
              >
                取消
              </button>
              <button 
                onClick={handleReject}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm font-medium"
              >
                确认驳回
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
