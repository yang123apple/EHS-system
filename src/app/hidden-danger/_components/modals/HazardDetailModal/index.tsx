// src/app/(dashboard)/hidden-danger/_components/modals/HazardDetailModal/index.tsx
import { useState } from 'react';
import { X, Trash2, Siren, ZoomIn, ChevronLeft, ChevronRight, Lock } from 'lucide-react';
import { StatusBadge, RiskBadge } from '../../Badges';
import { ProcessingFlow } from './ProcessingFlow';
import { AssignForm } from './ActionForms/AssignForm';
import { RectifyForm } from './ActionForms/RectifyForm';
import { VerifyForm } from './ActionForms/VerifyForm';
import { ExtensionCard } from './ExtensionCard';
import {
  canViewHazard,
  canAssignHazard,
  canRectifyHazard,
  canVerifyHazard,
  canDeleteHazard,
  canRequestExtension,
  canApproveExtension
} from '../../../_utils/permissions';

export default function HazardDetailModal({ hazard, onClose, user, allUsers, onProcess, onDelete }: any) {
  // 权限检查
  const hasViewPermission = canViewHazard(hazard, user);
  const hasAssignPermission = canAssignHazard(hazard, user);
  const hasRectifyPermission = canRectifyHazard(hazard, user);
  const hasVerifyPermission = canVerifyHazard(hazard, user);
  const hasDeletePermission = canDeleteHazard(hazard, user);
  const hasRequestExtensionPermission = canRequestExtension(hazard, user);
  const hasApproveExtensionPermission = canApproveExtension(hazard, user);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const handleImageClick = (photo: string, index: number) => {
    setPreviewImage(photo);
    setCurrentImageIndex(index);
  };

  const handleNextImage = () => {
    if (currentImageIndex < hazard.photos.length - 1) {
      const nextIndex = currentImageIndex + 1;
      setCurrentImageIndex(nextIndex);
      setPreviewImage(hazard.photos[nextIndex]);
    }
  };

  const handlePrevImage = () => {
    if (currentImageIndex > 0) {
      const prevIndex = currentImageIndex - 1;
      setCurrentImageIndex(prevIndex);
      setPreviewImage(hazard.photos[prevIndex]);
    }
  };

  // 如果用户无权查看此隐患，显示无权限提示
  if (!hasViewPermission) {
    return (
      <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-md">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md text-center">
          <Lock className="mx-auto mb-4 text-slate-400" size={48} />
          <h3 className="text-xl font-bold text-slate-800 mb-2">无权限查看</h3>
          <p className="text-slate-600 mb-6">您没有权限查看此隐患的详细信息。</p>
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900"
          >
            返回
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-md">
        <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b flex justify-between items-center bg-slate-50">
          <div className="flex items-center gap-3">
            <h3 className="font-bold text-lg">隐患详情</h3>
            <RiskBadge level={hazard.riskLevel} />
            <StatusBadge status={hazard.status} />
          </div>
          <div className="flex items-center gap-2">
            {hasDeletePermission && (
              <button onClick={() => onDelete(hazard.id)} className="text-red-500 p-2 hover:bg-red-50 rounded-lg transition-colors">
                <Trash2 size={18}/>
              </button>
            )}
            <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-lg transition-colors"><X size={20}/></button>
          </div>
        </div>

        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* Left: Info Section */}
          <div className="w-full lg:w-1/2 overflow-y-auto p-6 space-y-6">
            <div className="bg-slate-50 p-6 rounded-xl border border-slate-100">
              <h2 className="text-xl font-bold text-slate-900 mb-4">{hazard.desc}</h2>
              <div className="grid grid-cols-2 gap-4 text-sm text-slate-500">
                {hazard.code && (
                  <p className="col-span-2">
                    编号：<span className="text-blue-600 font-mono font-bold">{hazard.code}</span>
                  </p>
                )}
                <p>类型：<span className="text-slate-800">{hazard.type}</span></p>
                <p>区域：<span className="text-slate-800">{hazard.location}</span></p>
                <p>上报：<span className="text-slate-800">{hazard.reporterName}</span></p>
                <p>时间：<span className="text-slate-800">{new Date(hazard.reportTime).toLocaleString()}</span></p>
                {hazard.dopersonal_Name && (
                  <div className="col-span-2">
                    <p className="text-slate-500">
                      当前处理人：
                      <span className="text-blue-600 font-bold ml-1">{hazard.dopersonal_Name}</span>
                    </p>
                  </div>
                )}
              </div>
              <div className="flex gap-2 mt-6">
                {hazard.photos.map((p: string, i: number) => (
                  <div 
                    key={i} 
                    className="relative group cursor-pointer"
                    onClick={() => handleImageClick(p, i)}
                  >
                    <img 
                      src={p} 
                      className="w-24 h-24 rounded-lg object-cover border-2 border-white shadow-sm transition-transform group-hover:scale-105" 
                      alt="现场"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 rounded-lg transition-all flex items-center justify-center">
                      <ZoomIn className="text-white opacity-0 group-hover:opacity-100 transition-opacity" size={24} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <ProcessingFlow logs={hazard.logs} />
          </div>

          {/* Right: Action Pane */}
          <div className="w-full lg:w-1/2 bg-slate-50/50 border-l border-slate-200 p-6 overflow-y-auto space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between items-center font-bold text-slate-800">
                <span>流程处理</span>
                <StatusBadge status={hazard.status} />
              </div>
              {hazard.dopersonal_Name && (
                <div className="text-sm text-slate-600">
                  当前处理人：<span className="font-bold text-blue-600">{hazard.dopersonal_Name}</span>
                </div>
              )}
            </div>

            {/* 待指派状态 - 系统自动处理，用户不需要手动操作 */}
            {hazard.status === 'reported' && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-blue-800 font-medium text-center">
                  ⏳ 系统正在自动处理，请稍候...
                </p>
              </div>
            )}

            {/* 已指派/整改中状态 */}
            {(hazard.status === 'assigned' || hazard.status === 'rectifying') && (
              <div className="space-y-4">
                <div className="bg-white p-4 rounded-xl border shadow-sm text-sm space-y-2">
                  <p className="text-slate-500">整改责任人：<span className="font-bold text-slate-800">{hazard.responsibleName}</span></p>
                  <p className="text-slate-500">整改截止：<span className="font-bold text-red-600">{hazard.deadline}</span></p>
                </div>
                
                {/* 开始整改和驳回按钮 - 仅当前步骤执行人或管理员可见 */}
                {hazard.status === 'assigned' && hasRectifyPermission && (
                  <div className="flex gap-3">
                    <button 
                      onClick={() => onProcess('assign', hazard, {}, user)}
                      className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-blue-700 transition-all"
                    >
                      开始整改
                    </button>
                    <button 
                      onClick={() => {
                        const reason = prompt('请输入驳回原因：');
                        if (reason) {
                          onProcess('reject_by_responsible', hazard, { rejectReason: reason }, user);
                        }
                      }}
                      className="px-6 bg-red-500 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-red-600 transition-all"
                    >
                      驳回
                    </button>
                  </div>
                )}

                {/* 整改表单 - 仅责任人或管理员可见 */}
                {hazard.status === 'rectifying' && hasRectifyPermission && (
                  <RectifyForm hazard={hazard} onProcess={onProcess} user={user} />
                )}

                {/* 无权限提示 */}
                {!hasRectifyPermission && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                    <Lock className="text-amber-600 flex-shrink-0 mt-0.5" size={20} />
                    <div className="text-sm">
                      <p className="font-medium text-amber-800 mb-1">您暂无操作权限</p>
                      <p className="text-amber-600">只有责任人或管理员可以进行整改操作</p>
                    </div>
                  </div>
                )}
                
                {/* 延期卡片 - 根据权限控制 */}
                {(hasRequestExtensionPermission || hasApproveExtensionPermission) && (
                  <ExtensionCard 
                    hazard={hazard} 
                    onProcess={onProcess} 
                    canRequest={hasRequestExtensionPermission}
                    canApprove={hasApproveExtensionPermission} 
                  />
                )}
              </div>
            )}

            {/* 待验收状态 - 仅有验收权限的用户可见 */}
            {hazard.status === 'verified' && (
              <>
                {hasVerifyPermission ? (
                  <VerifyForm hazard={hazard} allUsers={allUsers} onProcess={onProcess} />
                ) : (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                    <Lock className="text-amber-600 flex-shrink-0 mt-0.5" size={20} />
                    <div className="text-sm">
                      <p className="font-medium text-amber-800 mb-1">您暂无验收权限</p>
                      <p className="text-amber-600">只有管理员、上报人或有处理权限的用户可以进行验收</p>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* 已关闭状态 - 显示最终状态 */}
            {hazard.status === 'closed' && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                <p className="text-green-800 font-medium">✓ 此隐患已完成验收并关闭</p>
              </div>
            )}
          </div>
        </div>
      </div>
      </div>

      {/* 图片预览弹窗 */}
      {previewImage && (
        <div className="fixed inset-0 bg-black/95 z-[60] flex items-center justify-center p-4">
          <button 
            onClick={() => setPreviewImage(null)}
            className="absolute top-4 right-4 text-white hover:bg-white/20 p-2 rounded-lg transition-colors"
          >
            <X size={32} />
          </button>

          {/* 左右切换按钮 */}
          {hazard.photos.length > 1 && (
            <>
              <button
                onClick={handlePrevImage}
                disabled={currentImageIndex === 0}
                className={`absolute left-4 text-white hover:bg-white/20 p-3 rounded-lg transition-colors ${
                  currentImageIndex === 0 ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <ChevronLeft size={32} />
              </button>
              <button
                onClick={handleNextImage}
                disabled={currentImageIndex === hazard.photos.length - 1}
                className={`absolute right-4 text-white hover:bg-white/20 p-3 rounded-lg transition-colors ${
                  currentImageIndex === hazard.photos.length - 1 ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <ChevronRight size={32} />
              </button>
            </>
          )}

          {/* 图片和计数器 */}
          <div className="flex flex-col items-center max-h-full">
            <img 
              src={previewImage} 
              alt="预览" 
              className="max-h-[85vh] max-w-full object-contain rounded-lg"
            />
            {hazard.photos.length > 1 && (
              <div className="mt-4 text-white text-sm bg-black/50 px-4 py-2 rounded-full">
                {currentImageIndex + 1} / {hazard.photos.length}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
