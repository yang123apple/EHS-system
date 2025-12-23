import { useState, useRef, useMemo, useEffect } from 'react';
import { X, Paperclip, CheckCircle, FileText, Printer, Calendar, User, Building } from 'lucide-react';
import { Project, Template } from '@/types/work-permit';
import { PermitService } from '@/services/workPermitService';
import ExcelRenderer from '../ExcelRenderer';
import SectionFormModal from './SectionFormModal';
import PrintStyle from '../PrintStyle';
import { MobileFormConfig } from './MobileFormEditor';
// 🟢 1. 引入工具函数（替换原内联定义）
import { findDeptRecursive } from '@/utils/departmentUtils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  templates: Template[];
  user: any;
  departments: any[];
  allUsers: any[];
  onSuccess: () => void;
}

export default function AddPermitModal({
  isOpen,
  onClose,
  project,
  templates,
  user,
  departments,
  allUsers,
  onSuccess,
}: Props) {
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [permitFormData, setPermitFormData] = useState<Record<string, any>>({});
  const [attachments, setAttachments] = useState<any[]>([]);
  const [opinion, setOpinion] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [previewCode, setPreviewCode] = useState<string>(''); // 🟢 预览编号
  const [mobileStep, setMobileStep] = useState<'select' | 'fill'>('select'); // 移动端步骤：选择模板 | 填写表单
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 🔵 V3.4 Section表单状态
  const [sectionModalOpen, setSectionModalOpen] = useState(false);
  const [currentSectionCell, setCurrentSectionCell] = useState<{ cellKey: string; fieldName: string } | null>(null);
  const [allTemplates, setAllTemplates] = useState<Template[]>([]);

  // 🔵 加载所有模板（用于section绑定）
  useEffect(() => {
    fetch('/api/templates')
      .then(res => res.json())
      .then(data => setAllTemplates(data))
      .catch(err => console.error('加载模板失败:', err));
  }, []);

  const selectedTemplateData = useMemo(() => {
    if (!selectedTemplate) return null;
    try {
      return JSON.parse(selectedTemplate.structureJson);
    } catch (e) {
      return { grid: [['错误']] };
    }
  }, [selectedTemplate?.id]);

  const selectedParsedFields = useMemo(() => {
    if (!selectedTemplate?.parsedFields) return [];
    try {
      const parsed = JSON.parse(selectedTemplate.parsedFields);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }, [selectedTemplate?.parsedFields]);

  // 🟢 移动端字段分组（基于 parsedFields 的结构化信息）
  // 📌 数据格式说明（与 ExcelRenderer 完全一致）：
  // - 普通单元格: permitFormData[`${rowIndex}-${colIndex}`] = value
  // - 内联输入框: permitFormData[`${rowIndex}-${colIndex}-inlines`] = { [`${rowIndex}-${colIndex}-inline-0`]: value, ... }
  // - Section单元格: permitFormData[`SECTION_R${rowIndex+1}C${colIndex+1}`] = { templateId, templateName, code, data }
  const mobileFieldGroups = useMemo(() => {
    if (!selectedParsedFields || selectedParsedFields.length === 0) return [];
    
    // 如果字段有 group 属性，使用该属性分组
    const hasGroupInfo = selectedParsedFields.some((f: any) => f.group);
    
    if (hasGroupInfo) {
      const groups = new Map<string, any[]>();
      selectedParsedFields.forEach((field: any) => {
        const groupName = field.group || '其他信息';
        if (!groups.has(groupName)) {
          groups.set(groupName, []);
        }
        groups.get(groupName)!.push(field);
      });
      return Array.from(groups.entries()).map(([title, fields]) => ({ title, fields }));
    }

    // 否则，按字段类型自动分组
    const groups: { title: string; fields: any[] }[] = [];
    const signatureFields: any[] = [];
    const regularFields: any[] = [];
    const safetyFields: any[] = [];

    selectedParsedFields.forEach((field: any) => {
      if (field.fieldType === 'signature') {
        signatureFields.push(field);
      } else if (field.isSafetyMeasure) {
        safetyFields.push(field);
      } else {
        regularFields.push(field);
      }
    });

    if (regularFields.length > 0) {
      groups.push({ title: '基础信息', fields: regularFields });
    }
    if (safetyFields.length > 0) {
      groups.push({ title: '安全措施', fields: safetyFields });
    }
    if (signatureFields.length > 0) {
      groups.push({ title: '审批意见', fields: signatureFields });
    }

    return groups;
  }, [selectedParsedFields]);

  // 🟢 当选择模板后，预生成编号
  useEffect(() => {
    if (selectedTemplate && project) {
      fetch(`/api/permits?action=generate-code&projectId=${project.id}&templateType=${encodeURIComponent(selectedTemplate.type)}`)
        .then(res => res.json())
        .then(data => {
          if (data.code) {
            setPreviewCode(data.code);
          }
        })
        .catch(err => {
          console.error('预生成编号失败:', err);
        });
    } else {
      setPreviewCode('');
    }
  }, [selectedTemplate?.id, project?.id]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.size > 50 * 1024 * 1024) {
        alert('附件大小不能超过 50MB');
        return;
      }
      const reader = new FileReader();
      reader.onload = (evt) => {
        setAttachments((prev) => [
          ...prev,
          {
            name: file.name,
            size: (file.size / 1024).toFixed(1) + ' KB',
            type: file.type,
            content: evt.target?.result,
          },
        ]);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  // 🔵 V3.4 Section相关处理函数
  const handleSectionClick = (cellKey: string, fieldName: string) => {
    console.log('🔵 Section clicked:', { cellKey, fieldName, selectedTemplate });
    setCurrentSectionCell({ cellKey, fieldName });
    setSectionModalOpen(true);
    console.log('🔵 Section modal opened');
  };

  const handleSectionSave = (sectionData: {
    templateId: string;
    templateName: string;
    code: string;
    data: Record<string, any>;
  }) => {
    if (!currentSectionCell) return;
    
    // 存储section数据到permitFormData中，使用SECTION_前缀
    setPermitFormData(prev => ({
      ...prev,
      [`SECTION_${currentSectionCell.cellKey}`]: sectionData
    }));
    
    setSectionModalOpen(false);
    setCurrentSectionCell(null);
  };

  // 🟢 渲染移动端表单（基于 parsedFields 的结构化分组）
  const renderMobileForm = () => {
    if (!mobileFieldGroups || mobileFieldGroups.length === 0) {
      return (
        <div className="p-8 text-center text-slate-400">
          <p>该模板暂无可编辑字段</p>
          <p className="text-sm mt-2">请在桌面端编辑模板并解析字段</p>
        </div>
      );
    }

    return (
      <div className="bg-slate-50 p-4 space-y-4">
        {/* 表单标题 */}
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 text-center">{selectedTemplate?.name}</h3>
          {previewCode && (
            <p className="text-sm text-blue-600 mt-2 text-center font-mono">编号：{previewCode}</p>
          )}
        </div>
        
        {/* 分组展示 */}
        {mobileFieldGroups.map((group, groupIndex) => (
          <div key={groupIndex} className="bg-white rounded-lg shadow-sm overflow-hidden">
            {/* 分组标题 */}
            {group.title && (
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-2.5 border-l-4 border-blue-700">
                <h4 className="text-white font-bold text-sm flex items-center gap-2">
                  <span className="w-1 h-4 bg-white rounded"></span>
                  {group.title}
                </h4>
              </div>
            )}
            
            {/* 分组内容 */}
            <div className="p-4 space-y-3">
              {group.fields.map((field, fieldIndex) => (
                <div key={`${field.cellKey}-${fieldIndex}`}>
                  {renderMobileFieldInput(field)}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // 🟢 渲染移动端字段输入（基于 parsedField 结构）
  const renderMobileFieldInput = (field: any) => {
    // 从 cellKey 解析行列坐标
    const match = field.cellKey.match(/R(\d+)C(\d+)/);
    if (!match) return null;
    
    const rowIndex = parseInt(match[1]) - 1;
    const colIndex = parseInt(match[2]) - 1;
    const inputKey = `${rowIndex}-${colIndex}`;
    const currentValue = permitFormData[inputKey] || '';
    const isRequired = field.required === true;
    const label = field.fieldName || field.label || '请填写';
    const fieldType = field.fieldType || 'text';
    const cellKey = field.cellKey;

    // 处理内联输入框（hint 中包含下划线）
    // 注意：与 ExcelRenderer 保持一致的数据格式
    if (field.hint && field.hint.includes('____')) {
      const parts = field.hint.split(/(____+)/);
      let inlineIndex = 0;
      
      // 从 permitFormData[`${inputKey}-inlines`] 中读取内联数据
      const inlinesData = permitFormData[`${inputKey}-inlines`] || {};
      
      return (
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-1.5 text-sm text-slate-700">
            {parts.map((part: string, i: number) => {
              if (/^____+$/.test(part)) {
                const currentInlineIndex = inlineIndex++;
                const inlineKey = `${inputKey}-inline-${currentInlineIndex}`;
                const inlineValue = inlinesData[inlineKey] || '';
                
                return (
                  <input
                    key={i}
                    type="text"
                    value={inlineValue}
                    onChange={(e) => {
                      // 更新内联数据对象，保持与 ExcelRenderer 一致的格式
                      setPermitFormData(prev => {
                        const currentInlines = prev[`${inputKey}-inlines`] || {};
                        return {
                          ...prev,
                          [`${inputKey}-inlines`]: {
                            ...currentInlines,
                            [inlineKey]: e.target.value
                          }
                        };
                      });
                    }}
                    className="flex-1 min-w-[80px] px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm bg-white"
                    placeholder="填写"
                  />
                );
              }
              return <span key={i} className="text-sm text-slate-700">{part}</span>;
            })}
          </div>
        </div>
      );
    }
    
    const handleChange = (val: string) => {
      setPermitFormData(prev => ({
        ...prev,
        [inputKey]: val
      }));
    };

    // 🔵 处理 Section 类型（子表单）
    if (fieldType === 'section') {
      const sectionData = permitFormData[`SECTION_${cellKey}`];
      return (
        <div className="space-y-1.5">
          <label className="flex items-center gap-1 text-xs font-medium text-slate-600">
            {label}
            {isRequired && <span className="text-red-500 text-xs">*</span>}
          </label>
          <button
            type="button"
            onClick={() => handleSectionClick(cellKey, label)}
            className={`w-full px-4 py-3 rounded-md border-2 transition text-sm font-semibold shadow-sm ${
              sectionData
                ? 'bg-green-50 border-green-500 text-green-700'
                : 'bg-blue-50 border-blue-400 text-blue-700 hover:bg-blue-100 active:scale-[0.98]'
            }`}
          >
            {sectionData ? '✓ 已填写 - 点击查看/编辑' : '📝 点击填写子表单'}
          </button>
        </div>
      );
    }

    // 🟠 处理 Signature 类型（签字字段，编辑模式下只读）
    if (fieldType === 'signature') {
      return (
        <div className="space-y-1.5">
          <label className="flex items-center gap-1 text-xs font-medium text-slate-600">
            {label}
          </label>
          <div className="w-full px-3 py-2.5 bg-amber-50 border border-amber-300 rounded-md text-amber-700 text-xs italic text-center">
            ✍️ 此字段将在审批流程中自动填写
          </div>
        </div>
      );
    }

    switch (fieldType) {
      case 'option':
        // 选项类型字段，渲染为单选按钮组
        const options = field.options || [];
        return (
          <div className="space-y-1.5">
            <label className="flex items-center gap-1 text-xs font-medium text-slate-600">
              {label}
              {isRequired && <span className="text-red-500 text-xs">*</span>}
            </label>
            <div className="flex flex-wrap gap-2">
              {options.map((opt: string, idx: number) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleChange(opt)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    currentValue === opt
                      ? 'bg-blue-500 text-white shadow-md'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        );

      case 'match':
        // 多选框类型
        const matchOptions = field.options || [];
        const selectedOptions = currentValue ? currentValue.split(',').filter(Boolean) : [];
        
        const toggleOption = (opt: string) => {
          const newSelected = selectedOptions.includes(opt)
            ? selectedOptions.filter((o: string) => o !== opt)
            : [...selectedOptions, opt];
          handleChange(newSelected.join(','));
        };

        return (
          <div className="space-y-1.5">
            <label className="flex items-center gap-1 text-xs font-medium text-slate-600">
              {label}
              {isRequired && <span className="text-red-500 text-xs">*</span>}
            </label>
            <div className="space-y-2">
              {matchOptions.map((opt: string, idx: number) => (
                <label
                  key={idx}
                  className="flex items-center gap-2 p-3 bg-slate-50 rounded-md cursor-pointer hover:bg-slate-100 transition"
                >
                  <input
                    type="checkbox"
                    checked={selectedOptions.includes(opt)}
                    onChange={() => toggleOption(opt)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-700">{opt}</span>
                </label>
              ))}
            </div>
          </div>
        );

      case 'select':
        const selectOptions = field.options || [];
        if (selectOptions.length === 0) {
          // 如果没有选项，退化为文本输入
          return (
            <div className="space-y-1.5">
              <label className="flex items-center gap-1 text-xs font-medium text-slate-600">
                {label}
                {isRequired && <span className="text-red-500 text-xs">*</span>}
              </label>
              <input
                type="text"
                value={currentValue}
                onChange={(e) => handleChange(e.target.value)}
                placeholder="请填写"
                className="w-full px-3 py-2.5 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm bg-white transition-all"
                required={isRequired}
              />
            </div>
          );
        }
        return (
          <div className="space-y-1.5">
            <label className="flex items-center gap-1 text-xs font-medium text-slate-600">
              {label}
              {isRequired && <span className="text-red-500 text-xs">*</span>}
            </label>
            <select
              value={currentValue}
              onChange={(e) => handleChange(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm bg-white appearance-none transition-all"
              required={isRequired}
            >
              <option value="">请选择</option>
              {selectOptions.map((opt: string, idx: number) => (
                <option key={idx} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        );

      case 'textarea':
        return (
          <div className="space-y-1.5">
            <label className="flex items-center gap-1 text-xs font-medium text-slate-600">
              {label}
              {isRequired && <span className="text-red-500 text-xs">*</span>}
            </label>
            <textarea
              value={currentValue}
              onChange={(e) => handleChange(e.target.value)}
              placeholder="请填写"
              rows={3}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm resize-none bg-white transition-all"
              required={isRequired}
            />
          </div>
        );

      case 'date':
        return (
          <div className="space-y-1.5">
            <label className="flex items-center gap-1 text-xs font-medium text-slate-600">
              {label}
              {isRequired && <span className="text-red-500 text-xs">*</span>}
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="date"
                value={currentValue}
                onChange={(e) => handleChange(e.target.value)}
                className="w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm bg-white transition-all"
                required={isRequired}
              />
            </div>
          </div>
        );

      case 'number':
        return (
          <div className="space-y-1.5">
            <label className="flex items-center gap-1 text-xs font-medium text-slate-600">
              {label}
              {isRequired && <span className="text-red-500 text-xs">*</span>}
            </label>
            <input
              type="number"
              value={currentValue}
              onChange={(e) => handleChange(e.target.value)}
              placeholder="请填写"
              className="w-full px-3 py-2.5 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm bg-white transition-all"
              required={isRequired}
            />
          </div>
        );

      case 'department':
        return (
          <div className="space-y-1.5">
            <label className="flex items-center gap-1 text-xs font-medium text-slate-600">
              {label}
              {isRequired && <span className="text-red-500 text-xs">*</span>}
            </label>
            <div className="relative">
              <Building className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <select
                value={currentValue}
                onChange={(e) => handleChange(e.target.value)}
                className="w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm bg-white appearance-none transition-all"
                required={isRequired}
              >
                <option value="">请选择部门</option>
                {renderDepartmentOptions(departments)}
              </select>
            </div>
          </div>
        );

      case 'user':
        return (
          <div className="space-y-1.5">
            <label className="flex items-center gap-1 text-xs font-medium text-slate-600">
              {label}
              {isRequired && <span className="text-red-500 text-xs">*</span>}
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <select
                value={currentValue}
                onChange={(e) => handleChange(e.target.value)}
                className="w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm bg-white appearance-none transition-all"
                required={isRequired}
              >
                <option value="">请选择人员</option>
                {allUsers.map((u) => (
                  <option key={u.id} value={u.name}>
                    {u.name} ({u.department || '未分配'})
                  </option>
                ))}
              </select>
            </div>
          </div>
        );

      case 'text':
      default:
        return (
          <div className="space-y-1.5">
            <label className="flex items-center gap-1 text-xs font-medium text-slate-600">
              {label}
              {isRequired && <span className="text-red-500 text-xs">*</span>}
            </label>
            <input
              type="text"
              value={currentValue}
              onChange={(e) => handleChange(e.target.value)}
              placeholder="请填写"
              className="w-full px-3 py-2.5 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm bg-white transition-all"
              required={isRequired}
            />
          </div>
        );
    }
  };

  // 🟢 渲染移动端表单字段
  const renderMobileField = (field: MobileFormConfig['fields'][0]) => {
    const value = permitFormData[field.fieldKey] || '';
    
    const handleChange = (newValue: any) => {
      setPermitFormData(prev => ({
        ...prev,
        [field.fieldKey]: newValue
      }));
    };

    switch (field.fieldType) {
      case 'textarea':
        return (
          <textarea
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={field.placeholder}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none min-h-[80px] text-sm"
            required={field.required}
          />
        );

      case 'select':
        return (
          <select
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm bg-white"
            required={field.required}
          >
            <option value="">请选择</option>
            {field.options?.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        );

      case 'date':
        return (
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="date"
              value={value}
              onChange={(e) => handleChange(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
              required={field.required}
            />
          </div>
        );

      case 'number':
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={field.placeholder}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
            required={field.required}
          />
        );

      case 'department':
        return (
          <div className="relative">
            <Building className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <select
              value={value}
              onChange={(e) => handleChange(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm bg-white appearance-none"
              required={field.required}
            >
              <option value="">请选择部门</option>
              {renderDepartmentOptions(departments)}
            </select>
          </div>
        );

      case 'user':
        return (
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <select
              value={value}
              onChange={(e) => handleChange(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm bg-white appearance-none"
              required={field.required}
            >
              <option value="">请选择人员</option>
              {allUsers.map((u) => (
                <option key={u.id} value={u.name}>
                  {u.name} ({u.department || '未分配'})
                </option>
              ))}
            </select>
          </div>
        );

      case 'text':
      default:
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={field.placeholder}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
            required={field.required}
          />
        );
    }
  };

  // 🟢 渲染部门选项（递归）
  const renderDepartmentOptions = (depts: any[], level = 0): React.ReactElement[] => {
    if (!Array.isArray(depts)) return [];
    
    return depts.flatMap((dept) => {
      const prefix = '　'.repeat(level);
      const options = [
        <option key={dept.id} value={dept.name}>
          {prefix}{dept.name}
        </option>
      ];
      
      if (dept.children && dept.children.length > 0) {
        options.push(...renderDepartmentOptions(dept.children, level + 1));
      }
      
      return options;
    });
  };

  // 🟢 2. 完全替换 preCheckWorkflow 函数（使用外部 findDeptRecursive）
  const preCheckWorkflow = (): boolean => {
    if (!selectedTemplate?.workflowConfig) return true;
    let config: any[] = [];
    try {
      config = JSON.parse(selectedTemplate.workflowConfig);
    } catch (e) {
      alert('流程配置格式错误，请联系管理员。');
      return false;
    }

    // 遍历每一个步骤进行预演
    for (let i = 0; i < config.length; i++) {
      const step = config[i];
      const stepName = step.name || `步骤${i + 1}`;

      // 🟢 步骤一（申请人签署）跳过验证，因为强制为申请人，不需要验证审批人和绑定单元格
      if (i === 0 || step.step === 0) {
        continue;
      }

      // 1. 策略：提交人部门负责人
      if (step.approverStrategy === 'current_dept_manager') {
        // --- 🟢 修复核心逻辑开始 ---
        // A. 获取最新的用户数据
        const freshUser = allUsers.find(u => String(u.id) === String(user.id)) || user;
        const currentDeptId = freshUser.departmentId;
        if (!currentDeptId) {
          alert(`无法提交：账号 [${freshUser.name}] 未绑定部门，无法解析 [${stepName}]。`);
          return false;
        }

        // B. 使用递归查找部门（解决子部门找不到的问题）
        console.log(`正在查找部门 ID: ${currentDeptId} (支持多级嵌套)`);
        // 🔴 新增这一行：打印完整的部门数据结构
        console.log('=== 系统返回的部门数据 ===', JSON.stringify(departments, null, 2));
        const dept = findDeptRecursive(departments, currentDeptId);
        console.log('递归查找结果:', dept);
        if (!dept) {
          alert(
            `数据异常：用户归属部门ID (${currentDeptId}) 无法在组织架构树中找到。\n请检查该部门是否已被删除，或联系管理员同步组织架构。`
          );
          return false;
        }
        // --- 🟢 修复核心逻辑结束 ---

        if (!dept.managerId) {
          alert(
            `无法提交：您所在的部门 [${dept.name}] 尚未设置负责人，导致 [${stepName}] 无人审批。请联系管理员。`
          );
          return false;
        }

        // (可选) 进一步检查负责人是否存在
        const manager = allUsers.find((u) => String(u.id) === String(dept.managerId));
        if (!manager) {
          alert(`无法提交：部门 [${dept.name}] 的负责人数据异常（找不到该用户 ID: ${dept.managerId}）。`);
          return false;
        }
      }

      // 2. 策略：指定部门负责人 (同样应用递归修复)
      if (step.approverStrategy === 'specific_dept_manager') {
        const targetDeptId = step.strategyConfig?.targetDeptId;
        if (!targetDeptId) {
          alert(`流程配置错误：[${stepName}] 未指定目标部门。`);
          return false;
        }

        // 🟢 这里也改成递归查找
        const dept = findDeptRecursive(departments, targetDeptId);
        if (!dept || !dept.managerId) {
          alert(
            `无法提交：指定的部门 [${dept?.name || targetDeptId}] 不存在或未设置负责人。`
          );
          return false;
        }

        const manager = allUsers.find((u) => String(u.id) === String(dept.managerId));
        if (!manager) {
          alert(`无法提交：部门 [${dept.name}] 的负责人数据异常（找不到该用户 ID: ${dept.managerId}）。`);
          return false;
        }
      }

      // 3. 策略：指定角色
      if (step.approverStrategy === 'role') {
        const { targetDeptId, roleName } = step.strategyConfig || {};
        if (!targetDeptId || !roleName) {
          alert(`流程配置错误：[${stepName}] 角色配置不完整。`);
          return false;
        }

        // 可选：校验目标部门是否存在（使用递归）
        const dept = findDeptRecursive(departments, targetDeptId);
        if (!dept) {
          alert(`无法提交：指定的角色审批部门 ID [${targetDeptId}] 不存在于组织架构中。`);
          return false;
        }

        const candidates = allUsers.filter(
          (u) =>
            String(u.departmentId) === String(targetDeptId) &&
            u.jobTitle &&
            u.jobTitle.includes(roleName)
        );
        if (candidates.length === 0) {
          alert(
            `无法提交：在部门 [${dept.name}] 中未找到职位包含 "${roleName}" 的人员，导致 [${stepName}] 无人审批。`
          );
          return false;
        }
      }

      // 4. 策略：固定人员（或默认）
      if (
        (!step.approverStrategy || step.approverStrategy === 'fixed') &&
        (!step.approvers || step.approvers.length === 0)
      ) {
        if (!step.outputCell) {
          alert(`流程配置错误：[${stepName}] 未设置审批人且未绑定单元格。`);
          return false;
        }
        // 绑定 outputCell 的情况在运行时处理，此处跳过
      }
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!selectedTemplate) return;
    if (!preCheckWorkflow()) {
      return;
    }
    if (!confirm('确认提交申请？提交后将自动进入审批流程。')) return;

    setIsSubmitting(true);
    try {
      const newRecord = await PermitService.create({
        projectId: project.id,
        templateId: selectedTemplate.id,
        dataJson: permitFormData,
        attachments: attachments,
        proposedCode: previewCode, // 🟢 传递预览编号
      });

      // ✅ 修改点：发起申请自动设为通过第一步
      await PermitService.approve({
        recordId: newRecord.id,
        opinion: opinion.trim() || '发起申请',
        action: 'pass',
        userName: user?.name || '用户',
        userId: user?.id,
      });

      alert('✅ 申请已提交！');
      setPermitFormData({});
      setAttachments([]);
      setOpinion('');
      onSuccess();
    } catch (e) {
      console.error(e);
      alert('提交失败，请重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center lg:p-4 backdrop-blur-sm print:!block print:!static print:bg-white print:!p-0 print:!m-0">
      <PrintStyle orientation={orientation} />
      <div className="bg-white lg:rounded-xl w-full h-full lg:max-w-[95vw] lg:h-[92vh] flex flex-col shadow-2xl print:!block print:shadow-none print:h-auto print:w-full print:max-w-none print:!p-0 print:!m-0">
        <div className="px-3 py-3 sm:p-4 border-b flex justify-between items-center bg-slate-50 lg:rounded-t-xl print:hidden">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {/* 移动端：步骤2时显示返回按钮 */}
            {mobileStep === 'fill' && (
              <button
                onClick={() => setMobileStep('select')}
                className="lg:hidden p-2 hover:bg-slate-200 rounded text-slate-600"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 12H5M12 19l-7-7 7-7"/>
                </svg>
              </button>
            )}
            <h3 className="font-bold text-base sm:text-lg text-slate-800 truncate">
              {mobileStep === 'select' ? '选择模板' : selectedTemplate?.name || '新增作业单'}
              <span className="hidden lg:inline"> - {project.name}</span>
            </h3>
          </div>
          <div className="flex gap-1 sm:gap-2 shrink-0">
            {/* 打印空白表单按钮 */}
            {selectedTemplate && mobileStep === 'fill' && (
              <button
                onClick={() => window.print()}
                className="hidden sm:flex px-3 py-2 rounded border transition items-center gap-2 bg-white text-slate-700 border-slate-300 hover:bg-slate-100 hover:border-slate-400"
                title="打印空白表单"
              >
                <Printer size={18} />
                <span className="text-sm">打印空白</span>
              </button>
            )}
            {mobileStep === 'fill' && (
            <button
              onClick={() => setOrientation(o => o === 'portrait' ? 'landscape' : 'portrait')}
              className="hidden sm:flex p-2 rounded border transition items-center justify-center bg-white text-slate-700 border-slate-300 hover:bg-slate-100 hover:border-slate-400"
              title={orientation === 'portrait' ? '当前：竖向纸张，点击切换为横向' : '当前：横向纸张，点击切换为竖向'}
            >
              {orientation === 'portrait' ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="7" y="2" width="10" height="20" rx="1" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="7" width="20" height="10" rx="1" />
                </svg>
              )}
            </button>
            )}
            <button onClick={onClose} className="p-1.5 sm:p-2 hover:bg-slate-200 rounded text-slate-500">
              <X size={20} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-hidden flex print:!block">
          {/* 左侧模板选择 - 桌面端始终显示，移动端只在step1显示 */}
          <div className={`${
            mobileStep === 'select' ? 'flex' : 'hidden'
          } lg:flex w-full lg:w-64 border-r p-3 sm:p-4 overflow-y-auto bg-slate-50/50 print:hidden flex-col`}>
            <h4 className="text-xs font-bold text-slate-500 mb-3 uppercase tracking-wider hidden lg:block">选择模板</h4>
            <div className="space-y-2 flex-1">
              {templates
                .filter((t) => !t.isLocked)
                .map((t) => (
                  <div
                    key={t.id}
                    onClick={() => {
                      setSelectedTemplate(t);
                      setPermitFormData({});
                      // 🟢 V3.4 应用模板的纸张方向
                      setOrientation((t.orientation as 'portrait' | 'landscape') || 'portrait');
                    }}
                    className={`p-3 sm:p-4 rounded-lg cursor-pointer text-sm transition-all border ${
                      selectedTemplate?.id === t.id
                        ? 'bg-blue-50 font-bold border-blue-200 text-blue-700 shadow-sm'
                        : 'bg-white border-slate-200 hover:bg-slate-50 hover:shadow-sm text-slate-600 hover:border-blue-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <FileText
                          size={18}
                          className={selectedTemplate?.id === t.id ? 'text-blue-500' : 'text-slate-400'}
                        />
                        <span>{t.name}</span>
                      </div>
                      {selectedTemplate?.id === t.id && (
                        <CheckCircle size={16} className="text-blue-500 shrink-0" />
                      )}
                    </div>
                    {selectedTemplate?.id === t.id && t.type && (
                      <div className="mt-2 text-xs text-slate-500 bg-white px-2 py-1 rounded">
                        {t.type}
                      </div>
                    )}
                  </div>
                ))}
            </div>
            
            {/* 移动端：选中模板后显示创建按钮 */}
            {selectedTemplate && (
              <button
                onClick={() => setMobileStep('fill')}
                className="lg:hidden mt-4 w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition flex items-center justify-center gap-2 shadow-lg"
              >
                <CheckCircle size={20} />
                开始填写
              </button>
            )}
          </div>

          {/* 右侧表单填写 - 桌面端始终显示，移动端只在step2显示 */}
          <div className={`${
            mobileStep === 'fill' ? 'flex' : 'hidden'
          } lg:flex flex-1 p-3 sm:p-4 lg:p-6 overflow-auto bg-slate-100 print:!p-0 print:!m-0 print:bg-white print:overflow-visible flex-col`}>
            {selectedTemplate ? (
              <div 
                className="mx-auto flex flex-col gap-3 sm:gap-4 w-full"
                style={{
                  maxWidth: orientation === 'portrait' ? '210mm' : '297mm',
                }}
              >
                {/* 附件管理 */}
                <div className="bg-white border rounded-lg p-3 sm:p-4 shadow-sm print:hidden">
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-700 text-sm">附件材料</span>
                      <span className="text-xs text-slate-400">(选填，支持图片/PDF，最大50MB)</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        onChange={handleFileSelect}
                      />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-1 text-xs bg-slate-50 hover:bg-slate-100 text-slate-700 px-3 py-1.5 rounded border border-slate-200 transition-colors"
                      >
                        <Paperclip size={14} /> 添加附件
                      </button>
                    </div>
                  </div>
                  {attachments.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {attachments.map((file, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1.5 rounded text-xs border border-blue-100"
                        >
                          <Paperclip size={12} />
                          <span className="max-w-[150px] truncate" title={file.name}>
                            {file.name}
                          </span>
                          <button
                            onClick={() => handleRemoveAttachment(idx)}
                            className="hover:text-red-500 ml-1"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 italic py-1">暂无附件</div>
                  )}
                </div>

                {/* 移动端表单视图（在小于1024px屏幕显示） */}
                <div className="lg:hidden">
                  {renderMobileForm()}
                </div>
                
                {/* 桌面端表格视图（在大屏幕显示） */}
                <div className="hidden lg:block">
                  <div 
                    id="print-area"
                    className="bg-white shadow-lg border border-slate-200 p-3 sm:p-6 lg:p-8 overflow-auto print:!p-0 print:!m-0 print:shadow-none print:border-0"
                    style={{
                      minHeight: orientation === 'portrait' ? '297mm' : '210mm',
                    }}
                  >
                    <ExcelRenderer
                      key={selectedTemplate.id}
                      templateData={selectedTemplateData}
                      workflowConfig={
                        selectedTemplate.workflowConfig ? JSON.parse(selectedTemplate.workflowConfig) : []
                      }
                      parsedFields={selectedParsedFields}
                      permitCode={previewCode} // 🟢 显示预览编号
                      orientation={orientation}
                      mode="edit"
                      onDataChange={setPermitFormData}
                      onSectionClick={handleSectionClick}
                      sectionBindings={selectedTemplate.sectionBindings ? JSON.parse(selectedTemplate.sectionBindings) : {}}
                    />
                  </div>
                </div>

                {/* 申请人附言与提交 */}
                <div className="bg-white border rounded-lg p-3 sm:p-4 shadow-sm sticky bottom-0 z-10 mt-4 print:hidden">
                  <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-2">申请人附言 (选填)</label>
                  <textarea
                    className="w-full border rounded p-2 sm:p-3 text-xs sm:text-sm h-16 sm:h-20 outline-none focus:ring-2 focus:ring-blue-500 mb-3 sm:mb-4 bg-slate-50 focus:bg-white transition-colors"
                    placeholder="请在此输入备注、紧急说明或其他需要审批人注意的事项..."
                    value={opinion}
                    onChange={(e) => setOpinion(e.target.value)}
                  />
                  <div className="flex justify-end pt-2 border-t border-slate-100">
                    <button
                      onClick={handleSubmit}
                      disabled={isSubmitting}
                      className="bg-green-600 text-white px-4 sm:px-6 py-2 sm:py-2.5 rounded shadow-lg shadow-green-200 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-bold transition-all active:scale-95 text-sm sm:text-base"
                    >
                      {isSubmitting ? (
                        <span className="animate-spin">⏳</span>
                      ) : (
                        <CheckCircle size={18} />
                      )}
                      {isSubmitting ? '提交中...' : '提交申请'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 p-4">
                <FileText size={48} className="mb-4 text-slate-200" />
                <p className="text-sm sm:text-base text-center">请在左侧选择一个模板开始填写</p>
                <p className="text-xs text-slate-400 mt-2 lg:hidden">点击“选择模板”按钮开始</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 🔵 V3.4 Section表单弹窗 */}
      {(() => {
        console.log('🔵 SectionFormModal render check:', {
          sectionModalOpen,
          currentSectionCell,
          hasSelectedTemplate: !!selectedTemplate,
          shouldRender: sectionModalOpen && currentSectionCell && selectedTemplate
        });
        
        if (sectionModalOpen && currentSectionCell && selectedTemplate) {
          const bindings = selectedTemplate.sectionBindings 
            ? JSON.parse(selectedTemplate.sectionBindings) 
            : {};
          const templateId = bindings[currentSectionCell.cellKey];
          const boundTemplate = allTemplates.find(t => t.id === templateId) || null;
          
          console.log('🔵 Rendering SectionFormModal:', {
            cellKey: currentSectionCell.cellKey,
            fieldName: currentSectionCell.fieldName,
            boundTemplate: boundTemplate?.name,
            parentCode: previewCode
          });
          
          // 检查是否已绑定二级模板
          if (!boundTemplate) {
            return (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                <div className="bg-white rounded-lg p-6 max-w-md shadow-xl">
                  <h3 className="text-lg font-bold text-red-600 mb-4">⚠️ 未绑定二级模板</h3>
                  <p className="text-slate-600 mb-4">
                    此单元格（{currentSectionCell.cellKey}）尚未绑定二级模板。
                    <br />请先在模板编辑页面为该section字段绑定一个二级模板。
                  </p>
                  <button
                    onClick={() => {
                      setSectionModalOpen(false);
                      setCurrentSectionCell(null);
                    }}
                    className="w-full px-4 py-2 bg-slate-600 text-white rounded hover:bg-slate-700"
                  >
                    关闭
                  </button>
                </div>
              </div>
            );
          }
          
          return (
            <SectionFormModal
              isOpen={true}
              cellKey={currentSectionCell.cellKey}
              fieldName={currentSectionCell.fieldName}
              boundTemplate={boundTemplate}
              parentCode={previewCode}
              parentFormData={permitFormData}
              parentParsedFields={selectedTemplate?.parsedFields ? JSON.parse(selectedTemplate.parsedFields) : []}
              parentApprovalLogs={[]} // 新建作业单时暂无审批日志
              parentWorkflowConfig={selectedTemplate?.workflowConfig ? JSON.parse(selectedTemplate.workflowConfig) : []}
              existingData={permitFormData[`SECTION_${currentSectionCell.cellKey}`]}
              onSave={handleSectionSave}
              onClose={() => {
                setSectionModalOpen(false);
                setCurrentSectionCell(null);
              }}
            />
          );
        }
        return null;
      })()}
    </div>
  );
}