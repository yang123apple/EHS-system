// src/app/(dashboard)/hidden-danger/_components/modals/HazardDetailModal/ActionForms/RectifyForm.tsx
import { useState } from 'react';
import { Camera, Image as ImageIcon, Send, XCircle } from 'lucide-react';

export function RectifyForm({ hazard, onProcess, user }: any) {
  const [data, setData] = useState({ rectifyDesc: '', photos: [] as string[] });
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // 验证文件格式
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    const fileExtension = file.name.toLowerCase().split('.').pop();
    const allowedExtensions = ['jpg', 'jpeg', 'png'];
    
    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
      alert('仅支持上传 JPG、PNG、JPEG 格式的照片');
      e.target.value = ''; // 清空输入
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (evt) => {
      setData(prev => ({ ...prev, photos: [...prev.photos, evt.target?.result as string] }));
    };
    reader.readAsDataURL(file);
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
        
        {/* 照片上传区 */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {data.photos.map((p, i) => (
            <img key={i} src={p} className="w-16 h-16 object-cover rounded border bg-white" alt="整改后"/>
          ))}
          <label className="w-16 h-16 border-2 border-dashed border-blue-300 rounded flex flex-col items-center justify-center text-blue-400 cursor-pointer hover:bg-white transition-colors">
            <ImageIcon size={20}/>
            <input 
              type="file" 
              accept="image/jpeg,image/jpg,image/png" 
              capture="environment"
              className="hidden" 
              onChange={handlePhotoUpload} 
            />
          </label>
        </div>

        <textarea 
          className="w-full border p-2 text-sm h-24 rounded focus:ring-2 focus:ring-blue-200 outline-none" 
          placeholder="请详细描述已采取的整改措施..." 
          onChange={e => setData({...data, rectifyDesc: e.target.value})}
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
