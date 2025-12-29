// src/app/hidden-danger/_components/workflow/WorkflowStepEditor.tsx
import { useState } from 'react';
import { Plus, Trash2, ChevronDown, ChevronRight, Lock, ArrowUp, ArrowDown } from 'lucide-react';
import { HazardWorkflowStep, HandlerStrategy, SimpleUser, ApprovalMode } from '@/types/hidden-danger';
import { HandlerStrategySelector } from './HandlerStrategySelector';
import { AdvancedHandlerConfig } from './AdvancedHandlerConfig';
import { UserSelectModal } from './UserSelectModal';
import { CCRuleEditor } from './CCRuleEditor';
import PeopleSelector from '@/components/common/PeopleSelector';

interface Props {
  steps: HazardWorkflowStep[];
  allUsers: SimpleUser[];
  departments: any[];
  onChange: (steps: HazardWorkflowStep[]) => void;
}

// 定义核心步骤ID，这些步骤不可删除
const CORE_STEP_IDS = ['report', 'assign', 'rectify', 'verify'];

// 定义强制执行人的步骤ID，这些步骤不允许修改处理人策略
const LOCKED_HANDLER_STEPS = ['report', 'rectify'];

export function WorkflowStepEditor({ steps, allUsers, departments, onChange }: Props) {
  const [expandedSteps, setExpandedSteps] = useState<number[]>([0]);
  const [editingStepName, setEditingStepName] = useState<number | null>(null);
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [deptSelectContext, setDeptSelectContext] = useState<{
    stepIndex: number;
    strategyId?: string;
    field: 'main' | 'location' | 'type' | 'risk';
    ruleIndex?: number;
  } | null>(null);
  const [userSelectContext, setUserSelectContext] = useState<{
    stepIndex: number;
    strategyId?: string;
    isSimpleMode?: boolean;
  } | null>(null);

  const toggleStep = (index: number) => {
    setExpandedSteps(prev =>
      prev.includes(index)
        ? prev.filter(i => i !== index)
        : [...prev, index]
    );
  };

  const addStep = () => {
    const newStep: HazardWorkflowStep = {
      id: `step_${Date.now()}`,
      name: `步骤 ${steps.length + 1}`,
      description: '',
      handlerStrategy: {
        type: 'reporter_manager',
        description: '默认由上报人主管处理'
      },
      ccRules: [],
    };
    
    // 将新步骤插入到verify（最后一步）之前
    const newSteps = [...steps];
    newSteps.splice(steps.length - 1, 0, newStep);
    onChange(newSteps);
    
    // 展开新插入的步骤
    setExpandedSteps([...expandedSteps, steps.length - 1]);
  };

  const removeStep = (index: number) => {
    const step = steps[index];
    
    if (CORE_STEP_IDS.includes(step.id)) {
      alert('核心流程步骤不可删除');
      return;
    }
    
    if (confirm('确认删除此步骤？')) {
      const newSteps = steps.filter((_, i) => i !== index);
      onChange(newSteps);
      setExpandedSteps(expandedSteps.filter(i => i !== index).map(i => i > index ? i - 1 : i));
    }
  };

  const moveStep = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    // 边界检查
    if (targetIndex < 0 || targetIndex >= steps.length) {
      return;
    }

    const currentStep = steps[index];
    
    // 核心步骤不允许移动
    if (CORE_STEP_IDS.includes(currentStep.id)) {
      alert('核心流程步骤不可移动位置');
      return;
    }
    
    const newSteps = [...steps];
    [newSteps[index], newSteps[targetIndex]] = [newSteps[targetIndex], newSteps[index]];
    onChange(newSteps);
  };

  const handleDeptSelect = (deptId: string, deptName: string) => {
    if (!deptSelectContext) return;

    const { stepIndex, strategyId, field, ruleIndex } = deptSelectContext;
    const step = steps[stepIndex];
    const newConfig = { ...step.handlerStrategy };

    if (strategyId && newConfig.strategies) {
      const newStrategies = newConfig.strategies.map(s => {
        if (s.id === strategyId) {
          if (field === 'main') {
            return { ...s, targetDeptId: deptId, targetDeptName: deptName };
          }
        }
        return s;
      });
      newConfig.strategies = newStrategies;
    } else {
      if (field === 'main') {
        newConfig.targetDeptId = deptId;
        newConfig.targetDeptName = deptName;
      } else if (field === 'location' && ruleIndex !== undefined) {
        const rules = [...(newConfig.locationMatches || [])];
        rules[ruleIndex] = { ...rules[ruleIndex], deptId, deptName };
        newConfig.locationMatches = rules;
      } else if (field === 'type' && ruleIndex !== undefined) {
        const rules = [...(newConfig.typeMatches || [])];
        rules[ruleIndex] = { ...rules[ruleIndex], deptId, deptName };
        newConfig.typeMatches = rules;
      } else if (field === 'risk' && ruleIndex !== undefined) {
        const rules = [...(newConfig.riskMatches || [])];
        rules[ruleIndex] = { ...rules[ruleIndex], deptId, deptName };
        newConfig.riskMatches = rules;
      }
    }

    updateHandlerStrategy(stepIndex, newConfig);
    setShowDeptModal(false);
    setDeptSelectContext(null);
  };

  const handleUserSelect = (users: Array<{ userId: string; userName: string }>) => {
    if (!userSelectContext) return;

    const { stepIndex, strategyId, isSimpleMode } = userSelectContext;
    const step = steps[stepIndex];
    const newConfig = { ...step.handlerStrategy };

    if (isSimpleMode) {
      newConfig.fixedUsers = users;
    } else if (newConfig.strategies && strategyId) {
      const newStrategies = newConfig.strategies.map(s =>
        s.id === strategyId ? { ...s, fixedUsers: users } : s
      );
      newConfig.strategies = newStrategies;
    }

    updateHandlerStrategy(stepIndex, newConfig);
    setShowUserModal(false);
    setUserSelectContext(null);
  };

  const openDeptSelector = (stepIndex: number, field: 'main' | 'location' | 'type' | 'risk', ruleIndex?: number, strategyId?: string) => {
    setDeptSelectContext({ stepIndex, strategyId, field, ruleIndex });
    setShowDeptModal(true);
  };

  const openUserSelector = (stepIndex: number, strategyId?: string) => {
    setUserSelectContext({ 
      stepIndex, 
      strategyId,
      isSimpleMode: !strategyId
    });
    setShowUserModal(true);
  };

  const isStepLocked = (step: HazardWorkflowStep) => {
    return LOCKED_HANDLER_STEPS.includes(step.id);
  };

  const isCoreStep = (step: HazardWorkflowStep) => {
    return CORE_STEP_IDS.includes(step.id);
  };

  const updateStep = (index: number, updates: Partial<HazardWorkflowStep>) => {
    const newSteps = [...steps];
    newSteps[index] = { ...newSteps[index], ...updates };
    onChange(newSteps);
  };

  const updateHandlerStrategy = (index: number, strategy: HazardWorkflowStep['handlerStrategy']) => {
    updateStep(index, { handlerStrategy: strategy });
  };

  const getStrategyLabel = (strategy: HandlerStrategy) => {
    switch (strategy) {
      case 'fixed': return '固定人员';
      case 'reporter_manager': return '上报人主管';
      case 'dept_manager': return '部门主管';
      case 'role': return '部门+职位';
      case 'location_match': return '区域匹配';
      case 'type_match': return '类型匹配';
      case 'risk_match': return '风险等级匹配';
      default: return strategy;
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h4 className="text-sm font-semibold text-slate-700">流程步骤</h4>
        <button
          onClick={addStep}
          className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 hover:bg-blue-700 transition-colors"
        >
          <Plus size={14} /> 添加步骤
        </button>
      </div>

      {steps.map((step, index) => {
        const isExpanded = expandedSteps.includes(index);
        const isLocked = isStepLocked(step);
        const isCore = isCoreStep(step);
        
        return (
          <div
            key={step.id}
            className={`group bg-white rounded-lg border border-slate-200 transition-all ${
              isExpanded ? 'shadow-sm' : 'hover:border-slate-300'
            } ${isLocked ? 'relative' : ''}`}
          >
            {/* 核心步骤左侧装饰线 */}
            {isLocked && (
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-400 rounded-l-lg" />
            )}

            {/* 步骤头部 */}
            <div 
              className="px-4 py-2.5 flex items-center justify-between cursor-pointer" 
              onClick={() => toggleStep(index)}
            >
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                {/* 序号 */}
                <span className="flex-shrink-0 w-6 h-6 rounded bg-blue-600 text-white text-xs font-semibold flex items-center justify-center">
                  {index + 1}
                </span>
                
                {/* 步骤名称 */}
                {editingStepName === index ? (
                  <input
                    type="text"
                    className="flex-1 min-w-0 px-2 py-1 text-sm font-medium text-slate-800 border border-blue-300 rounded bg-white outline-none focus:ring-1 focus:ring-blue-400"
                    value={step.name}
                    onChange={e => updateStep(index, { name: e.target.value })}
                    onBlur={() => setEditingStepName(null)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === 'Escape') setEditingStepName(null);
                    }}
                    autoFocus
                    onClick={e => e.stopPropagation()}
                  />
                ) : (
                  <h4 
                    className="flex-1 min-w-0 text-sm font-medium text-slate-800 truncate hover:text-blue-600 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingStepName(index);
                    }}
                  >
                    {step.name}
                  </h4>
                )}

                {/* 策略标签 */}
                <span className="flex-shrink-0 px-2 py-0.5 bg-slate-100 text-slate-500 text-xs rounded">
                  {getStrategyLabel(step.handlerStrategy.type)}
                </span>

                {/* 核心标识 */}
                {isCore && (
                  <div className="flex-shrink-0 flex items-center gap-1 text-xs text-amber-600">
                    <Lock size={12} />
                  </div>
                )}
              </div>

              {/* 操作按钮 - group-hover 显示 */}
              <div className="flex items-center gap-1 ml-2">
                {!isCore && (
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        moveStep(index, 'up');
                      }}
                      className={`p-1 rounded transition-colors ${
                        index === 0
                          ? 'text-slate-300 cursor-not-allowed' 
                          : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
                      }`}
                      disabled={index === 0}
                      title={index === 0 ? '已在顶部' : '上移'}
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        moveStep(index, 'down');
                      }}
                      className={`p-1 rounded transition-colors ${
                        index >= steps.length - 1 
                          ? 'text-slate-300 cursor-not-allowed' 
                          : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
                      }`}
                      disabled={index >= steps.length - 1}
                      title={index >= steps.length - 1 ? '已在底部' : '下移'}
                    >
                      <ArrowDown size={14} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeStep(index);
                      }}
                      className="p-1 rounded text-slate-400 hover:bg-red-50 hover:text-red-500"
                      title="删除步骤"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
                
                {isExpanded ? (
                  <ChevronDown size={16} className="text-slate-400" />
                ) : (
                  <ChevronRight size={16} className="text-slate-400" />
                )}
              </div>
            </div>

            {/* 步骤详细配置 */}
            {isExpanded && (
              <div className="px-4 py-3 border-t border-slate-100 space-y-3">
                {/* 步骤说明 */}
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">步骤说明</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all"
                    value={step.description || ''}
                    onChange={e => updateStep(index, { description: e.target.value })}
                    placeholder="如: 隐患上报后自动指派"
                  />
                </div>

                {/* 处理人策略 */}
                <div className="space-y-3">
                  {isLocked ? (
                    <div className="flex items-start gap-2 p-3 bg-amber-50/50 border border-amber-200 rounded-lg">
                      <Lock size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="text-xs font-medium text-amber-800">执行人已锁定</div>
                        <div className="text-xs text-amber-600/80 mt-0.5">
                          {step.id === 'report' && '此步骤执行人强制为隐患上报人'}
                          {step.id === 'rectify' && '此步骤执行人强制为整改责任人'}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* 审批模式 - 分段控件 */}
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-2">审批模式</label>
                        <div className="inline-flex bg-slate-100 rounded-lg p-1">
                          {(['OR', 'AND', 'CONDITIONAL'] as ApprovalMode[]).map(mode => (
                            <button
                              key={mode}
                              onClick={() => {
                                const newConfig = { ...step.handlerStrategy };
                                newConfig.approvalMode = mode;
                                
                                // 切换到高级模式时初始化策略列表
                                if (mode !== 'OR' && !newConfig.strategies) {
                                  newConfig.strategies = [{
                                    id: `strategy_${Date.now()}`,
                                    strategy: newConfig.type || 'fixed',
                                    fixedUsers: newConfig.fixedUsers || [],
                                    targetDeptId: newConfig.targetDeptId,
                                    targetDeptName: newConfig.targetDeptName,
                                    roleName: newConfig.roleName,
                                    condition: {
                                      enabled: false,
                                      field: 'location',
                                      operator: '=',
                                      value: '',
                                    },
                                  }];
                                }
                                
                                updateHandlerStrategy(index, newConfig);
                              }}
                              className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${
                                (step.handlerStrategy.approvalMode || 'OR') === mode
                                  ? 'bg-white text-slate-800 shadow-sm'
                                  : 'text-slate-600 hover:text-slate-800'
                              }`}
                            >
                              {mode === 'OR' && '或签'}
                              {mode === 'AND' && '会签'}
                              {mode === 'CONDITIONAL' && '条件签'}
                            </button>
                          ))}
                        </div>
                        <p className="text-xs text-slate-400 mt-1.5">
                          {(step.handlerStrategy.approvalMode || 'OR') === 'OR' && '任意一人处理即可'}
                          {step.handlerStrategy.approvalMode === 'AND' && '所有人都必须处理'}
                          {step.handlerStrategy.approvalMode === 'CONDITIONAL' && '根据条件判断处理人'}
                        </p>
                      </div>

                      {/* 简单模式（OR 签） */}
                      {(!step.handlerStrategy.approvalMode || step.handlerStrategy.approvalMode === 'OR') && (
                        <>
                          <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1.5">处理人策略</label>
                            <select
                              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all"
                              value={step.handlerStrategy.type}
                              onChange={e => {
                                const newStrategy = e.target.value as HandlerStrategy;
                                // 切换策略时清理旧配置，避免脏数据
                                updateHandlerStrategy(index, {
                                  type: newStrategy,
                                  description: step.handlerStrategy.description,
                                  approvalMode: 'OR',
                                });
                              }}
                            >
                              <option value="fixed">固定人员</option>
                              <option value="reporter_manager">上报人所在部门主管</option>
                              <option value="dept_manager">指定部门主管</option>
                              <option value="role">指定部门+职位</option>
                              <option value="location_match">根据区域匹配</option>
                              <option value="type_match">根据类型匹配</option>
                              <option value="risk_match">根据风险等级匹配</option>
                            </select>
                          </div>

                          <HandlerStrategySelector
                            strategy={step.handlerStrategy.type}
                            config={step.handlerStrategy}
                            allUsers={allUsers}
                            departments={departments}
                            onChange={config => updateHandlerStrategy(index, { ...config, approvalMode: 'OR' })}
                            onSelectDepartment={(field, ruleIndex) => openDeptSelector(index, field, ruleIndex)}
                            onSelectUser={() => openUserSelector(index)}
                          />
                        </>
                      )}

                      {/* 高级模式（AND 签 / CONDITIONAL 签） */}
                      {(step.handlerStrategy.approvalMode === 'AND' || step.handlerStrategy.approvalMode === 'CONDITIONAL') && (
                        <AdvancedHandlerConfig
                          strategies={step.handlerStrategy.strategies || []}
                          approvalMode={step.handlerStrategy.approvalMode}
                          allUsers={allUsers}
                          departments={departments}
                          onUpdate={(strategies) => {
                            updateHandlerStrategy(index, {
                              ...step.handlerStrategy,
                              strategies,
                            });
                          }}
                          onSelectDepartment={(strategyId, field, ruleIndex) =>
                            openDeptSelector(index, field, ruleIndex, strategyId)
                          }
                          onSelectUser={(strategyId) => openUserSelector(index, strategyId)}
                        />
                      )}
                    </>
                  )}
                </div>

                {/* 抄送规则 */}
                <div className="pt-2 border-t border-slate-100">
                  <CCRuleEditor
                    rules={step.ccRules}
                    allUsers={allUsers}
                    departments={departments}
                    onChange={ccRules => updateStep(index, { ccRules })}
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* 部门选择弹窗 */}
      <PeopleSelector
        isOpen={showDeptModal}
        onClose={() => {
          setShowDeptModal(false);
          setDeptSelectContext(null);
        }}
        mode="dept"
        onConfirm={(selection) => {
            if (Array.isArray(selection) && selection.length > 0) {
                // @ts-ignore
                const dept = selection[0];
                handleDeptSelect(dept.id, dept.name);
            }
            setShowDeptModal(false);
        }}
        title="选择部门"
      />

      {/* 用户选择弹窗 */}
      <UserSelectModal
        isOpen={showUserModal}
        onClose={() => {
          setShowUserModal(false);
          setUserSelectContext(null);
        }}
        onSelect={handleUserSelect}
        allUsers={allUsers}
        departments={departments}
        selectedUserIds={
          userSelectContext
            ? userSelectContext.isSimpleMode
              ? steps[userSelectContext.stepIndex]?.handlerStrategy?.fixedUsers?.map(u => u.userId) || []
              : steps[userSelectContext.stepIndex]?.handlerStrategy?.strategies
                  ?.find(s => s.id === userSelectContext.strategyId)
                  ?.fixedUsers?.map(u => u.userId) || []
            : []
        }
      />
    </div>
  );
}
