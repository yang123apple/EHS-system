// src/app/hidden-danger/_components/modals/HazardReportModal.tsx
import { useState, useEffect, useRef } from 'react';
import { X, Camera, ChevronRight, User, GitBranch, Mail, CheckCircle, ChevronDown, Upload, Loader2 } from 'lucide-react';
import { HazardConfig, RiskLevel } from '@/types/hidden-danger';
import { RISK_LEVEL_MAP, STRATEGY_NAME_MAP } from '@/constants/hazard';
import PeopleSelector from '@/components/common/PeopleSelector';
import { HazardHandlerResolverService } from '@/services/hazardHandlerResolver.service';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/apiClient';
import { useMinioUpload } from '@/hooks/useMinioUpload';

interface HazardReportModalProps {
  config: HazardConfig;
  allUsers?: any[];
  departments?: any[];
  workflowConfig?: any;
  onClose: () => void;
  onSubmit: (data: any) => void;
}

export function HazardReportModal({ config, allUsers = [], departments: propDepartments, workflowConfig, onClose, onSubmit }: HazardReportModalProps) {
  const { user } = useAuth();
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [checkTypes, setCheckTypes] = useState<Array<{ id: string; name: string; value: string; sortOrder: number }>>([]);
  const [formData, setFormData] = useState({
    checkType: 'daily' as string, // 检查类型（改为 string 以支持动态值）
    riskLevel: 'low' as RiskLevel,
    type: '',
    location: '',
    desc: '',
    rectifyRequirement: '', // 整改措施
    responsibleDeptId: '',
    responsibleDeptName: '',
    responsibleId: '',
    responsibleName: '',
    deadline: '',
    rectificationType: 'immediate' as 'immediate' | 'scheduled' // 整改方式：立即整改 | 限期整改
  });
  const [photos, setPhotos] = useState<string[]>([]); // 存储 MinIO objectName
  const [photoUrls, setPhotoUrls] = useState<string[]>([]); // 存储预览 URL
  const [uploadingPhotos, setUploadingPhotos] = useState<Set<number>>(new Set());
  const [departments, setDepartments] = useState<any[]>(propDepartments || []);
  const [departmentTree, setDepartmentTree] = useState<any[]>([]); // 保存完整的部门树
  const [showWorkflowPreview, setShowWorkflowPreview] = useState(false);
  const [workflowPreview, setWorkflowPreview] = useState<any>(null);
  const [isMobileWorkflowExpanded, setIsMobileWorkflowExpanded] = useState(false); // 移动端流程预览折叠状态
  const [isDragging, setIsDragging] = useState(false); // 拖拽状态
  const dragCounterRef = useRef(0); // 用于跟踪拖拽进入/离开次数

  // 获取检查类型列表
  useEffect(() => {
    const fetchCheckTypes = async () => {
      try {
        const res = await apiFetch('/api/check-types?activeOnly=true');
        const data = await res.json();
        setCheckTypes(data);
        
        // 如果有数据，设置第一个为默认值
        if (data.length > 0) {
          setFormData(prev => ({ ...prev, checkType: data[0].value }));
        }
      } catch (error) {
        console.error('获取检查类型失败:', error);
        // 失败时使用默认值
        setCheckTypes([
          { id: 'ckt_daily', name: '日常检查', value: 'daily', sortOrder: 1 }
        ]);
      }
    };
    fetchCheckTypes();
  }, []);

  // 获取部门列表（如果没有从 props 传入）
  useEffect(() => {
    if (propDepartments && propDepartments.length > 0) {
      setDepartments(propDepartments);
    } else {
      const fetchDepartments = async () => {
        try {
          const res = await apiFetch('/api/org');
          const data = await res.json();
          
          // 保存完整的部门树（用于处理人匹配）
          setDepartmentTree(data);
          
          // 扁平化部门列表（用于选择器）
          // 重要：保留所有字段（包括 managerId），以便处理人匹配器正常工作
          const flattenDepts = (nodes: any[], result: any[] = []): any[] => {
            // 确保 nodes 是数组
            if (!Array.isArray(nodes) || nodes.length === 0) {
              return result;
            }
            
            nodes.forEach(node => {
              result.push({ 
                id: node.id, 
                name: node.name,
                parentId: node.parentId,
                level: node.level,
                managerId: node.managerId  // 保留 managerId
              });
              if (node.children && Array.isArray(node.children) && node.children.length > 0) {
                flattenDepts(node.children, result);
              }
            });
            return result;
          };
          // 确保 data 是数组
          setDepartments(flattenDepts(Array.isArray(data) ? data : []));
        } catch (error) {
          console.error('获取部门列表失败:', error);
        }
      };
      fetchDepartments();
    }
  }, [propDepartments]);

  // MinIO 上传 Hook
  const { upload: uploadToMinio } = useMinioUpload({
    bucket: 'private',
    businessType: 'inspection', // 隐患排查照片使用 inspection 业务类型
    prefix: 'hazards/photos',
    category: 'hazard',
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  const handleFile = async (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // 验证文件格式
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    const fileExtension = file.name.toLowerCase().split('.').pop();
    const allowedExtensions = ['jpg', 'jpeg', 'png'];
    
    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension || '')) {
      alert('仅支持上传 JPG、PNG、JPEG 格式的照片');
      e.target.value = ''; // 清空输入
      return;
    }

    // 创建预览 URL
    const previewUrl = URL.createObjectURL(file);
    const photoIndex = photos.length;
    
    // 添加预览
    setPhotoUrls(prev => [...prev, previewUrl]);
    setPhotos(prev => [...prev, '']); // 占位
    setUploadingPhotos(prev => new Set(prev).add(photoIndex));

    try {
      // 上传到 MinIO
      const result = await uploadToMinio(file);
      
      // 更新 objectName
      setPhotos(prev => {
        const newPhotos = [...prev];
        newPhotos[photoIndex] = result.objectName;
        return newPhotos;
      });
      
      setUploadingPhotos(prev => {
        const newSet = new Set(prev);
        newSet.delete(photoIndex);
        return newSet;
      });
    } catch (error: any) {
      console.error('照片上传失败:', error);
      alert(`照片上传失败: ${error.message || '未知错误'}`);
      
      // 移除失败的照片
      setPhotos(prev => prev.filter((_, idx) => idx !== photoIndex));
      setPhotoUrls(prev => prev.filter((_, idx) => idx !== photoIndex));
      setUploadingPhotos(prev => {
        const newSet = new Set(prev);
        newSet.delete(photoIndex);
        return newSet;
      });
    }
    
    e.target.value = ''; // 清空输入以支持重复选择同一文件
  };

  // 处理文件列表上传（支持批量）
  const handleFiles = async (files: FileList | File[]) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    const allowedExtensions = ['jpg', 'jpeg', 'png'];
    
    for (const file of Array.from(files)) {
      const fileExtension = file.name.toLowerCase().split('.').pop();
      
      // 验证文件格式
      if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension || '')) {
        alert(`文件 ${file.name} 格式不支持，仅支持 JPG、PNG、JPEG 格式`);
        continue;
      }

      // 创建预览 URL
      const previewUrl = URL.createObjectURL(file);
      const photoIndex = photos.length + Array.from(files).indexOf(file);
      
      // 添加预览
      setPhotoUrls(prev => [...prev, previewUrl]);
      setPhotos(prev => [...prev, '']); // 占位
      setUploadingPhotos(prev => new Set(prev).add(photoIndex));

      try {
        // 上传到 MinIO
        const result = await uploadToMinio(file);
        
        // 更新 objectName
        setPhotos(prev => {
          const newPhotos = [...prev];
          newPhotos[photoIndex] = result.objectName;
          return newPhotos;
        });
        
        setUploadingPhotos(prev => {
          const newSet = new Set(prev);
          newSet.delete(photoIndex);
          return newSet;
        });
      } catch (error: any) {
        console.error('照片上传失败:', error);
        alert(`照片 ${file.name} 上传失败: ${error.message || '未知错误'}`);
        
        // 移除失败的照片
        setPhotos(prev => prev.filter((_, idx) => idx !== photoIndex));
        setPhotoUrls(prev => prev.filter((_, idx) => idx !== photoIndex));
        setUploadingPhotos(prev => {
          const newSet = new Set(prev);
          newSet.delete(photoIndex);
          return newSet;
        });
      }
    }
  };

  // 拖拽事件处理
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    
    // 检查是否包含文件
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      const hasFiles = Array.from(e.dataTransfer.items).some(
        item => item.kind === 'file'
      );
      if (hasFiles) {
        setIsDragging(true);
      }
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounterRef.current = 0;
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFiles(files);
    }
  };

  // 检测是否为桌面端（屏幕宽度 >= 1024px）
  const [isDesktop, setIsDesktop] = useState(false);
  
  useEffect(() => {
    const checkIsDesktop = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };
    
    checkIsDesktop();
    window.addEventListener('resize', checkIsDesktop);
    
    return () => window.removeEventListener('resize', checkIsDesktop);
  }, []);

  const handleDeptSelect = (deptId: string, deptName: string) => {
    setFormData(prev => ({
      ...prev,
      responsibleDeptId: deptId,
      responsibleDeptName: deptName,
      responsibleId: '',
      responsibleName: ''
    }));
    setShowDeptModal(false);
  };

  const handleUserSelect = (users: Array<{ userId: string; userName: string }>) => {
    if (users.length > 0) {
      const user = users[0];
      setFormData(prev => ({
        ...prev,
        responsibleId: user.userId,
        responsibleName: user.userName
      }));
    }
    setShowUserModal(false);
  };

  // 当选择"立即整改"时，自动设置deadline为当天23:59:59
  useEffect(() => {
    if (formData.rectificationType === 'immediate') {
      const today = new Date();
      const dateStr = today.toISOString().split('T')[0];
      setFormData(prev => ({ ...prev, deadline: dateStr }));
    } else if (formData.rectificationType === 'scheduled' && formData.deadline === new Date().toISOString().split('T')[0]) {
      // 从立即整改切换到限期整改时，清空默认的今日期限
      setFormData(prev => ({ ...prev, deadline: '' }));
    }
  }, [formData.rectificationType]);

  // 预测流程（使用统一解析服务，确保与实际流转一致）
  const predictWorkflow = async () => {
    if (!workflowConfig || !formData.type || !formData.location) {
      setWorkflowPreview(null);
      setShowWorkflowPreview(false);
      return;
    }

    try {
      console.log('🔍 [流程预览] 开始流程预测:', {
        workflowConfig,
        formData,
        currentUser: user,
        allUsersCount: allUsers?.length,
        departmentsCount: departments?.length
      });

      // 使用统一服务创建模拟隐患数据
      const mockHazard = HazardHandlerResolverService.createMockHazard(
        formData,
        user || { id: 'current-user', name: '当前用户' }
      );

      // 添加额外的责任人信息（如果用户选择了的话）
      if (formData.responsibleId) {
        mockHazard.responsibleId = formData.responsibleId;
        mockHazard.responsibleName = formData.responsibleName;
        mockHazard.responsibleDeptId = formData.responsibleDeptId;
        mockHazard.assignedDepartmentId = formData.responsibleDeptId;
      }

      console.log('📋 [流程预览] 模拟隐患对象:', mockHazard);
      console.log('👤 [流程预览] 当前用户信息:', {
        id: user?.id,
        name: user?.name,
        department: user?.department,
        departmentId: user?.departmentId,
        jobTitle: user?.jobTitle
      });

      // 获取上报人对象（用于抄送规则匹配）
      const reporter = user ? (allUsers?.find(u => u.id === user.id) || {
        id: user.id,
        name: user.name,
        departmentId: user.departmentId,
        jobTitle: user.jobTitle
      }) : undefined;

      // 使用统一服务解析整个工作流
      const result = await HazardHandlerResolverService.resolveWorkflow({
        hazard: mockHazard,
        workflowSteps: workflowConfig.steps || [],
        allUsers: allUsers || [],
        departments: departments || [],
        reporter
      });

      if (!result.success) {
        console.warn('⚠️ [流程预览] 工作流解析失败:', result.error);
      }

      console.log('✅ [流程预览] 工作流解析完成:', {
        success: result.success,
        stepsCount: result.steps.length,
        successfulSteps: result.steps.filter(s => s.success).length
      });

      // 转换结果格式以适配前端预览显示
      const preview = {
        steps: result.steps.map(step => ({
          stepName: step.stepName,
          stepKey: step.stepId,
          success: step.success,
          handlers: step.handlers.userNames || [],
          matchedBy: step.handlers.matchedBy,
          error: step.error,
          ccUsers: step.ccUsers.userNames || [],
          ccUserIds: step.ccUsers.userIds || [],
          ccDetails: step.ccUsers.details || [],
          // 保留候选处理人和审批模式信息（用于后续扩展）
          candidateHandlers: step.candidateHandlers,
          approvalMode: step.approvalMode
        }))
      };

      // 验证每个步骤的数据
      preview.steps.forEach((step: any, idx: number) => {
        console.log(`🔍 [流程预览] 步骤 ${idx + 1} (${step.stepName}) 最终数据:`, {
          处理人: step.handlers,
          抄送人员: step.ccUsers,
          抄送人员ID: step.ccUserIds,
          抄送规则详情: step.ccDetails?.map((d: any) => ({
            规则ID: d.ruleId,
            匹配方式: d.matchedBy,
            匹配到的用户: d.userNames,
          })),
          审批模式: step.approvalMode,
          候选处理人: step.candidateHandlers
        });
      });

      console.log('🎯 [流程预览] 最终流程预览:', preview);

      setWorkflowPreview(preview);
      setShowWorkflowPreview(true);
    } catch (error) {
      console.error('❌ [流程预览] 流程预测失败:', error);
      setWorkflowPreview(null);
      setShowWorkflowPreview(false);
    }
  };

  useEffect(() => {
    // 只有在选择了责任人之后才进行流程预览
    if (formData.type && formData.location && formData.responsibleId && workflowConfig) {
      predictWorkflow();
    } else {
      // 如果责任人未选择，清空预览
      setWorkflowPreview(null);
      setShowWorkflowPreview(false);
    }
  }, [formData.type, formData.location, formData.riskLevel, formData.responsibleId]);

  const handleSubmit = () => {
    const { type, location, desc, rectifyRequirement, deadline, responsibleDeptId, responsibleDeptName, responsibleId, responsibleName } = formData;
    
    if (!type || !location || !desc) {
      alert('请填写基础隐患信息（类型、区域、描述）');
      return;
    }
    
    if (!rectifyRequirement) {
      alert('请填写整改措施');
      return;
    }
    
    if (!responsibleDeptId || !responsibleId) {
      alert('请选择责任部门和责任人');
      return;
    }
    
    if (!deadline) {
      alert('请设置整改期限');
      return;
    }

    if (!workflowPreview || !workflowPreview.steps || workflowPreview.steps.length === 0) {
      alert('流程配置错误：无法匹配处理人，请检查工作流配置或联系管理员');
      return;
    }

    const failedSteps = workflowPreview.steps.filter((s: any) => !s.success);
    if (failedSteps.length > 0) {
      const errorMessages = failedSteps.map((s: any) => `${s.stepName}: ${s.error}`).join('\n');
      alert(`流程配置错误，以下步骤无法匹配处理人：\n\n${errorMessages}\n\n请检查工作流配置或联系管理员`);
      return;
    }

    // 收集第一步的抄送人ID（步骤1：上报并指派）
    const firstStep = workflowPreview.steps[0];
    // 优先使用 ccUserIds，如果没有则从 ccDetails 中提取（兼容旧数据）
    const firstStepCCUserIds = firstStep?.ccUserIds || firstStep?.ccDetails?.map((d: any) => d.userId).filter(Boolean) || [];
    const firstStepCCUserNames = firstStep?.ccUsers || [];

    // 提交数据：保留用户填写的责任部门和责任人作为业务数据
    // 流程执行人将由后端工作流引擎根据配置自动匹配
    const finalData = {
      checkType: formData.checkType, // 检查类型
      type,
      location,
      desc,
      rectifyRequirement, // 整改措施
      deadline,
      riskLevel: formData.riskLevel,
      rectificationType: formData.rectificationType, // 整改方式
      photos,
      status: 'reported', // 初始状态为 reported
      // 上报人信息（用于处理人匹配，如"上报人主管"策略）
      reporterDepartmentId: user?.departmentId,
      reporterDepartment: user?.department,
      // 保留用户填写的责任部门和责任人（业务数据）
      responsibleId,
      responsibleName,
      responsibleDeptId,
      responsibleDeptName,
      // 第一步的抄送人
      ccUsers: firstStepCCUserIds,
      ccUserNames: firstStepCCUserNames,
      logs: [{
        operatorId: user?.id,
        operatorName: user?.name || '系统',
        action: '上报隐患',
        time: new Date().toISOString(),
        changes: `责任部门：${responsibleDeptName}，责任人：${responsibleName}，期限：${deadline}`,
        ccUsers: firstStepCCUserIds,
        ccUserNames: firstStepCCUserNames
      }]
    };

    onSubmit(finalData);
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-2 lg:p-4 backdrop-blur-sm"
      onDragEnter={isDesktop ? handleDragEnter : undefined}
      onDragLeave={isDesktop ? handleDragLeave : undefined}
      onDragOver={isDesktop ? handleDragOver : undefined}
      onDrop={isDesktop ? handleDrop : undefined}
    >
      {/* 桌面端拖拽提示 overlay */}
      {isDesktop && isDragging && (
        <div className="absolute inset-0 z-[60] bg-blue-600/90 backdrop-blur-md flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <Upload size={64} className="text-white mx-auto mb-4 animate-bounce" />
            <h3 className="text-2xl font-bold text-white mb-2">松开鼠标上传图片</h3>
            <p className="text-blue-100">支持 JPG、PNG、JPEG 格式</p>
          </div>
        </div>
      )}
      
      <div className="bg-white w-full max-w-6xl rounded-xl shadow-2xl flex flex-col lg:flex-row overflow-hidden" style={{ maxHeight: '90vh' }}>
        {/* 移动端：顶部折叠的流程预览卡片 */}
        <div className="lg:hidden border-b bg-gradient-to-r from-blue-50 to-purple-50">
          <button 
            onClick={() => setIsMobileWorkflowExpanded(!isMobileWorkflowExpanded)}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-blue-50/50 transition-colors"
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <GitBranch size={18} className="text-blue-600 shrink-0" />
              <div className="flex flex-col items-start min-w-0 flex-1">
                <div className="flex items-center gap-2 w-full">
                  <span className="font-medium text-slate-800">流程预览</span>
                  {workflowPreview && workflowPreview.steps && (
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-medium shrink-0">
                      {workflowPreview.steps.filter((s: any) => s.success).length}/{workflowPreview.steps.length}
                    </span>
                  )}
                </div>
                {!isMobileWorkflowExpanded && (
                  <span className="text-xs text-slate-400 mt-0.5">点击查看流程预览</span>
                )}
              </div>
            </div>
            <ChevronDown 
              size={18} 
              className={`text-slate-400 transition-transform duration-200 shrink-0 ml-2 ${isMobileWorkflowExpanded ? 'rotate-180' : ''}`}
            />
          </button>
          
          {/* 折叠内容 */}
          {isMobileWorkflowExpanded && showWorkflowPreview && workflowPreview ? (
            <div className="px-4 pb-4 max-h-[40vh] overflow-y-auto">
              <div className="space-y-2">
                {workflowPreview.steps && workflowPreview.steps.length > 0 ? (
                  workflowPreview.steps.map((step: any, idx: number) => (
                    <div key={idx} className="bg-white rounded-lg p-3 shadow-sm">
                      <div className="flex items-start gap-2">
                        <div className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          step.success ? 'bg-blue-500 text-white' : 'bg-red-500 text-white'
                        }`}>
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-slate-800 text-sm truncate">{step.stepName}</div>
                          {step.success ? (
                            <div className="mt-1.5 space-y-1">
                              <div className="flex items-center gap-1.5 text-blue-600 text-xs">
                                <User size={12} className="shrink-0" />
                                <span className="truncate">{step.handlers.join('、')}</span>
                              </div>
                              {step.ccUsers && step.ccUsers.length > 0 && (
                                <div className="flex items-center gap-1 text-purple-600 text-xs">
                                  <Mail size={10} className="shrink-0" />
                                  <span className="truncate">
                                    {step.ccUsers.slice(0, 2).join('、')}{step.ccUsers.length > 2 ? '等' : ''}
                                  </span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-red-500 text-xs mt-1">无法匹配处理人</div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-slate-400 text-center py-4">
                    暂无流程配置或无法匹配处理人
                  </div>
                )}
              </div>
            </div>
          ) : isMobileWorkflowExpanded && (
            <div className="px-4 pb-4 text-xs text-slate-400 text-center py-4">
              请填写表单信息以预览流程
            </div>
          )}
        </div>

        {/* 桌面端：左侧流程预览 */}
        <div className="hidden lg:block w-2/5 bg-gradient-to-br from-blue-50 to-purple-50 p-6 overflow-y-auto border-r">
          <div className="flex items-center gap-2 mb-4">
            <GitBranch size={20} className="text-blue-600" />
            <h3 className="text-lg font-bold text-slate-800">流程预览</h3>
          </div>

          {showWorkflowPreview && workflowPreview ? (
            <div className="space-y-4">
              {workflowPreview.steps && workflowPreview.steps.length > 0 && (
                <div className="space-y-3">
                  <div className="text-xs font-bold text-blue-700 mb-2">处理流程</div>
                  {workflowPreview.steps.map((step: any, idx: number) => (
                    <div key={idx} className="bg-white rounded-lg p-3 shadow-sm">
                      <div className="flex items-start gap-2">
                        <div className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                          step.success ? 'bg-blue-500 text-white' : 'bg-red-500 text-white'
                        }`}>
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-slate-800 text-sm">{step.stepName}</div>
                          {step.success ? (
                            <div className="mt-1 space-y-1.5">
                              <div className="flex items-center gap-1 text-blue-600 text-xs">
                                <CheckCircle size={12} />
                                <span className="font-medium">处理人：{step.handlers.join('、')}</span>
                              </div>
                              {step.matchedBy && (
                                <div className="text-slate-400 text-xs">
                                  策略：{STRATEGY_NAME_MAP[step.matchedBy] || step.matchedBy}
                                </div>
                              )}
                              {step.ccUsers && step.ccUsers.length > 0 && (
                                <div className="pt-1 border-t border-slate-100">
                                  <div className="flex items-center gap-1 text-purple-600 text-xs mb-1">
                                    <Mail size={10} />
                                    <span className="font-medium">抄送：</span>
                                  </div>
                                  <div className="flex flex-wrap gap-1">
                                    {step.ccUsers.map((ccUser: string, ccIdx: number) => (
                                      <span key={ccIdx} className="px-1.5 py-0.5 bg-purple-50 text-purple-600 text-xs rounded">
                                        {ccUser}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-red-500 text-xs mt-1">{step.error}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {(!workflowPreview.steps || workflowPreview.steps.length === 0) && (
                <div className="text-xs text-slate-400 text-center py-8">
                  暂无流程配置或无法匹配处理人
                </div>
              )}
            </div>
          ) : (
            <div className="text-xs text-slate-400 text-center py-8">
              请填写表单信息以预览流程
            </div>
          )}
        </div>

        {/* 表单区域 - 移动端全宽，桌面端右侧 */}
        <div className="flex-1 p-4 lg:p-6 overflow-y-auto flex flex-col">
          <div className="flex justify-between items-center mb-4 shrink-0">
            <h3 className="text-lg font-bold">上报新隐患</h3>
            <button 
              onClick={onClose}
              className="p-1 hover:bg-slate-100 rounded transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <div className="mb-4 shrink-0">
            <div className="flex gap-2 overflow-x-auto py-2 scrollbar-hide -mx-4 px-4 lg:mx-0 lg:px-0">
              {photoUrls.map((url, i) => (
                <div key={i} className="shrink-0 flex-shrink-0 relative">
                  <img src={url} className="w-20 h-20 object-cover rounded border" alt={`照片${i + 1}`} />
                  {uploadingPhotos.has(i) && (
                    <div className="absolute inset-0 bg-black/50 rounded flex items-center justify-center">
                      <Loader2 size={20} className="text-white animate-spin" />
                    </div>
                  )}
                  {!uploadingPhotos.has(i) && (
                    <button
                      onClick={() => {
                        setPhotos(prev => prev.filter((_, idx) => idx !== i));
                        setPhotoUrls(prev => prev.filter((_, idx) => idx !== i));
                      }}
                      className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              ))}
              <label className="shrink-0 flex-shrink-0 w-20 h-20 min-w-[80px] min-h-[80px] border-2 border-dashed border-slate-300 rounded flex flex-col items-center justify-center text-slate-400 cursor-pointer hover:border-red-400 active:border-red-500 transition-colors">
                <Camera size={20} className="shrink-0" />
                <span className="text-[10px] mt-1 text-center leading-tight whitespace-nowrap">上传照片</span>
                <input 
                  type="file" 
                  accept="image/jpeg,image/jpg,image/png" 
                  capture="environment"
                  className="hidden" 
                  onChange={handleFile} 
                />
              </label>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-2">
                检查类型 <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-3 lg:grid-cols-6 gap-2">
                {checkTypes.map(checkType => (
                  <button
                    key={checkType.value}
                    type="button"
                    onClick={() => setFormData({...formData, checkType: checkType.value})}
                    className={`px-2 py-2 rounded-lg text-xs font-medium transition-all ${
                      formData.checkType === checkType.value
                        ? 'bg-purple-500 text-white ring-2 ring-offset-1 ring-purple-400 shadow-md'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span className="truncate">{checkType.name}</span>
                      {formData.checkType === checkType.value && (
                        <CheckCircle size={12} className="shrink-0" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-2">
                隐患级别 <span className="text-red-500">*</span>
              </label>
              {/* 移动端和桌面端：横向网格 */}
              <div className="grid grid-cols-4 gap-2">
                {(['low', 'medium', 'high', 'major'] as RiskLevel[]).map(level => {
                  const config = RISK_LEVEL_MAP[level];
                  return (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setFormData({...formData, riskLevel: level})}
                      className={`px-2 py-2.5 lg:px-4 lg:py-3 rounded-lg text-xs lg:text-sm font-medium transition-all ${
                        formData.riskLevel === level 
                          ? `${config.bg} ${config.text} ring-2 ring-offset-1 lg:ring-offset-2 ${config.ring} shadow-md`
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-center gap-1 lg:gap-2">
                        <span className="truncate">{config.label}</span>
                        {formData.riskLevel === level && (
                          <CheckCircle size={12} className={`${config.text} shrink-0 lg:w-4 lg:h-4`} />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-2">
                整改方式 <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({...formData, rectificationType: 'immediate'})}
                  className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    formData.rectificationType === 'immediate'
                      ? 'bg-green-500 text-white ring-2 ring-offset-1 ring-green-400 shadow-md'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <span>立即整改</span>
                    {formData.rectificationType === 'immediate' && (
                      <CheckCircle size={14} className="shrink-0" />
                    )}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({...formData, rectificationType: 'scheduled'})}
                  className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    formData.rectificationType === 'scheduled'
                      ? 'bg-blue-500 text-white ring-2 ring-offset-1 ring-blue-400 shadow-md'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <span>限期整改</span>
                    {formData.rectificationType === 'scheduled' && (
                      <CheckCircle size={14} className="shrink-0" />
                    )}
                  </div>
                </button>
              </div>
              {formData.rectificationType === 'immediate' && (
                <p className="text-xs text-green-600 mt-1.5">整改期限将自动设置为今日23:59:59</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  隐患类型 <span className="text-red-500">*</span>
                </label>
                <select className="w-full border rounded-lg p-2 text-sm" onChange={(e) => setFormData({...formData, type: e.target.value})}>
                  <option value="">请选择</option>
                  {config.types.map((o: string) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  发现位置 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="w-full border rounded-lg p-2 text-sm"
                  placeholder="请输入具体位置，如：3号车间东侧"
                  value={formData.location}
                  onChange={(e) => setFormData({...formData, location: e.target.value})}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  责任部门 <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowDeptModal(true)}
                  className="w-full border rounded-lg p-2 text-sm text-left bg-white hover:border-blue-400 transition-colors flex justify-between items-center group"
                >
                  <span className={formData.responsibleDeptName ? 'text-slate-800' : 'text-slate-400'}>
                    {formData.responsibleDeptName || '请选择部门'}
                  </span>
                  <ChevronRight size={16} className="text-slate-400 group-hover:text-blue-500" />
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  责任人 <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowUserModal(true)}
                  disabled={!formData.responsibleDeptId}
                  className={`w-full border rounded-lg p-2 text-sm text-left transition-colors flex justify-between items-center group ${
                    !formData.responsibleDeptId
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      : 'bg-white hover:border-blue-400'
                  }`}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <User size={16} className={`shrink-0 ${formData.responsibleName ? 'text-blue-500' : 'text-slate-400'}`} />
                    <span className={`truncate ${formData.responsibleName ? 'text-slate-800' : 'text-slate-400'}`}>
                      {formData.responsibleName || '请选择责任人'}
                    </span>
                  </div>
                  <ChevronRight size={16} className="text-slate-400 group-hover:text-blue-500 shrink-0" />
                </button>
                {!formData.responsibleDeptId && (
                  <p className="text-xs text-slate-400 mt-1">请先选择责任部门</p>
                )}
              </div>
            </div>

            {formData.rectificationType === 'scheduled' && (
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  整改期限 <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  className="w-full border rounded-lg p-2 text-sm"
                  value={formData.deadline}
                  onChange={(e) => setFormData({...formData, deadline: e.target.value})}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  隐患描述 <span className="text-red-500">*</span>
                </label>
                <textarea 
                  className="w-full border rounded-lg p-3 text-sm h-32" 
                  placeholder="请详细描述发现的隐患情况..." 
                  value={formData.desc}
                  onChange={(e) => setFormData({...formData, desc: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  整改措施 <span className="text-red-500">*</span>
                </label>
                <textarea 
                  className="w-full border rounded-lg p-3 text-sm h-32" 
                  placeholder="请填写具体的整改措施和要求..." 
                  value={formData.rectifyRequirement}
                  onChange={(e) => setFormData({...formData, rectifyRequirement: e.target.value})}
                />
              </div>
            </div>
          </div>

          {/* 移动端：固定在底部，桌面端：跟随表单 */}
          <div className="mt-4 lg:mt-4 shrink-0">
            {/* 移动端：固定底部双按钮 */}
            <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 safe-area-inset-bottom z-40">
              <div className="flex gap-3 max-w-6xl mx-auto">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-3 rounded-lg border-2 border-slate-300 text-slate-700 font-medium hover:bg-slate-50 active:scale-95 transition"
                >
                  取消
                </button>
                <button
                  onClick={handleSubmit}
                  className="flex-[2] px-6 py-3 rounded-lg bg-red-600 text-white font-bold shadow-lg hover:bg-red-700 active:scale-95 transition"
                >
                  确认并指派整改
                </button>
              </div>
            </div>
            
            {/* 桌面端：跟随表单 */}
            <button
              onClick={handleSubmit}
              className="hidden lg:block w-full bg-red-600 text-white py-3 rounded-lg font-bold shadow-lg hover:bg-red-700 transition"
            >
              确认并指派整改
            </button>
          </div>
          
          {/* 移动端：为底部按钮预留空间 */}
          <div className="lg:hidden h-20 shrink-0" />
        </div>
      </div>

      <PeopleSelector
        isOpen={showDeptModal}
        onClose={() => setShowDeptModal(false)}
        mode="dept"
        onConfirm={(selection) => {
            if (Array.isArray(selection) && selection.length > 0) {
                // @ts-ignore
                handleDeptSelect(selection[0].id, selection[0].name);
            }
            setShowDeptModal(false);
        }}
        title="选择责任部门"
      />

      <PeopleSelector
        isOpen={showUserModal}
        onClose={() => setShowUserModal(false)}
        mode="user"
        viewMode="grid"
        showDeptTree={false}
        multiSelect={false}
        activeUsersOnly={true}
        initialDeptId={formData.responsibleDeptId}
        onConfirm={(selection) => {
          if (Array.isArray(selection) && selection.length > 0) {
            const user = selection[0] as any;
            handleUserSelect([{ 
              userId: user.id, 
              userName: user.name 
            }]);
          }
        }}
        title="选择责任人"
      />
    </div>
  );
}
