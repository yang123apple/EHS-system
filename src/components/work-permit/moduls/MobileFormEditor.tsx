import { useState, useEffect } from 'react';
import { Smartphone, Plus, Trash2, GripVertical, Edit2, X, Check } from 'lucide-react';
import { ParsedField } from '@/types/work-permit';

export interface MobileFormField {
  id: string;
  label: string;
  fieldKey: string; // 对应parsedFields中的fieldName
  fieldType: 'text' | 'select' | 'date' | 'number' | 'textarea' | 'signature' | 'department' | 'user';
  placeholder?: string;
  required: boolean;
  options?: string[]; // 用于select类型
  order: number;
}

export interface MobileFormConfig {
  enabled: boolean;
  fields: MobileFormField[];
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
  const [editingField, setEditingField] = useState<MobileFormField | null>(null);
  const [showAddField, setShowAddField] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (currentConfig) {
        setEnabled(currentConfig.enabled);
        setFields(currentConfig.fields);
      } else {
        // 自动从parsedFields生成初始配置
        const autoFields: MobileFormField[] = parsedFields
          .filter(f => !['signature', 'section'].includes(f.fieldType))
          .map((f, index) => ({
            id: `field-${Date.now()}-${index}`,
            label: f.label || f.fieldName,
            fieldKey: f.fieldName,
            fieldType: mapFieldType(f.fieldType),
            placeholder: `请输入${f.label || f.fieldName}`,
            required: false,
            options: f.fieldType === 'select' ? f.options : undefined,
            order: index,
          }));
        setFields(autoFields);
        setEnabled(false);
      }
    }
  }, [isOpen, currentConfig, parsedFields]);

  const mapFieldType = (type: string): MobileFormField['fieldType'] => {
    switch (type) {
      case 'text': return 'text';
      case 'select': return 'select';
      case 'date': return 'date';
      case 'number': return 'number';
      case 'textarea': return 'textarea';
      case 'signature': return 'signature';
      case 'department': return 'department';
      case 'user': return 'user';
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
    };
    setFields([...fields, newField]);
    setEditingField(newField);
    setShowAddField(false);
  };

  const handleDeleteField = (id: string) => {
    setFields(fields.filter(f => f.id !== id));
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
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl w-full max-w-4xl h-[90vh] flex flex-col shadow-2xl">
        <div className="p-4 border-b flex justify-between items-center bg-gradient-to-r from-blue-50 to-purple-50">
          <div className="flex items-center gap-3">
            <Smartphone className="text-blue-600" size={24} />
            <div>
              <h3 className="font-bold text-lg text-slate-800">移动端表单编辑器</h3>
              <p className="text-xs text-slate-500">将表格数据转换为移动端友好的垂直表单</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded text-slate-500">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex">
          {/* 左侧：字段列表编辑 */}
          <div className="w-1/2 border-r flex flex-col">
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
                  <Plus size={14} /> 添加字段
                </button>
              </div>
              <p className="text-xs text-slate-500">
                拖动排序，点击编辑字段属性
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {fields.length === 0 ? (
                <div className="text-center text-slate-400 py-12">
                  <Smartphone size={48} className="mx-auto mb-4 opacity-30" />
                  <p className="text-sm">暂无字段</p>
                  <p className="text-xs mt-1">点击"添加字段"开始配置</p>
                </div>
              ) : (
                fields.map((field, index) => (
                  <div
                    key={field.id}
                    className={`border rounded-lg p-3 transition cursor-pointer ${
                      editingField?.id === field.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-slate-200 bg-white hover:border-blue-300'
                    }`}
                    onClick={() => setEditingField(field)}
                  >
                    <div className="flex items-center gap-2">
                      <GripVertical size={16} className="text-slate-400 cursor-move" />
                      <div className="flex-1">
                        <div className="font-medium text-sm text-slate-800">{field.label}</div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {field.fieldType} {field.required && <span className="text-red-500">*</span>}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleMoveUp(index); }}
                          disabled={index === 0}
                          className="p-1 hover:bg-slate-200 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                          title="上移"
                        >
                          ▲
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleMoveDown(index); }}
                          disabled={index === fields.length - 1}
                          className="p-1 hover:bg-slate-200 rounded disabled:opacity-30 disabled:cursor-not-allowed"
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

          {/* 右侧：字段属性编辑 / 预览 */}
          <div className="w-1/2 flex flex-col">
            {editingField ? (
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-bold text-slate-800 flex items-center gap-2">
                    <Edit2 size={16} /> 字段属性
                  </h4>
                  <button
                    onClick={() => setEditingField(null)}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    完成编辑
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
                        {f.label || f.fieldName}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500 mt-1">选择要绑定的解析字段</p>
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

                {editingField.fieldType === 'select' && (
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

                <div>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingField.required}
                      onChange={(e) => handleUpdateField(editingField.id, { required: e.target.checked })}
                      className="rounded text-blue-600"
                    />
                    <span className="font-medium text-slate-700">必填字段</span>
                  </label>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-400 p-4">
                <div className="text-center">
                  <Edit2 size={48} className="mx-auto mb-4 opacity-30" />
                  <p className="text-sm">点击左侧字段进行编辑</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t bg-slate-50 flex justify-between items-center">
          <div className="text-xs text-slate-500">
            共 {fields.length} 个字段 {enabled ? '(已启用)' : '(未启用)'}
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
