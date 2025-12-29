// src/app/hidden-danger/_components/modals/HazardReportModal.tsx
import { useState, useEffect } from 'react';
import { X, Camera, ChevronRight, User, GitBranch, Mail, CheckCircle } from 'lucide-react';
import { HazardConfig, RiskLevel } from '@/types/hidden-danger';
import { RISK_LEVEL_MAP } from '@/constants/hazard';
import PeopleSelector from '@/components/common/PeopleSelector';
import { UserSelectModal } from '../workflow/UserSelectModal';
import { matchHandler } from '../../_utils/handler-matcher';
import { matchAllCCRules } from '../../_utils/cc-matcher';
import { useAuth } from '@/context/AuthContext';

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
  const [formData, setFormData] = useState({
    riskLevel: 'low' as RiskLevel,
    type: '',
    location: '',
    desc: '',
    responsibleDeptId: '',
    responsibleDeptName: '',
    responsibleId: '',
    responsibleName: '',
    deadline: ''
  });
  const [photos, setPhotos] = useState<string[]>([]);
  const [departments, setDepartments] = useState<any[]>(propDepartments || []);
  const [departmentTree, setDepartmentTree] = useState<any[]>([]); // 保存完整的部门树
  const [showWorkflowPreview, setShowWorkflowPreview] = useState(false);
  const [workflowPreview, setWorkflowPreview] = useState<any>(null);

  // 获取部门列表（如果没有从 props 传入）
  useEffect(() => {
    if (propDepartments && propDepartments.length > 0) {
      setDepartments(propDepartments);
    } else {
      const fetchDepartments = async () => {
        try {
          const res = await fetch('/api/org');
          const data = await res.json();
          
          // 保存完整的部门树（用于处理人匹配）
          setDepartmentTree(data);
          
          // 扁平化部门列表（用于选择器）
          // 重要：保留所有字段（包括 managerId），以便处理人匹配器正常工作
          const flattenDepts = (nodes: any[], result: any[] = []): any[] => {
            nodes?.forEach(node => {
              result.push({ 
                id: node.id, 
                name: node.name,
                parentId: node.parentId,
                level: node.level,
                managerId: node.managerId  // 保留 managerId
              });
              if (node.children?.length) {
                flattenDepts(node.children, result);
              }
            });
            return result;
          };
          setDepartments(flattenDepts(data));
        } catch (error) {
          console.error('获取部门列表失败:', error);
        }
      };
      fetchDepartments();
    }
  }, [propDepartments]);

  const handleFile = (e: any) => {
    const reader = new FileReader();
    reader.onload = (evt) => setPhotos([...photos, evt.target?.result as string]);
    reader.readAsDataURL(e.target.files[0]);
  };

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

  // 预测流程
  const predictWorkflow = async () => {
    if (!workflowConfig || !formData.type || !formData.location) {
      setWorkflowPreview(null);
      setShowWorkflowPreview(false);
      return;
    }

    try {
      console.log('🔍 开始流程预测:', {
        workflowConfig,
        formData,
        currentUser: user,
        allUsersCount: allUsers?.length,
        departmentsCount: departments?.length
      });

      // 确保 mockHazard 包含完整的上报人信息和责任人信息（用于流程预测）
      const mockHazard = {
        ...formData,
        reporterId: user?.id || 'current-user',
        reporterName: user?.name || '当前用户',
        reporterDepartment: user?.department,
        reporterDepartmentId: user?.departmentId,
        // 添加责任人信息（如果用户选择了的话，用于某些匹配策略）
        responsibleId: formData.responsibleId || undefined,
        responsibleName: formData.responsibleName || undefined,
        responsibleDeptId: formData.responsibleDeptId || undefined,
        assignedDepartmentId: formData.responsibleDeptId || undefined, // 用于责任部门主管匹配
        status: 'assigned' as any,
      };

      console.log('📋 模拟隐患对象:', mockHazard);
      console.log('👤 当前用户信息:', {
        id: user?.id,
        name: user?.name,
        department: user?.department,
        departmentId: user?.departmentId,
        jobTitle: user?.jobTitle
      });

      const steps = workflowConfig.steps || [];
      console.log('📝 工作流步骤数量:', steps.length);
      
      const stepPredictions = await Promise.all(
        steps.map(async (step: any, index: number) => {
          console.log(`🔄 预测步骤 ${index + 1}: ${step.name} (策略: ${step.handlerStrategy?.type})`);
          
          // 为步骤配置添加上下文信息，以便 matchFixed 可以自动推断
          const enrichedStep = {
            ...step,
            handlerStrategy: {
              ...step.handlerStrategy,
              config: {
                ...step.handlerStrategy.config,
                fixedUsers: step.handlerStrategy.fixedUsers, // 传递 fixedUsers
                _stepContext: {
                  id: step.id,
                  name: step.name
                }
              }
            }
          };
          
          const result = await matchHandler({
            hazard: mockHazard as any,
            step: enrichedStep,
            allUsers: allUsers || [],
            departments: departments,  // 使用 state 中扁平化后的部门数组
          });
          
          console.log(`✅ 步骤 ${index + 1} 匹配结果:`, result);
          
          // 匹配该步骤的抄送人员
          let stepCCUsers: string[] = [];
          let stepCCDetails: any[] = [];
          
          if (step.ccRules && step.ccRules.length > 0) {
            console.log(`📧 步骤 ${index + 1} 抄送规则数量:`, step.ccRules.length);
            console.log(`📧 步骤 ${index + 1} 抄送规则详情:`, step.ccRules.map((r: any) => ({ type: r.type, config: r.config })));
            
            const ccResult = await matchAllCCRules(
              mockHazard as any,
              step.ccRules,
              allUsers || [],
              departments  // 使用 state 中扁平化后的部门数组
            );
            
            stepCCUsers = ccResult.userNames;
            stepCCDetails = ccResult.details;
            
            console.log(`📧 步骤 ${index + 1} 抄送匹配结果:`, {
              成功规则数: ccResult.details.length,
              抄送人员: stepCCUsers,
              详情: ccResult.details
            });
          }
          
          return {
            stepName: step.name,
            stepKey: step.id,
            success: result.success,
            handlers: result.userNames || [],
            matchedBy: result.matchedBy,
            error: result.error,
            ccUsers: stepCCUsers,
            ccDetails: stepCCDetails,
          };
        })
      );

      console.log('📊 所有步骤预测完成:', stepPredictions);

      const preview = {
        steps: stepPredictions,
      };

      console.log('🎯 最终流程预览:', preview);

      setWorkflowPreview(preview);
      setShowWorkflowPreview(true);
    } catch (error) {
      console.error('❌ 流程预测失败:', error);
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
    const { type, location, desc, deadline, responsibleDeptId, responsibleDeptName, responsibleId, responsibleName } = formData;
    
    if (!type || !location || !desc) {
      alert('请填写基础隐患信息（类型、区域、描述）');
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
    const firstStepCCUserIds = firstStep?.ccDetails?.map((d: any) => d.userId).filter(Boolean) || [];
    const firstStepCCUserNames = firstStep?.ccUsers || [];

    // 提交数据：保留用户填写的责任部门和责任人作为业务数据
    // 流程执行人将由后端工作流引擎根据配置自动匹配
    const finalData = {
      type,
      location,
      desc,
      deadline,
      riskLevel: formData.riskLevel,
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
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white w-full max-w-6xl rounded-xl shadow-2xl flex overflow-hidden" style={{ maxHeight: '90vh' }}>
        {/* 左侧：流程预览 */}
        <div className="w-2/5 bg-gradient-to-br from-blue-50 to-purple-50 p-6 overflow-y-auto border-r">
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
                                <div className="text-slate-400 text-xs">策略：{step.matchedBy}</div>
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

        {/* 右侧：表单 */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold">上报新隐患</h3>
            <button onClick={onClose}><X size={20} /></button>
          </div>

          <div className="flex gap-2 overflow-x-auto py-2 mb-4">
            {photos.map((p, i) => <img key={i} src={p} className="w-20 h-20 object-cover rounded border" />)}
            <label className="w-20 h-20 border-2 border-dashed border-slate-300 rounded flex flex-col items-center justify-center text-slate-400 cursor-pointer hover:border-red-400">
              <Camera size={24} />
              <span className="text-[10px] mt-1">上传照片</span>
              <input type="file" className="hidden" onChange={handleFile} />
            </label>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-2">
                隐患级别 <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-4 gap-2">
                {(['low', 'medium', 'high', 'major'] as RiskLevel[]).map(level => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setFormData({...formData, riskLevel: level})}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                      formData.riskLevel === level 
                        ? `${RISK_LEVEL_MAP[level].bg} ${RISK_LEVEL_MAP[level].text} ring-2 ring-offset-2 ${RISK_LEVEL_MAP[level].ring}`
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {RISK_LEVEL_MAP[level].label}
                  </button>
                ))}
              </div>
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
          </div>

          <button 
            onClick={handleSubmit}
            className="w-full bg-red-600 text-white py-3 rounded-lg font-bold shadow-lg hover:bg-red-700 transition mt-4"
          >
            确认并指派整改
          </button>
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

      <UserSelectModal
        isOpen={showUserModal}
        onClose={() => setShowUserModal(false)}
        onSelect={handleUserSelect}
        allUsers={allUsers?.filter(u => u.departmentId === formData.responsibleDeptId) || []}
        departments={departments}
        selectedUserIds={formData.responsibleId ? [formData.responsibleId] : []}
        singleSelect={true}
      />
    </div>
  );
}
