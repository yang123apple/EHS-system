// src/app/hidden-danger/_components/workflow/CCRuleEditor.tsx
import { useState } from 'react';
import { Plus, Trash2, Mail, Users, MapPin, Tag, Shield, UserCheck, Building2 } from 'lucide-react';
import { HazardCCRule, CCRuleType, SimpleUser } from '@/types/hidden-danger';
import DepartmentSelectModal from '@/components/work-permit/moduls/DepartmentSelectModal';
import { UserSelectModal } from './UserSelectModal';

interface Props {
  rules: HazardCCRule[];
  allUsers: SimpleUser[];
  departments: any[];
  onChange: (rules: HazardCCRule[]) => void;
}

// 内部组件：人员标签
const UserTag = ({ user }: { user: SimpleUser }) => (
  <div className="flex items-center gap-1 px-2 py-1 bg-blue-50 border border-blue-200 rounded text-xs">
    <div className="w-4 h-4 rounded-full bg-blue-600 flex items-center justify-center text-white text-[10px] font-semibold flex-shrink-0">
      {user.name.charAt(0)}
    </div>
    <span className="text-slate-700 font-medium truncate">{user.name}</span>
  </div>
);

// 内部组件：部门标签
const DeptTag = ({ deptName }: { deptName: string }) => (
  <div className="flex items-center gap-1 px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs">
    <Building2 size={14} className="text-slate-400 flex-shrink-0" />
    <span className="text-slate-700 font-medium truncate">{deptName}</span>
  </div>
);

export function CCRuleEditor({ rules, allUsers, departments, onChange }: Props) {
  const [deptModalOpen, setDeptModalOpen] = useState(false);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [currentEditingRule, setCurrentEditingRule] = useState<number | null>(null);

  const handleDeptSelect = (deptId: string, deptName: string) => {
    if (currentEditingRule !== null) {
      updateRuleConfig(currentEditingRule, { deptId, deptName });
    }
    setDeptModalOpen(false);
    setCurrentEditingRule(null);
  };

  const handleUserSelect = (users: Array<{ userId: string; userName: string }>) => {
    if (currentEditingRule !== null) {
      const userIds = users.map(u => u.userId);
      updateRuleConfig(currentEditingRule, { userIds });
    }
    setUserModalOpen(false);
    setCurrentEditingRule(null);
  };

  const openDeptSelector = (ruleIndex: number) => {
    setCurrentEditingRule(ruleIndex);
    setDeptModalOpen(true);
  };

  const openUserSelector = (ruleIndex: number) => {
    setCurrentEditingRule(ruleIndex);
    setUserModalOpen(true);
  };

  const addRule = () => {
    const newRule: HazardCCRule = {
      id: `cc_${Date.now()}`,
      type: 'fixed_users',
      config: {},
      description: ''
    };
    onChange([...rules, newRule]);
  };

  const removeRule = (index: number) => {
    onChange(rules.filter((_, i) => i !== index));
  };

  const updateRuleType = (index: number, newType: CCRuleType) => {
    const newRules = [...rules];
    // 切换类型时清理旧配置，避免脏数据
    newRules[index] = {
      ...newRules[index],
      type: newType,
      config: {},
      description: ''
    };
    onChange(newRules);
  };

  const updateRuleConfig = (index: number, configUpdates: any) => {
    const newRules = [...rules];
    newRules[index].config = { ...newRules[index].config, ...configUpdates };
    onChange(newRules);
  };

  const getRuleIcon = (type: CCRuleType) => {
    switch (type) {
      case 'fixed_users': return <Users size={14} className="text-blue-600" />;
      case 'reporter_manager': return <UserCheck size={14} className="text-green-600" />;
      case 'responsible_manager': return <UserCheck size={14} className="text-indigo-600" />;
      case 'handler_manager': return <UserCheck size={14} className="text-purple-600" />;
      case 'dept_by_location': return <MapPin size={14} className="text-orange-600" />;
      case 'dept_by_type': return <Tag size={14} className="text-pink-600" />;
      case 'role_match': return <Shield size={14} className="text-indigo-600" />;
      case 'responsible': return <UserCheck size={14} className="text-violet-600" />;
      case 'reporter': return <UserCheck size={14} className="text-amber-600" />;
      default: return <Mail size={14} className="text-slate-400" />;
    }
  };

  const getRuleTypeName = (type: CCRuleType) => {
    switch (type) {
      case 'fixed_users': return '固定人员';
      case 'reporter_manager': return '上报人主管';
      case 'responsible_manager': return '责任人主管';
      case 'handler_manager': return '处理人主管';
      case 'dept_by_location': return '区域匹配部门';
      case 'dept_by_type': return '类型匹配部门';
      case 'role_match': return '角色匹配';
      case 'responsible': return '责任人';
      case 'reporter': return '上报人';
      default: return type;
    }
  };

  return (
    <div className="space-y-2.5">
      <div className="flex justify-between items-center">
        <label className="text-xs font-medium text-slate-500">抄送规则</label>
        <button
          onClick={addRule}
          className="bg-blue-600 text-white px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-1 hover:bg-blue-700 transition-colors"
        >
          <Plus size={14} /> 添加
        </button>
      </div>

      {rules.length === 0 && (
        <div className="text-center py-6 bg-slate-50/50 border border-slate-200 rounded-lg">
          <Mail size={18} className="mx-auto mb-1.5 text-slate-300" />
          <p className="text-xs text-slate-400">暂无抄送规则</p>
        </div>
      )}

      {/* 流式小卡片布局 */}
      <div className="flex flex-wrap gap-3">
        {rules.map((rule, index) => (
          <div 
            key={rule.id} 
            className="group relative w-64 bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2.5 hover:border-slate-300 transition-all"
          >
            {/* 卡片头部：图标+标题 */}
            <div className="flex items-center gap-2">
              {getRuleIcon(rule.type)}
              <span className="text-xs font-medium text-slate-700 flex-1">
                {getRuleTypeName(rule.type)}
              </span>
              {/* 删除按钮 - hover 显示 */}
              <button
                onClick={() => removeRule(index)}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-slate-400 hover:bg-red-50 hover:text-red-500"
              >
                <Trash2 size={14} />
              </button>
            </div>

            {/* 规则类型选择 */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">类型</label>
              <select
                className="w-full px-2 py-1.5 text-xs bg-white border border-slate-200 rounded outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all"
                value={rule.type}
                onChange={e => updateRuleType(index, e.target.value as CCRuleType)}
              >
                <option value="fixed_users">固定人员</option>
                <option value="reporter_manager">上报人主管</option>
                <option value="responsible_manager">责任人主管</option>
                <option value="handler_manager">处理人主管</option>
                <option value="dept_by_location">区域匹配部门</option>
                <option value="dept_by_type">类型匹配部门</option>
                <option value="role_match">角色匹配</option>
                <option value="responsible">责任人</option>
                <option value="reporter">上报人</option>
              </select>
            </div>

            {/* 根据类型显示配置 */}
            {rule.type === 'fixed_users' && (
              <div className="space-y-2">
                {(!rule.config?.userIds || rule.config.userIds.length === 0) ? (
                  <button
                    onClick={() => openUserSelector(index)}
                    className="w-full py-2 bg-white border border-dashed border-slate-300 rounded text-xs text-slate-500 hover:border-blue-400 hover:text-blue-600 transition-colors flex items-center justify-center gap-1"
                  >
                    <Users size={14} /> 选择人员
                  </button>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-1.5">
                      {(rule.config?.userIds || []).map((userId: string) => {
                        const user = allUsers.find(u => u.id === userId);
                        return user ? <UserTag key={userId} user={user} /> : null;
                      })}
                    </div>
                    <button
                      onClick={() => openUserSelector(index)}
                      className="w-full py-1.5 bg-white border border-slate-200 rounded text-xs text-blue-600 hover:bg-blue-50 transition-colors"
                    >
                      修改人员
                    </button>
                  </>
                )}
              </div>
            )}

            {rule.type === 'reporter_manager' && (
              <div className="p-2 bg-green-50/50 border border-green-200 rounded">
                <p className="text-xs text-green-700">自动识别上报人主管</p>
              </div>
            )}

            {rule.type === 'responsible_manager' && (
              <div className="p-2 bg-indigo-50/50 border border-indigo-200 rounded">
                <p className="text-xs text-indigo-700">自动识别责任人主管</p>
              </div>
            )}

            {rule.type === 'handler_manager' && (
              <div className="p-2 bg-purple-50/50 border border-purple-200 rounded">
                <p className="text-xs text-purple-700">自动识别处理人主管</p>
              </div>
            )}

            {rule.type === 'responsible' && (
              <div className="p-2 bg-violet-50/50 border border-violet-200 rounded">
                <p className="text-xs text-violet-700">自动抄送责任人</p>
              </div>
            )}

            {rule.type === 'reporter' && (
              <div className="p-2 bg-amber-50/50 border border-amber-200 rounded">
                <p className="text-xs text-amber-700">自动抄送上报人</p>
              </div>
            )}

            {rule.type === 'dept_by_location' && (
              <div className="space-y-2">
                <input
                  type="text"
                  className="w-full px-2 py-1.5 text-xs bg-white border border-slate-200 rounded outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-400 transition-all"
                  placeholder="区域关键词"
                  value={rule.config?.locationMatch || ''}
                  onChange={e => updateRuleConfig(index, { locationMatch: e.target.value })}
                />
                {rule.config?.deptName ? (
                  <>
                    <DeptTag deptName={rule.config.deptName} />
                    <button
                      onClick={() => openDeptSelector(index)}
                      className="w-full py-1.5 bg-white border border-slate-200 rounded text-xs text-orange-600 hover:bg-orange-50 transition-colors"
                    >
                      修改部门
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => openDeptSelector(index)}
                    className="w-full py-2 bg-white border border-dashed border-slate-300 rounded text-xs text-slate-500 hover:border-orange-400 hover:text-orange-600 transition-colors flex items-center justify-center gap-1"
                  >
                    <Building2 size={14} /> 选择部门
                  </button>
                )}
              </div>
            )}

            {rule.type === 'dept_by_type' && (
              <div className="space-y-2">
                <input
                  type="text"
                  className="w-full px-2 py-1.5 text-xs bg-white border border-slate-200 rounded outline-none focus:ring-2 focus:ring-pink-100 focus:border-pink-400 transition-all"
                  placeholder="类型关键词"
                  value={rule.config?.typeMatch || ''}
                  onChange={e => updateRuleConfig(index, { typeMatch: e.target.value })}
                />
                {rule.config?.deptName ? (
                  <>
                    <DeptTag deptName={rule.config.deptName} />
                    <button
                      onClick={() => openDeptSelector(index)}
                      className="w-full py-1.5 bg-white border border-slate-200 rounded text-xs text-pink-600 hover:bg-pink-50 transition-colors"
                    >
                      修改部门
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => openDeptSelector(index)}
                    className="w-full py-2 bg-white border border-dashed border-slate-300 rounded text-xs text-slate-500 hover:border-pink-400 hover:text-pink-600 transition-colors flex items-center justify-center gap-1"
                  >
                    <Building2 size={14} /> 选择部门
                  </button>
                )}
              </div>
            )}

            {rule.type === 'role_match' && (
              <div className="space-y-2">
                <input
                  type="text"
                  className="w-full px-2 py-1.5 text-xs bg-white border border-slate-200 rounded outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all"
                  placeholder="职位关键词"
                  value={rule.config?.roleName || ''}
                  onChange={e => updateRuleConfig(index, { roleName: e.target.value })}
                />
                <p className="text-xs text-slate-500">抄送职位包含此关键词的人员</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 部门选择弹窗 */}
      <DepartmentSelectModal
        isOpen={deptModalOpen}
        onClose={() => {
          setDeptModalOpen(false);
          setCurrentEditingRule(null);
        }}
        onSelect={handleDeptSelect}
        selectedDeptId={currentEditingRule !== null ? rules[currentEditingRule]?.config?.deptId : undefined}
      />

      {/* 用户选择弹窗 */}
      <UserSelectModal
        isOpen={userModalOpen}
        onClose={() => {
          setUserModalOpen(false);
          setCurrentEditingRule(null);
        }}
        onSelect={handleUserSelect}
        allUsers={allUsers}
        departments={departments}
        selectedUserIds={currentEditingRule !== null ? (rules[currentEditingRule]?.config?.userIds || []) : []}
      />
    </div>
  );
}
