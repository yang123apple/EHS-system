import { Plus, X, Filter } from 'lucide-react';
import { ApproverStrategyItem, WorkflowApprover, ParsedField, ApproverStrategy } from '@/types/work-permit';

interface Props {
  strategies: ApproverStrategyItem[];
  parsedFields: ParsedField[];
  stepApprovalMode: 'OR' | 'AND' | 'CONDITIONAL';
  onUpdate: (strategies: ApproverStrategyItem[]) => void;
  onSelectDepartment: (strategyId: string) => void;
  onSelectUser: (strategyId: string) => void;
  departments: any[];
  allUsers: any[];
}

export default function ApproverStrategyConfig({
  strategies,
  parsedFields,
  stepApprovalMode,
  onUpdate,
  onSelectDepartment,
  onSelectUser,
  departments,
  allUsers,
}: Props) {
  
  // 添加新策略
  const addStrategy = () => {
    const newStrategy: ApproverStrategyItem = {
      id: `strategy_${Date.now()}_${Math.random()}`,
      strategy: 'fixed',
      approvers: [],
      condition: {
        enabled: false,
        fieldName: '',
        operator: '=',
        value: '',
      },
    };
    onUpdate([...strategies, newStrategy]);
  };

  // 更新策略
  const updateStrategy = (id: string, updates: Partial<ApproverStrategyItem>) => {
    const newStrategies = strategies.map(s => 
      s.id === id ? { ...s, ...updates } : s
    );
    onUpdate(newStrategies);
  };

  // 删除策略
  const removeStrategy = (id: string) => {
    onUpdate(strategies.filter(s => s.id !== id));
  };

  // 获取策略名称
  const getStrategyLabel = (strategy: ApproverStrategy) => {
    const labels: any = {
      specific_user: '指定人员',
      role: '角色',
      direct_manager: '直属上级',
      dept_manager: '部门负责人',
      form_cell: '表单字段',
    };
    return labels[strategy] || strategy;
  };

  return (
    <div className="space-y-3">
      {/* 策略列表 */}
      {strategies.map((strategyItem, index) => (
        <div key={strategyItem.id} className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-3">
          {/* 头部 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-600">审批人 #{index + 1}</span>
              {stepApprovalMode === 'CONDITIONAL' && strategyItem.condition?.enabled && (
                <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] rounded font-medium flex items-center gap-1">
                  <Filter size={10} /> 条件生效
                </span>
              )}
            </div>
            <button
              onClick={() => removeStrategy(strategyItem.id)}
              className="text-red-500 hover:bg-red-50 p-1 rounded"
              title="删除此审批人"
            >
              <X size={14} />
            </button>
          </div>

          {/* 条件判断配置（仅条件签模式显示） */}
          {stepApprovalMode === 'CONDITIONAL' && (
            <div className="bg-green-50 border border-green-200 rounded p-2 space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id={`condition_${strategyItem.id}`}
                  checked={strategyItem.condition?.enabled || false}
                  onChange={(e) => updateStrategy(strategyItem.id, {
                    condition: {
                      ...(strategyItem.condition || { fieldName: '', operator: '=', value: '' }),
                      enabled: e.target.checked,
                    }
                  })}
                  className="rounded"
                />
                <label htmlFor={`condition_${strategyItem.id}`} className="text-xs font-medium text-green-700">
                  启用条件判断
                </label>
              </div>

              {strategyItem.condition?.enabled && (
                <div className="grid grid-cols-3 gap-2">
                  {/* 字段选择 */}
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-1">判断字段</label>
                    <select
                      className="w-full border rounded text-xs py-1 px-2 bg-white"
                      value={strategyItem.condition?.fieldName || ''}
                      onChange={(e) => updateStrategy(strategyItem.id, {
                        condition: { ...strategyItem.condition!, fieldName: e.target.value }
                      })}
                    >
                      <option value="">选择字段</option>
                      {parsedFields.map((f) => (
                        <option key={f.cellKey} value={f.fieldName}>
                          {f.label} ({f.fieldType})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 操作符 */}
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-1">判断符号</label>
                    <select
                      className="w-full border rounded text-xs py-1 px-2 bg-white"
                      value={strategyItem.condition?.operator || '='}
                      onChange={(e) => updateStrategy(strategyItem.id, {
                        condition: { ...strategyItem.condition!, operator: e.target.value as any }
                      })}
                    >
                      <option value="=">=（等于）</option>
                      <option value="!=">!=（不等于）</option>
                      <option value=">">{'>'} (大于)</option>
                      <option value="<">{'<'} (小于)</option>
                      <option value=">=">{'>='} (大于等于)</option>
                      <option value="<=">{'<='} (小于等于)</option>
                      <option value="contains">包含</option>
                      <option value="not_contains">不包含</option>
                      <option value="in">在列表中</option>
                      <option value="not_in">不在列表中</option>
                    </select>
                  </div>

                  {/* 判断值 */}
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-1">判断值</label>
                    <input
                      type="text"
                      className="w-full border rounded text-xs py-1 px-2"
                      placeholder="输入值..."
                      value={strategyItem.condition?.value || ''}
                      onChange={(e) => updateStrategy(strategyItem.id, {
                        condition: { ...strategyItem.condition!, value: e.target.value }
                      })}
                    />
                  </div>
                </div>
              )}

              {strategyItem.condition?.enabled && (
                <div className="text-[10px] text-green-600">
                  当 <strong>{strategyItem.condition.fieldName || '(未选择)'}</strong>{' '}
                  {strategyItem.condition.operator}{' '}
                  <strong>"{strategyItem.condition.value || '(空)'}"</strong> 时，此审批人策略生效
                </div>
              )}
            </div>
          )}

          {/* 找人策略选择 */}
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">找人策略</label>
            <select
              className="w-full border rounded text-xs py-1.5 px-2 bg-white"
              value={strategyItem.strategy}
              onChange={(e) => updateStrategy(strategyItem.id, {
                strategy: e.target.value as ApproverStrategy,
                strategyConfig: {},
                approvers: [],
              })}
            >
              <option value="fixed">固定人员</option>
              <option value="current_dept_manager">申请人所在部门负责人</option>
              <option value="specific_dept_manager">指定部门负责人</option>
              <option value="template_field_dept_manager">表单字段指定部门负责人</option>
              <option value="template_text_match">文本字段匹配</option>
              <option value="template_option_match">选项字段匹配</option>
              <option value="role">角色</option>
            </select>
          </div>

          {/* 策略配置区域 */}
          {strategyItem.strategy === 'fixed' && (
            <div className="bg-white p-2 rounded border">
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-medium text-slate-600">固定审批人</label>
                <button
                  onClick={() => onSelectUser(strategyItem.id)}
                  className="text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600"
                >
                  选择人员
                </button>
              </div>
              <div className="flex flex-wrap gap-1">
                {(strategyItem.approvers || []).length === 0 ? (
                  <span className="text-xs text-slate-400">未选择人员</span>
                ) : (
                  strategyItem.approvers!.map((approver: WorkflowApprover) => (
                    <span
                      key={approver.id}
                      className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded border border-blue-200"
                    >
                      {approver.name}
                    </span>
                  ))
                )}
              </div>
            </div>
          )}

          {strategyItem.strategy === 'specific_dept_manager' && (
            <div className="bg-white p-2 rounded border">
              <label className="text-xs font-medium text-slate-600 block mb-1">指定部门</label>
              <div
                onClick={() => onSelectDepartment(strategyItem.id)}
                className="border border-slate-300 rounded text-xs py-1.5 px-2 bg-white cursor-pointer hover:border-blue-500"
              >
                <span className={strategyItem.strategyConfig?.targetDeptId ? 'text-slate-700' : 'text-slate-400'}>
                  {strategyItem.strategyConfig?.targetDeptName || '点击选择部门'}
                </span>
              </div>
            </div>
          )}

          {strategyItem.strategy === 'template_field_dept_manager' && (
            <div className="bg-white p-2 rounded border">
              <label className="text-xs font-medium text-slate-600 block mb-1">部门字段</label>
              <select
                className="w-full border rounded text-xs py-1 px-2 bg-white"
                value={strategyItem.strategyConfig?.fieldName || ''}
                onChange={(e) => updateStrategy(strategyItem.id, {
                  strategyConfig: { ...strategyItem.strategyConfig, fieldName: e.target.value }
                })}
              >
                <option value="">选择部门字段</option>
                {parsedFields.filter(f => f.fieldType === 'department').map((f) => (
                  <option key={f.cellKey} value={f.fieldName}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {strategyItem.strategy === 'role' && (
            <div className="bg-white p-2 rounded border">
              <label className="text-xs font-medium text-slate-600 block mb-1">角色名称</label>
              <input
                type="text"
                className="w-full border rounded text-xs py-1 px-2"
                placeholder="如：EHS工程师"
                value={strategyItem.strategyConfig?.roleName || ''}
                onChange={(e) => updateStrategy(strategyItem.id, {
                  strategyConfig: { ...strategyItem.strategyConfig, roleName: e.target.value }
                })}
              />
            </div>
          )}
        </div>
      ))}

      {/* 添加审批人按钮 */}
      <button
        onClick={addStrategy}
        className="w-full py-2 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
      >
        <Plus size={16} />
        添加审批人策略
      </button>

      {strategies.length === 0 && (
        <div className="text-xs text-slate-400 text-center py-2">
          点击上方按钮添加审批人配置
        </div>
      )}
    </div>
  );
}
