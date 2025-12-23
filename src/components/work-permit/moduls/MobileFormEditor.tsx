import { useState, useEffect } from 'react';
import { Smartphone, Plus, Trash2, GripVertical, Edit2, X, Check, Eye, Settings, Calendar } from 'lucide-react';
import { ParsedField } from '@/types/work-permit';

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
  const [editingField, setEditingField] = useState<MobileFormField | null>(null);
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('preview'); // 默认预览模式

  useEffect(() => {
    if (isOpen) {
      if (currentConfig) {
        setEnabled(currentConfig.enabled);
        setFields(currentConfig.fields);
        if (currentConfig.groups) {
          setGroups(currentConfig.groups);
        }
      } else {
        // 自动从parsedFields生成初始配置
        const autoFields: MobileFormField[] = parsedFields
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
      fields: fields.map((f, i) => ({ ...f, order: i })),
      groups,
    });
    onClose();
  };

  // 渲染移动端预览
  const renderMobilePreview = () => {
    const groupedFields = new Map<string, MobileFormField[]>();
    
    // 按分组整理字段
    fields.filter(f => !f.hidden).forEach(field => {
      const groupName = field.group || '未分组';
      if (!groupedFields.has(groupName)) {
        groupedFields.set(groupName, []);
      }
      groupedFields.get(groupName)!.push(field);
    });

    // 按照 groups 的顺序排列
    const sortedGroups = groups
      .map(g => ({
        name: g.name,
        fields: groupedFields.get(g.name) || []
      }))
      .filter(g => g.fields.length > 0);

    // 添加未在 groups 中定义的分组
    groupedFields.forEach((fields, groupName) => {
      if (!groups.some(g => g.name === groupName)) {
        sortedGroups.push({ name: groupName, fields });
      }
    });

    return (
      <div className="h-full overflow-auto bg-slate-100">
        {/* 模拟手机屏幕 */}
        <div className="max-w-md mx-auto bg-white min-h-full shadow-2xl">
          {/* 手机顶部状态栏 */}
          <div className="bg-slate-900 text-white px-4 py-2 flex items-center justify-between text-xs">
            <span>9:41</span>
            <div className="flex items-center gap-1">
              <span>📶</span>
              <span>📡</span>
              <span>🔋</span>
            </div>
          </div>

          {/* 表单内容 */}
          <div className="p-4 space-y-4">
            {/* 表单标题 */}
            <div className="bg-white rounded-lg p-4 shadow-sm border">
              <h3 className="text-lg font-bold text-slate-800 text-center">作业许可申请</h3>
              <p className="text-sm text-blue-600 mt-2 text-center font-mono">编号：预览模式</p>
            </div>

            {/* 分组卡片 */}
            {sortedGroups.map((group, groupIndex) => (
              <div key={groupIndex} className="bg-white rounded-lg shadow-sm overflow-hidden border">
                {/* 分组标题 */}
                <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-2.5 border-l-4 border-blue-700">
                  <h4 className="text-white font-bold text-sm flex items-center gap-2">
                    <span className="w-1 h-4 bg-white rounded"></span>
                    {group.name}
                  </h4>
                </div>

                {/* 字段列表 */}
                <div className="p-4 space-y-3">
                  {group.fields.map((field, fieldIndex) => (
                    <div 
                      key={field.id}
                      className={`transition-all ${
                        editingField?.id === field.id ? 'ring-2 ring-purple-500 rounded-lg p-2 -m-2' : ''
                      }`}
                      onClick={() => {
                        setEditingField(field);
                        setViewMode('edit');
                      }}
                    >
                      {renderFieldPreview(field)}
                    </div>
                  ))}
                </div>
              </div>
            ))}

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
    );
  };

  // 渲染单个字段预览
  const renderFieldPreview = (field: MobileFormField) => {
    const label = (
      <label className="flex items-center gap-1 text-xs font-medium text-slate-600 mb-1">
        {field.label}
        {field.required && <span className="text-red-500 text-xs">*</span>}
      </label>
    );

    switch (field.fieldType) {
      case 'option':
        return (
          <div className="space-y-1.5">
            {label}
            <div className="flex flex-wrap gap-2">
              {(field.options || ['选项1', '选项2', '选项3']).map((opt, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="px-4 py-2 rounded-md text-sm font-medium transition-all bg-slate-100 text-slate-700"
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        );

      case 'match':
        return (
          <div className="space-y-1.5">
            {label}
            <div className="space-y-2">
              {(field.options || ['选项1', '选项2', '选项3']).map((opt, idx) => (
                <label
                  key={idx}
                  className="flex items-center gap-2 p-3 bg-slate-50 rounded-md"
                >
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-blue-600 rounded"
                    disabled
                  />
                  <span className="text-sm text-slate-700">{opt}</span>
                </label>
              ))}
            </div>
          </div>
        );

      case 'select':
        return (
          <div className="space-y-1.5">
            {label}
            <select
              className="w-full px-3 py-2.5 border border-slate-300 rounded-md text-sm bg-white"
              disabled
            >
              <option>{field.placeholder || '请选择'}</option>
              {(field.options || []).map((opt, idx) => (
                <option key={idx}>{opt}</option>
              ))}
            </select>
          </div>
        );

      case 'textarea':
      case 'signature':
        return (
          <div className="space-y-1.5">
            {label}
            <textarea
              placeholder={field.placeholder || `请输入${field.label}`}
              rows={3}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-md text-sm resize-none bg-white"
              disabled
            />
          </div>
        );

      case 'date':
        return (
          <div className="space-y-1.5">
            {label}
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="date"
                className="w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-md text-sm bg-white"
                disabled
              />
            </div>
          </div>
        );

      case 'number':
        return (
          <div className="space-y-1.5">
            {label}
            <input
              type="number"
              placeholder={field.placeholder || `请输入${field.label}`}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-md text-sm bg-white"
              disabled
            />
          </div>
        );

      case 'department':
        return (
          <div className="space-y-1.5">
            {label}
            <button
              type="button"
              className="w-full px-3 py-2.5 border border-slate-300 rounded-md text-sm bg-white text-left text-slate-400"
              disabled
            >
              {field.placeholder || '选择部门'}
            </button>
          </div>
        );

      case 'user':
        return (
          <div className="space-y-1.5">
            {label}
            <button
              type="button"
              className="w-full px-3 py-2.5 border border-slate-300 rounded-md text-sm bg-white text-left text-slate-400"
              disabled
            >
              {field.placeholder || '选择人员'}
            </button>
          </div>
        );

      default:
        return (
          <div className="space-y-1.5">
            {label}
            <input
              type="text"
              placeholder={field.placeholder || `请输入${field.label}`}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-md text-sm bg-white"
              disabled
            />
          </div>
        );
    }
  };

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
                <button
                  onClick={handleAddField}
                  disabled={!enabled}
                  className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition"
                >
                  <Plus size={14} /> 添加
                </button>
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
          <div className={`${viewMode === 'edit' ? 'w-1/3' : 'w-2/3'} flex flex-col transition-all`}>
            {renderMobilePreview()}
          </div>

          {/* 右侧：字段属性编辑 */}
          <div className={`${viewMode === 'edit' && editingField ? 'w-1/3' : 'w-0'} border-l flex flex-col transition-all overflow-hidden`}>
            {editingField && (
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-bold text-slate-800 flex items-center gap-2">
                    <Edit2 size={16} /> 字段属性
                  </h4>
                  <button
                    onClick={() => setEditingField(null)}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    完成
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">显示标签 *</label>
                  <input
                    type="text"
                    value={editingField.label}
                    onChange={(e) => handleUpdateField(editingField.id, { label: e.target.value })}
                    className="w-full border rounded px-3 py-2 text-sm"
                    placeholder="字段显示名称"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">关联字段 *</label>
                  <select
                    value={editingField.fieldKey}
                    onChange={(e) => handleUpdateField(editingField.id, { fieldKey: e.target.value })}
                    className="w-full border rounded px-3 py-2 text-sm bg-white"
                  >
                    <option value="">请选择</option>
                    {parsedFields.map(f => (
                      <option key={f.fieldName} value={f.fieldName}>
                        {f.fieldName} ({f.label})
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500 mt-1">选择要绑定的解析字段</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">所属分组</label>
                  <select
                    value={editingField.group || ''}
                    onChange={(e) => handleUpdateField(editingField.id, { group: e.target.value })}
                    className="w-full border rounded px-3 py-2 text-sm bg-white"
                  >
                    {groups.map(g => (
                      <option key={g.name} value={g.name}>{g.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">字段类型</label>
                  <select
                    value={editingField.fieldType}
                    onChange={(e) => handleUpdateField(editingField.id, { fieldType: e.target.value as MobileFormField['fieldType'] })}
                    className="w-full border rounded px-3 py-2 text-sm bg-white"
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

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">占位提示</label>
                  <input
                    type="text"
                    value={editingField.placeholder || ''}
                    onChange={(e) => handleUpdateField(editingField.id, { placeholder: e.target.value })}
                    className="w-full border rounded px-3 py-2 text-sm"
                    placeholder="例如：请输入姓名"
                  />
                </div>

                {['option', 'match', 'select'].includes(editingField.fieldType) && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">选项（每行一个）</label>
                    <textarea
                      value={editingField.options?.join('\n') || ''}
                      onChange={(e) => handleUpdateField(editingField.id, { options: e.target.value.split('\n').filter(Boolean) })}
                      className="w-full border rounded px-3 py-2 text-sm"
                      rows={4}
                      placeholder="选项1&#10;选项2&#10;选项3"
                    />
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingField.required}
                      onChange={(e) => handleUpdateField(editingField.id, { required: e.target.checked })}
                      className="rounded text-blue-600"
                    />
                    <span className="font-medium text-slate-700">必填字段</span>
                  </label>
                  
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingField.hidden || false}
                      onChange={(e) => handleUpdateField(editingField.id, { hidden: e.target.checked })}
                      className="rounded text-slate-600"
                    />
                    <span className="font-medium text-slate-700">隐藏字段</span>
                  </label>
                </div>
              </div>
            )}
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
