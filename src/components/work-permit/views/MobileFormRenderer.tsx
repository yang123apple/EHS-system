import React from 'react';
import { Calendar, User, Building, ChevronRight, Hash, AlignLeft, CheckSquare, List, FileText, Users, Building2, Smartphone } from 'lucide-react';

export interface MobileFormGroup {
  title: string;
  fieldKeys: string[];
}

export interface MobileFormConfigForRenderer {
  groups: MobileFormGroup[];
  fields?: any[];
  title?: string;
}

// 渲染模式
type RenderMode = 'edit' | 'preview' | 'readonly';

interface MobileFormRendererProps {
  // 表单配置
  config: MobileFormConfigForRenderer | null;
  parsedFields?: any[];
  
  // 表单标题和编号
  title?: string;
  code?: string;
  
  // 数据相关
  formData?: Record<string, any>;
  onDataChange?: (key: string, value: any) => void;
  
  // 渲染模式
  mode?: RenderMode;
  
  // 特殊字段处理
  onSectionClick?: (cellKey: string, fieldName: string) => void;
  onDepartmentClick?: (inputKey: string, label: string) => void;
  onFieldClick?: (field: any) => void;
  
  // 数据源（用于下拉选择）
  departments?: any[];
  allUsers?: any[];
  
  // 额外的渲染钩子
  renderFieldValue?: (field: any, value: any) => React.ReactNode;
  getFieldIcon?: (fieldType: string) => React.ReactNode;
}

// 🟢 统一的字段图标获取函数
const defaultGetFieldIcon = (fieldType: string) => {
  const iconClass = "shrink-0";
  switch (fieldType) {
    case 'text':
      return <FileText size={14} className={`${iconClass} text-blue-500`} />;
    case 'textarea':
      return <AlignLeft size={14} className={`${iconClass} text-purple-500`} />;
    case 'date':
      return <Calendar size={14} className={`${iconClass} text-green-500`} />;
    case 'select':
    case 'option':
      return <List size={14} className={`${iconClass} text-orange-500`} />;
    case 'match':
      return <CheckSquare size={14} className={`${iconClass} text-indigo-500`} />;
    case 'number':
      return <Hash size={14} className={`${iconClass} text-cyan-500`} />;
    case 'department':
      return <Building2 size={14} className={`${iconClass} text-amber-500`} />;
    case 'user':
    case 'personnel':
    case 'personal':
      return <Users size={14} className={`${iconClass} text-pink-500`} />;
    case 'signature':
      return <FileText size={14} className={`${iconClass} text-rose-500`} />;
    default:
      return <FileText size={14} className={`${iconClass} text-slate-400`} />;
  }
};

// 🟢 获取分组图标
const getGroupIcon = (title: string) => {
  if (title.includes('基础') || title.includes('信息')) return <FileText size={16} />;
  if (title.includes('安全') || title.includes('措施')) return <CheckSquare size={16} />;
  if (title.includes('审批') || title.includes('意见') || title.includes('签署')) return <Users size={16} />;
  return <List size={16} />;
};

export default function MobileFormRenderer(props: MobileFormRendererProps) {
  const {
    config,
    parsedFields = [],
    title,
    code,
    formData = {},
    onDataChange,
    mode = 'edit',
    onSectionClick,
    onDepartmentClick,
    departments = [],
    allUsers = [],
    renderFieldValue,
    getFieldIcon = defaultGetFieldIcon,
  } = props;

  // 🆕 状态锁：处理中文输入法闪烁和焦点丢失
  const isComposing = React.useRef(false);
  const lastScrollY = React.useRef(0);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // 🆕 恢复滚动位置
  React.useLayoutEffect(() => {
    if (lastScrollY.current > 0) {
      window.scrollTo(0, lastScrollY.current);
    }
  });
  
  // 优雅处理 config 为空的情况
  if (!config || !config.groups) {
    return (
      <div className="p-12 text-center bg-white rounded-xl m-4 shadow-sm border border-slate-100">
        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <Smartphone size={32} className="text-slate-300" />
        </div>
        <h3 className="text-slate-600 font-medium">暂无移动端配置</h3>
        <p className="text-xs text-slate-400 mt-2 leading-relaxed">
          请在电脑端“模板管理”中<br />配置移动端表单字段
        </p>
      </div>
    );
  }

  // 🆕 使用 useCallback 稳定函数引用，解决输入一个字符就失去焦点的问题
  const handleFieldChange = React.useCallback((field: any, value: any) => {
    if (!onDataChange) return;
    
    // 获取字段的输入key
    let inputKey: string;
    
    if (field.rowIndex !== undefined && field.colIndex !== undefined) {
      inputKey = `${field.rowIndex}-${field.colIndex}`;
    } else {
      const fieldKeyString = field.cellKey || field.fieldKey || "";
      const match = fieldKeyString.match(/R(\d+)C(\d+)/);
      if (match) {
        inputKey = `${parseInt(match[1]) - 1}-${parseInt(match[2]) - 1}`;
      } else {
        inputKey = fieldKeyString;
      }
    }
    
    // 记录滚动位置
    lastScrollY.current = window.scrollY;
    onDataChange(inputKey, value);
  }, [onDataChange]);

  // 获取字段当前值
  const getFieldValue = React.useCallback((field: any): any => {
    let inputKey: string;
    
    if (field.rowIndex !== undefined && field.colIndex !== undefined) {
      inputKey = `${field.rowIndex}-${field.colIndex}`;
    } else {
      const fieldKeyString = field.cellKey || field.fieldKey || "";
      const match = fieldKeyString.match(/R(\d+)C(\d+)/);
      if (match) {
        inputKey = `${parseInt(match[1]) - 1}-${parseInt(match[2]) - 1}`;
      } else {
        inputKey = fieldKeyString;
      }
    }
    
    return formData[inputKey] || '';
  }, [formData]);

  // 🟢 统一的字段值渲染函数（只读模式）
  const defaultRenderFieldValue = (field: any, value: any) => {
    if (!value) return <span className="text-slate-400 text-sm italic">未填写</span>;

    switch (field.fieldType) {
      case 'option':
      case 'select':
        return <span className="inline-block break-words max-w-full text-sm">{value}</span>;
      
      case 'match':
        const values = Array.isArray(value) ? value : value.split(',').filter(Boolean);
        return (
          <div className="flex flex-wrap gap-1">
            {values.map((v: string, i: number) => (
              <span key={i} className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs inline-block break-words max-w-full">
                {v}
              </span>
            ))}
          </div>
        );
      
      case 'date':
        return <span className="inline-block break-words max-w-full font-mono text-sm">{value}</span>;
      
      case 'textarea':
      case 'signature':
        return <div className="break-words whitespace-pre-wrap max-w-full text-sm">{value}</div>;
      
      default:
        return <span className="inline-block break-words max-w-full text-sm">{value}</span>;
    }
  };

  // 🟢 统一的字段渲染函数
  const renderField = (field: any, groupIndex: number, fieldIndex: number) => {
    const currentValue = getFieldValue(field);
    const isRequired = field.required === true;
    const label = field.fieldName || field.label || '请填写';
    const fieldType = field.fieldType || 'text';
    const isDisabled = mode === 'readonly' || mode === 'preview';
    const isReadonly = mode === 'readonly';
    const isPreview = mode === 'preview';
    const fieldKey = field.cellKey || field.fieldKey || `${groupIndex}-${fieldIndex}`;
    
    // 处理预览模式下的点击
    const handleClick = () => {
      if (isPreview && props.onFieldClick) {
        props.onFieldClick(field);
      }
    };

    // 🟢 对于只读模式，使用统一的样式渲染
    if (isReadonly) {
      const isInlineField = !['textarea', 'match', 'signature'].includes(fieldType);
      const renderValue = renderFieldValue ? renderFieldValue(field, currentValue) : defaultRenderFieldValue(field, currentValue);
      
      return (
        <div 
          key={fieldKey} 
          onClick={handleClick}
          className={`border-b border-slate-50 py-3.5 last:border-0 ${isPreview ? 'cursor-pointer hover:bg-blue-50/50 transition-colors rounded-lg px-2 -mx-2' : ''}`}
        >
          {isInlineField ? (
            <div className="flex items-start gap-3">
              <label className="text-[13px] font-medium text-slate-500 flex items-center gap-2 shrink-0 pt-0.5 min-w-[90px] max-w-[120px]">
                {getFieldIcon(fieldType)}
                <span className="whitespace-normal break-words leading-tight">{label}</span>
                {isRequired && <span className="text-red-500 -ml-1">*</span>}
              </label>
              <div className="flex-1 min-w-0 text-right">
                <div className="text-[14px] text-slate-800 break-words overflow-wrap-anywhere whitespace-normal font-medium">
                  {renderValue}
                </div>
              </div>
            </div>
          ) : (
            <>
              <label className="block text-[13px] font-medium text-slate-500 mb-2 flex items-center gap-2">
                {getFieldIcon(fieldType)}
                <span className="break-words leading-tight">{label}</span>
                {isRequired && <span className="text-red-500 -ml-1">*</span>}
              </label>
              <div className="bg-slate-50/50 rounded-lg px-3 py-2.5 border border-slate-100/50">
                <div className="text-[14px] text-slate-800 break-words whitespace-pre-wrap overflow-wrap-anywhere leading-relaxed">
                  {renderValue}
                </div>
              </div>
            </>
          )}
        </div>
      );
    }

    if (fieldType === 'textarea' || fieldType === 'match' || fieldType === 'signature' || (field.hint && field.hint.includes('____'))) {
      if (fieldType === 'textarea' || fieldType === 'signature') {
        return (
          <div 
            key={fieldKey} 
            onClick={handleClick}
            className={`py-3 border-b border-slate-100 last:border-0 ${isPreview ? 'cursor-pointer hover:bg-blue-50/50 transition-colors rounded-lg px-2 -mx-2' : ''}`}
          >
            <label className="block text-xs font-medium text-slate-600 mb-1.5 flex items-center gap-1.5">
              {getFieldIcon(fieldType)}
              <span className="break-words">{label}</span>
              {isRequired && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            <textarea
              defaultValue={currentValue}
              onBlur={(e) => handleFieldChange(field, e.target.value)}
              onCompositionStart={() => { isComposing.current = true; }}
              onCompositionEnd={(e: any) => { 
                isComposing.current = false;
                handleFieldChange(field, e.target.value);
              }}
              rows={fieldType === 'signature' ? 2 : 3}
              className="w-full p-3 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all resize-none shadow-sm"
              placeholder={field.hint || `请输入${label}...`}
              disabled={isDisabled}
              style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}
            />
          </div>
        );
      }
      if (fieldType === 'match') {
        const matchOptions = field.options || [];
        const selectedOptions = currentValue ? (Array.isArray(currentValue) ? currentValue : currentValue.split(',').filter(Boolean)) : [];
        const toggleOption = (opt: string, e: React.MouseEvent) => {
          e.preventDefault();
          if (isDisabled) return;
          const newSelected = selectedOptions.includes(opt)
            ? selectedOptions.filter((o: string) => o !== opt)
            : [...selectedOptions, opt];
          handleFieldChange(field, newSelected.join(','));
        };
        return (
          <div 
            key={fieldKey} 
            onClick={handleClick}
            className={`py-3 border-b border-slate-100 last:border-0 ${isPreview ? 'cursor-pointer hover:bg-blue-50/50 transition-colors rounded-lg px-2 -mx-2' : ''}`}
          >
            <label className="block text-xs font-medium text-slate-600 mb-1.5 flex items-center gap-1.5">
              {getFieldIcon(fieldType)}
              <span className="break-words">{label}</span>
              {isRequired && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            <div className="flex flex-wrap gap-2">
              {matchOptions.map((opt: string, idx: number) => (
                <button
                  key={opt}
                  type="button"
                  onClick={(e) => toggleOption(opt, e)}
                  disabled={isDisabled}
                  className={`flex items-center gap-2 px-3 py-2 rounded cursor-pointer transition-all border ${
                    selectedOptions.includes(opt) 
                      ? 'bg-blue-500 text-white border-blue-600 shadow-sm' 
                      : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-sm border flex items-center justify-center ${selectedOptions.includes(opt) ? 'bg-white border-white' : 'bg-white border-slate-300'}`}>
                    {selectedOptions.includes(opt) && <CheckSquare size={12} className="text-blue-500" />}
                  </div>
                  <span className="text-sm whitespace-normal text-left break-words">{opt}</span>
                </button>
              ))}
            </div>
          </div>
        );
      }
    }

    const FieldWrapper = ({ children }: { children: React.ReactNode }) => (
      <div 
        key={fieldKey} 
        onClick={handleClick}
        className={`flex items-start justify-between border-b border-slate-50 py-4 last:border-0 gap-4 ${isPreview ? 'cursor-pointer hover:bg-blue-50/50 transition-colors rounded-lg px-2 -mx-2' : ''}`}
      >
        <label className="flex items-center gap-2 text-[13px] font-medium text-slate-500 min-w-[90px] max-w-[140px] shrink-0 pt-1">
          {getFieldIcon(fieldType)}
          <span className="whitespace-normal break-words leading-tight">{label}</span>
          {isRequired && <span className="text-red-500 -ml-1">*</span>}
        </label>
        <div className="flex-1 flex justify-end min-w-0">
          {children}
        </div>
      </div>
    );

    switch (fieldType) {
      case 'text':
      case 'number':
        return (
          <FieldWrapper>
            <input
              type={fieldType}
              defaultValue={currentValue}
              key={`${fieldKey}-${currentValue === ''}`}
              onBlur={(e) => handleFieldChange(field, e.target.value)}
              onCompositionStart={() => { isComposing.current = true; }}
              onCompositionEnd={(e: any) => { 
                isComposing.current = false;
                handleFieldChange(field, e.target.value);
              }}
              onFocus={(e) => { e.stopPropagation(); }}
              disabled={isDisabled}
              placeholder="填写"
              className="w-full text-right bg-transparent border-b border-dashed border-slate-300 outline-none text-sm text-slate-800 placeholder:text-slate-300 focus:border-blue-400 px-2 py-1"
              required={isRequired}
              style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}
            />
          </FieldWrapper>
        );
      
      case 'select':
        return (
          <FieldWrapper>
            <div className="relative flex items-center w-full justify-end">
              <select
                value={currentValue}
                onChange={(e) => handleFieldChange(field, e.target.value)}
                disabled={isDisabled}
                className="appearance-none bg-transparent pr-6 text-right outline-none text-sm text-slate-800 border-b border-dashed border-slate-300 focus:border-blue-400 px-2 py-1 w-full max-w-[200px]"
              >
                <option value="">选择</option>
                {field.options?.map((opt: string, i: number) => (
                  <option key={i} value={opt}>{opt}</option>
                ))}
              </select>
              <ChevronRight size={14} className="text-slate-400 absolute right-0 pointer-events-none" />
            </div>
          </FieldWrapper>
        );
      
      case 'date':
        return (
          <FieldWrapper>
            <input
              type="date"
              value={currentValue}
              onChange={(e) => handleFieldChange(field, e.target.value)}
              disabled={isDisabled}
              className="bg-transparent text-right outline-none text-sm text-slate-800 border-b border-dashed border-slate-300 focus:border-blue-400 px-2 py-1"
            />
          </FieldWrapper>
        );
      
      case 'option':
        const useSwitch = field.options?.length === 2 && (
          (field.options.includes('是') && field.options.includes('否')) ||
          (field.options.includes('通过') && field.options.includes('不通过'))
        );

        if (useSwitch) {
          const positiveOpt = field.options.find((o: string) => ['是', '通过'].includes(o));
          const negativeOpt = field.options.find((o: string) => ['否', '不通过'].includes(o));
          const isActive = currentValue === positiveOpt;

          return (
            <FieldWrapper>
              <div 
                onClick={() => {
                  if (isDisabled) return;
                  handleFieldChange(field, isActive ? negativeOpt : positiveOpt);
                }}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  isActive ? 'bg-blue-500' : 'bg-slate-200'
                } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    isActive ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </div>
              <span className="ml-2 text-xs text-slate-500 min-w-[30px]">{currentValue || '未选'}</span>
            </FieldWrapper>
          );
        }

        return (
          <FieldWrapper>
            <div className="flex flex-wrap gap-1 justify-end max-w-full">
              {field.options?.map((opt: string, idx: number) => (
                <button
                  key={idx}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    if (!isDisabled) handleFieldChange(field, opt);
                  }}
                  className={`px-3 py-1.5 rounded text-xs transition-all break-words text-left border ${
                    currentValue === opt 
                      ? 'bg-blue-500 text-white border-blue-600 shadow-sm font-medium' 
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                  disabled={isDisabled}
                  style={{ wordBreak: 'break-word', whiteSpace: 'normal', overflowWrap: 'anywhere' }}
                >
                  {opt}
                </button>
              ))}
            </div>
          </FieldWrapper>
        );
      
      case 'department':
        return (
          <FieldWrapper>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                if (!isDisabled && onDepartmentClick) {
                  let inputKey: string;
                  if (field.rowIndex !== undefined && field.colIndex !== undefined) {
                    inputKey = `${field.rowIndex}-${field.colIndex}`;
                  } else {
                    const match = (field.cellKey || "").match(/R(\d+)C(\d+)/);
                    inputKey = match ? `${parseInt(match[1]) - 1}-${parseInt(match[2]) - 1}` : field.cellKey;
                  }
                  onDepartmentClick(inputKey, label);
                }
              }}
              className="flex items-center gap-1 text-sm text-slate-800 hover:text-blue-600 transition-colors py-1"
              disabled={isDisabled}
            >
              <span className={`break-words text-right max-w-[150px] ${currentValue ? 'text-slate-800' : 'text-slate-300'}`}>
                {currentValue || '点击选择部门'}
              </span>
              <ChevronRight size={16} className="text-slate-400 shrink-0" />
            </button>
          </FieldWrapper>
        );
      
      case 'user':
      case 'personnel':
      case 'personal':
        return (
          <FieldWrapper>
            <input
              type="text"
              defaultValue={currentValue}
              key={`${fieldKey}-${currentValue === ''}`}
              onBlur={(e) => handleFieldChange(field, e.target.value)}
              onCompositionStart={() => { isComposing.current = true; }}
              onCompositionEnd={(e: any) => { 
                isComposing.current = false;
                handleFieldChange(field, e.target.value);
              }}
              onFocus={(e) => e.stopPropagation()}
              disabled={isDisabled}
              placeholder="请输入姓名"
              className="w-full text-right bg-transparent border-b border-dashed border-slate-300 outline-none text-sm text-slate-800 placeholder:text-slate-300 focus:border-blue-400 px-2 py-1"
              style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}
            />
          </FieldWrapper>
        );
      
      default:
        return (
          <FieldWrapper>
            <input
              type="text"
              defaultValue={currentValue}
              onBlur={(e) => handleFieldChange(field, e.target.value)}
              disabled={isDisabled}
              placeholder="填写"
              className="w-full text-right bg-transparent border-b border-dashed border-slate-300 outline-none text-sm text-slate-800"
            />
          </FieldWrapper>
        );
    }
  };

  return (
    <div ref={containerRef} className="bg-slate-100/50 p-4 space-y-4 min-h-full">
      {(title || code) && (
        <div className="bg-white rounded-lg p-4 shadow-sm">
          {title && <h3 className="text-lg font-bold text-slate-800 text-center">{title}</h3>}
          {code && (
            <p className="text-sm text-blue-600 mt-2 text-center font-mono">编号：{code}</p>
          )}
        </div>
      )}
      
      {config.groups && config.groups.map((group: any, groupIndex: number) => {
        const groupTitle = group.title || group.name || `分组 ${groupIndex + 1}`;
        
        const groupFields = (() => {
          const rawKeys = group.fieldKeys || group.fields || group.keys || [];
          const sourceFields = (config.fields && config.fields.length > 0) ? config.fields : parsedFields;
          
          if (Array.isArray(rawKeys) && rawKeys.length > 0) {
            const fields = rawKeys.map((keyOrObj: any) => {
              const fieldKey = typeof keyOrObj === 'string' ? keyOrObj : (keyOrObj.cellKey || keyOrObj.fieldKey);
              if (!fieldKey) return null;

              let field = sourceFields.find((f: any) => 
                f.id === fieldKey || 
                f.cellKey === fieldKey || 
                f.fieldKey === fieldKey ||
                f.fieldName === fieldKey ||
                f.label === fieldKey ||
                (typeof fieldKey === 'string' && f.fieldName && f.fieldName.includes(fieldKey))
              );
              
              return field;
            }).filter(Boolean);
            
            if (fields.length > 0) return fields;
          }
          
          const matchedByGroup = sourceFields.filter((f: any) => {
            const fGroup = f.group || f.groupName;
            return fGroup && (
              fGroup === groupTitle || 
              fGroup === group.name || 
              groupTitle.includes(fGroup) ||
              fGroup.includes(groupTitle)
            );
          });
          
          if (matchedByGroup.length > 0) return matchedByGroup;

          if (groupTitle.includes('审批') || groupTitle.includes('意见')) {
            const signatureFields = sourceFields.filter((f: any) => 
              f.fieldType === 'signature' || 
              (f.fieldName && (f.fieldName.includes('意见') || f.fieldName.includes('审批') || f.fieldName.includes('签署')))
            );
            if (signatureFields.length > 0) return signatureFields;
          }
          
          return [];
        })();
        
        if (groupFields.length === 0) return null;
        
        const isEven = groupIndex % 2 === 0;
        return (
          <div key={groupIndex} className={`rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-4 transition-colors ${isEven ? 'bg-white' : 'bg-blue-50/30'}`}>
            <div className={`${isEven ? 'bg-slate-50' : 'bg-blue-100/40'} px-4 py-3 border-b border-slate-200 flex items-center justify-between`}>
              <h4 className="text-slate-800 font-bold text-[14px] flex items-center gap-2">
                <span className={`p-1 rounded-lg ${isEven ? 'bg-blue-50 text-blue-600' : 'bg-white text-blue-700 shadow-sm'}`}>
                  {getGroupIcon(groupTitle)}
                </span>
                {groupTitle}
              </h4>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${isEven ? 'bg-blue-100 text-blue-600' : 'bg-blue-600 text-white'}`}>
                Section {groupIndex + 1}
              </span>
            </div>
            <div className="px-4">
              {groupFields.map((field: any, fieldIndex: number) => {
                const fieldKey = field?.cellKey || field?.fieldKey || `${groupIndex}-${fieldIndex}`;
                return (
                  <React.Fragment key={fieldKey}>
                    {renderField(field, groupIndex, fieldIndex)}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
