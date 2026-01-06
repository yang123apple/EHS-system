// src/app/hidden-danger/_components/workflow/HandlerStrategySelector.tsx
import { useState } from 'react';
import { Plus, X, Trash2, User, Users, MapPin, AlertTriangle, Tag } from 'lucide-react';
import { HandlerStrategy, LocationMatch, TypeMatch, RiskMatch, SimpleUser } from '@/types/hidden-danger';

interface Props {
  strategy: HandlerStrategy;
  config: any;
  allUsers: SimpleUser[];
  departments: any[];
  onChange: (config: any) => void;
  onSelectDepartment?: (field: 'main' | 'location' | 'type' | 'risk', ruleIndex?: number) => void;
  onSelectUser?: () => void;
}

export function HandlerStrategySelector({ 
  strategy, 
  config, 
  allUsers = [], 
  departments = [],
  onChange,
  onSelectDepartment,
  onSelectUser
}: Props) {
  
  const getDeptName = (id: string) => {
    if (!departments || !Array.isArray(departments)) return id;
    const found = departments.find((d: any) => d.id === id);
    return found ? found.name : id;
  };

  // 安全检查
  const safeUsers = allUsers || [];

  // 固定人员策略
  if (strategy === 'fixed') {
    return (
      <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-200 space-y-3">
        <div className="flex justify-between items-center">
          <label className="text-xs font-bold text-slate-600">固定处理人</label>
          <button
            onClick={() => onSelectUser?.()}
            className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            选择人员
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {(!config.fixedUsers || config.fixedUsers.length === 0) ? (
            <span className="text-xs text-slate-400">未选择人员</span>
          ) : (
            config.fixedUsers.map((user: { userId: string; userName: string }, idx: number) => (
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
    );
  }

  // 上报人主管策略
  if (strategy === 'reporter_manager') {
    return (
      <div className="p-4 bg-blue-50/50 rounded border border-blue-200">
        <div className="flex items-center gap-2 text-blue-700">
          <Users size={16} />
          <span className="text-sm font-medium">自动路由给上报人所在部门的主管</span>
        </div>
        <p className="text-xs text-blue-600 mt-2">系统将自动查找上报人部门的负责人进行处理</p>
      </div>
    );
  }

  // 责任人策略
  if (strategy === 'responsible') {
    return (
      <div className="p-4 bg-purple-50/50 rounded border border-purple-200">
        <div className="flex items-center gap-2 text-purple-700">
          <User size={16} />
          <span className="text-sm font-medium">自动路由给隐患责任人</span>
        </div>
        <p className="text-xs text-purple-600 mt-2">系统将自动派发给新建隐患时指定的责任人</p>
      </div>
    );
  }

  // 上报人策略
  if (strategy === 'reporter') {
    return (
      <div className="p-4 bg-amber-50/50 rounded border border-amber-200">
        <div className="flex items-center gap-2 text-amber-700">
          <User size={16} />
          <span className="text-sm font-medium">自动路由给隐患上报人</span>
        </div>
        <p className="text-xs text-amber-600 mt-2">系统将自动派发给隐患的上报人</p>
      </div>
    );
  }

  // 责任人主管策略
  if (strategy === 'responsible_manager') {
    return (
      <div className="p-4 bg-indigo-50/50 rounded border border-indigo-200">
        <div className="flex items-center gap-2 text-indigo-700">
          <Users size={16} />
          <span className="text-sm font-medium">自动路由给责任人所在部门主管</span>
        </div>
        <p className="text-xs text-indigo-600 mt-2">系统将自动查找责任人所在部门的负责人进行处理</p>
      </div>
    );
  }

  // 指定部门主管策略
  if (strategy === 'dept_manager') {
    return (
      <div className="space-y-3">
        <label className="text-xs font-bold text-slate-600">目标部门</label>
        <button
          onClick={() => onSelectDepartment?.('main')}
          className="w-full border border-slate-300 rounded p-3 bg-white hover:border-blue-500 transition-colors text-left"
        >
          <span className={config.targetDeptId ? 'text-slate-700' : 'text-slate-400'}>
            {config.targetDeptId ? getDeptName(config.targetDeptId) : '点击选择部门'}
          </span>
        </button>
        <p className="text-xs text-slate-500">系统将路由给该部门的负责人</p>
      </div>
    );
  }

  // 角色匹配策略
  if (strategy === 'role') {
    return (
      <div className="space-y-3">
        <div>
          <label className="text-xs font-bold text-slate-600 block mb-2">目标部门</label>
          <button
            onClick={() => onSelectDepartment?.('main')}
            className="w-full border border-slate-300 rounded p-3 bg-white hover:border-blue-500 text-left"
          >
            <span className={config.targetDeptId ? 'text-slate-700' : 'text-slate-400'}>
              {config.targetDeptId ? getDeptName(config.targetDeptId) : '点击选择部门'}
            </span>
          </button>
        </div>
        <div>
          <label className="text-xs font-bold text-slate-600 block mb-2">职位关键词</label>
          <input
            type="text"
            className="w-full border rounded px-3 py-2 text-sm"
            placeholder="如: EHS经理"
            value={config.roleName || ''}
            onChange={e => onChange({ ...config, roleName: e.target.value })}
          />
          <p className="text-xs text-slate-500 mt-1">
            系统将查找该部门中职位包含此关键词的人员
          </p>
        </div>
      </div>
    );
  }

  // 区域匹配策略
  if (strategy === 'location_match') {
    return (
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <label className="text-xs font-bold text-slate-600">区域匹配规则</label>
          <button
            onClick={() => {
              const newRules = [...(config.rules || []), { location: '', deptId: '', deptName: '' }];
              onChange({ ...config, rules: newRules });
            }}
            className="text-xs bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600 flex items-center gap-1"
          >
            <Plus size={12} /> 添加规则
          </button>
        </div>

        {(!config.rules || config.rules.length === 0) && (
          <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded border border-dashed">
            请添加至少一条区域匹配规则
          </div>
        )}

        {(config.rules || []).map((rule: LocationMatch, idx: number) => (
          <div key={idx} className="bg-white p-3 rounded border space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <MapPin size={12} /> 规则 {idx + 1}
              </span>
              <button
                onClick={() => {
                  const newRules = (config.rules || []).filter((_: any, i: number) => i !== idx);
                  onChange({ ...config, rules: newRules });
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
                  const newRules = [...(config.rules || [])];
                  newRules[idx].location = e.target.value;
                  onChange({ ...config, rules: newRules });
                }}
              />
            </div>

            <div>
              <label className="text-xs text-slate-500 block mb-1">负责部门</label>
              <button
                onClick={() => onSelectDepartment?.('location', idx)}
                className="w-full border rounded px-2 py-1 bg-slate-50 hover:border-blue-500 text-sm text-left"
              >
                {rule.deptName || '点击选择部门'}
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // 类型匹配策略
  if (strategy === 'type_match') {
    return (
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <label className="text-xs font-bold text-slate-600">类型匹配规则</label>
          <button
            onClick={() => {
              const newRules = [...(config.rules || []), { type: '', deptId: '', deptName: '' }];
              onChange({ ...config, rules: newRules });
            }}
            className="text-xs bg-purple-500 text-white px-2 py-1 rounded hover:bg-purple-600 flex items-center gap-1"
          >
            <Plus size={12} /> 添加规则
          </button>
        </div>

        {(!config.rules || config.rules.length === 0) && (
          <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded border border-dashed">
            请添加至少一条类型匹配规则
          </div>
        )}

        {(config.rules || []).map((rule: TypeMatch, idx: number) => (
          <div key={idx} className="bg-white p-3 rounded border space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <Tag size={12} /> 规则 {idx + 1}
              </span>
              <button
                onClick={() => {
                  const newRules = (config.rules || []).filter((_: any, i: number) => i !== idx);
                  onChange({ ...config, rules: newRules });
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
                  const newRules = [...(config.rules || [])];
                  newRules[idx].type = e.target.value;
                  onChange({ ...config, rules: newRules });
                }}
              />
            </div>

            <div>
              <label className="text-xs text-slate-500 block mb-1">负责部门</label>
              <button
                onClick={() => onSelectDepartment?.('type', idx)}
                className="w-full border rounded px-2 py-1 bg-slate-50 hover:border-blue-500 text-sm text-left"
              >
                {rule.deptName || '点击选择部门'}
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // 风险等级匹配策略
  if (strategy === 'risk_match') {
    return (
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <label className="text-xs font-bold text-slate-600">风险等级匹配规则</label>
          <button
            onClick={() => {
              const newRules = [...(config.rules || []), { riskLevel: 'high', deptId: '', deptName: '' }];
              onChange({ ...config, rules: newRules });
            }}
            className="text-xs bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600 flex items-center gap-1"
          >
            <Plus size={12} /> 添加规则
          </button>
        </div>

        {(!config.rules || config.rules.length === 0) && (
          <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded border border-dashed">
            请添加至少一条风险等级匹配规则
          </div>
        )}

        {(config.rules || []).map((rule: RiskMatch, idx: number) => (
          <div key={idx} className="bg-white p-3 rounded border space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <AlertTriangle size={12} /> 规则 {idx + 1}
              </span>
              <button
                onClick={() => {
                  const newRules = (config.rules || []).filter((_: any, i: number) => i !== idx);
                  onChange({ ...config, rules: newRules });
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
                  const newRules = [...(config.rules || [])];
                  newRules[idx].riskLevel = e.target.value as any;
                  onChange({ ...config, rules: newRules });
                }}
              >
                <option value="high">高风险</option>
                <option value="medium">中风险</option>
                <option value="low">低风险</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-slate-500 block mb-1">负责部门</label>
              <button
                onClick={() => onSelectDepartment?.('risk', idx)}
                className="w-full border rounded px-2 py-1 bg-slate-50 hover:border-blue-500 text-sm text-left"
              >
                {rule.deptName || '点击选择部门'}
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return null;
}
