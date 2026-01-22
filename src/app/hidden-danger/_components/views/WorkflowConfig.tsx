// src/app/hidden-danger/_components/views/WorkflowConfig.tsx
import { useState, useEffect } from 'react';
import { Save, Settings2, GitBranch, Plus, X, FileText, Tags, Map, Trash2, Info} from 'lucide-react';
import { HazardConfig, HazardWorkflowConfig, SimpleUser } from '@/types/hidden-danger';
import { WorkflowStepEditor } from '../workflow/WorkflowStepEditor';
import { apiFetch } from '@/lib/apiClient';

interface Props {
  config: HazardConfig;
  allUsers: SimpleUser[];
  departments: any[];
  onRefresh: () => void;
  // 兼容旧版本传入的参数（已废弃，保留以避免类型错误）
  ccRules?: any[];
  planRules?: any[];
}

// 检查类型数据结构
interface CheckType {
  id: string;
  name: string;
  value: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
}

export function WorkflowConfig({ config, allUsers, departments, onRefresh }: Props) {
  const [basicConfig, setBasicConfig] = useState<HazardConfig>({
    types: [],
    areas: [],
    checkTypes: []
  });
  const [checkTypes, setCheckTypes] = useState<CheckType[]>([]);
  const [workflowConfig, setWorkflowConfig] = useState<HazardWorkflowConfig>({
    steps: [],
    version: 1,
    updatedAt: new Date().toISOString(),
    updatedBy: 'admin'
  });
  const [isSaving, setIsSaving] = useState(false);

  // 加载现有配置
  useEffect(() => {
    loadWorkflowConfig();
    loadBasicConfig();
    loadCheckTypes();
  }, [config]);

  const loadBasicConfig = async () => {
    try {
      const response = await apiFetch('/api/hazards/config');
      if (response.ok) {
        const data = await response.json();
        setBasicConfig(data);
      }
    } catch (error) {
      console.error('加载基础配置失败:', error);
    }
  };

  const loadCheckTypes = async () => {
    try {
      const response = await apiFetch('/api/check-types');
      if (response.ok) {
        const data = await response.json();
        setCheckTypes(data);
      }
    } catch (error) {
      console.error('加载检查类型失败:', error);
    }
  };

  const loadWorkflowConfig = async () => {
    try {
      const response = await apiFetch('/api/hazards/workflow');
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data && result.data.steps) {
          setWorkflowConfig(result.data);
        } else {
          // 初始化默认配置
          initializeDefaultConfig();
        }
      } else {
        initializeDefaultConfig();
      }
    } catch (error) {
      console.error('加载流转规则失败:', error);
      initializeDefaultConfig();
    }
  };

  const initializeDefaultConfig = () => {
    setWorkflowConfig({
      steps: [
        {
          id: 'report_assign',
          name: '上报并指派',
          description: '隐患上报后自动指派给责任人',
          handlerStrategy: {
            type: 'reporter_manager',
            description: '默认指派给上报人的直属主管'
          },
          ccRules: [],
        },
        {
          id: 'rectify_verify',
          name: '整改验收',
          description: '整改完成后由验收人验收',
          handlerStrategy: {
            type: 'reporter_manager',
            description: '默认由上报人的直属主管验收'
          },
          ccRules: [],
        },
      ],
      version: 1,
      updatedAt: new Date().toISOString(),
      updatedBy: 'admin'
    });
  };

  const handleSaveWorkflow = async () => {
    setIsSaving(true);
    try {
      // 验证工作流配置
      const validationError = validateWorkflowConfig(workflowConfig);
      if (validationError) {
        alert(validationError);
        setIsSaving(false);
        return;
      }

      // 获取当前用户信息（实际应从上下文获取）
      const currentUser = { id: 'admin', name: 'Admin' };
      
      const response = await apiFetch('/api/hazards/workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: workflowConfig,
          userId: currentUser.id,
          userName: currentUser.name,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        alert('流转规则保存成功！');
        if (result.data) {
          setWorkflowConfig(result.data);
        }
        onRefresh();
      } else {
        const error = await response.json();
        alert(`保存失败: ${error.error || '未知错误'}`);
      }
    } catch (error) {
      console.error('保存失败:', error);
      alert('保存失败，请检查网络连接');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveBasicConfig = async () => {
    setIsSaving(true);
    try {
      const response = await apiFetch('/api/hazards/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(basicConfig),
      });

      if (response.ok) {
        alert('基础配置保存成功！');
        onRefresh();
      } else {
        alert('保存失败');
      }
    } catch (error) {
      console.error('保存基础配置失败:', error);
      alert('保存失败，请检查网络连接');
    } finally {
      setIsSaving(false);
    }
  };

  const addType = () => {
    const newType = prompt('请输入新的隐患类型：');
    if (newType && !basicConfig.types.includes(newType)) {
      setBasicConfig({ ...basicConfig, types: [...basicConfig.types, newType] });
    }
  };

  const removeType = (type: string) => {
    if (confirm(`确定删除隐患类型"${type}"吗？`)) {
      setBasicConfig({ ...basicConfig, types: basicConfig.types.filter(t => t !== type) });
    }
  };

  const addArea = () => {
    const newArea = prompt('请输入新的发现区域：');
    if (newArea && !basicConfig.areas.includes(newArea)) {
      setBasicConfig({ ...basicConfig, areas: [...basicConfig.areas, newArea] });
    }
  };

  const removeArea = (area: string) => {
    if (confirm(`确定删除发现区域"${area}"吗？`)) {
      setBasicConfig({ ...basicConfig, areas: basicConfig.areas.filter(a => a !== area) });
    }
  };

  const addCheckType = async () => {
    const name = prompt('请输入检查类型名称（如：日常检查）：');
    if (!name || !name.trim()) return;

    const value = prompt('请输入检查类型值（英文，如：daily）：');
    if (!value || !value.trim()) return;

    const description = prompt('请输入描述（可选）：');

    setIsSaving(true);
    try {
      const response = await apiFetch('/api/check-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          value: value.trim(),
          description: description?.trim() || '',
          sortOrder: checkTypes.length + 1,
          isActive: true,
        }),
      });

      if (response.ok) {
        alert('检查类型添加成功！');
        await loadCheckTypes();
      } else {
        const error = await response.json();
        alert(`添加失败: ${error.error || '未知错误'}`);
      }
    } catch (error) {
      console.error('添加检查类型失败:', error);
      alert('添加失败，请检查网络连接');
    } finally {
      setIsSaving(false);
    }
  };

  const removeCheckType = async (checkType: CheckType) => {
    if (!confirm(`确定删除检查类型"${checkType.name}"吗？`)) return;

    setIsSaving(true);
    try {
      const response = await apiFetch(`/api/check-types?id=${checkType.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        alert('检查类型删除成功！');
        await loadCheckTypes();
      } else {
        const error = await response.json();
        alert(`删除失败: ${error.error || '未知错误'}`);
      }
    } catch (error) {
      console.error('删除检查类型失败:', error);
      alert('删除失败，请检查网络连接');
    } finally {
      setIsSaving(false);
    }
  };

  // 验证工作流配置
  const validateWorkflowConfig = (config: HazardWorkflowConfig): string | null => {
    if (!config.steps || config.steps.length < 2) {
      return '工作流至少需要包含上报和验收两个步骤';
    }

    // 检查第一个步骤必须是 report
    if (config.steps[0].id !== 'report') {
      return '第一个步骤必须是"上报"步骤';
    }

    // 检查最后一个步骤必须是 verify
    const lastStep = config.steps[config.steps.length - 1];
    if (lastStep.id !== 'verify') {
      return '最后一个步骤必须是"验收闭环"步骤';
    }

    // 检查必须包含核心步骤
    const requiredSteps = ['report', 'assign', 'rectify', 'verify'];
    const stepIds = config.steps.map(s => s.id);
    const missingSteps = requiredSteps.filter(id => !stepIds.includes(id));
    
    if (missingSteps.length > 0) {
      return `缺少必需步骤: ${missingSteps.join(', ')}`;
    }

    // 检查核心步骤顺序
    const reportIndex = stepIds.indexOf('report');
    const assignIndex = stepIds.indexOf('assign');
    const rectifyIndex = stepIds.indexOf('rectify');
    const verifyIndex = stepIds.indexOf('verify');

    if (reportIndex !== 0) {
      return '"上报"步骤必须是第一个步骤';
    }

    if (assignIndex < reportIndex || assignIndex > rectifyIndex) {
      return '"指派"步骤必须在"上报"和"整改"之间';
    }

    if (rectifyIndex < assignIndex || rectifyIndex > verifyIndex) {
      return '"整改"步骤必须在"指派"和"验收"之间';
    }

    if (verifyIndex !== config.steps.length - 1) {
      return '"验收闭环"步骤必须是最后一个步骤';
    }

    return null;
  };

  return (
    <div className="space-y-4">
      {/* 基础配置卡片 - 放大版 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* 头部标题区 */}
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg text-purple-600">
              <FileText size={20} />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-lg">系统字典配置</h3>
              <p className="text-sm text-slate-500">管理隐患分类</p>
            </div>
          </div>
          <button
            onClick={handleSaveBasicConfig}
            disabled={isSaving}
            className={`px-5 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${
              isSaving
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-purple-600 text-white hover:bg-purple-700'
            }`}
          >
            <Save size={18} />
            {isSaving ? '保存中...' : '保存'}
          </button>
        </div>

        <div className="p-6">
          {/* 隐患类型主区域 */}
          <div className="space-y-3 mb-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Tags size={18} className="text-slate-400" />
                <label className="text-base font-bold text-slate-700">隐患分类</label>
                <span className="bg-slate-100 text-slate-500 text-xs px-2 py-1 rounded font-medium">
                  {basicConfig.types.length} 项
                </span>
              </div>
              <button
                onClick={addType}
                className="text-sm font-bold px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all flex items-center gap-1.5"
              >
                <Plus size={16} /> 添加
              </button>
            </div>

            {/* 标签容器 */}
            <div className="flex flex-wrap gap-3 min-h-[100px] p-4 bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
              {basicConfig.types.map((type) => (
                <div 
                  key={type} 
                  className="group flex items-center gap-2 bg-white px-4 py-2.5 rounded-lg border border-slate-100 hover:border-red-200 hover:bg-red-50 transition-all"
                >
                  <div className="w-2 h-2 rounded-full bg-blue-400 group-hover:bg-red-400 transition-colors" />
                  <span className="text-sm text-slate-700 font-medium">{type}</span>
                  <button
                    onClick={() => removeType(type)}
                    className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={16} strokeWidth={2.5} />
                  </button>
                </div>
              ))}
              
              {basicConfig.types.length === 0 && (
                <div className="w-full flex flex-col items-center justify-center py-8 text-slate-400">
                  <Tags size={32} className="opacity-20 mb-2" />
                  <p className="text-sm">暂无分类</p>
                </div>
              )}
            </div>
          </div>

          {/* 检查类型配置区域 */}
          <div className="space-y-3 pt-6 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings2 size={18} className="text-purple-500" />
                <label className="text-base font-bold text-slate-700">检查类型</label>
                <span className="bg-purple-100 text-purple-600 text-xs px-2 py-1 rounded font-medium">
                  {checkTypes.length} 项
                </span>
              </div>
              <button
                onClick={addCheckType}
                disabled={isSaving}
                className="text-sm font-bold px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-all flex items-center gap-1.5"
              >
                <Plus size={16} /> 添加
              </button>
            </div>

            {/* 检查类型标签容器 */}
            <div className="flex flex-wrap gap-3 min-h-[100px] p-4 bg-purple-50/30 rounded-lg border border-dashed border-purple-200">
              {checkTypes.map((checkType) => (
                <div 
                  key={checkType.id} 
                  className="group flex items-center gap-2 bg-white px-4 py-2.5 rounded-lg border border-purple-100 hover:border-red-200 hover:bg-red-50 transition-all"
                  title={checkType.description || checkType.value}
                >
                  <div className="w-2 h-2 rounded-full bg-purple-400 group-hover:bg-red-400 transition-colors" />
                  <span className="text-sm text-slate-700 font-medium">{checkType.name}</span>
                  <span className="text-xs text-slate-400 font-mono">({checkType.value})</span>
                  <button
                    onClick={() => removeCheckType(checkType)}
                    disabled={isSaving}
                    className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 disabled:cursor-not-allowed transition-opacity"
                  >
                    <X size={16} strokeWidth={2.5} />
                  </button>
                </div>
              ))}
              
              {checkTypes.length === 0 && (
                <div className="w-full flex flex-col items-center justify-center py-8 text-slate-400">
                  <Settings2 size={32} className="opacity-20 mb-2" />
                  <p className="text-sm">暂无检查类型</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {/* 流程配置卡片 - 放大版 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 bg-slate-50/50 flex items-center justify-between border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
              <GitBranch size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-800 text-lg">流程配置</h3>
                <span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded font-medium">
                  v{workflowConfig.version}
                </span>
              </div>
              <p className="text-sm text-slate-500">定义隐患处理流转规则</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden md:block text-right">
              <div className="text-xs text-slate-400 font-medium">最后更新</div>
              <div className="text-sm text-slate-600">{new Date(workflowConfig.updatedAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</div>
            </div>
            <button
              onClick={handleSaveWorkflow}
              disabled={isSaving}
              className={`px-5 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${
                isSaving
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              <Save size={18} />
              {isSaving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* 流程步骤编辑器 - 直接展示，无额外装饰 */}
          <WorkflowStepEditor
            steps={workflowConfig.steps}
            allUsers={allUsers}
            departments={departments}
            onChange={steps => setWorkflowConfig({ ...workflowConfig, steps })}
          />
        </div>
      </div>
    </div>
  );
}
