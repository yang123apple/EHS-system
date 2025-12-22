import { useState, useRef, useMemo, useEffect } from 'react';
import { X, Paperclip, CheckCircle, FileText } from 'lucide-react';
import { Project, Template } from '@/types/work-permit';
import { PermitService } from '@/services/workPermitService';
import ExcelRenderer from '../ExcelRenderer';
import SectionFormModal from './SectionFormModal';
// 🟢 1. 引入工具函数（替换原内联定义）
import { findDeptRecursive } from '@/utils/departmentUtils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  templates: Template[];
  user: any;
  departments: any[];
  allUsers: any[];
  onSuccess: () => void;
}

export default function AddPermitModal({
  isOpen,
  onClose,
  project,
  templates,
  user,
  departments,
  allUsers,
  onSuccess,
}: Props) {
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [permitFormData, setPermitFormData] = useState<Record<string, any>>({});
  const [attachments, setAttachments] = useState<any[]>([]);
  const [opinion, setOpinion] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [previewCode, setPreviewCode] = useState<string>(''); // 🟢 预览编号
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 🔵 V3.4 Section表单状态
  const [sectionModalOpen, setSectionModalOpen] = useState(false);
  const [currentSectionCell, setCurrentSectionCell] = useState<{ cellKey: string; fieldName: string } | null>(null);
  const [allTemplates, setAllTemplates] = useState<Template[]>([]);

  // 🔵 加载所有模板（用于section绑定）
  useEffect(() => {
    fetch('/api/templates')
      .then(res => res.json())
      .then(data => setAllTemplates(data))
      .catch(err => console.error('加载模板失败:', err));
  }, []);

  const selectedTemplateData = useMemo(() => {
    if (!selectedTemplate) return null;
    try {
      return JSON.parse(selectedTemplate.structureJson);
    } catch (e) {
      return { grid: [['错误']] };
    }
  }, [selectedTemplate?.id]);

  const selectedParsedFields = useMemo(() => {
    if (!selectedTemplate?.parsedFields) return [];
    try {
      const parsed = JSON.parse(selectedTemplate.parsedFields);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }, [selectedTemplate?.parsedFields]);

  // 🟢 当选择模板后，预生成编号
  useEffect(() => {
    if (selectedTemplate && project) {
      fetch(`/api/permits?action=generate-code&projectId=${project.id}&templateType=${encodeURIComponent(selectedTemplate.type)}`)
        .then(res => res.json())
        .then(data => {
          if (data.code) {
            setPreviewCode(data.code);
          }
        })
        .catch(err => {
          console.error('预生成编号失败:', err);
        });
    } else {
      setPreviewCode('');
    }
  }, [selectedTemplate?.id, project?.id]);

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

  // 🔵 V3.4 Section相关处理函数
  const handleSectionClick = (cellKey: string, fieldName: string) => {
    console.log('🔵 Section clicked:', { cellKey, fieldName, selectedTemplate });
    setCurrentSectionCell({ cellKey, fieldName });
    setSectionModalOpen(true);
    console.log('🔵 Section modal opened');
  };

  const handleSectionSave = (sectionData: {
    templateId: string;
    templateName: string;
    code: string;
    data: Record<string, any>;
  }) => {
    if (!currentSectionCell) return;
    
    // 存储section数据到permitFormData中，使用SECTION_前缀
    setPermitFormData(prev => ({
      ...prev,
      [`SECTION_${currentSectionCell.cellKey}`]: sectionData
    }));
    
    setSectionModalOpen(false);
    setCurrentSectionCell(null);
  };

  // 🟢 2. 完全替换 preCheckWorkflow 函数（使用外部 findDeptRecursive）
  const preCheckWorkflow = (): boolean => {
    if (!selectedTemplate?.workflowConfig) return true;
    let config: any[] = [];
    try {
      config = JSON.parse(selectedTemplate.workflowConfig);
    } catch (e) {
      alert('流程配置格式错误，请联系管理员。');
      return false;
    }

    // 遍历每一个步骤进行预演
    for (let i = 0; i < config.length; i++) {
      const step = config[i];
      const stepName = step.name || `步骤${i + 1}`;

      // 🟢 步骤一（申请人签署）跳过验证，因为强制为申请人，不需要验证审批人和绑定单元格
      if (i === 0 || step.step === 0) {
        continue;
      }

      // 1. 策略：提交人部门负责人
      if (step.approverStrategy === 'current_dept_manager') {
        // --- 🟢 修复核心逻辑开始 ---
        // A. 获取最新的用户数据
        const freshUser = allUsers.find(u => String(u.id) === String(user.id)) || user;
        const currentDeptId = freshUser.departmentId;
        if (!currentDeptId) {
          alert(`无法提交：账号 [${freshUser.name}] 未绑定部门，无法解析 [${stepName}]。`);
          return false;
        }

        // B. 使用递归查找部门（解决子部门找不到的问题）
        console.log(`正在查找部门 ID: ${currentDeptId} (支持多级嵌套)`);
        // 🔴 新增这一行：打印完整的部门数据结构
        console.log('=== 系统返回的部门数据 ===', JSON.stringify(departments, null, 2));
        const dept = findDeptRecursive(departments, currentDeptId);
        console.log('递归查找结果:', dept);
        if (!dept) {
          alert(
            `数据异常：用户归属部门ID (${currentDeptId}) 无法在组织架构树中找到。\n请检查该部门是否已被删除，或联系管理员同步组织架构。`
          );
          return false;
        }
        // --- 🟢 修复核心逻辑结束 ---

        if (!dept.managerId) {
          alert(
            `无法提交：您所在的部门 [${dept.name}] 尚未设置负责人，导致 [${stepName}] 无人审批。请联系管理员。`
          );
          return false;
        }

        // (可选) 进一步检查负责人是否存在
        const manager = allUsers.find((u) => String(u.id) === String(dept.managerId));
        if (!manager) {
          alert(`无法提交：部门 [${dept.name}] 的负责人数据异常（找不到该用户 ID: ${dept.managerId}）。`);
          return false;
        }
      }

      // 2. 策略：指定部门负责人 (同样应用递归修复)
      if (step.approverStrategy === 'specific_dept_manager') {
        const targetDeptId = step.strategyConfig?.targetDeptId;
        if (!targetDeptId) {
          alert(`流程配置错误：[${stepName}] 未指定目标部门。`);
          return false;
        }

        // 🟢 这里也改成递归查找
        const dept = findDeptRecursive(departments, targetDeptId);
        if (!dept || !dept.managerId) {
          alert(
            `无法提交：指定的部门 [${dept?.name || targetDeptId}] 不存在或未设置负责人。`
          );
          return false;
        }

        const manager = allUsers.find((u) => String(u.id) === String(dept.managerId));
        if (!manager) {
          alert(`无法提交：部门 [${dept.name}] 的负责人数据异常（找不到该用户 ID: ${dept.managerId}）。`);
          return false;
        }
      }

      // 3. 策略：指定角色
      if (step.approverStrategy === 'role') {
        const { targetDeptId, roleName } = step.strategyConfig || {};
        if (!targetDeptId || !roleName) {
          alert(`流程配置错误：[${stepName}] 角色配置不完整。`);
          return false;
        }

        // 可选：校验目标部门是否存在（使用递归）
        const dept = findDeptRecursive(departments, targetDeptId);
        if (!dept) {
          alert(`无法提交：指定的角色审批部门 ID [${targetDeptId}] 不存在于组织架构中。`);
          return false;
        }

        const candidates = allUsers.filter(
          (u) =>
            String(u.departmentId) === String(targetDeptId) &&
            u.jobTitle &&
            u.jobTitle.includes(roleName)
        );
        if (candidates.length === 0) {
          alert(
            `无法提交：在部门 [${dept.name}] 中未找到职位包含 "${roleName}" 的人员，导致 [${stepName}] 无人审批。`
          );
          return false;
        }
      }

      // 4. 策略：固定人员（或默认）
      if (
        (!step.approverStrategy || step.approverStrategy === 'fixed') &&
        (!step.approvers || step.approvers.length === 0)
      ) {
        if (!step.outputCell) {
          alert(`流程配置错误：[${stepName}] 未设置审批人且未绑定单元格。`);
          return false;
        }
        // 绑定 outputCell 的情况在运行时处理，此处跳过
      }
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!selectedTemplate) return;
    if (!preCheckWorkflow()) {
      return;
    }
    if (!confirm('确认提交申请？提交后将自动进入审批流程。')) return;

    setIsSubmitting(true);
    try {
      const newRecord = await PermitService.create({
        projectId: project.id,
        templateId: selectedTemplate.id,
        dataJson: permitFormData,
        attachments: attachments,
        proposedCode: previewCode, // 🟢 传递预览编号
      });

      // ✅ 修改点：发起申请自动设为通过第一步
      console.log('🔍 [调试] 提交审批前的 user 对象:', user);
      console.log('🔍 [调试] user.id =', user?.id);
      
      await PermitService.approve({
        recordId: newRecord.id,
        opinion: opinion.trim() || '发起申请',
        action: 'pass',
        userName: user?.name || '用户',
        userId: user?.id, // 🟢 传递发起人 ID，用于部门负责人策略
      });

      alert('✅ 申请已提交！');
      setPermitFormData({});
      setAttachments([]);
      setOpinion('');
      onSuccess();
    } catch (e) {
      console.error(e);
      alert('提交失败，请重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl w-full max-w-[95vw] h-[92vh] flex flex-col shadow-2xl">
        <div className="p-4 border-b flex justify-between items-center bg-slate-50 rounded-t-xl">
          <h3 className="font-bold text-lg text-slate-800">新增作业单 - {project.name}</h3>
          <div className="flex gap-2">
            <button
              onClick={() => setOrientation(o => o === 'portrait' ? 'landscape' : 'portrait')}
              className="p-2 rounded border transition flex items-center justify-center bg-white text-slate-700 border-slate-300 hover:bg-slate-100 hover:border-slate-400"
              title={orientation === 'portrait' ? '当前：竖向纸张，点击切换为横向' : '当前：横向纸张，点击切换为竖向'}
            >
              {orientation === 'portrait' ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="7" y="2" width="10" height="20" rx="1" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="7" width="20" height="10" rx="1" />
                </svg>
              )}
            </button>
            <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded text-slate-500">
              <X size={20} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-hidden flex">
          {/* 左侧模板选择 */}
          <div className="w-64 border-r p-4 overflow-y-auto bg-slate-50/50">
            <h4 className="text-xs font-bold text-slate-500 mb-3 uppercase tracking-wider">选择模板</h4>
            <div className="space-y-2">
              {templates
                .filter((t) => !t.isLocked)
                .map((t) => (
                  <div
                    key={t.id}
                    onClick={() => {
                      setSelectedTemplate(t);
                      setPermitFormData({});
                    }}
                    className={`p-3 rounded-lg cursor-pointer text-sm transition-all border ${
                      selectedTemplate?.id === t.id
                        ? 'bg-blue-50 font-bold border-blue-200 text-blue-700 shadow-sm'
                        : 'bg-white border-transparent hover:bg-white hover:shadow-sm text-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <FileText
                        size={16}
                        className={selectedTemplate?.id === t.id ? 'text-blue-500' : 'text-slate-400'}
                      />
                      {t.name}
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* 右侧表单填写 */}
          <div className="flex-1 p-6 overflow-auto bg-slate-100">
            {selectedTemplate ? (
              <div 
                className="mx-auto flex flex-col gap-4"
                style={{
                  width: orientation === 'portrait' ? '210mm' : '297mm',
                  maxWidth: '100%',
                }}
              >
                {/* 附件管理 */}
                <div className="bg-white border rounded-lg p-3 shadow-sm">
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-700 text-sm">附件材料</span>
                      <span className="text-xs text-slate-400">(选填，支持图片/PDF，最大50MB)</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        onChange={handleFileSelect}
                      />
                      <button
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
                          <span className="max-w-[150px] truncate" title={file.name}>
                            {file.name}
                          </span>
                          <button
                            onClick={() => handleRemoveAttachment(idx)}
                            className="hover:text-red-500 ml-1"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 italic py-1">暂无附件</div>
                  )}
                </div>

                {/* Excel 渲染区域 */}
                <div 
                  className="bg-white shadow-lg border border-slate-200 p-8 overflow-auto"
                  style={{
                    minHeight: orientation === 'portrait' ? '297mm' : '210mm',
                  }}
                >
                  <ExcelRenderer
                    key={selectedTemplate.id}
                    templateData={selectedTemplateData}
                    workflowConfig={
                      selectedTemplate.workflowConfig ? JSON.parse(selectedTemplate.workflowConfig) : []
                    }
                    parsedFields={selectedParsedFields}
                    permitCode={previewCode} // 🟢 显示预览编号
                    orientation={orientation}
                    mode="edit"
                    onDataChange={setPermitFormData}
                    onSectionClick={handleSectionClick}
                    sectionBindings={selectedTemplate.sectionBindings ? JSON.parse(selectedTemplate.sectionBindings) : {}}
                  />
                </div>

                {/* 申请人附言与提交 */}
                <div className="bg-white border rounded-lg p-4 shadow-sm sticky bottom-0 z-10 mt-4">
                  <label className="block text-sm font-bold text-slate-700 mb-2">申请人附言 (选填)</label>
                  <textarea
                    className="w-full border rounded p-2 text-sm h-20 outline-none focus:ring-2 focus:ring-blue-500 mb-4 bg-slate-50 focus:bg-white transition-colors"
                    placeholder="请在此输入备注、紧急说明或其他需要审批人注意的事项..."
                    value={opinion}
                    onChange={(e) => setOpinion(e.target.value)}
                  />
                  <div className="flex justify-end pt-2 border-t border-slate-100">
                    <button
                      onClick={handleSubmit}
                      disabled={isSubmitting}
                      className="bg-green-600 text-white px-6 py-2.5 rounded shadow-lg shadow-green-200 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-bold transition-all active:scale-95"
                    >
                      {isSubmitting ? (
                        <span className="animate-spin">⏳</span>
                      ) : (
                        <CheckCircle size={18} />
                      )}
                      {isSubmitting ? '提交中...' : '提交申请'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <FileText size={48} className="mb-4 text-slate-200" />
                <p>请在左侧选择一个模板开始填写</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 🔵 V3.4 Section表单弹窗 */}
      {(() => {
        console.log('🔵 SectionFormModal render check:', {
          sectionModalOpen,
          currentSectionCell,
          hasSelectedTemplate: !!selectedTemplate,
          shouldRender: sectionModalOpen && currentSectionCell && selectedTemplate
        });
        
        if (sectionModalOpen && currentSectionCell && selectedTemplate) {
          const bindings = selectedTemplate.sectionBindings 
            ? JSON.parse(selectedTemplate.sectionBindings) 
            : {};
          const templateId = bindings[currentSectionCell.cellKey];
          const boundTemplate = allTemplates.find(t => t.id === templateId) || null;
          
          console.log('🔵 Rendering SectionFormModal:', {
            cellKey: currentSectionCell.cellKey,
            fieldName: currentSectionCell.fieldName,
            boundTemplate: boundTemplate?.name,
            parentCode: previewCode
          });
          
          // 检查是否已绑定二级模板
          if (!boundTemplate) {
            return (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                <div className="bg-white rounded-lg p-6 max-w-md shadow-xl">
                  <h3 className="text-lg font-bold text-red-600 mb-4">⚠️ 未绑定二级模板</h3>
                  <p className="text-slate-600 mb-4">
                    此单元格（{currentSectionCell.cellKey}）尚未绑定二级模板。
                    <br />请先在模板编辑页面为该section字段绑定一个二级模板。
                  </p>
                  <button
                    onClick={() => {
                      setSectionModalOpen(false);
                      setCurrentSectionCell(null);
                    }}
                    className="w-full px-4 py-2 bg-slate-600 text-white rounded hover:bg-slate-700"
                  >
                    关闭
                  </button>
                </div>
              </div>
            );
          }
          
          return (
            <SectionFormModal
              isOpen={true}
              cellKey={currentSectionCell.cellKey}
              fieldName={currentSectionCell.fieldName}
              boundTemplate={boundTemplate}
              parentCode={previewCode}
              existingData={permitFormData[`SECTION_${currentSectionCell.cellKey}`]}
              onSave={handleSectionSave}
              onClose={() => {
                setSectionModalOpen(false);
                setCurrentSectionCell(null);
              }}
            />
          );
        }
        return null;
      })()}
    </div>
  );
}