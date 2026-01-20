/**
 * 策略配置面板 - 根据不同策略类型显示对应的配置UI
 */

import React from 'react';
import { Plus, Trash2, User, Users, MapPin, Tag, AlertTriangle, Building2 } from 'lucide-react';
import type {
  WorkflowStrategyItem,
  ComponentMode,
  DepartmentInfo,
  UserInfo,
  ParsedFormField,
  LocationMatchRule,
  TypeMatchRule,
  RiskMatchRule,
} from './types';
import { getStrategyDescription } from './utils';

interface StrategyConfigPanelProps {
  strategyItem: WorkflowStrategyItem;
  mode: ComponentMode;
  departments: DepartmentInfo[];
  allUsers: UserInfo[];
  parsedFields: ParsedFormField[];
  onUpdate: (updates: Partial<WorkflowStrategyItem>) => void;
  onSelectDepartment?: (purpose: string) => void;
  onSelectUser?: () => void;
  showDescription?: boolean;
}

export function StrategyConfigPanel({
  strategyItem,
  mode,
  departments,
  allUsers,
  parsedFields,
  onUpdate,
  onSelectDepartment,
  onSelectUser,
  showDescription = true,
}: StrategyConfigPanelProps) {
  
  const { strategy, config } = strategyItem;

  // 获取部门名称
  const getDeptName = (id?: string) => {
    if (!id) return '';
    const dept = departments.find(d => d.id === id);
    return dept?.name || id;
  };

  // 渲染描述
  const renderDescription = () => {
    if (!showDescription) return null;
    
    const desc = getStrategyDescription(strategy, mode);
    if (!desc) return null;

    return (
      <div className="text-xs text-slate-500 bg-slate-50/50 p-2 rounded border border-slate-200">
        💡 {desc}
      </div>
    );
  };

  // ==================== 固定人员 ====================
  if (strategy === 'fixed') {
    return (
      <div className="space-y-2">
        {renderDescription()}
        <div className="bg-white p-3 rounded border border-slate-200">
          <div className="flex justify-between items-center mb-2">
            <label className="text-xs font-medium text-slate-600">固定{mode === 'simple' ? '处理人' : '审批人'}</label>
            <button
              onClick={() => onSelectUser?.()}
              className="text-xs bg-blue-500 text-white px-3 py-1.5 rounded hover:bg-blue-600 transition-colors font-medium"
            >
              选择人员
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {(!config.fixedPersons || config.fixedPersons.length === 0) ? (
              <span className="text-xs text-slate-400">未选择人员</span>
            ) : (
              config.fixedPersons.map((person, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1.5 bg-blue-50 text-blue-700 text-xs rounded border border-blue-200 font-medium flex items-center gap-1"
                >
                  <User size={12} />
                  {person.userName}
                </span>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  // ==================== 角色（部门+职位） ====================
  if (strategy === 'role') {
    return (
      <div className="space-y-2">
        {renderDescription()}
        <div className="bg-white p-3 rounded border border-slate-200 space-y-2">
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">目标部门（可选）</label>
            <button
              onClick={() => onSelectDepartment?.('role_dept')}
              className="w-full border border-slate-300 rounded px-3 py-2 bg-slate-50 hover:border-blue-500 text-sm text-left transition-colors"
            >
              <span className={config.role?.targetDeptId ? 'text-slate-700' : 'text-slate-400'}>
                {config.role?.targetDeptName || '全公司范围'}
              </span>
            </button>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">职位关键词</label>
            <input
              type="text"
              className="w-full border rounded px-3 py-2 text-sm"
              placeholder="如: EHS经理、安全员"
              value={config.role?.roleName || ''}
              onChange={e => onUpdate({
                config: {
                  ...config,
                  role: { ...config.role!, roleName: e.target.value }
                }
              })}
            />
            <p className="text-xs text-slate-500 mt-1">
              系统将查找职位包含此关键词的人员
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ==================== 上报人/申请人主管 ====================
  if (strategy === 'reporter_manager') {
    return (
      <div className="space-y-2">
        {renderDescription()}
        <div className="p-3 bg-blue-50/50 rounded border border-blue-200">
          <div className="flex items-center gap-2 text-blue-700">
            <Users size={16} />
            <span className="text-sm font-medium">
              自动路由给{mode === 'simple' ? '上报人' : '申请人'}所在部门的主管
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ==================== 责任人主管 ====================
  if (strategy === 'responsible_manager') {
    return (
      <div className="space-y-2">
        {renderDescription()}
        <div className="p-3 bg-indigo-50/50 rounded border border-indigo-200">
          <div className="flex items-center gap-2 text-indigo-700">
            <Users size={16} />
            <span className="text-sm font-medium">自动路由给责任人所在部门主管</span>
          </div>
        </div>
      </div>
    );
  }

  // ==================== 责任人 ====================
  if (strategy === 'responsible') {
    return (
      <div className="space-y-2">
        {renderDescription()}
        <div className="p-3 bg-purple-50/50 rounded border border-purple-200">
          <div className="flex items-center gap-2 text-purple-700">
            <User size={16} />
            <span className="text-sm font-medium">自动路由给隐患责任人</span>
          </div>
        </div>
      </div>
    );
  }

  // ==================== 上报人/申请人 ====================
  if (strategy === 'reporter') {
    return (
      <div className="space-y-2">
        {renderDescription()}
        <div className="p-3 bg-amber-50/50 rounded border border-amber-200">
          <div className="flex items-center gap-2 text-amber-700">
            <User size={16} />
            <span className="text-sm font-medium">
              自动路由给隐患{mode === 'simple' ? '上报人' : '申请人'}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ==================== 指定部门主管 ====================
  if (strategy === 'dept_manager') {
    return (
      <div className="space-y-2">
        {renderDescription()}
        <div className="bg-white p-3 rounded border border-slate-200">
          <label className="text-xs font-medium text-slate-600 block mb-2">目标部门</label>
          <button
            onClick={() => onSelectDepartment?.('target_dept')}
            className="w-full border border-slate-300 rounded px-3 py-2 bg-slate-50 hover:border-blue-500 text-left transition-colors"
          >
            <span className={config.deptManager?.targetDeptId ? 'text-slate-700' : 'text-slate-400'}>
              {config.deptManager?.targetDeptName || '点击选择部门'}
            </span>
          </button>
          <p className="text-xs text-slate-500 mt-2">系统将路由给该部门的负责人</p>
        </div>
      </div>
    );
  }

  // ==================== 表单字段指定部门主管 ====================
  if (strategy === 'form_field_dept_manager') {
    return (
      <div className="space-y-2">
        {renderDescription()}
        <div className="bg-white p-3 rounded border border-slate-200">
          <label className="text-xs font-medium text-slate-600 block mb-2">部门字段</label>
          <select
            className="w-full border rounded px-3 py-2 text-sm bg-white"
            value={config.formField?.fieldName || ''}
            onChange={e => onUpdate({
              config: {
                ...config,
                formField: { fieldName: e.target.value, expectedType: 'department' }
              }
            })}
          >
            <option value="">选择部门字段</option>
            {parsedFields.filter(f => f.fieldType === 'department').map(f => (
              <option key={f.fieldName} value={f.fieldName}>
                {f.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-500 mt-2">
            系统将根据表单中填写的部门，路由给该部门负责人
          </p>
        </div>
      </div>
    );
  }

  // ==================== 区域匹配 ====================
  if (strategy === 'location_match') {
    const rules = config.matchRules?.locationRules || [];
    
    return (
      <div className="space-y-2">
        {renderDescription()}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold text-slate-600">区域匹配规则</label>
            <button
              onClick={() => {
                const newRules = [...rules, { location: '', deptId: '', deptName: '' }];
                onUpdate({
                  config: {
                    ...config,
                    matchRules: { ...config.matchRules, locationRules: newRules }
                  }
                });
              }}
              className="text-xs bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600 flex items-center gap-1"
            >
              <Plus size={12} /> 添加规则
            </button>
          </div>

          {rules.length === 0 && (
            <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded border border-dashed">
              请添加至少一条区域匹配规则
            </div>
          )}

          {rules.map((rule, idx) => (
            <div key={idx} className="bg-white p-3 rounded border space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <MapPin size={12} /> 规则 {idx + 1}
                </span>
                <button
                  onClick={() => {
                    const newRules = rules.filter((_, i) => i !== idx);
                    onUpdate({
                      config: {
                        ...config,
                        matchRules: { ...config.matchRules, locationRules: newRules }
                      }
                    });
                  }}
                  className="text-red-500 hover:bg-red-50 p-1 rounded"
                >
                  <Trash2 size={12} />
                </button>
              </div>
              
              <div>
                <label className="text-xs text-slate-500 block mb-1">区域名称</label>
                <input
                  type="text"
                  className="w-full border rounded px-2 py-1 text-sm"
                  placeholder="如: 东厂区"
                  value={rule.location}
                  onChange={e => {
                    const newRules = [...rules];
                    newRules[idx] = { ...rule, location: e.target.value };
                    onUpdate({
                      config: {
                        ...config,
                        matchRules: { ...config.matchRules, locationRules: newRules }
                      }
                    });
                  }}
                />
              </div>

              <div>
                <label className="text-xs text-slate-500 block mb-1">负责部门</label>
                <button
                  onClick={() => onSelectDepartment?.(`location_${idx}`)}
                  className="w-full border rounded px-2 py-1 bg-slate-50 hover:border-blue-500 text-sm text-left"
                >
                  {rule.deptName || '点击选择部门'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ==================== 类型匹配 ====================
  if (strategy === 'type_match') {
    const rules = config.matchRules?.typeRules || [];
    
    return (
      <div className="space-y-2">
        {renderDescription()}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold text-slate-600">类型匹配规则</label>
            <button
              onClick={() => {
                const newRules = [...rules, { type: '', deptId: '', deptName: '' }];
                onUpdate({
                  config: {
                    ...config,
                    matchRules: { ...config.matchRules, typeRules: newRules }
                  }
                });
              }}
              className="text-xs bg-purple-500 text-white px-2 py-1 rounded hover:bg-purple-600 flex items-center gap-1"
            >
              <Plus size={12} /> 添加规则
            </button>
          </div>

          {rules.length === 0 && (
            <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded border border-dashed">
              请添加至少一条类型匹配规则
            </div>
          )}

          {rules.map((rule, idx) => (
            <div key={idx} className="bg-white p-3 rounded border space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <Tag size={12} /> 规则 {idx + 1}
                </span>
                <button
                  onClick={() => {
                    const newRules = rules.filter((_, i) => i !== idx);
                    onUpdate({
                      config: {
                        ...config,
                        matchRules: { ...config.matchRules, typeRules: newRules }
                      }
                    });
                  }}
                  className="text-red-500 hover:bg-red-50 p-1 rounded"
                >
                  <Trash2 size={12} />
                </button>
              </div>
              
              <div>
                <label className="text-xs text-slate-500 block mb-1">隐患类型</label>
                <input
                  type="text"
                  className="w-full border rounded px-2 py-1 text-sm"
                  placeholder="如: 机械伤害"
                  value={rule.type}
                  onChange={e => {
                    const newRules = [...rules];
                    newRules[idx] = { ...rule, type: e.target.value };
                    onUpdate({
                      config: {
                        ...config,
                        matchRules: { ...config.matchRules, typeRules: newRules }
                      }
                    });
                  }}
                />
              </div>

              <div>
                <label className="text-xs text-slate-500 block mb-1">负责部门</label>
                <button
                  onClick={() => onSelectDepartment?.(`type_${idx}`)}
                  className="w-full border rounded px-2 py-1 bg-slate-50 hover:border-blue-500 text-sm text-left"
                >
                  {rule.deptName || '点击选择部门'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ==================== 风险等级匹配 ====================
  if (strategy === 'risk_match') {
    const rules = config.matchRules?.riskRules || [];
    
    return (
      <div className="space-y-2">
        {renderDescription()}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold text-slate-600">风险等级匹配规则</label>
            <button
              onClick={() => {
                const newRules = [...rules, { riskLevel: 'high' as const, deptId: '', deptName: '' }];
                onUpdate({
                  config: {
                    ...config,
                    matchRules: { ...config.matchRules, riskRules: newRules }
                  }
                });
              }}
              className="text-xs bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600 flex items-center gap-1"
            >
              <Plus size={12} /> 添加规则
            </button>
          </div>

          {rules.length === 0 && (
            <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded border border-dashed">
              请添加至少一条风险等级匹配规则
            </div>
          )}

          {rules.map((rule, idx) => (
            <div key={idx} className="bg-white p-3 rounded border space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <AlertTriangle size={12} /> 规则 {idx + 1}
                </span>
                <button
                  onClick={() => {
                    const newRules = rules.filter((_, i) => i !== idx);
                    onUpdate({
                      config: {
                        ...config,
                        matchRules: { ...config.matchRules, riskRules: newRules }
                      }
                    });
                  }}
                  className="text-red-500 hover:bg-red-50 p-1 rounded"
                >
                  <Trash2 size={12} />
                </button>
              </div>
              
              <div>
                <label className="text-xs text-slate-500 block mb-1">风险等级</label>
                <select
                  className="w-full border rounded px-2 py-1 text-sm bg-white"
                  value={rule.riskLevel}
                  onChange={e => {
                    const newRules = [...rules];
                    newRules[idx] = { ...rule, riskLevel: e.target.value as any };
                    onUpdate({
                      config: {
                        ...config,
                        matchRules: { ...config.matchRules, riskRules: newRules }
                      }
                    });
                  }}
                >
                  <option value="high">高风险</option>
                  <option value="major">重大风险</option>
                  <option value="medium">中风险</option>
                  <option value="low">低风险</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-500 block mb-1">负责部门</label>
                <button
                  onClick={() => onSelectDepartment?.(`risk_${idx}`)}
                  className="w-full border rounded px-2 py-1 bg-slate-50 hover:border-blue-500 text-sm text-left"
                >
                  {rule.deptName || '点击选择部门'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 默认返回空
  return null;
}
