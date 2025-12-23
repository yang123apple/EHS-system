import { useState, useEffect, useMemo } from 'react';
import { 
  Smartphone, Plus, Trash2, GripVertical, Edit2, X, Check, Eye, Settings
} from 'lucide-react';
import { ParsedField } from '@/types/work-permit';
import MobileFormRenderer, { MobileFormConfigForRenderer } from '../views/MobileFormRenderer';

export interface MobileFormField {
  id: string;
  label: string;
  fieldKey: string; // 对应parsedFields中的fieldName
  fieldType: 'text' | 'select' | 'date' | 'number' | 'textarea' | 'signature' | 'department' | 'user' | 'option' | 'match';
  placeholder?: string;
  required: boolean;
  options?: string[]; // 用于select类型
  order: number;
  group?: string; // 分组名称
  hidden?: boolean; // 是否隐藏
}

export interface MobileFormConfig {
  enabled: boolean;
  fields: MobileFormField[];
  groups?: Array<{ name: string; order: number }>; // 分组配置
  title?: string; // 表单标题
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  parsedFields: ParsedField[];
  currentConfig?: MobileFormConfig;
  onSave: (config: MobileFormConfig) => void;
}

export default function MobileFormEditor({ isOpen, onClose, parsedFields, currentConfig, onSave }: Props) {
  const [enabled, setEnabled] = useState(false);
  const [fields, setFields] = useState<MobileFormField[]>([]);
  const [groups, setGroups] = useState<Array<{ name: string; order: number }>>([
    { name: '基础信息', order: 0 },
    { name: '安全措施', order: 1 },
    { name: '审批意见', order: 2 }
  ]);
  const [title, setTitle] = useState('作业许可申请');
  const [editingField, setEditingField] = useState<MobileFormField | null>(null);
  const [editingGroupIndex, setEditingGroupIndex] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('preview'); // 默认预览模式

  useEffect(() => {
    if (isOpen) {
      if (currentConfig) {
        setEnabled(currentConfig.enabled);
        setFields(currentConfig.fields);
        setTitle(currentConfig.title || '作业许可申请');
        if (currentConfig.groups) {
          setGroups(currentConfig.groups);
        }
      } else {
        // 🟢 自动从parsedFields生成初始配置，按坐标排序（先行后列）
        const sortedParsedFields = [...parsedFields].sort((a, b) => {
          // 优先使用rowIndex/colIndex
          if (a.rowIndex !== undefined && b.rowIndex !== undefined) {
            if (a.rowIndex !== b.rowIndex) return a.rowIndex - b.rowIndex;
            return (a.colIndex || 0) - (b.colIndex || 0);
          }
          // 兜底：从cellKey解析
          const matchA = a.cellKey?.match(/R(\d+)C(\d+)/);
          const matchB = b.cellKey?.match(/R(\d+)C(\d+)/);
          if (matchA && matchB) {
            const rowA = parseInt(matchA[1]);
            const rowB = parseInt(matchB[1]);
            if (rowA !== rowB) return rowA - rowB;
            return parseInt(matchA[2]) - parseInt(matchB[2]);
          }
          return 0;
        });

        const autoFields: MobileFormField[] = sortedParsedFields
          .map((f, index) => ({
            id: `field-${Date.now()}-${index}`,
            label: f.fieldName || f.label,
            fieldKey: f.fieldName,
            fieldType: mapFieldType(f.fieldType),
            placeholder: `请输入${f.fieldName || f.label}`,
            required: f.required || false,
            options: ['option', 'match', 'select'].includes(f.fieldType) ? f.options : undefined,
            order: index,
            group: f.group || autoDetectGroup(f),
            hidden: false,
          }));
        setFields(autoFields);
        setEnabled(false);
      }
    }
  }, [isOpen, currentConfig, parsedFields]);

  const autoDetectGroup = (field: ParsedField): string => {
    if (field.fieldType === 'signature') return '审批意见';
    if (field.isSafetyMeasure) return '安全措施';
    return '基础信息';
  };

  const mapFieldType = (type: string): MobileFormField['fieldType'] => {
    switch (type) {
      case 'text': return 'text';
      case 'select': return 'select';
      case 'option': return 'option';
      case 'match': return 'match';
      case 'date': return 'date';
      case 'number': return 'number';
      case 'textarea': return 'textarea';
      case 'signature': return 'signature';
      case 'department': return 'department';
      case 'personnel': return 'user';
      default: return 'text';
    }
  };

  const handleAddField = () => {
    const newField: MobileFormField = {
      id: `field-${Date.now()}`,
      label: '新字段',
      fieldKey: '',
      fieldType: 'text',
      placeholder: '',
      required: false,
      order: fields.length,
      group: '基础信息',
      hidden: false,
    };
    setFields([...fields, newField]);
    setEditingField(newField);
    setViewMode('edit');
  };

  const handleDeleteField = (id: string) => {
    setFields(fields.filter(f => f.id !== id));
    if (editingField?.id === id) {
      setEditingField(null);
    }
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newFields = [...fields];
    [newFields[index - 1], newFields[index]] = [newFields[index], newFields[index - 1]];
    newFields.forEach((f, i) => f.order = i);
    setFields(newFields);
  };

  const handleMoveDown = (index: number) => {
    if (index === fields.length - 1) return;
    const newFields = [...fields];
    [newFields[index], newFields[index + 1]] = [newFields[index + 1], newFields[index]];
    newFields.forEach((f, i) => f.order = i);
    setFields(newFields);
  };

  const handleUpdateField = (id: string, updates: Partial<MobileFormField>) => {
    setFields(fields.map(f => f.id === id ? { ...f, ...updates } : f));
    if (editingField?.id === id) {
      setEditingField({ ...editingField, ...updates });
    }
  };

  const handleSave = () => {
    onSave({
      enabled,
      fields,
      groups,
      title,
    });
    onClose();
  };

  // 分组管理函数
  const handleAddGroup = () => {
    const newGroup = {
      name: '新分组',
      order: groups.length
    };
    setGroups([...groups, newGroup]);
    // 保持在表单设置模式，不自动进入编辑
  };

  const handleDeleteGroup = (index: number) => {
    const groupName = groups[index].name;
    // 将该分组的字段移到"其他信息"
    setFields(fields.map(f => 
      f.group === groupName ? { ...f, group: '其他信息' } : f
    ));
    setGroups(groups.filter((_, i) => i !== index));
    if (editingGroupIndex === index) {
      setEditingGroupIndex(null); // 返回表单设置模式
    }
  };

  const handleUpdateGroup = (index: number, name: string) => {
    const oldName = groups[index].name;
    const newGroups = [...groups];
    newGroups[index] = { ...newGroups[index], name };
    setGroups(newGroups);
    // 更新字段的分组名称
    setFields(fields.map(f => 
      f.group === oldName ? { ...f, group: name } : f
    ));
  };

  const handleMoveGroupUp = (index: number) => {
    if (index === 0) return;
    const newGroups = [...groups];
    [newGroups[index - 1], newGroups[index]] = [newGroups[index], newGroups[index - 1]];
    newGroups.forEach((g, i) => g.order = i);
    setGroups(newGroups);
  };

  const handleMoveGroupDown = (index: number) => {
    if (index === groups.length - 1) return;
    const newGroups = [...groups];
    [newGroups[index], newGroups[index + 1]] = [newGroups[index + 1], newGroups[index]];
    newGroups.forEach((g, i) => g.order = i);
    setGroups(newGroups);
  };

  // 🟢 构建预览用的 Config 配置
  const previewConfig: MobileFormConfigForRenderer = useMemo(() => {
    // 1. 按分组整理字段ID
    const groupedFields = new Map<string, string[]>();
    
    fields.filter(f => !f.hidden).forEach(field => {
      const groupName = field.group || '未分组';
      if (!groupedFields.has(groupName)) {
        groupedFields.set(groupName, []);
      }
      groupedFields.get(groupName)!.push(field.id);
    });

    // 2. 按照 groups 的顺序生成 renderer 需要的 groups 结构
    const rendererGroups = groups.map(g => ({
      title: g.name,
      fieldKeys: groupedFields.get(g.name) || []
    })).filter(g => g.fieldKeys.length > 0);
    
    // 3. 添加未在 groups 中定义的分组（如果有的话）
    groupedFields.forEach((keys, groupName) => {
      if (!groups.some(g => g.name === groupName)) {
        rendererGroups.push({
          title: groupName,
          fieldKeys: keys
        });
      }
    });

    // 4. 将编辑器字段转换为 renderer 可用的字段对象
    const rendererFields = fields.map(f => ({
      ...f,
      // 关键：renderer 通过 cellKey/fieldKey 查找字段，这里统一用 id
      cellKey: f.id, 
      fieldKey: f.id,
      fieldName: f.label, // renderer 使用 fieldName 或 label
      fieldType: f.fieldType,
      hint: f.placeholder, // placeholder 映射到 hint
    }));

    return {
      groups: rendererGroups,
      fields: rendererFields,
      title: title
    };
  }, [fields, groups, title]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl w-full max-w-6xl h-[90vh] flex flex-col shadow-2xl">
        <div className="p-4 border-b flex justify-between items-center bg-gradient-to-r from-blue-50 to-purple-50">
          <div className="flex items-center gap-3">
            <Smartphone className="text-blue-600" size={24} />
            <div>
              <h3 className="font-bold text-lg text-slate-800">移动端表单编辑器</h3>
              <p className="text-xs text-slate-500">所见即所得，实时预览移动端效果</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* 视图切换 */}
            <div className="flex bg-slate-200 rounded-lg p-1">
              <button
                onClick={() => setViewMode('preview')}
                className={`px-3 py-1.5 rounded text-xs font-medium transition flex items-center gap-1 ${
                  viewMode === 'preview'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                <Eye size={14} /> 预览
              </button>
              <button
                onClick={() => setViewMode('edit')}
                className={`px-3 py-1.5 rounded text-xs font-medium transition flex items-center gap-1 ${
                  viewMode === 'edit'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                <Settings size={14} /> 编辑
              </button>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded text-slate-500">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex">
          {/* 左侧：字段列表 */}
          <div className={`${viewMode === 'edit' ? 'w-1/3' : 'w-0'} border-r flex flex-col transition-all overflow-hidden`}>
            <div className="p-4 border-b bg-slate-50">
              <div className="flex items-center justify-between mb-4">
                <label className="flex items-center gap-2 font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => setEnabled(e.target.checked)}
                    className="rounded text-blue-600"
                  />
                  启用移动端表单
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => { 
                      setEditingField(null); 
                      setEditingGroupIndex(-1);
                      setViewMode('edit'); // 自动切换到编辑模式
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 text-white text-xs rounded hover:bg-purple-700 transition"
                    title="编辑表单标题和分组"
                  >
                    <Settings size={14} /> 设置
                  </button>
                  <button
                    onClick={handleAddField}
                    disabled={!enabled}
                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition"
                  >
                    <Plus size={14} /> 添加字段
                  </button>
                </div>
              </div>
              <p className="text-xs text-slate-500">
                点击字段编辑属性，拖动排序
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {fields.length === 0 ? (
                <div className="text-center text-slate-400 py-12">
                  <Smartphone size={48} className="mx-auto mb-4 opacity-30" />
                  <p className="text-sm">暂无字段</p>
                  <p className="text-xs mt-1">点击"添加"开始配置</p>
                </div>
              ) : (
                fields.map((field, index) => (
                  <div
                    key={field.id}
                    className={`border rounded-lg p-3 transition cursor-pointer ${
                      editingField?.id === field.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-slate-200 bg-white hover:border-blue-300'
                    } ${field.hidden ? 'opacity-50' : ''}`}
                    onClick={() => setEditingField(field)}
                  >
                    <div className="flex items-center gap-2">
                      <GripVertical size={16} className="text-slate-400 cursor-move" />
                      <div className="flex-1">
                        <div className="font-medium text-sm text-slate-800 flex items-center gap-2">
                          {field.label}
                          {field.hidden && <span className="text-xs text-slate-400">(已隐藏)</span>}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {field.fieldType} • {field.group} {field.required && <span className="text-red-500">*</span>}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleMoveUp(index); }}
                          disabled={index === 0}
                          className="p-1 hover:bg-slate-200 rounded disabled:opacity-30 disabled:cursor-not-allowed text-xs"
                          title="上移"
                        >
                          ▲
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleMoveDown(index); }}
                          disabled={index === fields.length - 1}
                          className="p-1 hover:bg-slate-200 rounded disabled:opacity-30 disabled:cursor-not-allowed text-xs"
                          title="下移"
                        >
                          ▼
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteField(field.id); }}
                          className="p-1 hover:bg-red-100 text-red-600 rounded"
                          title="删除"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 中间：预览区 */}
          <div className={`${viewMode === 'edit' ? 'w-1/3' : 'w-2/3'} flex flex-col transition-all bg-slate-100 overflow-hidden`}>
            <div className="h-full overflow-auto p-4 flex justify-center">
              {/* 模拟手机屏幕 */}
              <div className="w-[375px] bg-white min-h-[667px] shadow-2xl rounded-xl overflow-hidden flex flex-col border-8 border-slate-900">
                {/* 手机顶部状态栏 */}
                <div className="bg-slate-900 text-white px-4 py-2 flex items-center justify-between text-xs shrink-0">
                  <span>9:41</span>
                  <div className="flex items-center gap-1">
                    <span>📶</span>
                    <span>📡</span>
                    <span>🔋</span>
                  </div>
                </div>

                {/* 表单内容 - 使用 MobileFormRenderer */}
                <div className="flex-1 overflow-y-auto bg-slate-50">
                  <MobileFormRenderer 
                    config={previewConfig}
                    mode="preview" // 使用预览模式
                    onFieldClick={(field) => {
                      // 查找对应的 MobileFormField 并设置为编辑中
                      const targetField = fields.find(f => f.id === field.id);
                      if (targetField) {
                        setEditingField(targetField);
                        setViewMode('edit');
                      }
                    }}
                  />
                  
                  {fields.filter(f => !f.hidden).length === 0 && (
                    <div className="text-center py-12 text-slate-400">
                      <Smartphone size={48} className="mx-auto mb-4 opacity-30" />
                      <p className="text-sm">暂无字段</p>
                      <p className="text-xs mt-1">点击"添加字段"开始配置</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 右侧：字段属性编辑 / 表单设置 */}
          <div className={`${viewMode === 'edit' && (editingField || editingGroupIndex !== null) ? 'w-1/3' : 'w-0'} border-l flex flex-col transition-all overflow-hidden bg-white`}>
            {editingField ? (
              /* 字段属性编辑 */
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-bold text-slate-800">字段属性</h4>
                  <button
                    onClick={() => setEditingField(null)}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    关闭
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">字段名称</label>
                  <input
                    type="text"
                    value={editingField.label}
                    onChange={(e) => handleUpdateField(editingField.id, { label: e.target.value })}
                    className="w-full border rounded px-2 py-1 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">字段类型</label>
                  <select
                    value={editingField.fieldType}
                    onChange={(e) => handleUpdateField(editingField.id, { fieldType: e.target.value as MobileFormField['fieldType'] })}
                    className="w-full border rounded px-2 py-1 text-sm"
                  >
                    <option value="text">单行文本</option>
                    <option value="textarea">多行文本</option>
                    <option value="number">数字</option>
                    <option value="date">日期</option>
                    <option value="option">单选（按钮组）</option>
                    <option value="match">多选（复选框）</option>
                    <option value="select">下拉选择</option>
                    <option value="department">部门选择</option>
                    <option value="user">人员选择</option>
                    <option value="signature">签名</option>
                  </select>
                </div>

                {['option', 'match', 'select'].includes(editingField.fieldType) && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">选项（每行一个）</label>
                    <textarea
                      value={editingField.options?.join('\n') || ''}
                      onChange={(e) => handleUpdateField(editingField.id, { 
                        options: e.target.value.split('\n').filter(o => o.trim()) 
                      })}
                      className="w-full border rounded px-2 py-1 text-sm"
                      rows={4}
                      placeholder="选项1&#10;选项2&#10;选项3"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">所属分组</label>
                  <select
                    value={editingField.group || ''}
                    onChange={(e) => handleUpdateField(editingField.id, { group: e.target.value })}
                    className="w-full border rounded px-2 py-1 text-sm"
                  >
                    <option value="">未分组</option>
                    {groups.map((g, i) => (
                      <option key={i} value={g.name}>{g.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">占位符</label>
                  <input
                    type="text"
                    value={editingField.placeholder || ''}
                    onChange={(e) => handleUpdateField(editingField.id, { placeholder: e.target.value })}
                    className="w-full border rounded px-2 py-1 text-sm"
                  />
                </div>

                <div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={editingField.required || false}
                      onChange={(e) => handleUpdateField(editingField.id, { required: e.target.checked })}
                    />
                    必填字段
                  </label>
                </div>

                <div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={editingField.hidden || false}
                      onChange={(e) => handleUpdateField(editingField.id, { hidden: e.target.checked })}
                    />
                    隐藏字段
                  </label>
                </div>
              </div>
            ) : editingGroupIndex !== null ? (
              /* 表单标题和分组管理 */
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-bold text-slate-800 flex items-center gap-2">
                    <Settings size={16} /> 表单设置
                  </h4>
                  <button
                    onClick={() => setEditingGroupIndex(null)}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    关闭
                  </button>
                </div>

                {/* 表单标题 */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">表单标题</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full border rounded px-3 py-2 text-sm"
                    placeholder="例如：作业许可申请"
                  />
                </div>

                {/* 分组管理 */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-bold text-slate-700">分组管理</label>
                    <button
                      onClick={handleAddGroup}
                      className="flex items-center gap-1 px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition"
                    >
                      <Plus size={12} /> 新增分组
                    </button>
                  </div>
                  <div className="space-y-2">
                    {groups.map((group, index) => (
                      <div
                        key={index}
                        className={`border rounded-lg p-3 transition ${
                          editingGroupIndex === index
                            ? 'border-purple-500 bg-purple-50'
                            : 'border-slate-200 bg-white'
                        }`}
                      >
                        {editingGroupIndex === index ? (
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={group.name}
                              onChange={(e) => handleUpdateGroup(index, e.target.value)}
                              className="w-full border rounded px-2 py-1 text-sm"
                              placeholder="分组名称"
                            />
                            <button
                              onClick={() => setEditingGroupIndex(null)}
                              className="text-xs text-blue-600 hover:underline"
                            >
                              完成
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm text-slate-800">{group.name}</span>
                            <div className="flex gap-1">
                              <button
                                onClick={() => setEditingGroupIndex(index)}
                                className="p-1 hover:bg-slate-200 rounded text-xs"
                                title="编辑"
                              >
                                <Edit2 size={12} />
                              </button>
                              <button
                                onClick={() => handleMoveGroupUp(index)}
                                disabled={index === 0}
                                className="p-1 hover:bg-slate-200 rounded disabled:opacity-30 disabled:cursor-not-allowed text-xs"
                                title="上移"
                              >
                                ▲
                              </button>
                              <button
                                onClick={() => handleMoveGroupDown(index)}
                                disabled={index === groups.length - 1}
                                className="p-1 hover:bg-slate-200 rounded disabled:opacity-30 disabled:cursor-not-allowed text-xs"
                                title="下移"
                              >
                                ▼
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm(`确定删除分组"${group.name}"吗？该分组的字段将移至"其他信息"`)) {
                                    handleDeleteGroup(index);
                                  }
                                }}
                                className="p-1 hover:bg-red-100 text-red-600 rounded"
                                title="删除"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="p-4 border-t bg-slate-50 flex justify-between items-center">
          <div className="text-xs text-slate-500">
            共 {fields.length} 个字段 • {fields.filter(f => !f.hidden).length} 个显示 {enabled ? '✓ 已启用' : '✗ 未启用'}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 border rounded hover:bg-slate-100 text-sm"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2 text-sm"
            >
              <Check size={16} /> 保存配置
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
