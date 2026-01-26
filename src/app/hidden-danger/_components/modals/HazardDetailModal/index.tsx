// src/app/(dashboard)/hidden-danger/_components/modals/HazardDetailModal/index.tsx
import { useState, useEffect } from 'react';
import { X, Trash2, Siren, ZoomIn, ChevronLeft, ChevronRight, Lock } from 'lucide-react';
import { StatusBadge, RiskBadge } from '../../Badges';
import { WorkflowSteps } from './WorkflowSteps';
import { AssignForm } from './ActionForms/AssignForm';
import { RectifyForm } from './ActionForms/RectifyForm';
import { VerifyForm } from './ActionForms/VerifyForm';
import { ExtensionCard } from './ExtensionCard';
import { RejectModal } from '../RejectModal';
import {
  canViewHazard,
  canAssignHazard,
  canRectifyHazard,
  canVerifyHazard,
  canDeleteHazard,
  canRequestExtension,
  canApproveExtension,
  getCurrentStepInfoForPermission
} from '../../../_utils/permissions';
import type { StepHandlerResult } from '@/services/hazardHandlerResolver.service';
import { getCheckTypeName } from '@/utils/checkTypeMapping';
import { useMinioImageUrls } from '@/hooks/useMinioImageUrl';

export default function HazardDetailModal({ hazard, onClose, user, allUsers, onProcess, onDelete }: any) {
  const [checkTypeName, setCheckTypeName] = useState<string>(hazard.checkType || '');
  const [currentStepInfo, setCurrentStepInfo] = useState<StepHandlerResult | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showRejectModal, setShowRejectModal] = useState(false);
  
  // 🚀 优化：从 HazardWorkflowStep 表读取当前步骤信息（用于权限检查）
  useEffect(() => {
    const loadCurrentStepInfo = async () => {
      if (hazard.id && (hazard.currentStepIndex !== undefined && hazard.currentStepIndex !== null)) {
        try {
          const stepInfo = await getCurrentStepInfoForPermission(hazard.id, hazard.currentStepIndex);
          setCurrentStepInfo(stepInfo);
        } catch (error) {
          console.error('[HazardDetailModal] 加载步骤信息失败:', error);
          // 如果加载失败，使用 null，权限检查会回退到从 hazard 对象读取
          setCurrentStepInfo(null);
        }
      }
    };
    
    loadCurrentStepInfo();
  }, [hazard.id, hazard.currentStepIndex]);
  
  // 权限检查（使用从表读取的步骤信息）
  const hasViewPermission = canViewHazard(hazard, user);
  const hasAssignPermission = canAssignHazard(hazard, user);
  const hasRectifyPermission = canRectifyHazard(hazard, user, currentStepInfo);
  const hasVerifyPermission = canVerifyHazard(hazard, user, currentStepInfo);
  const hasDeletePermission = canDeleteHazard(hazard, user);
  const hasRequestExtensionPermission = canRequestExtension(hazard, user);
  const hasApproveExtensionPermission = canApproveExtension(hazard, user);

  // 确保三类照片始终是数组
  const photos = Array.isArray(hazard.photos) ? hazard.photos : (hazard.photos ? [hazard.photos] : []);
  const rectifyPhotos = Array.isArray(hazard.rectificationPhotos || hazard.rectifyPhotos)
    ? (hazard.rectificationPhotos || hazard.rectifyPhotos)
    : ((hazard.rectificationPhotos || hazard.rectifyPhotos) ? [hazard.rectificationPhotos || hazard.rectifyPhotos] : []);
  const verifyPhotos = Array.isArray(hazard.verificationPhotos || hazard.verifyPhotos)
    ? (hazard.verificationPhotos || hazard.verifyPhotos)
    : ((hazard.verificationPhotos || hazard.verifyPhotos) ? [hazard.verificationPhotos || hazard.verifyPhotos] : []);

  // 🔧 使用 useMinioImageUrls hook 将 MinIO 路径转换为预签名 URL
  const { urls: photoUrls, loading: photosLoading } = useMinioImageUrls(photos);
  const { urls: rectifyPhotoUrls, loading: rectifyPhotosLoading } = useMinioImageUrls(rectifyPhotos);
  const { urls: verifyPhotoUrls, loading: verifyPhotosLoading } = useMinioImageUrls(verifyPhotos);

  // 加载检查类型名称
  useEffect(() => {
    if (hazard.checkType) {
      getCheckTypeName(hazard.checkType).then(setCheckTypeName);
    }
  }, [hazard.checkType]);

  const handleImageClick = (photoUrl: string, index: number) => {
    setPreviewImage(photoUrl);
    setCurrentImageIndex(index);
  };

  const handleNextImage = () => {
    if (currentImageIndex < photoUrls.length - 1) {
      const nextIndex = currentImageIndex + 1;
      setCurrentImageIndex(nextIndex);
      setPreviewImage(photoUrls[nextIndex]);
    }
  };

  const handlePrevImage = () => {
    if (currentImageIndex > 0) {
      const prevIndex = currentImageIndex - 1;
      setCurrentImageIndex(prevIndex);
      setPreviewImage(photoUrls[prevIndex]);
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
      <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-2 lg:p-4 backdrop-blur-md">
        <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-3 lg:p-4 border-b flex justify-between items-center bg-slate-50 shrink-0">
          <div className="flex items-center gap-2 lg:gap-3 flex-1 min-w-0">
            <h3 className="font-bold text-base lg:text-lg truncate">隐患详情</h3>
            <div className="flex items-center gap-1.5 shrink-0">
              <RiskBadge level={hazard.riskLevel} />
              <StatusBadge status={hazard.status} />
            </div>
          </div>
          <div className="flex items-center gap-1 lg:gap-2 shrink-0">
            {hasDeletePermission && (
              <button onClick={() => onDelete(hazard)} className="text-red-500 p-1.5 lg:p-2 hover:bg-red-50 rounded-lg transition-colors">
                <Trash2 size={16} className="lg:w-[18px] lg:h-[18px]"/>
              </button>
            )}
            <button onClick={onClose} className="p-1.5 lg:p-2 hover:bg-slate-200 rounded-lg transition-colors">
              <X size={18} className="lg:w-5 lg:h-5"/>
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* Left: Info Section */}
          <div className="w-full lg:w-1/2 overflow-y-auto p-4 lg:p-6 space-y-4 lg:space-y-6">
            {/* 🟢 已作废提示横幅 */}
            {hazard.isVoided && (
              <div className="bg-gradient-to-r from-gray-100 to-gray-50 border-2 border-gray-300 rounded-xl p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-500 flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-800 text-lg mb-2">此隐患已作废</h3>
                    <div className="space-y-1.5 text-sm text-gray-600">
                      {hazard.voidReason && (
                        <p><span className="font-semibold">作废原因：</span>{hazard.voidReason}</p>
                      )}
                      {hazard.voidedAt && (
                        <p><span className="font-semibold">作废时间：</span>{new Date(hazard.voidedAt).toLocaleString()}</p>
                      )}
                      {hazard.voidedBy && (() => {
                        try {
                          const voidedBy = JSON.parse(hazard.voidedBy);
                          return <p><span className="font-semibold">操作人：</span>{voidedBy.name || voidedBy.id}</p>;
                        } catch {
                          return null;
                        }
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <div className={`p-4 lg:p-6 rounded-xl border ${
              hazard.isVoided 
                ? 'bg-gray-50/50 border-gray-200' 
                : 'bg-slate-50 border-slate-100'
            }`}>
              <h2 className={`text-lg lg:text-xl font-bold mb-3 lg:mb-4 ${
                hazard.isVoided ? 'text-gray-600 line-through' : 'text-slate-900'
              }`}>{hazard.desc}</h2>
              {/* 移动端：单列，桌面端：2列 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4 text-sm text-slate-500">
                {hazard.code && (
                  <p className="col-span-1 lg:col-span-2">
                    编号：<span className="text-blue-600 font-mono font-bold break-all">{hazard.code}</span>
                  </p>
                )}
                <p>类型：<span className="text-slate-800">{hazard.type}</span></p>
                <p>区域：<span className="text-slate-800">{hazard.location}</span></p>
                {hazard.checkType && (
                  <p>检查类型：<span className="text-slate-800">{checkTypeName}</span></p>
                )}
                {hazard.rectificationType && (
                  <p>整改方式：
                    <span className={`font-medium ${hazard.rectificationType === 'immediate' ? 'text-green-600' : 'text-blue-600'}`}>
                      {hazard.rectificationType === 'immediate' ? '立即整改' : '限期整改'}
                    </span>
                  </p>
                )}
                <p>上报：<span className="text-slate-800">{hazard.reporterName}</span></p>
                <p>时间：<span className="text-slate-800 break-words">{new Date(hazard.reportTime).toLocaleString()}</span></p>
                {(hazard.candidateHandlers && hazard.candidateHandlers.length > 0 && hazard.approvalMode) ? (
                  <div className="col-span-1 lg:col-span-2">
                    <p className="text-slate-500">
                      当前处理人（{hazard.approvalMode === 'AND' ? '会签' : '或签'}）：
                      <span className="text-blue-600 font-bold ml-1">
                        {hazard.candidateHandlers.map((h: any) => h.userName).join('、')}
                      </span>
                    </p>
                  </div>
                ) : hazard.dopersonal_Name || hazard.currentExecutorName ? (
                  <div className="col-span-1 lg:col-span-2">
                    <p className="text-slate-500">
                      当前处理人：
                      <span className="text-blue-600 font-bold ml-1">{hazard.currentExecutorName || hazard.dopersonal_Name}</span>
                    </p>
                  </div>
                ) : null}
              </div>
              {/* 照片展示区域 - 三列布局 */}
              <div className="mt-4 lg:mt-6">
                <div className="grid grid-cols-3 gap-3 lg:gap-4">
                  {/* 隐患照片列 */}
                  <div className="space-y-2">
                    <p className="text-xs text-slate-500 font-medium">隐患照片</p>
                    {photosLoading ? (
                      <div className="w-full aspect-square rounded-lg bg-slate-200 animate-pulse" />
                    ) : photoUrls.length > 0 && photoUrls[0] ? (
                      <div 
                        className="relative group cursor-pointer"
                        onClick={() => handleImageClick(photoUrls[0], 0)}
                      >
                        <img 
                          src={photoUrls[0]} 
                          className="w-full aspect-square rounded-lg object-cover border-2 border-white shadow-sm transition-transform group-active:scale-105" 
                          alt="隐患照片"
                          onError={(e) => {
                            e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2VlZSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5sb2FkIGVycm9yPC90ZXh0Pjwvc3ZnPg==';
                          }}
                        />
                        <div className="absolute inset-0 bg-black/0 group-active:bg-black/40 rounded-lg transition-all flex items-center justify-center">
                          <ZoomIn className="text-white opacity-0 group-active:opacity-100 transition-opacity" size={20} />
                        </div>
                      </div>
                    ) : (
                      <div className="w-full aspect-square rounded-lg bg-slate-200 flex items-center justify-center">
                        <span className="text-xs text-slate-400">暂无照片</span>
                      </div>
                    )}
                  </div>

                  {/* 整改照片列 */}
                  <div className="space-y-2">
                    <p className="text-xs text-slate-500 font-medium">整改照片</p>
                    {rectifyPhotosLoading ? (
                      <div className="w-full aspect-square rounded-lg bg-slate-200 animate-pulse" />
                    ) : rectifyPhotoUrls.length > 0 && rectifyPhotoUrls[0] ? (
                      <div 
                        className="relative group cursor-pointer"
                        onClick={() => handleImageClick(rectifyPhotoUrls[0], 0)}
                      >
                        <img 
                          src={rectifyPhotoUrls[0]} 
                          className="w-full aspect-square rounded-lg object-cover border-2 border-white shadow-sm transition-transform group-active:scale-105" 
                          alt="整改照片"
                          onError={(e) => {
                            e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2VlZSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5sb2FkIGVycm9yPC90ZXh0Pjwvc3ZnPg==';
                          }}
                        />
                        <div className="absolute inset-0 bg-black/0 group-active:bg-black/40 rounded-lg transition-all flex items-center justify-center">
                          <ZoomIn className="text-white opacity-0 group-active:opacity-100 transition-opacity" size={20} />
                        </div>
                      </div>
                    ) : (
                      <div className="w-full aspect-square rounded-lg bg-slate-200 flex items-center justify-center">
                        <span className="text-xs text-slate-400">未整改</span>
                      </div>
                    )}
                  </div>

                  {/* 验收照片列 */}
                  <div className="space-y-2">
                    <p className="text-xs text-slate-500 font-medium">验收照片</p>
                    {verifyPhotosLoading ? (
                      <div className="w-full aspect-square rounded-lg bg-slate-200 animate-pulse" />
                    ) : verifyPhotoUrls.length > 0 && verifyPhotoUrls[0] ? (
                      <div 
                        className="relative group cursor-pointer"
                        onClick={() => handleImageClick(verifyPhotoUrls[0], 0)}
                      >
                        <img 
                          src={verifyPhotoUrls[0]} 
                          className="w-full aspect-square rounded-lg object-cover border-2 border-white shadow-sm transition-transform group-active:scale-105" 
                          alt="验收照片"
                          onError={(e) => {
                            e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2VlZSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5sb2FkIGVycm9yPC90ZXh0Pjwvc3ZnPg==';
                          }}
                        />
                        <div className="absolute inset-0 bg-black/0 group-active:bg-black/40 rounded-lg transition-all flex items-center justify-center">
                          <ZoomIn className="text-white opacity-0 group-active:opacity-100 transition-opacity" size={20} />
                        </div>
                      </div>
                    ) : (
                      <div className="w-full aspect-square rounded-lg bg-slate-200 flex items-center justify-center">
                        <span className="text-xs text-slate-400">未验收</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="text-sm font-bold text-slate-800 mb-2">工作流步骤</div>
              <WorkflowSteps hazardId={hazard.id} currentStepIndex={hazard.currentStepIndex} />
            </div>
          </div>

          {/* Right: Action Pane */}
          <div className="w-full lg:w-1/2 bg-slate-50/50 border-t lg:border-l border-slate-200 p-4 lg:p-6 overflow-y-auto space-y-4 lg:space-y-6">
            <div className="space-y-3">
              <div className="flex justify-between items-center font-bold text-slate-800">
                <span className="text-base lg:text-lg">流程处理</span>
                <StatusBadge status={hazard.status} />
              </div>
              
              {/* 当前审批人圆角方框 - 始终显示 */}
              {(hazard.candidateHandlers && hazard.candidateHandlers.length > 0 && hazard.approvalMode) ? (
                <div className="bg-blue-50 border-2 border-blue-200 rounded-xl px-4 py-2.5 shadow-sm">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-slate-600 font-medium">当前审批人（{hazard.approvalMode === 'AND' ? '会签' : '或签'}）：</span>
                    <span className="font-bold text-blue-700">
                      {hazard.candidateHandlers.map((h: any) => h.userName).join('、')}
                    </span>
                  </div>
                </div>
              ) : hazard.dopersonal_Name || hazard.currentExecutorName ? (
                <div className="bg-blue-50 border-2 border-blue-200 rounded-xl px-4 py-2.5 shadow-sm">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-slate-600 font-medium">当前审批人：</span>
                    <span className="font-bold text-blue-700">{hazard.currentExecutorName || hazard.dopersonal_Name}</span>
                  </div>
                </div>
              ) : (
                <div className="bg-amber-50 border-2 border-amber-200 rounded-xl px-4 py-2.5 shadow-sm">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-slate-600 font-medium">当前审批人：</span>
                    <span className="font-medium text-amber-700">
                      {hazard.status === 'reported' ? '系统正在自动指派中...' : 
                       hazard.status === 'closed' ? '流程已关闭' :
                       hazard.isVoided ? '隐患已作废' :
                       '暂无处理人信息'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* 🟢 已作废隐患：禁用所有业务操作 */}
            {hazard.isVoided ? (
              <div className="bg-gray-100 border-2 border-gray-300 rounded-xl p-6 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-500 mb-4">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                </div>
                <p className="text-gray-800 font-bold text-lg mb-2">此隐患已作废</p>
                <p className="text-gray-600 text-sm">已作废的隐患无法进行任何业务操作</p>
              </div>
            ) : (
              <>
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
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button 
                      onClick={() => onProcess('assign', hazard, {}, user)}
                      className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-blue-700 active:scale-95 transition-all"
                    >
                      开始整改
                    </button>
                    <button 
                      onClick={() => setShowRejectModal(true)}
                      className="px-6 bg-red-500 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-red-600 active:scale-95 transition-all"
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
              </>
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
          {photoUrls.length > 1 && (
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
                disabled={currentImageIndex === photoUrls.length - 1}
                className={`absolute right-4 text-white hover:bg-white/20 p-3 rounded-lg transition-colors ${
                  currentImageIndex === photoUrls.length - 1 ? 'opacity-50 cursor-not-allowed' : ''
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
              onError={(e) => {
                e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2VlZSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj7lm77niYfliqDovb3lpLHotKU8L3RleHQ+PC9zdmc+';
              }}
            />
            {photoUrls.length > 1 && (
              <div className="mt-4 text-white text-sm bg-black/50 px-4 py-2 rounded-full">
                {currentImageIndex + 1} / {photoUrls.length}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 驳回模态框 */}
      <RejectModal
        isOpen={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        onConfirm={(reason, photos) => {
          onProcess('reject_by_responsible', hazard, { rejectReason: reason, rejectPhotos: photos }, user);
          setShowRejectModal(false);
        }}
        title="驳回整改任务"
        description="请说明驳回原因，并提供相关凭证图片（可选）。任务将回退到'已指派'状态，需要重新处理。"
      />
    </>
  );
}
