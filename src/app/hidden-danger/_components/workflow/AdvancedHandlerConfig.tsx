// src/app/hidden-danger/_components/workflow/AdvancedHandlerConfig.tsx
import { Plus, X, Filter, User, Users } from 'lucide-react';
import { HandlerStrategyItem, HandlerStrategy, ApprovalMode, SimpleUser } from '@/types/hidden-danger';

interface Props {
  strategies: HandlerStrategyItem[];
  approvalMode: ApprovalMode;
  allUsers: SimpleUser[];
  departments: any[];
  onUpdate: (strategies: HandlerStrategyItem[]) => void;
  onSelectDepartment: (strategyId: string, field: 'main' | 'location' | 'type' | 'risk', ruleIndex?: number) => void;
  onSelectUser: (strategyId: string) => void;
}

export function AdvancedHandlerConfig({
  strategies,
  approvalMode,
  allUsers,
  departments,
  onUpdate,
  onSelectDepartment,
  onSelectUser,
}: Props) {

  // 添加新策略
  const addStrategy = () => {
    const newStrategy: HandlerStrategyItem = {
      id: `strategy_${Date.now()}_${Math.random()}`,
      strategy: 'fixed',
      condition: {
        enabled: false,
        field: 'location',
        operator: '=',
        value: '',
      },
      fixedUsers: [],
    };
    onUpdate([...strategies, newStrategy]);
  };

  // 更新策略
  const updateStrategy = (id: string, updates: Partial<HandlerStrategyItem>) => {
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
  const getStrategyLabel = (strategy: HandlerStrategy) => {
    const labels: Record<HandlerStrategy, string> = {
      fixed: '固定人员',
      reporter_manager: '上报人主管',
      responsible_manager: '责任人主管',
      dept_manager: '部门主管',
      role: '部门+职位',
      location_match: '区域匹配',
      type_match: '类型匹配',
      risk_match: '风险等级匹配',
      responsible: '责任人',
      reporter: '上报人',
    };
    return labels[strategy] || strategy;
  };

  const getDeptName = (id: string) => {
    const found = departments.find((d: any) => d.id === id);
    return found ? found.name : id;
  };

  return (
    <div className="space-y-3">
      {/* 策略列表 */}
      {strategies.map((strategyItem, index) => (
        <div key={strategyItem.id} className="bg-white border border-slate-200 rounded-xl p-4 space-y-4 shadow-sm">
          {/* 头部 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 bg-blue-600 text-white text-xs font-bold rounded">
                处理人 #{index + 1}
              </span>
              {approvalMode === 'CONDITIONAL' && strategyItem.condition?.enabled && (
                <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] rounded font-medium flex items-center gap-1">
                  <Filter size={10} /> 条件生效
                </span>
              )}
            </div>
            <button
              onClick={() => removeStrategy(strategyItem.id)}
              className="text-red-500 hover:bg-red-50 p-1.5 rounded transition-colors"
              title="删除此处理人"
            >
              <X size={16} />
            </button>
          </div>

          {/* 条件判断配置（仅条件签模式显示） */}
          {approvalMode === 'CONDITIONAL' && (
            <div className="bg-green-50/50 border border-green-200 rounded-xl p-3 space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id={`condition_${strategyItem.id}`}
                  checked={strategyItem.condition?.enabled || false}
                  onChange={(e) => updateStrategy(strategyItem.id, {
                    condition: {
                      ...(strategyItem.condition || { field: 'location', operator: '=', value: '' }),
                      enabled: e.target.checked,
                    }
                  })}
                  className="rounded"
                />
                <label htmlFor={`condition_${strategyItem.id}`} className="text-xs font-bold text-green-700">
                  启用条件判断
                </label>
              </div>

              {strategyItem.condition?.enabled && (
                <div className="grid grid-cols-3 gap-3">
                  {/* 字段选择 */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">判断字段</label>
                    <select
                      className="w-full border border-slate-200 rounded-lg text-xs py-1.5 px-2 bg-white focus:ring-2 focus:ring-green-100 focus:border-green-400 outline-none"
                      value={strategyItem.condition?.field || 'location'}
                      onChange={(e) => updateStrategy(strategyItem.id, {
                        condition: { ...strategyItem.condition!, field: e.target.value as any }
                      })}
                    >
                      <option value="location">隐患区域</option>
                      <option value="type">隐患类型</option>
                      <option value="riskLevel">风险等级</option>
                    </select>
                  </div>

                  {/* 操作符 */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">判断符号</label>
                    <select
                      className="w-full border border-slate-200 rounded-lg text-xs py-1.5 px-2 bg-white focus:ring-2 focus:ring-green-100 focus:border-green-400 outline-none"
                      value={strategyItem.condition?.operator || '='}
                      onChange={(e) => updateStrategy(strategyItem.id, {
                        condition: { ...strategyItem.condition!, operator: e.target.value as any }
                      })}
                    >
                      <option value="=">=（等于）</option>
                      <option value="!=">!=（不等于）</option>
                      <option value="contains">包含</option>
                      <option value="not_contains">不包含</option>
                    </select>
                  </div>

                  {/* 判断值 */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">判断值</label>
                    <input
                      type="text"
                      className="w-full border border-slate-200 rounded-lg text-xs py-1.5 px-2 focus:ring-2 focus:ring-green-100 focus:border-green-400 outline-none"
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
                <div className="text-[10px] text-green-700 bg-white px-3 py-2 rounded-lg">
                  当 <strong>{strategyItem.condition.field === 'location' ? '隐患区域' : strategyItem.condition.field === 'type' ? '隐患类型' : '风险等级'}</strong>{' '}
                  {strategyItem.condition.operator}{' '}
                  <strong>"{strategyItem.condition.value || '(空)'}"</strong> 时，此处理人策略生效
                </div>
              )}
            </div>
          )}

          {/* 找人策略选择 */}
          <div className="space-y-2">
            <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">找人策略</label>
            <select
              className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all shadow-sm"
              value={strategyItem.strategy}
              onChange={(e) => updateStrategy(strategyItem.id, {
                strategy: e.target.value as HandlerStrategy,
                fixedUsers: [],
                targetDeptId: undefined,
                targetDeptName: undefined,
                roleName: undefined,
                locationMatches: undefined,
                typeMatches: undefined,
                riskMatches: undefined,
              })}
            >
              <option value="fixed">固定人员</option>
              <option value="reporter_manager">上报人所在部门主管</option>
              <option value="responsible_manager">责任人所在部门主管</option>
              <option value="dept_manager">指定部门主管</option>
              <option value="role">指定部门+职位</option>
              <option value="location_match">根据区域匹配</option>
              <option value="type_match">根据类型匹配</option>
              <option value="risk_match">根据风险等级匹配</option>
              <option value="responsible">责任人</option>
              <option value="reporter">上报人</option>
            </select>
          </div>

          {/* 策略配置区域 */}
          {strategyItem.strategy === 'fixed' && (
            <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-200 space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-slate-600">固定处理人</label>
                <button
                  onClick={() => onSelectUser(strategyItem.id)}
                  className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  选择人员
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {(!strategyItem.fixedUsers || strategyItem.fixedUsers.length === 0) ? (
                  <span className="text-xs text-slate-400">未选择人员</span>
                ) : (
                  strategyItem.fixedUsers.map((user, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1.5 bg-blue-50 text-blue-700 text-xs rounded-lg border border-blue-200 font-medium flex items-center gap-1"
                    >
                      <User size={12} />
                      {user.userName}
                    </span>
                  ))
                )}
              </div>
            </div>
          )}

          {strategyItem.strategy === 'reporter_manager' && (
            <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-200">
              <div className="flex items-center gap-2 text-blue-700">
                <Users size={16} />
                <span className="text-sm font-medium">自动路由给上报人所在部门的主管</span>
              </div>
              <p className="text-xs text-blue-600 mt-2">系统将自动查找上报人部门的负责人进行处理</p>
            </div>
          )}

          {strategyItem.strategy === 'responsible_manager' && (
            <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-200">
              <div className="flex items-center gap-2 text-indigo-700">
                <Users size={16} />
                <span className="text-sm font-medium">自动路由给责任人所在部门的主管</span>
              </div>
              <p className="text-xs text-indigo-600 mt-2">系统将自动查找责任人部门的负责人进行处理</p>
            </div>
          )}

          {strategyItem.strategy === 'responsible' && (
            <div className="p-4 bg-purple-50/50 rounded-xl border border-purple-200">
              <div className="flex items-center gap-2 text-purple-700">
                <User size={16} />
                <span className="text-sm font-medium">自动路由给隐患责任人</span>
              </div>
              <p className="text-xs text-purple-600 mt-2">系统将自动派发给新建隐患时指定的责任人</p>
            </div>
          )}

          {strategyItem.strategy === 'reporter' && (
            <div className="p-4 bg-amber-50/50 rounded-xl border border-amber-200">
              <div className="flex items-center gap-2 text-amber-700">
                <User size={16} />
                <span className="text-sm font-medium">自动路由给隐患上报人</span>
              </div>
              <p className="text-xs text-amber-600 mt-2">系统将自动派发给隐患的上报人</p>
            </div>
          )}

          {strategyItem.strategy === 'dept_manager' && (
            <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-200 space-y-2">
              <label className="text-xs font-bold text-slate-600">目标部门</label>
              <button
                onClick={() => onSelectDepartment(strategyItem.id, 'main')}
                className="w-full border border-slate-300 rounded-lg p-3 bg-white hover:border-blue-400 transition-colors text-left shadow-sm"
              >
                <span className={strategyItem.targetDeptId ? 'text-slate-700' : 'text-slate-400'}>
                  {strategyItem.targetDeptId ? getDeptName(strategyItem.targetDeptId) : '点击选择部门'}
                </span>
              </button>
              <p className="text-xs text-slate-500">系统将路由给该部门的负责人</p>
            </div>
          )}

          {strategyItem.strategy === 'role' && (
            <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-200 space-y-3">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-600">目标部门</label>
                <button
                  onClick={() => onSelectDepartment(strategyItem.id, 'main')}
                  className="w-full border border-slate-300 rounded-lg p-3 bg-white hover:border-blue-400 text-left shadow-sm"
                >
                  <span className={strategyItem.targetDeptId ? 'text-slate-700' : 'text-slate-400'}>
                    {strategyItem.targetDeptId ? getDeptName(strategyItem.targetDeptId) : '点击选择部门'}
                  </span>
                </button>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-600">职位关键词</label>
                <input
                  type="text"
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all shadow-sm"
                  placeholder="如: EHS经理"
                  value={strategyItem.roleName || ''}
                  onChange={(e) => updateStrategy(strategyItem.id, { roleName: e.target.value })}
                />
                <p className="text-xs text-slate-500">系统将查找该部门中职位包含此关键词的人员</p>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* 添加处理人按钮 */}
      <button
        onClick={addStrategy}
        className="w-full py-3 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
      >
        <Plus size={18} />
        添加处理人策略
      </button>

      {strategies.length === 0 && (
        <div className="text-xs text-slate-400 text-center py-2">
          点击上方按钮添加处理人配置
        </div>
      )}
    </div>
  );
}
