import React, { useRef, useEffect, useLayoutEffect, useCallback, useMemo, useState } from 'react';
import { Calendar, User, Building, ChevronRight, Hash, AlignLeft, CheckSquare, List, FileText, Users, Building2, Smartphone, X } from 'lucide-react';
import HandwrittenSignature from '../HandwrittenSignature';
import SignatureImage from '../SignatureImage';
import MultiSignatureDisplay from '../MultiSignatureDisplay';

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
    case 'timenow':
      return <Calendar size={14} className={`${iconClass} text-slate-500`} />;
    case 'serial':
      return <Hash size={14} className={`${iconClass} text-slate-500`} />;
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
    case 'handwritten':
      return <FileText size={14} className={`${iconClass} text-purple-500`} />;
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

const MobileFormRenderer = React.memo((props: MobileFormRendererProps) => {
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
  const isComposing = useRef(false);
  const lastScrollY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // 🟢 修复问题3：输入跳动
  const activeInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const isUserScrolling = useRef(false);

  // 手写签名模态框状态
  const [signatureModalOpen, setSignatureModalOpen] = useState(false);
  const [pendingSignatureField, setPendingSignatureField] = useState<any>(null);

  // 🟢 监听用户主动滚动
  useEffect(() => {
    let scrollTimeout: NodeJS.Timeout;
    
    const handleScroll = () => {
      isUserScrolling.current = true;
      clearTimeout(scrollTimeout);
      
      scrollTimeout = setTimeout(() => {
        isUserScrolling.current = false;
      }, 150);
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      clearTimeout(scrollTimeout);
    };
  }, []);

  // 🟢 智能恢复滚动位置 - 已移除
  // 移除原因：在移动端，手动干预滚动会与系统软键盘的 scrollIntoView 冲突，导致点击输入框时页面跳动。

  // 🆕 预计算所有分组的字段，避免在渲染路径中实时计算导致子组件重挂载
  const memoizedGroups = useMemo(() => {
    if (!config || !config.groups) return [];
    
    return config.groups.map((group: any, groupIndex: number) => {
      const groupTitle = group.title || group.name || `分组 ${groupIndex + 1}`;
      const rawKeys = group.fieldKeys || group.fields || group.keys || [];
      const sourceFields = (config.fields && config.fields.length > 0) ? config.fields : parsedFields;
      
      // 🟢 修复：优先使用 parsedFields 中的字段类型（确保与模板编辑器中的设置一致）
      // 创建一个字段类型映射表（cellKey -> ParsedField）
      const parsedFieldsMap = new Map<string, any>();
      parsedFields.forEach(f => {
        if (f.cellKey) {
          parsedFieldsMap.set(f.cellKey, f);
        }
      });
      
      // 调试信息：检查 sourceFields 和 parsedFields 中的 handwritten 字段
      if (process.env.NODE_ENV === 'development') {
        const handwrittenInSource = sourceFields.filter((f: any) => f.fieldType === 'handwritten' || f.type === 'handwritten');
        const handwrittenInParsed = Array.from(parsedFieldsMap.values()).filter((f: any) => f.fieldType === 'handwritten');
        
        if (handwrittenInParsed.length > 0) {
          console.log('✅ [MobileFormRenderer] Found handwritten fields in parsedFields:', handwrittenInParsed.map(f => ({
            cellKey: f.cellKey,
            fieldName: f.fieldName,
            fieldType: f.fieldType
          })));
        }
        
        if (handwrittenInSource.length > 0) {
          console.log('✅ [MobileFormRenderer] Found handwritten fields in sourceFields:', handwrittenInSource.map(f => ({
            cellKey: f.cellKey,
            fieldName: f.fieldName,
            fieldType: f.fieldType,
            type: f.type
          })));
        }
        
        if (handwrittenInParsed.length > 0 && handwrittenInSource.length === 0) {
          console.warn('⚠️ [MobileFormRenderer] parsedFields 中有 handwritten 字段，但 sourceFields 中没有！');
        }
      }
      
      let groupFields: any[] = [];
      
      if (Array.isArray(rawKeys) && rawKeys.length > 0) {
        groupFields = rawKeys.map((keyOrObj: any) => {
          const fieldKey = typeof keyOrObj === 'string' ? keyOrObj : (keyOrObj.cellKey || keyOrObj.fieldKey);
          if (!fieldKey) return null;

          const foundField = sourceFields.find((f: any) => 
            f.id === fieldKey || 
            f.cellKey === fieldKey || 
            f.fieldKey === fieldKey ||
            f.fieldName === fieldKey ||
            f.label === fieldKey ||
            (typeof fieldKey === 'string' && f.fieldName && f.fieldName.includes(fieldKey))
          );
          
          // 确保返回的字段对象包含所有必要的属性
          if (foundField) {
            // 🟢 修复：优先使用 parsedFields 中的字段类型（确保与模板编辑器中的设置一致）
            const parsedField = parsedFieldsMap.get(fieldKey);
            const finalFieldType = parsedField?.fieldType || foundField.fieldType || foundField.type || 'text';
            
            const normalizedField = {
              ...foundField,
              fieldType: finalFieldType, // 使用最新的字段类型
              rowIndex: parsedField?.rowIndex ?? foundField.rowIndex, // 🟢 保留原始行号
              colIndex: parsedField?.colIndex ?? foundField.colIndex, // 🟢 保留原始列号
            };
            
            // 调试信息：检查 handwritten 字段
            if (finalFieldType === 'handwritten' && process.env.NODE_ENV === 'development') {
              console.log('✅ [MobileFormRenderer] Normalized handwritten field:', {
                cellKey: normalizedField.cellKey,
                fieldName: normalizedField.fieldName,
                fieldType: normalizedField.fieldType,
                source: parsedField ? 'parsedFields' : 'sourceFields'
              });
            }
            
            return normalizedField;
          }
          
          return null;
        }).filter(Boolean);
        
        // 🟢 关键优化：同组内字段按原始 Excel 行列顺序排序（从左到右、从上到下）
        groupFields.sort((a: any, b: any) => {
          // 优先使用 rowIndex/colIndex
          if (a.rowIndex !== undefined && b.rowIndex !== undefined) {
            if (a.rowIndex !== b.rowIndex) return a.rowIndex - b.rowIndex;
            return (a.colIndex || 0) - (b.colIndex || 0);
          }
          // 兜底：从 cellKey 解析
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
      }
      
      if (groupFields.length === 0) {
        groupFields = sourceFields.filter((f: any) => {
          const fGroup = f.group || f.groupName;
          return fGroup && (
            fGroup === groupTitle || 
            fGroup === group.name || 
            groupTitle.includes(fGroup) ||
            fGroup.includes(groupTitle)
          );
        });
      }

      if (groupFields.length === 0 && (groupTitle.includes('审批') || groupTitle.includes('意见'))) {
        groupFields = sourceFields.filter((f: any) => 
          f.fieldType === 'signature' || 
          (f.fieldName && (f.fieldName.includes('意见') || f.fieldName.includes('审批') || f.fieldName.includes('签署')))
        );
      }
      
      return {
        ...group,
        title: groupTitle,
        fields: groupFields
      };
    });
  }, [config, parsedFields]);
  
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

  // 🆕 统一 Key 获取逻辑：优先使用 field.id (编辑器中已设为 cellKey)
  const getFieldKey = useCallback((field: any) => {
    // 🟢 核心修复：优先使用 field.id，回退到 cellKey
    // 编辑器中已将 id 设置为 cellKey，确保一致性
    return field.id || field.cellKey || "";
  }, []);

  // 🆕 使用 useCallback 稳定函数引用，解决输入一个字符就失去焦点的问题
  const handleFieldChange = useCallback((field: any, value: any) => {
    if (!onDataChange) return;
    const inputKey = getFieldKey(field);
    if (inputKey) onDataChange(inputKey, value);
  }, [onDataChange, getFieldKey]);

  // 🟢 处理输入框获取焦点
  const handleInputFocus = useCallback((e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    activeInputRef.current = e.target as any;
    // 🆕 使用原生 scrollIntoView 让浏览器处理对焦
    setTimeout(() => {
      if (activeInputRef.current) {
        activeInputRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    }, 300);
  }, []);

  // 🟢 处理输入框失去焦点
  const handleInputBlur = useCallback(() => {
    activeInputRef.current = null;
  }, []);

  // 获取字段当前值 - 优化版本：移除调试日志和重复解析
  const getFieldValue = useCallback((field: any): any => {
    const inputKey = getFieldKey(field);
    return formData[inputKey] || '';
  }, [formData, getFieldKey]);

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
      
      case 'handwritten':
        // 兼容旧数据：如果是字符串，转换为数组；如果是数组，直接使用
        const signatureArray = Array.isArray(value) 
          ? value 
          : (value && typeof value === 'string' && value.length > 0 ? [value] : []);
        
        if (signatureArray.length > 0) {
          return (
            <MultiSignatureDisplay
              signatures={signatureArray}
              onAddSignature={() => {}}
              readonly={true}
              maxWidth={300}
              maxHeight={200}
            />
          );
        }
        return <span className="text-slate-300 text-sm">未签名</span>;
      
      default:
        return <span className="inline-block break-words max-w-full text-sm">{value}</span>;
    }
  };

  // 🟢 统一的字段渲染函数 - 使用 useCallback 稳定引用，防止输入框闪烁
  const renderField = useCallback((field: any, groupIndex: number, fieldIndex: number) => {
    const currentValue = getFieldValue(field);
    const isRequired = field.required === true;
    const label = field.fieldName || field.label || '请填写';
    // 确保 fieldType 正确获取（支持多种可能的字段名）
    const fieldType = field.fieldType || field.type || 'text';
    
    // 调试信息（仅在开发环境，对 handwritten 类型输出详细日志）
    if (process.env.NODE_ENV === 'development' && (fieldType === 'handwritten' || field.fieldType === 'handwritten' || field.type === 'handwritten')) {
      console.log('🔍 [MobileFormRenderer] Handwritten field detected:', {
        '最终 fieldType': fieldType,
        'field.fieldType': field.fieldType,
        'field.type': field.type,
        'cellKey': field.cellKey,
        'fieldKey': field.fieldKey,
        'fieldName': field.fieldName,
        'label': label,
        'mode': mode,
        'isDisabled': mode === 'readonly' || mode === 'preview',
        '完整字段对象': field
      });
    }
    const isDisabled = mode === 'readonly' || mode === 'preview';
    const isReadonly = mode === 'readonly';
    const isPreview = mode === 'preview';
    const fieldKey = field.cellKey || field.fieldKey || `${groupIndex}-${fieldIndex}`;
    
    const handleClick = () => {
      if (isPreview && props.onFieldClick) {
        props.onFieldClick(field);
      }
    };

    // section 字段：点击进入子表单
    if (fieldType === 'section') {
      const clickSection = () => {
        if (onSectionClick && field?.cellKey) {
          onSectionClick(field.cellKey, field.fieldName || field.label || '子表单');
        }
      };
      return (
        <div onClick={handleClick} className={`border-b border-slate-50 py-3.5 last:border-0 ${isPreview ? 'cursor-pointer hover:bg-blue-50/50 transition-colors rounded-lg px-2 -mx-2' : ''}`}>
          <div className="flex items-start gap-3">
            <label className="text-[13px] font-medium text-slate-500 flex items-center gap-2 shrink-0 pt-0.5 min-w-[90px] max-w-[120px]">
              {getFieldIcon(fieldType)}
              <span className="whitespace-normal break-words leading-tight">{label}</span>
              {isRequired && <span className="text-red-500 -ml-1">*</span>}
            </label>
            <div className="flex-1 min-w-0 text-right">
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); clickSection(); }}
                className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded border border-slate-300 hover:border-blue-500 hover:text-blue-600 transition-colors"
              >
                填写子表单
              </button>
            </div>
          </div>
        </div>
      );
    }

    // timenow 字段：显示占位符，自动生成时间，无需填写
    if (fieldType === 'timenow') {
      const display = currentValue;
      if (isReadonly) {
        return (
          <div onClick={handleClick} className={`border-b border-slate-50 py-3.5 last:border-0 ${isPreview ? 'cursor-pointer hover:bg-blue-50/50 transition-colors rounded-lg px-2 -mx-2' : ''}`}>
            <div className="flex items-start gap-3">
              <label className="text-[13px] font-medium text-slate-500 flex items-center gap-2 shrink-0 pt-0.5 min-w-[90px] max-w-[120px]">
                {getFieldIcon(fieldType)}
                <span className="whitespace-normal break-words leading-tight">{label}</span>
                {isRequired && <span className="text-red-500 -ml-1">*</span>}
              </label>
              <div className="flex-1 min-w-0 text-right">
                <div className="text-[14px] text-slate-800 break-words overflow-wrap-anywhere whitespace-normal font-medium">{display || <span className="text-slate-300 italic">未填写</span>}</div>
              </div>
            </div>
          </div>
        );
      }
      // 编辑模式：显示占位符，禁用输入
      return (
        <div onClick={handleClick} className={`flex items-start justify-between border-b border-slate-50 py-4 last:border-0 gap-4 ${isPreview ? 'cursor-pointer hover:bg-blue-50/50 transition-colors rounded-lg px-2 -mx-2' : ''}`}>
          <label className="flex items-center gap-2 text-[13px] font-medium text-slate-500 min-w-[90px] max-w-[140px] shrink-0 pt-1">
            {getFieldIcon(fieldType)}
            <span className="whitespace-normal break-words leading-tight">{label}</span>
            {isRequired && <span className="text-red-500 -ml-1">*</span>}
          </label>
          <div className="flex-1 flex justify-end min-w-0">
            <div className="w-full text-right bg-slate-50 border-b border-dashed border-slate-300 text-sm text-slate-500 italic px-2 py-1 select-none">
              {display || '时间自动生成，无需填写'}
            </div>
          </div>
        </div>
      );
    }

    // serial 字段：改为手动填写
    if (fieldType === 'serial') {
      const display = currentValue;
      if (isReadonly) {
        return (
          <div onClick={handleClick} className={`border-b border-slate-50 py-3.5 last:border-0 ${isPreview ? 'cursor-pointer hover:bg-blue-50/50 transition-colors rounded-lg px-2 -mx-2' : ''}`}>
            <div className="flex items-start gap-3">
              <label className="text-[13px] font-medium text-slate-500 flex items-center gap-2 shrink-0 pt-0.5 min-w-[90px] max-w-[120px]">
                {getFieldIcon(fieldType)}
                <span className="whitespace-normal break-words leading-tight">{label}</span>
                {isRequired && <span className="text-red-500 -ml-1">*</span>}
              </label>
              <div className="flex-1 min-w-0 text-right">
                <div className="text-[14px] text-slate-800 break-words overflow-wrap-anywhere whitespace-normal font-medium">{display || <span className="text-slate-300 italic">未生成</span>}</div>
              </div>
            </div>
          </div>
        );
      }
      // 编辑模式：允许输入
      return (
        <div onClick={handleClick} className={`flex items-start justify-between border-b border-slate-50 py-4 last:border-0 gap-4 ${isPreview ? 'cursor-pointer hover:bg-blue-50/50 transition-colors rounded-lg px-2 -mx-2' : ''}`}>
          <label className="flex items-center gap-2 text-[13px] font-medium text-slate-500 min-w-[90px] max-w-[140px] shrink-0 pt-1">
            {getFieldIcon(fieldType)}
            <span className="whitespace-normal break-words leading-tight">{label}</span>
            {isRequired && <span className="text-red-500 -ml-1">*</span>}
          </label>
          <div className="flex-1 flex justify-end min-w-0">
            <input
              value={display ?? ''}
              onChange={(e) => handleFieldChange(field, e.target.value)}
              inputMode="numeric"
              className="w-full text-right bg-white border border-slate-200 rounded px-2 py-1 text-sm text-slate-800 outline-none focus:border-blue-400"
              placeholder={field.hint || '请输入序号'}
            />
          </div>
        </div>
      );
    }

    // 1. 只读模式渲染
    if (isReadonly) {
      const isInlineField = !['textarea', 'match', 'signature', 'handwritten'].includes(fieldType);
      const renderValue = renderFieldValue ? renderFieldValue(field, currentValue) : defaultRenderFieldValue(field, currentValue);
      
      return (
        <div onClick={handleClick} className={`border-b border-slate-50 py-3.5 last:border-0 ${isPreview ? 'cursor-pointer hover:bg-blue-50/50 transition-colors rounded-lg px-2 -mx-2' : ''}`}>
          {isInlineField ? (
            <div className="flex items-start gap-3">
              <label className="text-[13px] font-medium text-slate-500 flex items-center gap-2 shrink-0 pt-0.5 min-w-[90px] max-w-[120px]">
                {getFieldIcon(fieldType)}
                <span className="whitespace-normal break-words leading-tight">{label}</span>
                {isRequired && <span className="text-red-500 -ml-1">*</span>}
              </label>
              <div className="flex-1 min-w-0 text-right">
                <div className="text-[14px] text-slate-800 break-words overflow-wrap-anywhere whitespace-normal font-medium">{renderValue}</div>
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
                <div className="text-[14px] text-slate-800 break-words whitespace-pre-wrap overflow-wrap-anywhere leading-relaxed">{renderValue}</div>
              </div>
            </>
          )}
        </div>
      );
    }

    // 2. 编辑模式 - 特殊大字段 (Textarea, Match, Signature, Handwritten)
    // 调试：检查字段类型判断
    if (process.env.NODE_ENV === 'development') {
      const isSpecialField = fieldType === 'textarea' || fieldType === 'match' || fieldType === 'signature' || fieldType === 'handwritten' || (field.hint && field.hint.includes('____'));
      if (fieldType === 'handwritten') {
        console.log('[MobileFormRenderer] Handwritten field check:', {
          fieldType,
          isSpecialField,
          willEnterSpecialFieldBlock: isSpecialField
        });
      }
    }
    
    if (fieldType === 'textarea' || fieldType === 'match' || fieldType === 'signature' || fieldType === 'handwritten' || (field.hint && field.hint.includes('____'))) {
      // 🟢 Signature 字段特殊处理：编辑模式显示占位符（与桌面端一致）
      if (fieldType === 'signature') {
        const approverHint = field.label || '签核人';
        const display = currentValue;
        return (
          <div onClick={handleClick} className={`py-3 border-b border-slate-100 last:border-0 ${isPreview ? 'cursor-pointer hover:bg-blue-50/50 transition-colors rounded-lg px-2 -mx-2' : ''}`}>
            <label className="block text-xs font-medium text-slate-600 mb-1.5 flex items-center gap-1.5">
              {getFieldIcon(fieldType)}
              <span className="break-words">{label}</span>
              {isRequired && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            <div className="w-full p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm flex flex-col items-center justify-center min-h-[60px] text-amber-700 italic select-none">
              {display ? (
                <span className="whitespace-pre-line text-slate-800 not-italic text-center">{display}</span>
              ) : (
                <>
                  <span className="text-center">待 {approverHint} 签核</span>
                  <span className="text-[10px] text-amber-500 mt-1 text-center">签核后自动写入意见/签名/日期</span>
                </>
              )}
            </div>
          </div>
        );
      }

      // 🟢 Handwritten 字段特殊处理：手写签名（支持多人签名）
      if (fieldType === 'handwritten') {
        // 兼容旧数据：如果是字符串，转换为数组；如果是数组，直接使用
        const signatureArray = Array.isArray(currentValue) 
          ? currentValue 
          : (currentValue && typeof currentValue === 'string' && currentValue.length > 0 ? [currentValue] : []);
        const hasSignature = signatureArray.length > 0;
        
        // 调试信息（仅在开发环境）
        if (process.env.NODE_ENV === 'development') {
          console.log('✅ [MobileFormRenderer] Entering handwritten field render block:', {
            fieldType,
            cellKey: field.cellKey,
            fieldName: field.fieldName,
            label,
            hasSignature,
            signatureCount: signatureArray.length,
            isDisabled,
            mode,
            isReadonly
          });
        }
        
        if (isReadonly) {
          // 只读模式：显示多个签名
          return (
            <div onClick={handleClick} className={`py-3 border-b border-slate-100 last:border-0 ${isPreview ? 'cursor-pointer hover:bg-blue-50/50 transition-colors rounded-lg px-2 -mx-2' : ''}`}>
              <label className="block text-xs font-medium text-slate-600 mb-1.5 flex items-center gap-1.5">
                {getFieldIcon(fieldType)}
                <span className="break-words">{label}</span>
                {isRequired && <span className="text-red-500 ml-0.5">*</span>}
              </label>
              <div className="w-full p-3 bg-white border border-slate-200 rounded-lg min-h-[100px] flex items-center justify-center">
                {hasSignature ? (
                  <MultiSignatureDisplay
                    signatures={signatureArray}
                    onAddSignature={() => {}}
                    readonly={true}
                    maxWidth={300}
                    maxHeight={200}
                  />
                ) : (
                  <span className="text-slate-300 text-sm">未签名</span>
                )}
              </div>
            </div>
          );
        }
        
        // 编辑模式：显示多个签名和"+"按钮
        return (
          <div className="py-3 border-b border-slate-100 last:border-0">
            <label className="block text-xs font-medium text-slate-600 mb-1.5 flex items-center gap-1.5">
              {getFieldIcon(fieldType)}
              <span className="break-words">{label}</span>
              {isRequired && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            <div className="w-full p-3 bg-purple-50 border border-purple-200 rounded-lg min-h-[100px] flex items-center justify-center">
              <MultiSignatureDisplay
                signatures={signatureArray}
                onAddSignature={() => {
                  if (!isDisabled) {
                    console.log('[MobileFormRenderer] Opening signature modal for field:', field);
                    setPendingSignatureField(field);
                    setSignatureModalOpen(true);
                  }
                }}
                onRemoveSignature={(index) => {
                  if (!isDisabled && onDataChange) {
                    const fieldKey = getFieldKey(field);
                    const newArray = [...signatureArray];
                    newArray.splice(index, 1);
                    onDataChange(fieldKey, newArray.length > 0 ? newArray : '');
                  }
                }}
                maxWidth={300}
                maxHeight={200}
                readonly={false}
              />
            </div>
          </div>
        );
      }
      
      // Textarea 字段
      if (fieldType === 'textarea') {
        return (
          <div onClick={handleClick} className={`py-3 border-b border-slate-100 last:border-0 ${isPreview ? 'cursor-pointer hover:bg-blue-50/50 transition-colors rounded-lg px-2 -mx-2' : ''}`}>
            <label className="block text-xs font-medium text-slate-600 mb-1.5 flex items-center gap-1.5">
              {getFieldIcon(fieldType)}
              <span className="break-words">{label}</span>
              {isRequired && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            <textarea
              value={currentValue}
              onChange={(e) => handleFieldChange(field, e.target.value)}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              rows={3}
              className="w-full p-3 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all resize-none shadow-sm"
              placeholder={field.hint || `请输入${label}...`}
              disabled={isDisabled}
            />
          </div>
        );
      }
      if (fieldType === 'match') {
        const matchOptions = field.options || [];
        const selectedOptions = currentValue ? (Array.isArray(currentValue) ? currentValue : currentValue.split(',').filter(Boolean)) : [];
        return (
          <div onClick={handleClick} className={`py-3 border-b border-slate-100 last:border-0 ${isPreview ? 'cursor-pointer hover:bg-blue-50/50 transition-colors rounded-lg px-2 -mx-2' : ''}`}>
            <label className="block text-xs font-medium text-slate-600 mb-1.5 flex items-center gap-1.5">
              {getFieldIcon(fieldType)}
              <span className="break-words">{label}</span>
              {isRequired && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            <div className="flex flex-wrap gap-2">
              {matchOptions.map((opt: string) => (
                <button
                  key={opt}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    if (isDisabled) return;
                    const newSelected = selectedOptions.includes(opt) ? selectedOptions.filter((o: string) => o !== opt) : [...selectedOptions, opt];
                    handleFieldChange(field, newSelected.join(','));
                  }}
                  disabled={isDisabled}
                  className={`flex items-center gap-2 px-3 py-2 rounded transition-all border ${selectedOptions.includes(opt) ? 'bg-blue-500 text-white border-blue-600 shadow-sm' : 'bg-slate-100 text-slate-700 border-slate-200'}`}
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

    // 3. 编辑模式 - 标准行字段 (Text, Select, Date, Department)
    return (
      <div onClick={handleClick} className={`flex items-start justify-between border-b border-slate-50 py-4 last:border-0 gap-4 ${isPreview ? 'cursor-pointer hover:bg-blue-50/50 transition-colors rounded-lg px-2 -mx-2' : ''}`}>
        <label className="flex items-center gap-2 text-[13px] font-medium text-slate-500 min-w-[90px] max-w-[140px] shrink-0 pt-1">
          {getFieldIcon(fieldType)}
          <span className="whitespace-normal break-words leading-tight">{label}</span>
          {isRequired && <span className="text-red-500 -ml-1">*</span>}
        </label>
        <div className="flex-1 flex justify-end min-w-0">
          {(() => {
            switch (fieldType) {
              case 'text':
              case 'number':
              case 'user':
              case 'personnel':
              case 'personal':
                return (
                  <input
                    type={fieldType === 'number' ? 'number' : 'text'}
                    value={currentValue}
                    onChange={(e) => handleFieldChange(field, e.target.value)}
                    onFocus={handleInputFocus}
                    onBlur={handleInputBlur}
                    disabled={isDisabled}
                    placeholder="填写"
                    className="w-full text-right bg-transparent border-b border-dashed border-slate-300 outline-none text-sm text-slate-800 placeholder:text-slate-300 focus:border-blue-400 px-2 py-1"
                  />
                );
              case 'select':
                return (
                  <div className="relative flex items-center w-full justify-end">
                    <select
                      value={currentValue}
                      onChange={(e) => handleFieldChange(field, e.target.value)}
                      onFocus={handleInputFocus}
                      onBlur={handleInputBlur}
                      disabled={isDisabled}
                      className="appearance-none bg-transparent pr-6 text-right outline-none text-sm text-slate-800 border-b border-dashed border-slate-300 focus:border-blue-400 px-2 py-1 w-full max-w-[200px]"
                    >
                      <option value="">选择</option>
                      {field.options?.map((opt: string, i: number) => <option key={i} value={opt}>{opt}</option>)}
                    </select>
                    <ChevronRight size={14} className="text-slate-400 absolute right-0 pointer-events-none" />
                  </div>
                );
              case 'date':
                return (
                  <input
                    type="date"
                    value={currentValue}
                    onChange={(e) => handleFieldChange(field, e.target.value)}
                    onFocus={handleInputFocus}
                    onBlur={handleInputBlur}
                    disabled={isDisabled}
                    className="bg-transparent text-right outline-none text-sm text-slate-800 border-b border-dashed border-slate-300 focus:border-blue-400 px-2 py-1"
                  />
                );
              case 'option':
                const useSwitch = field.options?.length === 2 && ((field.options.includes('是') && field.options.includes('否')) || (field.options.includes('通过') && field.options.includes('不通过')));
                if (useSwitch) {
                  const positiveOpt = field.options.find((o: string) => ['是', '通过'].includes(o));
                  const negativeOpt = field.options.find((o: string) => ['否', '不通过'].includes(o));
                  const isActive = currentValue === positiveOpt;
                  return (
                    <div className="flex items-center">
                      <div 
                        onClick={() => !isDisabled && handleFieldChange(field, isActive ? negativeOpt : positiveOpt)}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${isActive ? 'bg-blue-500' : 'bg-slate-200'} ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${isActive ? 'translate-x-5' : 'translate-x-0'}`} />
                      </div>
                      <span className="ml-2 text-xs text-slate-500 min-w-[30px]">{currentValue || '未选'}</span>
                    </div>
                  );
                }
                return (
                  <div className="flex flex-wrap gap-1 justify-end max-w-full">
                    {field.options?.map((opt: string, idx: number) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={(e) => { e.preventDefault(); if (!isDisabled) handleFieldChange(field, opt); }}
                        className={`px-3 py-1.5 rounded text-xs transition-all border ${currentValue === opt ? 'bg-blue-500 text-white border-blue-600 shadow-sm font-medium' : 'bg-slate-50 text-slate-600 border-slate-200'}`}
                        disabled={isDisabled}
                      >{opt}</button>
                    ))}
                  </div>
                );
              case 'department':
                return (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      const inputKey = getFieldKey(field);
                      if (!isDisabled && onDepartmentClick && inputKey) {
                        onDepartmentClick(inputKey, label);
                      }
                    }}
                    className="flex items-center gap-1 text-sm text-slate-800 hover:text-blue-600 transition-colors py-1"
                    disabled={isDisabled}
                  >
                    <span className={`break-words text-right max-w-[150px] ${currentValue ? 'text-slate-800' : 'text-slate-300'}`}>{currentValue || '点击选择部门'}</span>
                    <ChevronRight size={16} className="text-slate-400 shrink-0" />
                  </button>
                );
              default:
                return (
                  <input
                    type="text"
                    value={currentValue}
                    onChange={(e) => handleFieldChange(field, e.target.value)}
                    onFocus={handleInputFocus}
                    onBlur={handleInputBlur}
                    disabled={isDisabled}
                    placeholder="填写"
                    className="w-full text-right bg-transparent border-b border-dashed border-slate-300 outline-none text-sm text-slate-800"
                  />
                );
            }
          })()}
        </div>
      </div>
    );
  }, [getFieldValue, getFieldIcon, handleFieldChange, handleInputFocus, handleInputBlur, mode, onDepartmentClick, onSectionClick, props.onFieldClick, renderFieldValue, getFieldKey]);

  return (
    <div ref={containerRef} className="bg-slate-100/50 p-4 space-y-4 min-h-full pb-4">
      {(title || code) && (
        <div className="bg-white rounded-lg p-4 shadow-sm">
          {title && <h3 className="text-lg font-bold text-slate-800 text-center">{title}</h3>}
          {code && (
            <p className="text-sm text-blue-600 mt-2 text-center font-mono">编号：{code}</p>
          )}
        </div>
      )}
      
      {memoizedGroups.map((group: any, groupIndex: number) => {
        const groupTitle = group.title;
        const groupFields = group.fields;
        
        if (groupFields.length === 0) return null;
        
        const isEven = groupIndex % 2 === 0;
        return (
          <div key={`group-${groupIndex}`} className={`rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-4 transition-colors ${isEven ? 'bg-white' : 'bg-blue-50/30'}`}>
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
                // 🚩 使用绝对唯一且稳定的 key，防止重绘时焦点丢失
                const stableKey = field.cellKey || field.fieldKey || `R${field.rowIndex}C${field.colIndex}` || `${groupIndex}-${fieldIndex}`;
                return (
                  <React.Fragment key={stableKey}>
                    {renderField(field, groupIndex, fieldIndex)}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* 手写签名模态框 */}
      {signatureModalOpen && pendingSignatureField && (
        <div 
          className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4"
          onClick={(e) => {
            // 点击背景关闭模态框
            if (e.target === e.currentTarget) {
              setSignatureModalOpen(false);
              setPendingSignatureField(null);
            }
          }}
        >
          <div 
            className="bg-white rounded-lg shadow-xl p-4 max-w-full w-full max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-800">手写签名</h3>
              <button
                onClick={() => {
                  setSignatureModalOpen(false);
                  setPendingSignatureField(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1"
                type="button"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <HandwrittenSignature
              value={undefined} // 新签名，不传入已有值
              onChange={(base64) => {
                if (pendingSignatureField && onDataChange && base64) {
                  const fieldKey = getFieldKey(pendingSignatureField);
                  const currentValue = getFieldValue(pendingSignatureField);
                  // 兼容旧数据：如果是字符串，转换为数组；如果是数组，直接使用
                  const signatureArray = Array.isArray(currentValue) 
                    ? currentValue 
                    : (currentValue && typeof currentValue === 'string' && currentValue.length > 0 ? [currentValue] : []);
                  
                  // 将新签名添加到数组中
                  const newArray = [...signatureArray, base64];
                  console.log('[MobileFormRenderer] Adding new signature to array. Total signatures:', newArray.length);
                  onDataChange(fieldKey, newArray);
                }
              }}
              onClose={() => {
                setSignatureModalOpen(false);
                setPendingSignatureField(null);
              }}
              width={Math.min(typeof window !== 'undefined' ? window.innerWidth - 64 : 600, 600)}
              height={300}
            />
          </div>
        </div>
      )}
    </div>
  );
});

export type { MobileFormRendererProps };
export default MobileFormRenderer;
