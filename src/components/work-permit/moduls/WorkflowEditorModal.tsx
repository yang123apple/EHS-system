import { useState, useEffect } from 'react';
import { Plus, Save, X, Trash2, RefreshCw, Users, User, GitBranch, Briefcase, UserCog, Filter } from 'lucide-react';
import { Template, WorkflowStep, ParsedField, WorkflowPart, ApproverStrategyItem } from '@/types/work-permit';
import { TemplateService } from '@/services/workPermitService';
import ExcelRenderer from '../ExcelRenderer';
import DepartmentSelectModal from './DepartmentSelectModal';
import ApproverStrategyConfig from './ApproverStrategyConfig';
import { flattenDepartments } from '@/utils/departmentUtils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  template: Template;
  departments: any[];
  allUsers: any[];
  onRefreshDepts: () => void;
  onSuccess: () => void;
}

export default function WorkflowEditorModal({
  isOpen,
  onClose,
  template,
  departments,
  allUsers,
  onRefreshDepts,
  onSuccess,
}: Props) {
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStep[]>([]);
  const [workflowParts, setWorkflowParts] = useState<WorkflowPart[]>([]); // 🔵 V3.4 Part系统
  const [initialEditData, setInitialEditData] = useState<any>(null);
  const [parsedFields, setParsedFields] = useState<ParsedField[]>([]);
  const [isPickingCell, setIsPickingCell] = useState(false);
  const [editingStepIndex, setEditingStepIndex] = useState<number>(-1);
  const [editingPartIndex, setEditingPartIndex] = useState<number>(-1); // 🔵 编辑中的Part
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');

  // 部门选择器状态
  const [selectorTarget, setSelectorTarget] = useState<{
    type: 'approver' | 'strategy' | 'strategy_item';
    stepIdx: number;
    approverIdx?: number;
    strategyId?: string; // 🟢 V3.6 新增：用于多策略配置
  } | null>(null);

  // 🟢 V3.6 新增：用户选择器状态
  const [userSelectorOpen, setUserSelectorOpen] = useState(false);
  const [userSelectorTarget, setUserSelectorTarget] = useState<{
    stepIdx: number;
    strategyId: string;
  } | null>(null);

  // 🔵 判断是否为二级模板
  const isSecondaryTemplate = template?.level === 'secondary';

  useEffect(() => {
    if (isOpen && template) {
      try {
        const parsedData = JSON.parse(template.structureJson);
        setInitialEditData(parsedData);
        const cfg = template.workflowConfig ? JSON.parse(template.workflowConfig) : [];

        // 🔵 根据模板级别加载不同配置
        if (isSecondaryTemplate) {
          // 二级模板：加载Part配置并归一化
          const normalizedParts = (cfg as any[]).map(p => ({
            part: p.part || 1,
            name: p.name || '',
            outputCell: p.outputCell,
            pickStrategy: p.pickStrategy || 'field_match',
            pickConfig: p.pickConfig || { fieldName: '' },
          }));
          setWorkflowParts(normalizedParts);
        } else {
          // 一级模板：加载Step配置
          const normalized = (cfg as any[]).map(s => ({
            ...s,
            approvers: s.approvers || [],
            approvalMode: s.approvalMode || 'OR',
            approverStrategy: s.approverStrategy || 'fixed',
            strategyConfig: s.strategyConfig || { targetDeptId: '', roleName: '' },
          }));
          setWorkflowSteps(normalized);
        }

        // 🟢 加载解析的字段
        if (template.parsedFields) {
          try {
            const fields = JSON.parse(template.parsedFields);
            setParsedFields(fields);
          } catch (e) {
            console.error('Failed to parse template fields:', e);
            setParsedFields([]);
          }
        } else {
          setParsedFields([]);
        }
      } catch (e) {
        console.error('Parse error', e);
      }
    }
  }, [isOpen, template]);

  const updateStep = (idx: number, changes: Partial<WorkflowStep>) => {
    const newSteps = [...workflowSteps];
    newSteps[idx] = { ...newSteps[idx], ...changes };
    setWorkflowSteps(newSteps);
  };

  // 🟢 V3.6 新增：更新审批人策略列表
  const updateApproverStrategies = (idx: number, strategies: ApproverStrategyItem[]) => {
    const newSteps = [...workflowSteps];
    newSteps[idx].approverStrategies = strategies;
    setWorkflowSteps(newSteps);
  };

  // 🟢 V3.6 新增：处理部门选择（针对多策略）
  const handleSelectDepartmentForStrategy = (stepIdx: number, strategyId: string) => {
    setSelectorTarget({
      type: 'strategy_item',
      stepIdx,
      strategyId,
    });
  };

  // 🟢 V3.6 新增：处理用户选择（针对多策略）
  const handleSelectUserForStrategy = (stepIdx: number, strategyId: string) => {
    setUserSelectorTarget({ stepIdx, strategyId });
    setUserSelectorOpen(true);
  };

  const updateStrategyConfig = (idx: number, field: string, value: string) => {
    const newSteps = [...workflowSteps];
    if (!newSteps[idx].strategyConfig) newSteps[idx].strategyConfig = {};
    if (field === 'roleName') newSteps[idx].strategyConfig!.roleName = value;
    if (field === 'fieldName') {
      newSteps[idx].strategyConfig!.fieldName = value;
      newSteps[idx].strategyConfig!.expectedType = 'department';
    }
    setWorkflowSteps(newSteps);
  };

  const handleDeptSelect = (deptId: string, deptName: string) => {
    if (!selectorTarget) return;
    const { type, stepIdx, approverIdx, strategyId } = selectorTarget;
    const newSteps = [...workflowSteps];

    if (type === 'approver' && typeof approverIdx === 'number') {
      const approver = newSteps[stepIdx].approvers[approverIdx];
      approver.deptId = deptId;
      approver.userId = '';
      approver.userName = '';
    } else if (type === 'strategy_item' && strategyId) {
      // 🟢 V3.6 新增：处理多策略配置的部门选择
      const strategies = newSteps[stepIdx].approverStrategies || [];
      const strategy = strategies.find(s => s.id === strategyId);
      if (strategy) {
        if (!strategy.strategyConfig) strategy.strategyConfig = {};
        strategy.strategyConfig.targetDeptId = deptId;
        strategy.strategyConfig.targetDeptName = deptName;
        newSteps[stepIdx].approverStrategies = strategies;
      }
    } else if (type === 'strategy') {
      // 🟢 处理文本匹配策略的部门选择（旧版向后兼容）
      const textMatchIdx = (newSteps[stepIdx] as any)._editingTextMatchIdx;
      if (textMatchIdx !== undefined && newSteps[stepIdx].strategyConfig?.textMatches) {
        newSteps[stepIdx].strategyConfig!.textMatches![textMatchIdx].targetDeptId = deptId;
        newSteps[stepIdx].strategyConfig!.textMatches![textMatchIdx].targetDeptName = deptName;
        delete (newSteps[stepIdx] as any)._editingTextMatchIdx;
      }
      // 🟢 处理选项匹配策略的部门选择
      else if ((newSteps[stepIdx] as any)._editingOptionMatchIdx !== undefined && newSteps[stepIdx].strategyConfig?.optionMatches) {
        const optionMatchIdx = (newSteps[stepIdx] as any)._editingOptionMatchIdx;
        newSteps[stepIdx].strategyConfig!.optionMatches![optionMatchIdx].targetDeptId = deptId;
        newSteps[stepIdx].strategyConfig!.optionMatches![optionMatchIdx].targetDeptName = deptName;
        delete (newSteps[stepIdx] as any)._editingOptionMatchIdx;
      }
      // 🟢 默认处理（原有逻辑）
      else {
        if (!newSteps[stepIdx].strategyConfig) newSteps[stepIdx].strategyConfig = {};
        newSteps[stepIdx].strategyConfig!.targetDeptId = deptId;
        newSteps[stepIdx].strategyConfig!.targetDeptName = deptName;
      }
    }

    setWorkflowSteps(newSteps);
    setSelectorTarget(null);
  };

  const handleSave = async () => {
    try {
      // 🔵 根据模板级别保存不同配置
      const configToSave = isSecondaryTemplate ? workflowParts : workflowSteps;
      await TemplateService.update(template.id, {
        workflowConfig: JSON.stringify(configToSave),
      });
      alert('保存成功');
      onSuccess();
      onClose();
    } catch (e) {
      alert('保存失败');
    }
  };

  const handleCellPicked = (r: number, c: number) => {
    const cellKey = `R${r + 1}C${c + 1}`;
    
    // 🔵 二级模板Part拾取
    if (isSecondaryTemplate && isPickingCell && editingPartIndex !== -1) {
      handleCellPickedForPart(cellKey);
      return;
    }
    
    // 一级模板Step拾取
    if (isPickingCell && editingStepIndex !== -1) {
      updateStep(editingStepIndex, { outputCell: { r, c } });
      setIsPickingCell(false);
      setEditingStepIndex(-1);
    }
  };

  const flatDepts = flattenDepartments(departments);
  const getDeptName = (id: string) => {
    const found = flatDepts.find(d => d.id === id);
    return found ? found.name : id;
  };

  const handleAddStep = () => {
    setWorkflowSteps(prev => {
      const maxStep = prev.reduce((m, s) => Math.max(m, s.step || 0), -1);
      return [
        ...prev,
        {
          step: maxStep + 1,
          name: `步骤 ${maxStep + 2}`,
          type: 'approval',
          approvalMode: 'OR',
          approverStrategy: 'fixed',
          approvers: [{ deptId: '', userId: '', userName: '' }],
          strategyConfig: {},
        } as any,
      ];
    });
  };

  // 🔵 V3.4 Part系统相关函数
  const handleAddPart = () => {
    setWorkflowParts(prev => [
      ...prev,
      {
        part: prev.length + 1,
        name: `Part ${prev.length + 1}`,
        outputCell: undefined,
        pickStrategy: 'field_match',
        pickConfig: { fieldName: '' },
      },
    ]);
  };

  const handleDeletePart = (idx: number) => {
    if (confirm('确认删除此Part？')) {
      setWorkflowParts(prev => prev.filter((_, i) => i !== idx).map((p, i) => ({ ...p, part: i + 1 })));
    }
  };

  const updatePart = (idx: number, changes: Partial<WorkflowPart>) => {
    const newParts = [...workflowParts];
    newParts[idx] = { 
      ...newParts[idx], 
      ...changes,
      // 深度合并pickConfig
      pickConfig: changes.pickConfig 
        ? { ...newParts[idx].pickConfig, ...changes.pickConfig }
        : newParts[idx].pickConfig
    };
    setWorkflowParts(newParts);
  };

  const handleCellPickedForPart = (cellKey: string) => {
    if (editingPartIndex >= 0) {
      updatePart(editingPartIndex, { outputCell: cellKey });
      setIsPickingCell(false);
      setEditingPartIndex(-1);
    }
  };

  const updateApprover = (stepIdx: number, approverIdx: number, field: string, value: string) => {
    const newSteps = [...workflowSteps];
    const approver = newSteps[stepIdx].approvers[approverIdx];
    if (field === 'userId') {
      approver.userId = value;
      const user = allUsers.find(u => u.id === value);
      approver.userName = user ? user.name : '';
    }
    setWorkflowSteps(newSteps);
  };

  const addApproverRow = (stepIdx: number) => {
    const newSteps = [...workflowSteps];
    newSteps[stepIdx].approvers.push({ deptId: '', userId: '', userName: '', name: '' });
    setWorkflowSteps(newSteps);
  };

  const removeApproverRow = (stepIdx: number, appIdx: number) => {
    const newSteps = [...workflowSteps];
    if (newSteps[stepIdx].approvers.length > 1) {
      newSteps[stepIdx].approvers.splice(appIdx, 1);
      setWorkflowSteps(newSteps);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl w-full max-w-[95vw] h-[95vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="p-4 border-b flex justify-between items-center bg-slate-50">
          <h3 className="font-bold text-lg text-slate-800">
            {isSecondaryTemplate ? '字段继承配置' : '流程配置'}: {template.name}
            {isSecondaryTemplate && <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">二级模板</span>}
          </h3>
          <div className="flex gap-2">
            <button
              onClick={() => setOrientation(orientation === 'portrait' ? 'landscape' : 'portrait')}
              className="p-2 rounded border transition flex items-center justify-center bg-white text-slate-700 border-slate-300 hover:bg-slate-100 hover:border-slate-400"
              title={orientation === 'portrait' ? '当前：竖向纸张，点击切换为横向' : '当前：横向纸张，点击切换为竖向'}
            >
              {orientation === 'portrait' ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="7" y="2" width="10" height="20" rx="1" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="7" width="20" height="10" rx="1" />
                </svg>
              )}
            </button>
            <button
              onClick={isSecondaryTemplate ? handleAddPart : handleAddStep}
              className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm flex items-center gap-1"
            >
              <Plus size={16} /> {isSecondaryTemplate ? '添加Part' : '添加步骤'}
            </button>
            <button
              onClick={handleSave}
              className="bg-green-600 text-white px-3 py-1.5 rounded text-sm flex items-center gap-1"
            >
              <Save size={16} /> 保存
            </button>
            <button onClick={onClose}>
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="w-96 border-r bg-slate-50 p-4 overflow-y-auto flex flex-col gap-3">
            {/* 🔵 二级模板：Part配置界面 */}
            {isSecondaryTemplate && workflowParts.map((part, idx) => (
              <div
                key={idx}
                className="bg-white p-4 rounded-lg border border-purple-200 shadow-sm"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-purple-600 font-bold">Part {part.part}</span>
                  </div>
                  <button
                    onClick={() => handleDeletePart(idx)}
                    className="text-red-500 hover:text-red-700 p-1"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                {/* Part名称 */}
                <div className="mb-3">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Part名称</label>
                  <input
                    type="text"
                    className="w-full border rounded px-2 py-1 text-sm"
                    value={part.name}
                    onChange={(e) => updatePart(idx, { name: e.target.value })}
                    placeholder="如：需求单位审批"
                  />
                </div>

                {/* 输出单元格 */}
                <div className="mb-3">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">输出单元格</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="flex-1 border rounded px-2 py-1 text-sm bg-slate-50"
                      value={part.outputCell || ''}
                      readOnly
                      placeholder="点击右侧拾取"
                    />
                    <button
                      onClick={() => {
                        setEditingPartIndex(idx);
                        setIsPickingCell(true);
                      }}
                      className="px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
                    >
                      拾取
                    </button>
                  </div>
                </div>

                {/* 拾取策略 */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">拾取策略</label>
                  <div className="bg-slate-50 p-2 rounded border">
                    <div className="text-xs text-slate-500 mb-2">指定字段查找</div>
                    <input
                      type="text"
                      className="w-full border rounded px-2 py-1 text-sm"
                      value={part.pickConfig.fieldName}
                      onChange={(e) => updatePart(idx, { 
                        pickConfig: { fieldName: e.target.value } 
                      })}
                      placeholder="一级模板字段名，如：需求单位意见"
                    />
                  </div>
                </div>
              </div>
            ))}

            {/* 一级模板：Step配置界面 */}
            {!isSecondaryTemplate && workflowSteps.map((step, idx) => (
              <div
                key={idx}
                className={`bg-white p-4 rounded-lg border transition-all ${
                  editingStepIndex === idx
                    ? 'ring-2 ring-blue-400 border-blue-400 shadow-md'
                    : 'border-slate-200'
                }`}
              >
                <div className="flex justify-between items-center mb-2 pb-2 border-b border-slate-100">
                  <span className="font-bold text-sm bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                    Step {idx + 1}
                  </span>
                  <button
                    onClick={() => setWorkflowSteps(prev => prev.filter((_, i) => i !== idx))}
                    className="text-red-500 hover:bg-red-50 p-1 rounded"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <input
                  className="w-full border rounded px-2 py-1.5 text-sm mb-2 font-bold text-slate-700"
                  value={step.name}
                  onChange={e => updateStep(idx, { name: e.target.value })}
                  placeholder="步骤名称"
                />

                {/* 🟢 条件触发器 */}
                <div className="mb-3 p-2 bg-amber-50 border border-amber-200 rounded">
                  <div className="flex justify-between items-center">
                    <button
                      onClick={() => {
                        const current = step.triggerConditions || [];
                        const newCond = { field: 'location', operator: '包含', value: '' };
                        updateStep(idx, { triggerConditions: [...current, newCond] });
                      }}
                      className="text-xs flex items-center gap-1 text-amber-700 hover:text-amber-900 font-medium"
                    >
                      <Filter size={12} /> {(step.triggerConditions && step.triggerConditions.length > 0) ? `已设 ${step.triggerConditions.length} 条件` : '添加触发条件'}
                    </button>
                    {step.triggerConditions && step.triggerConditions.length > 0 && (
                      <button
                        onClick={() => updateStep(idx, { triggerConditions: [] })}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        清空全部
                      </button>
                    )}
                  </div>
                  {step.triggerConditions && step.triggerConditions.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      {step.triggerConditions.map((cond: any, cidx: number) => (
                        <div key={cidx} className="flex flex-col gap-1 bg-white p-1.5 rounded text-xs border border-amber-100">
                          <div className="flex gap-1 items-center">
                            <select
                              className="border rounded px-1.5 py-1 text-xs flex-1 bg-white outline-none"
                              value={cond.field}
                              onChange={e => {
                                const newConds = [...(step.triggerConditions || [])];
                                newConds[cidx].field = e.target.value;
                                updateStep(idx, { triggerConditions: newConds });
                              }}
                            >
                              <option value="location">工程地点</option>
                              <option value="requestDept">需求部门</option>
                              <option value="supplierName">供应商</option>
                            </select>
                            <select
                              className="border rounded px-1.5 py-1 text-xs w-16 bg-white outline-none"
                              value={cond.operator}
                              onChange={e => {
                                const newConds = [...(step.triggerConditions || [])];
                                newConds[cidx].operator = e.target.value;
                                updateStep(idx, { triggerConditions: newConds });
                              }}
                            >
                              <option value="包含">包含</option>
                              <option value="等于">等于</option>
                              <option value="不等于">不等于</option>
                            </select>
                            <button
                              onClick={() => {
                                const newConds = (step.triggerConditions || []).filter((_: any, i: number) => i !== cidx);
                                updateStep(idx, { triggerConditions: newConds });
                              }}
                              className="text-red-500 hover:bg-red-50 p-1 rounded shrink-0"
                              title="删除此条件"
                            >
                              <X size={14} />
                            </button>
                          </div>
                          <input
                            className="border rounded px-2 py-1 text-xs w-full bg-white outline-none"
                            placeholder="输入匹配值..."
                            value={cond.value}
                            onChange={e => {
                              const newConds = [...(step.triggerConditions || [])];
                              newConds[cidx].value = e.target.value;
                              updateStep(idx, { triggerConditions: newConds });
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 mb-3 bg-slate-50 p-2 rounded border border-slate-200">
                  <span className="text-xs font-bold text-slate-500">模式:</span>
                  <div className="flex gap-1 flex-wrap">
                    <button
                      onClick={() => updateStep(idx, { approvalMode: 'OR' })}
                      className={`px-2 py-0.5 text-xs rounded flex items-center gap-1 border ${
                        step.approvalMode === 'OR'
                          ? 'bg-blue-100 text-blue-700 border-blue-200 font-bold'
                          : 'bg-white text-slate-500 border-slate-200'
                      }`}
                    >
                      <User size={12} /> 或签
                    </button>
                    <button
                      onClick={() => updateStep(idx, { approvalMode: 'AND' })}
                      className={`px-2 py-0.5 text-xs rounded flex items-center gap-1 border ${
                        step.approvalMode === 'AND'
                          ? 'bg-purple-100 text-purple-700 border-purple-200 font-bold'
                          : 'bg-white text-slate-500 border-slate-200'
                      }`}
                    >
                      <Users size={12} /> 会签
                    </button>
                    <button
                      onClick={() => updateStep(idx, { approvalMode: 'CONDITIONAL' })}
                      className={`px-2 py-0.5 text-xs rounded flex items-center gap-1 border ${
                        step.approvalMode === 'CONDITIONAL'
                          ? 'bg-green-100 text-green-700 border-green-200 font-bold'
                          : 'bg-white text-slate-500 border-slate-200'
                      }`}
                    >
                      <GitBranch size={12} /> 条件签
                    </button>
                  </div>
                </div>

                {step.approvalMode === 'CONDITIONAL' && (
                  <div className="mb-3 p-2 bg-green-50 border border-green-200 rounded text-xs text-green-700">
                    <strong>条件签模式：</strong>每个审批人可设置独立条件，系统根据条件匹配结果自动选择符合条件的审批人。
                  </div>
                )}

                {/* 🟢 V3.6 新版多审批人策略配置（仅条件签使用） */}
                {step.approvalMode === 'CONDITIONAL' && (
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-bold text-slate-500">审批人配置</label>
                      <button
                        onClick={() => {
                          // 初始化多策略配置
                          if (!step.approverStrategies || step.approverStrategies.length === 0) {
                            updateStep(idx, {
                              approverStrategies: [{
                                id: `strategy_${Date.now()}`,
                                strategy: 'fixed',
                                approvers: [],
                                condition: { enabled: false, fieldName: '', operator: '=', value: '' },
                              }]
                            });
                          }
                        }}
                        className="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 border border-blue-200"
                      >
                        {!step.approverStrategies || step.approverStrategies.length === 0 ? '使用多策略配置' : '多策略模式'}
                      </button>
                    </div>

                    {step.approverStrategies && step.approverStrategies.length > 0 ? (
                      <ApproverStrategyConfig
                        strategies={step.approverStrategies}
                        parsedFields={parsedFields}
                        stepApprovalMode={step.approvalMode || 'OR'}
                        onUpdate={(strategies) => updateApproverStrategies(idx, strategies)}
                        onSelectDepartment={(strategyId) => handleSelectDepartmentForStrategy(idx, strategyId)}
                        onSelectUser={(strategyId) => handleSelectUserForStrategy(idx, strategyId)}
                        departments={departments}
                        allUsers={allUsers}
                      />
                    ) : (
                      <div className="border-2 border-dashed border-slate-200 rounded p-3 text-center">
                        <p className="text-xs text-slate-400 mb-2">使用传统单策略配置</p>
                      </div>
                    )}
                  </div>
                )}

                {/* 旧版单策略配置（条件签使用多策略时不显示，或签/会签始终显示） */}
                {(step.approvalMode !== 'CONDITIONAL' || !step.approverStrategies || step.approverStrategies.length === 0) && (
                  <>
                <div className="mb-2">
                  <label className="text-xs font-bold text-slate-500 mb-1 block">找人策略</label>
                  <select
                    className="w-full border rounded text-xs py-1.5 px-2 mb-2 bg-slate-50 outline-none"
                    value={step.approverStrategy || 'fixed'}
                    onChange={e => {
                      const newStrategy = e.target.value as any;
                      const updates: any = {
                        approverStrategy: newStrategy,
                        strategy: null,
                        strategyValue: null,
                      };
                      // 🟢 切换到 fixed 时，确保有 approvers 数组
                      if (newStrategy === 'fixed' && (!step.approvers || step.approvers.length === 0)) {
                        updates.approvers = [{ deptId: '', userId: '', userName: '' }];
                      }
                      updateStep(idx, updates);
                    }}
                  >
                    <option value="fixed">👤 指定具体人员 (固定)</option>
                    <option value="current_dept_manager">🏢 提交人部门负责人 (动态)</option>
                    <option value="specific_dept_manager">🎯 指定部门负责人 (固定部门)</option>
                    <option value="role">🛡️ 指定部门+职位 (角色)</option>
                    <option value="template_field_manager">📄 从模板内容匹配 (部门字段)</option>
                    <option value="template_text_match">📝 从模板内容匹配 (文本匹配)</option>
                    <option value="template_option_match">☑️ 从模板内容匹配 (选项匹配)</option>
                  </select>
                </div>

                {step.approverStrategy === 'current_dept_manager' && (
                  <div className="p-3 bg-blue-50/50 rounded border border-blue-100 text-xs text-blue-600 flex items-center gap-2 mb-3">
                    <GitBranch size={16} /> 自动路由给提交人所在部门经理
                  </div>
                )}

                {(step.approverStrategy === 'specific_dept_manager' ||
                  step.approverStrategy === 'role') && (
                  <div className="mb-3 p-3 bg-slate-50 border border-slate-200 rounded space-y-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 block mb-1">目标部门</label>
                      <div
                        onClick={() =>
                          setSelectorTarget({ type: 'strategy', stepIdx: idx })
                        }
                        className="border border-slate-300 rounded text-xs py-1.5 px-2 bg-white cursor-pointer flex items-center hover:border-blue-500"
                      >
                        <Briefcase size={12} className="mr-2 text-slate-400" />
                        <span
                          className={
                            step.strategyConfig?.targetDeptId
                              ? 'text-slate-700'
                              : 'text-slate-400'
                          }
                        >
                          {step.strategyConfig?.targetDeptId
                            ? getDeptName(step.strategyConfig.targetDeptId)
                            : '点击选择部门'}
                        </span>
                      </div>
                    </div>

                    {step.approverStrategy === 'role' && (
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 block mb-1">
                          职位名称 (包含)
                        </label>
                        <div className="flex items-center border border-slate-300 rounded bg-white px-2">
                          <UserCog size={12} className="text-slate-400 mr-2" />
                          <input
                            className="w-full text-xs py-1.5 outline-none"
                            placeholder="如: EHS经理"
                            value={step.strategyConfig?.roleName || ''}
                            onChange={e => updateStrategyConfig(idx, 'roleName', e.target.value)}
                          />
                        </div>
                      </div>
                    )}

                    <div className="text-[10px] text-slate-400 pt-1">
                      {step.approverStrategy === 'role'
                        ? `* 系统将查找 [${step.strategyConfig?.targetDeptName || '?'}] 中职位包含 "${
                            step.strategyConfig?.roleName || '?'
                          }" 的人员`
                        : `* 系统将路由给 [${step.strategyConfig?.targetDeptName || '?'}] 的部门经理`}
                    </div>
                  </div>
                )}

                {step.approverStrategy === 'template_field_manager' && (
                  <div className="mb-3 p-3 bg-slate-50 border border-slate-200 rounded space-y-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 block mb-1">选择模板字段 (类型为部门)</label>
                      <select
                        className="w-full border rounded text-xs py-1.5 px-2 bg-white"
                        value={step.strategyConfig?.fieldName || ''}
                        onChange={e => updateStrategyConfig(idx, 'fieldName', e.target.value)}
                      >
                        <option value="">请选择字段</option>
                        {Array.from(
                          new Map(
                            parsedFields
                              .filter((f: any) => f.fieldType === 'department')
                              .map((f: any) => [f.fieldName, f])
                          ).values()
                        ).map((f: any) => (
                          <option key={f.cellKey} value={f.fieldName}>{`${f.label} (${f.fieldName})`}</option>
                        ))}
                      </select>
                    </div>
                    <div className="text-[10px] text-slate-400 pt-1">
                      * 系统将读取此部门字段的值，并自动路由到该部门的负责人
                    </div>
                  </div>
                )}

                {/* 🟢 文本匹配策略 */}
                {step.approverStrategy === 'template_text_match' && (
                  <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded space-y-2">
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-xs font-bold text-amber-700">文本匹配规则</label>
                      <button
                        onClick={() => {
                          const newSteps = [...workflowSteps];
                          if (!newSteps[idx].strategyConfig) newSteps[idx].strategyConfig = {};
                          if (!newSteps[idx].strategyConfig!.textMatches) newSteps[idx].strategyConfig!.textMatches = [];
                          newSteps[idx].strategyConfig!.textMatches!.push({
                            fieldName: '',
                            containsText: '',
                            targetDeptId: '',
                            targetDeptName: '',
                          });
                          setWorkflowSteps(newSteps);
                        }}
                        className="text-xs bg-amber-500 text-white px-2 py-1 rounded hover:bg-amber-600 flex items-center gap-1"
                      >
                        <Plus size={12} /> 添加规则
                      </button>
                    </div>
                    
                    {(!step.strategyConfig?.textMatches || step.strategyConfig.textMatches.length === 0) && (
                      <div className="text-xs text-amber-600 bg-amber-100 p-2 rounded">
                        请添加至少一条匹配规则
                      </div>
                    )}

                    {step.strategyConfig?.textMatches?.map((match: any, matchIdx: number) => (
                      <div key={matchIdx} className="bg-white p-2 rounded border border-amber-300 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-amber-700">规则 {matchIdx + 1}</span>
                          <button
                            onClick={() => {
                              const newSteps = [...workflowSteps];
                              newSteps[idx].strategyConfig!.textMatches!.splice(matchIdx, 1);
                              setWorkflowSteps(newSteps);
                            }}
                            className="text-red-500 hover:bg-red-50 p-1 rounded"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>

                        <div>
                          <label className="text-[10px] text-slate-500 block mb-1">选择文本字段</label>
                          <select
                            className="w-full border rounded text-xs py-1 px-2 bg-white"
                            value={match.fieldName || ''}
                            onChange={e => {
                              const newSteps = [...workflowSteps];
                              newSteps[idx].strategyConfig!.textMatches![matchIdx].fieldName = e.target.value;
                              setWorkflowSteps(newSteps);
                            }}
                          >
                            <option value="">请选择字段</option>
                            {parsedFields.filter((f: any) => f.fieldType === 'text' || f.fieldType === 'match').map((f: any) => (
                              <option key={f.cellKey} value={f.fieldName}>{`${f.label} (${f.fieldName})`}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] text-slate-500 block mb-1">包含文本</label>
                          <input
                            type="text"
                            className="w-full border rounded text-xs py-1 px-2"
                            placeholder="如: 危险作业"
                            value={match.containsText || ''}
                            onChange={e => {
                              const newSteps = [...workflowSteps];
                              newSteps[idx].strategyConfig!.textMatches![matchIdx].containsText = e.target.value;
                              setWorkflowSteps(newSteps);
                            }}
                          />
                        </div>

                        <div>
                          <label className="text-[10px] text-slate-500 block mb-1">路由到部门负责人</label>
                          <div
                            onClick={() => {
                              // 设置一个临时标记，用于后续处理
                              const newSteps = [...workflowSteps];
                              (newSteps[idx] as any)._editingTextMatchIdx = matchIdx;
                              setWorkflowSteps(newSteps);
                              setSelectorTarget({ type: 'strategy', stepIdx: idx });
                            }}
                            className="border border-slate-300 rounded text-xs py-1.5 px-2 bg-white cursor-pointer hover:border-blue-500"
                          >
                            <span className={match.targetDeptId ? 'text-slate-700' : 'text-slate-400'}>
                              {match.targetDeptId ? match.targetDeptName : '点击选择部门'}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}

                    <div className="text-[10px] text-slate-400 pt-1">
                      * 当字段内容包含指定文本时，自动路由到对应部门的负责人
                    </div>
                  </div>
                )}

                {/* 🟢 选项匹配策略 */}
                {step.approverStrategy === 'template_option_match' && (
                  <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded space-y-2">
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-xs font-bold text-green-700">选项匹配规则</label>
                      <button
                        onClick={() => {
                          const newSteps = [...workflowSteps];
                          if (!newSteps[idx].strategyConfig) newSteps[idx].strategyConfig = {};
                          if (!newSteps[idx].strategyConfig!.optionMatches) newSteps[idx].strategyConfig!.optionMatches = [];
                          newSteps[idx].strategyConfig!.optionMatches!.push({
                            fieldName: '',
                            checkedValue: '',
                            approverType: 'dept_manager',
                            targetDeptId: '',
                            targetDeptName: '',
                          });
                          setWorkflowSteps(newSteps);
                        }}
                        className="text-xs bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600 flex items-center gap-1"
                      >
                        <Plus size={12} /> 添加规则
                      </button>
                    </div>
                    
                    {(!step.strategyConfig?.optionMatches || step.strategyConfig.optionMatches.length === 0) && (
                      <div className="text-xs text-green-600 bg-green-100 p-2 rounded">
                        请添加至少一条匹配规则
                      </div>
                    )}

                    {step.strategyConfig?.optionMatches?.map((match: any, matchIdx: number) => (
                      <div key={matchIdx} className="bg-white p-2 rounded border border-green-300 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-green-700">规则 {matchIdx + 1}</span>
                          <button
                            onClick={() => {
                              const newSteps = [...workflowSteps];
                              newSteps[idx].strategyConfig!.optionMatches!.splice(matchIdx, 1);
                              setWorkflowSteps(newSteps);
                            }}
                            className="text-red-500 hover:bg-red-50 p-1 rounded"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>

                        <div>
                          <label className="text-[10px] text-slate-500 block mb-1">选择选项字段</label>
                          <select
                            className="w-full border rounded text-xs py-1 px-2 bg-white"
                            value={match.fieldName || ''}
                            onChange={e => {
                              const newSteps = [...workflowSteps];
                              newSteps[idx].strategyConfig!.optionMatches![matchIdx].fieldName = e.target.value;
                              setWorkflowSteps(newSteps);
                            }}
                          >
                            <option value="">请选择字段</option>
                            {parsedFields.filter((f: any) => f.fieldType === 'option').map((f: any) => (
                              <option key={f.cellKey} value={f.fieldName}>{`${f.label} (${f.fieldName})`}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] text-slate-500 block mb-1">勾选值 (如: √ 或 ☑)</label>
                          <input
                            type="text"
                            className="w-full border rounded text-xs py-1 px-2"
                            placeholder="如: √"
                            value={match.checkedValue || ''}
                            onChange={e => {
                              const newSteps = [...workflowSteps];
                              newSteps[idx].strategyConfig!.optionMatches![matchIdx].checkedValue = e.target.value;
                              setWorkflowSteps(newSteps);
                            }}
                          />
                        </div>

                        <div>
                          <label className="text-[10px] text-slate-500 block mb-1">审批人类型</label>
                          <select
                            className="w-full border rounded text-xs py-1 px-2 bg-white"
                            value={match.approverType || 'dept_manager'}
                            onChange={e => {
                              const newSteps = [...workflowSteps];
                              newSteps[idx].strategyConfig!.optionMatches![matchIdx].approverType = e.target.value as 'person' | 'dept_manager';
                              setWorkflowSteps(newSteps);
                            }}
                          >
                            <option value="dept_manager">部门负责人</option>
                            <option value="person">指定具体人员</option>
                          </select>
                        </div>

                        {match.approverType === 'dept_manager' && (
                          <div>
                            <label className="text-[10px] text-slate-500 block mb-1">选择部门</label>
                            <div
                              onClick={() => {
                                const newSteps = [...workflowSteps];
                                (newSteps[idx] as any)._editingOptionMatchIdx = matchIdx;
                                setWorkflowSteps(newSteps);
                                setSelectorTarget({ type: 'strategy', stepIdx: idx });
                              }}
                              className="border border-slate-300 rounded text-xs py-1.5 px-2 bg-white cursor-pointer hover:border-blue-500"
                            >
                              <span className={match.targetDeptId ? 'text-slate-700' : 'text-slate-400'}>
                                {match.targetDeptId ? match.targetDeptName : '点击选择部门'}
                              </span>
                            </div>
                          </div>
                        )}

                        {match.approverType === 'person' && (
                          <div>
                            <label className="text-[10px] text-slate-500 block mb-1">选择人员</label>
                            <select
                              className="w-full border rounded text-xs py-1 px-2 bg-white"
                              value={match.approverUserId || ''}
                              onChange={e => {
                                const newSteps = [...workflowSteps];
                                const user = allUsers.find((u: any) => u.id === e.target.value);
                                newSteps[idx].strategyConfig!.optionMatches![matchIdx].approverUserId = e.target.value;
                                newSteps[idx].strategyConfig!.optionMatches![matchIdx].approverUserName = user?.name || '';
                                setWorkflowSteps(newSteps);
                              }}
                            >
                              <option value="">请选择人员</option>
                              {allUsers.map((u: any) => (
                                <option key={u.id} value={u.id}>
                                  {u.name} {u.jobTitle ? `(${u.jobTitle})` : ''}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    ))}

                    <div className="text-[10px] text-slate-400 pt-1">
                      * 当选项被勾选时，自动路由到对应的审批人
                    </div>
                  </div>
                )}

                {step.approverStrategy === 'fixed' && (
                  <div className="space-y-2 mb-3">
                    <label className="text-xs font-bold text-slate-500 mb-1 block">
                      审批人员 {step.approvers.length > 1 && `(共${step.approvers.length}人)`}
                    </label>
                    {step.approvers.map((app, appIdx) => (
                      <div key={appIdx} className="bg-slate-50 p-2 rounded border border-slate-200 space-y-1.5">
                        <div className="flex gap-1 items-center">
                        {step.approvers.length > 1 && (
                          <span className="text-xs text-slate-400 font-mono w-4">{appIdx + 1}.</span>
                        )}
                        <div
                          onClick={() =>
                            setSelectorTarget({
                              type: 'approver',
                              stepIdx: idx,
                              approverIdx: appIdx,
                            })
                          }
                          className="border border-slate-300 rounded text-xs py-1 px-2 w-28 h-[28px] bg-white cursor-pointer flex items-center truncate hover:border-blue-500 transition-colors"
                          title={app.deptId ? getDeptName(app.deptId) : '点击选择部门'}
                        >
                          <span
                            className={`truncate ${
                              app.deptId ? 'text-slate-700' : 'text-slate-400'
                            }`}
                          >
                            {app.deptId ? getDeptName(app.deptId) : '选择部门'}
                          </span>
                        </div>

                        <select
                          className="border border-slate-300 rounded text-xs py-1 px-1 flex-1 outline-none focus:border-blue-500 bg-white h-[28px]"
                          value={app.userId}
                          onChange={e => updateApprover(idx, appIdx, 'userId', e.target.value)}
                          disabled={!app.deptId}
                        >
                          <option value="">{!app.deptId ? '请先选择部门' : '选择人员'}</option>
                          {app.deptId && allUsers
                            .filter(u => u.departmentId === app.deptId || (!u.departmentId && u.department === getDeptName(app.deptId)))
                            .map((u: any) => (
                              <option key={u.id} value={u.id}>
                                {u.name} {u.jobTitle ? `(${u.jobTitle})` : ''}
                              </option>
                            ))}
                          {app.deptId && allUsers.filter(u => u.departmentId === app.deptId || (!u.departmentId && u.department === getDeptName(app.deptId))).length === 0 && (
                            <option value="" disabled>该部门暂无人员</option>
                          )}
                        </select>

                        {appIdx === step.approvers.length - 1 ? (
                          <button
                            onClick={() => addApproverRow(idx)}
                            className="text-blue-500 hover:bg-blue-50 p-1 rounded"
                          >
                            <Plus size={14} />
                          </button>
                        ) : (
                          <button
                            onClick={() => removeApproverRow(idx, appIdx)}
                            className="text-red-500 hover:bg-red-50 p-1 rounded"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                        </div>

                        {/* 🟢 条件签模式下的个人条件配置 */}
                        {step.approvalMode === 'CONDITIONAL' && (
                          <div className="ml-5 p-2 bg-white border border-green-200 rounded">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-xs font-bold text-green-700">此人触发条件</span>
                              <button
                                onClick={() => {
                                  const newSteps = [...workflowSteps];
                                  const approver = newSteps[idx].approvers[appIdx];
                                  const defaultField = parsedFields.length > 0 ? parsedFields[0].fieldName : 'location';
                                  const current = approver.conditions || [];
                                  approver.conditions = [...current, { field: defaultField, operator: '包含', value: '' }];
                                  setWorkflowSteps(newSteps);
                                }}
                                className="text-xs text-green-600 hover:text-green-800 flex items-center gap-0.5"
                              >
                                <Plus size={10} /> 添加
                              </button>
                            </div>
                            {app.conditions && app.conditions.length > 0 ? (
                              <div className="space-y-1">
                                {app.conditions.map((cond: any, cidx: number) => {
                                  const selectedField = parsedFields.find(f => f.fieldName === cond.field);
                                  return (
                                    <div key={cidx} className="flex flex-col gap-1 bg-slate-50 p-1 rounded text-xs border">
                                      <div className="flex gap-1 items-center">
                                        <select
                                          className="border rounded px-1 py-0.5 text-xs flex-1 bg-white"
                                          value={cond.field}
                                          onChange={e => {
                                            const newSteps = [...workflowSteps];
                                            newSteps[idx].approvers[appIdx].conditions![cidx].field = e.target.value;
                                            setWorkflowSteps(newSteps);
                                          }}
                                        >
                                          <option value="">-- 选择字段 --</option>
                                          {parsedFields.length > 0 ? (
                                            parsedFields.map(f => (
                                              <option key={f.fieldName} value={f.fieldName}>
                                                {f.label} ({f.fieldType})
                                              </option>
                                            ))
                                          ) : (
                                            <>
                                              <option value="location">工程地点</option>
                                              <option value="requestDept">需求部门</option>
                                              <option value="supplierName">供应商</option>
                                            </>
                                          )}
                                        </select>
                                        <select
                                          className="border rounded px-1 py-0.5 text-xs w-14 bg-white"
                                          value={cond.operator}
                                          onChange={e => {
                                            const newSteps = [...workflowSteps];
                                            newSteps[idx].approvers[appIdx].conditions![cidx].operator = e.target.value;
                                            setWorkflowSteps(newSteps);
                                          }}
                                        >
                                          <option value="包含">包含</option>
                                          <option value="等于">等于</option>
                                          <option value="不等于">不等于</option>
                                          <option value="大于">大于</option>
                                          <option value="小于">小于</option>
                                        </select>
                                        <button
                                          onClick={() => {
                                            const newSteps = [...workflowSteps];
                                            newSteps[idx].approvers[appIdx].conditions = 
                                              newSteps[idx].approvers[appIdx].conditions!.filter((_: any, i: number) => i !== cidx);
                                            setWorkflowSteps(newSteps);
                                          }}
                                          className="text-red-500 hover:bg-red-50 p-0.5 rounded"
                                        >
                                          <X size={10} />
                                        </button>
                                      </div>
                                      <input
                                        className="border rounded px-1 py-0.5 text-xs w-full bg-white"
                                        placeholder={selectedField ? `输入${selectedField.fieldType}值...` : "输入匹配值..."}
                                        value={cond.value}
                                        onChange={e => {
                                          const newSteps = [...workflowSteps];
                                          newSteps[idx].approvers[appIdx].conditions![cidx].value = e.target.value;
                                          setWorkflowSteps(newSteps);
                                        }}
                                      />
                                      {selectedField && (
                                        <p className="text-[10px] text-slate-500">{selectedField.hint}</p>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="text-[10px] text-slate-400">
                                {parsedFields.length > 0 
                                  ? '未设置条件，默认总是匹配' 
                                  : '模板未有解析字段，请先上传模板或重新解析'}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-2 flex justify-between items-center bg-slate-50 p-2 rounded border border-dashed border-slate-300">
                  <span className="text-xs text-slate-500">
                    {step.outputCell
                      ? `已绑定 R${step.outputCell.r}C${step.outputCell.c}`
                      : '未绑定签字位'}
                  </span>
                  <button
                    onClick={() => {
                      setEditingStepIndex(idx);
                      setIsPickingCell(true);
                    }}
                    className={`text-xs px-2 py-1 rounded border ${
                      isPickingCell && editingStepIndex === idx
                        ? 'bg-blue-600 text-white'
                        : 'bg-white hover:border-blue-400'
                    }`}
                  >
                    拾取
                  </button>
                </div>
                  </>
                )}
                {/* 🟢 旧版单策略配置结束 */}
              </div>
            ))}
          </div>

          <div className="flex-1 overflow-auto bg-slate-100 p-6 flex justify-center">
            <div 
              className="bg-white shadow-lg p-8"
              style={{
                width: orientation === 'portrait' ? '210mm' : '297mm',
                minHeight: orientation === 'portrait' ? '297mm' : '210mm',
                maxWidth: '100%',
              }}
            >
              {initialEditData && (
                <ExcelRenderer
                  key={template.id}
                  templateData={initialEditData}
                  mode="view"
                  orientation={orientation}
                  isPickingCell={isPickingCell}
                  onCellClick={handleCellPicked}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      <DepartmentSelectModal
        isOpen={!!selectorTarget}
        onClose={() => setSelectorTarget(null)}
        onSelect={handleDeptSelect}
        selectedDeptId={
          selectorTarget
            ? selectorTarget.type === 'approver'
              ? workflowSteps[selectorTarget.stepIdx].approvers[selectorTarget.approverIdx!]?.deptId
              : workflowSteps[selectorTarget.stepIdx].strategyConfig?.targetDeptId
            : undefined
        }
      />
    </div>
  );
}
