/**
 * 统一工作流策略选择器组件
 * 
 * 用于隐患管理和作业票管理的通用人员/审批人选择策略配置
 */

import React from 'react';
import { Plus, X, Filter, User, Users, MapPin, Tag, AlertTriangle, Building2 } from 'lucide-react';
import type {
  WorkflowStrategySelectorProps,
  WorkflowStrategyItem,
  WorkflowStrategyType,
  ComponentMode,
} from './types';
import { StrategyConfigPanel } from './StrategyConfigPanel';
import { getStrategyLabel, getDefaultConfig } from './utils';

export function WorkflowStrategySelector({
  mode = 'simple',
  supportedStrategies,
  strategyItems,
  approvalMode = 'OR',
  parsedFields = [],
  departments,
  allUsers,
  onChange,
  onSelectDepartment,
  onSelectUser,
  className = '',
  showDescription = true,
}: WorkflowStrategySelectorProps) {

  // 获取可用的策略列表
  const getAvailableStrategies = (): WorkflowStrategyType[] => {
    if (supportedStrategies) {
      return supportedStrategies;
    }

    // 根据模式返回默认策略
    if (mode === 'simple') {
      // 隐患简单模式
      return [
        'fixed',
        'reporter_manager',
        'responsible_manager',
        'responsible',
        'reporter',
        'dept_manager',
        'role',
        'location_match',
        'type_match',
        'risk_match',
      ];
    } else {
      // 作业票完整模式
      return [
        'fixed',
        'reporter_manager',
        'dept_manager',
        'form_field_dept_manager',
        'form_condition',
        'role',
      ];
    }
  };

  const availableStrategies = getAvailableStrategies();

  // 添加新策略
  const addStrategy = () => {
    const newItem: WorkflowStrategyItem = {
      id: `strategy_${Date.now()}_${Math.random()}`,
      strategy: 'fixed',
      config: getDefaultConfig('fixed'),
      condition: approvalMode === 'CONDITIONAL' ? {
        enabled: false,
        fieldName: '',
        operator: '=',
        value: '',
      } : undefined,
    };
    onChange([...strategyItems, newItem]);
  };

  // 更新策略
  const updateStrategy = (id: string, updates: Partial<WorkflowStrategyItem>) => {
    const newItems = strategyItems.map(item =>
      item.id === id ? { ...item, ...updates } : item
    );
    onChange(newItems);
  };

  // 删除策略
  const removeStrategy = (id: string) => {
    onChange(strategyItems.filter(item => item.id !== id));
  };

  // 策略类型改变时重置配置
  const handleStrategyTypeChange = (id: string, newStrategy: WorkflowStrategyType) => {
    updateStrategy(id, {
      strategy: newStrategy,
      config: getDefaultConfig(newStrategy),
    });
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* 策略列表 */}
      {strategyItems.map((item, index) => (
        <div
          key={item.id}
          className="bg-slate-50/50 border border-slate-200 rounded-lg p-3 space-y-3"
        >
          {/* 头部 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-600">
                {mode === 'simple' ? '处理人' : '审批人'} #{index + 1}
              </span>
              {approvalMode === 'CONDITIONAL' && item.condition?.enabled && (
                <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] rounded font-medium flex items-center gap-1">
                  <Filter size={10} /> 条件生效
                </span>
              )}
            </div>
            <button
              onClick={() => removeStrategy(item.id)}
              className="text-red-500 hover:bg-red-50 p-1 rounded transition-colors"
              title="删除此策略"
            >
              <X size={14} />
            </button>
          </div>

          {/* 条件判断配置（仅条件签模式显示） */}
          {approvalMode === 'CONDITIONAL' && parsedFields.length > 0 && (
            <div className="bg-green-50 border border-green-200 rounded p-2 space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id={`condition_${item.id}`}
                  checked={item.condition?.enabled || false}
                  onChange={(e) => updateStrategy(item.id, {
                    condition: {
                      enabled: e.target.checked,
                      fieldName: item.condition?.fieldName || '',
                      operator: item.condition?.operator || '=',
                      value: item.condition?.value || '',
                    }
                  })}
                  className="rounded"
                />
                <label htmlFor={`condition_${item.id}`} className="text-xs font-medium text-green-700">
                  启用条件判断
                </label>
              </div>

              {item.condition?.enabled && (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    {/* 字段选择 */}
                    <div>
                      <label className="text-[10px] text-slate-500 block mb-1">判断字段</label>
                      <select
                        className="w-full border rounded text-xs py-1 px-2 bg-white"
                        value={item.condition?.fieldName || ''}
                        onChange={(e) => updateStrategy(item.id, {
                          condition: { ...item.condition!, fieldName: e.target.value }
                        })}
                      >
                        <option value="">选择字段</option>
                        {parsedFields.map((f) => (
                          <option key={f.fieldName} value={f.fieldName}>
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
                        value={item.condition?.operator || '='}
                        onChange={(e) => updateStrategy(item.id, {
                          condition: { ...item.condition!, operator: e.target.value as any }
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
                        value={item.condition?.value || ''}
                        onChange={(e) => updateStrategy(item.id, {
                          condition: { ...item.condition!, value: e.target.value }
                        })}
                      />
                    </div>
                  </div>

                  <div className="text-[10px] text-green-600">
                    当 <strong>{item.condition.fieldName || '(未选择)'}</strong>{' '}
                    {item.condition.operator}{' '}
                    <strong>"{item.condition.value || '(空)'}"</strong> 时，此策略生效
                  </div>
                </>
              )}
            </div>
          )}

          {/* 策略类型选择 */}
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">
              {mode === 'simple' ? '找人策略' : '审批人策略'}
            </label>
            <select
              className="w-full border border-slate-300 rounded text-xs py-1.5 px-2 bg-white"
              value={item.strategy}
              onChange={(e) => handleStrategyTypeChange(item.id, e.target.value as WorkflowStrategyType)}
            >
              {availableStrategies.map((strategy) => (
                <option key={strategy} value={strategy}>
                  {getStrategyLabel(strategy, mode)}
                </option>
              ))}
            </select>
          </div>

          {/* 策略配置面板 */}
          <StrategyConfigPanel
            strategyItem={item}
            mode={mode}
            departments={departments}
            allUsers={allUsers}
            parsedFields={parsedFields}
            onUpdate={(updates) => updateStrategy(item.id, updates)}
            onSelectDepartment={(purpose) => onSelectDepartment?.(item.id, purpose)}
            onSelectUser={() => onSelectUser?.(item.id)}
            showDescription={showDescription}
          />
        </div>
      ))}

      {/* 添加策略按钮 */}
      <button
        onClick={addStrategy}
        className="w-full py-2 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
      >
        <Plus size={16} />
        添加{mode === 'simple' ? '处理人' : '审批人'}策略
      </button>

      {strategyItems.length === 0 && (
        <div className="text-xs text-slate-400 text-center py-2">
          点击上方按钮添加{mode === 'simple' ? '处理人' : '审批人'}配置
        </div>
      )}
    </div>
  );
}
