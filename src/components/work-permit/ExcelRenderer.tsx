import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { CheckSquare, Square, Bold, Type, MousePointerClick, Clock, Check, AlertCircle, X } from 'lucide-react';
import PeopleSelector from '@/components/common/PeopleSelector';
import HandwrittenSignature from './HandwrittenSignature';
import SignatureImage from './SignatureImage';
import MultiSignatureDisplay from './MultiSignatureDisplay';
import { ParsedField } from '@/types/work-permit';

// 定义样式接口
type CellStyle = {
  bold?: boolean;
  fontSize?: number;
};

interface ExcelRendererProps {
  templateData: any; // { grid, merges, cols, rows, styles }
  initialData?: any;
  approvalLogs?: any[]; // ✅ 新增：审批记录
  workflowConfig?: any[]; // ✅ 新增：流程配置 [{ step, rowIndex, name }]
  parsedFields?: ParsedField[]; // 🟢 新增：解析的字段列表
  parseEditMode?: boolean; // 🟢 是否处于解析编辑模式
  onParsedFieldsChange?: (fields: ParsedField[]) => void;
  permitCode?: string; // 🟢 新增：作业单编号
  orientation?: 'portrait' | 'landscape'; // 🟢 新增：纸张方向
  mode?: 'view' | 'edit' | 'design';
  onDataChange?: (data: any) => void;
  onTemplateChange?: (newTemplateData: any) => void;
  // 新增：单元格拾取支持
  onCellClick?: (rowIndex: number, colIndex: number) => void;
  isPickingCell?: boolean;
  // 🔵 V3.4 Section绑定回调
  onSectionBind?: (cellKey: string) => void;
  sectionBindings?: Record<string, string>; // cellKey -> templateId
  onSectionClick?: (cellKey: string, fieldName: string) => void; // Section单元格点击（编辑模式）
}

// 自定义日期选择器：支持临时状态（tempDate/tempTime），只有在用户点“确认”后才触发 onChange
const CustomDatePicker = ({ value, onChange }: { value: string, onChange: (val: string) => void }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // ✅ 新增临时状态（初始为 null，避免 SSR 时使用当前时间导致水合差异）
  const [tempDate, setTempDate] = useState<Date | null>(null);
  const [tempTime, setTempTime] = useState<string>("09:00");
  const [popupStyle, setPopupStyle] = useState<React.CSSProperties>({});

  // 记录组件是否在客户端挂载，只有挂载后才执行与当前时间有关的逻辑
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // ✅ 初始化逻辑（打开时根据 value 初始化临时状态），仅在客户端挂载后运行
  useEffect(() => {
    if (!isOpen || !mounted) return;
    if (value) {
      const d = new Date(value);
      if (!isNaN(d.getTime())) {
        setTempDate(d);
        setTempTime(`${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`);
        return;
      }
    }
    const now = new Date();
    setTempDate(now);
    setTempTime(`${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`);
  }, [isOpen, value, mounted]);

  // 点击文档任意处关闭弹窗（如果点击在外面）
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!isOpen) return;
      const tgt = e.target as HTMLElement;
      // 如果点击不在弹窗内，也不在触发输入上，关闭
      if (!containerRef.current) return;
      if (!containerRef.current.contains(tgt) && tgt !== inputRef.current) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  // 计算弹窗位置（相对于输入框），并在打开时更新样式
  useEffect(() => {
    if (!isOpen) return;
    const el = inputRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPopupStyle({
      position: 'absolute',
      left: rect.left + window.scrollX,
      top: rect.bottom + window.scrollY,
      zIndex: 9999
    });
  }, [isOpen]);

  // 当 tempDate 可能为 null 时，安全派生 year/month（不会在 SSR 阶段就使用当前时间）
  const year = tempDate ? tempDate.getFullYear() : new Date().getFullYear();
  const month = tempDate ? tempDate.getMonth() : new Date().getMonth();
  const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  const firstDayOfMonth = (y: number, m: number) => new Date(y, m, 1).getDay();

  const handlePrevMonth = () => setTempDate(prev => prev ? new Date(prev.getFullYear(), prev.getMonth() - 1, 1) : new Date());
  const handleNextMonth = () => setTempDate(prev => prev ? new Date(prev.getFullYear(), prev.getMonth() + 1, 1) : new Date());

  // ✅ 点击日期只更新临时状态
  const handleDateClick = (day: number) => {
    setTempDate(prev => prev ? new Date(prev.getFullYear(), prev.getMonth(), day) : new Date());
  };

  // ✅ 确认保存逻辑
  const handleConfirm = () => {
    if (!tempDate) return; // 安全保护：如果尚未初始化，直接返回
    const [hours, minutes] = tempTime.split(':').map(Number);
    const finalDate = new Date(year, month, tempDate.getDate(), hours, minutes);
    const y = finalDate.getFullYear();
    const m = (finalDate.getMonth() + 1).toString().padStart(2, '0');
    const d = finalDate.getDate().toString().padStart(2, '0');
    const h = finalDate.getHours().toString().padStart(2, '0');
    const min = finalDate.getMinutes().toString().padStart(2, '0');
    onChange(`${y}-${m}-${d}T${h}:${min}`);
    setIsOpen(false);
  };

  const renderWeeks = (weeks: number[][], selectedDate: Date, onClickDay: (d: number) => void) => {
    return weeks.map((week, wi) => (
      <React.Fragment key={wi}>
        {week.map((day, di) => {
          const empty = day < 1 || day > daysInMonth(year, month);
          const isSelected = !empty && selectedDate.getDate() === day && selectedDate.getMonth() === month && selectedDate.getFullYear() === year;
          return (
            <div key={di} className="text-center">
              {empty ? <div className="h-8"></div> : (
                <button
                  onClick={() => onClickDay(day)}
                  className={`w-8 h-8 rounded ${isSelected ? 'bg-blue-600 text-white' : 'hover:bg-slate-100'}`}
                >
                  {day}
                </button>
              )}
            </div>
          );
        })}
      </React.Fragment>
    ));
  };

  const renderCalendar = () => {
    const total = daysInMonth(year, month);
    const start = firstDayOfMonth(year, month);
    const weeks: number[][] = [];
    let curDay = 1 - start;
    while (curDay <= total) {
      const week: number[] = [];
      for (let i = 0; i < 7; i++) {
        week.push(curDay);
        curDay++;
      }
      weeks.push(week);
    }

    return (
      <div className="p-3 bg-white border rounded shadow z-20 w-[260px]" ref={containerRef}>
        <div className="flex items-center justify-between mb-2">
          <button onClick={handlePrevMonth} className="px-2 py-1 text-sm">‹</button>
          <div className="text-sm font-bold">{year}年 {month + 1}月</div>
          <button onClick={handleNextMonth} className="px-2 py-1 text-sm">›</button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-xs text-slate-500 mb-2">
          <div className="text-center">日</div><div className="text-center">一</div><div className="text-center">二</div><div className="text-center">三</div><div className="text-center">四</div><div className="text-center">五</div><div className="text-center">六</div>
        </div>
        <div className="grid grid-cols-7 gap-1 text-sm mb-2">
          {renderWeeks(weeks, tempDate!, handleDateClick)}
        </div>

        {/* ✅ 底部：时间选择 + 确认按钮 */}
        <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-1 bg-slate-50 px-2 py-1.5 rounded border border-slate-200">
            <Clock size={14} className="text-slate-400"/>
            <input
              type="time"
              className="bg-transparent text-xs outline-none w-20 text-slate-700 font-mono"
              value={tempTime}
              onChange={(e) => setTempTime(e.target.value)}
            />
          </div>
          <button
            onClick={handleConfirm}
            className="flex-1 bg-blue-600 text-white text-xs py-1.5 rounded hover:bg-blue-700 flex items-center justify-center gap-1 shadow-sm transition-transform active:scale-95"
          >
            <Check size={12} strokeWidth={3}/> 确认
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="relative inline-block w-full">
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          readOnly
          value={mounted && value ? (new Date(value)).toLocaleString() : ''}
          onClick={() => setIsOpen(true)}
          className="border-b border-slate-300 outline-none w-full bg-transparent text-sm h-8 cursor-pointer"
        />
      </div>
      {isOpen && mounted && tempDate && (
        // 使用 portal 渲染到 body，避免被表格单元格 overflow:hidden 裁剪
        createPortal(
          <div style={popupStyle} ref={containerRef}>
            {renderCalendar()}
          </div>,
          document.body
        )
      )}
    </div>
  );
};

export default function ExcelRenderer({
  templateData,
  initialData = {},
  approvalLogs = [],
  workflowConfig = [],
  parsedFields = [],
  parseEditMode = false,
  onParsedFieldsChange,
  permitCode, // 🟢 新增：作业单编号
  orientation = 'portrait', // 🟢 新增：纸张方向
  mode = 'view',
  onDataChange,
  onTemplateChange,
  onCellClick,
  isPickingCell = false,
  onSectionBind,
  sectionBindings = {},
  onSectionClick
}: ExcelRendererProps) {
  // 🔵 调试：检查parsedFields中是否有section字段（仅在开发环境输出）
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      const sectionFields = parsedFields.filter(f => f.fieldType === 'section');
      if (sectionFields.length > 0) {
        console.log('🟣 Found section fields in parsedFields:', sectionFields);
      }
      // 移除无 section 字段时的警告日志，减少控制台噪音
    }
  }, [parsedFields]);
  
  // 使用惰性初始化：只在挂载时从 props.templateData 读取一次，避免后续 props 引用变化导致重复同步和死循环
  const [gridData, setGridData] = useState<any[][]>(() => {
    const rawGrid = Array.isArray(templateData) ? templateData : (templateData?.grid || []);
    return JSON.parse(JSON.stringify(rawGrid));
  });

  const [colWidths, setColWidths] = useState<any[]>(() => {
    const rawGrid = Array.isArray(templateData) ? templateData : (templateData?.grid || []);
    let initialCols = templateData?.cols || [];
    if (!initialCols || initialCols.length === 0) {
      const maxCols = rawGrid.length > 0 ? rawGrid[0].length : 10;
      initialCols = Array(maxCols).fill({ wpx: 100 });
    }
    return initialCols;
  });

  const [rowHeights, setRowHeights] = useState<any[]>(() => {
    const rawGrid = Array.isArray(templateData) ? templateData : (templateData?.grid || []);
    let initialRows = templateData?.rows || [];
    if (!initialRows || initialRows.length === 0) {
      initialRows = Array(rawGrid.length).fill({ hpx: 30 });
    }
    return initialRows;
  });

  const [styles, setStyles] = useState<Record<string, CellStyle>>(() => (templateData?.styles || {}));

  const [selectedCell, setSelectedCell] = useState<{ r: number, c: number } | null>(null);
  const parsedMap = useRef<Record<string, ParsedField>>({});
  useEffect(() => {
    const m: Record<string, ParsedField> = {};
    (parsedFields || []).forEach((f) => { if (f?.cellKey) m[f.cellKey] = f; });
    parsedMap.current = m;
  }, [JSON.stringify(parsedFields)]);

  const merges = templateData?.merges || [];

  const [formData, setFormData] = useState<Record<string, any>>({});
  // 🟢 新增：存储内联输入框的值（key 格式："r-c-inline-index"）
  const [inlineInputs, setInlineInputs] = useState<Record<string, string>>({});

  const [deptModalOpen, setDeptModalOpen] = useState(false);
  const [pendingDeptCell, setPendingDeptCell] = useState<{ r: number; c: number } | null>(null);
  
  // 手写签名模态框状态
  const [signatureModalOpen, setSignatureModalOpen] = useState(false);
  const [pendingSignatureCell, setPendingSignatureCell] = useState<{ r: number; c: number } | null>(null);

  // 用 ref 保存最新的 formData，便于在 effect 中比较并避免把 formData 添加到依赖里
  const formDataRef = useRef<Record<string, any>>(formData);
  useEffect(() => {
    formDataRef.current = formData;
  }, [formData]);

  // 本地临时编辑值（用于需要确认的输入，例如 datetime-local）
  const [editingValues, setEditingValues] = useState<Record<string, any>>({});
  const setEditingValue = (key: string, value: any) => setEditingValues(prev => ({ ...prev, [key]: value }));
  const clearEditingValue = (key: string) => setEditingValues(prev => {
    const n = { ...prev };
    delete n[key];
    return n;
  });

  // 🟢 使用 useMemo 缓存 stringify 结果，避免每次渲染都执行（性能优化）
  const initialDataStr = useMemo(() => JSON.stringify(initialData), [initialData]);
  const approvalLogsStr = useMemo(() => JSON.stringify(approvalLogs), [approvalLogs]);
  const workflowConfigStr = useMemo(() => JSON.stringify(workflowConfig), [workflowConfig]);
  const parsedFieldsStr = useMemo(() => JSON.stringify(parsedFields), [parsedFields]);
  
  // 🟢 使用 ref 跟踪 previous values，避免不必要的更新
  const prevPropsRef = useRef({
    initialDataStr: '',
    approvalLogsStr: '',
    workflowConfigStr: '',
    parsedFieldsStr: ''
  });
  
  // ✅ 核心逻辑：合并初始数据 + 审批日志 + 签字数据
  // 🟢 优化：只在 props 真正变化时才处理（通过缓存的 stringify 结果比较）
  useEffect(() => {
    const currentInitialDataStr = initialDataStr;
    const currentApprovalLogsStr = approvalLogsStr;
    const currentWorkflowConfigStr = workflowConfigStr;
    const currentParsedFieldsStr = parsedFieldsStr;
    
    // 🟢 优化：如果 props 没有变化，完全跳过处理（避免不必要的计算）
    const prevInitialDataStr = prevPropsRef.current.initialDataStr;
    const prevApprovalLogsStr = prevPropsRef.current.approvalLogsStr;
    const prevWorkflowConfigStr = prevPropsRef.current.workflowConfigStr;
    const prevParsedFieldsStr = prevPropsRef.current.parsedFieldsStr;
    
    if (prevInitialDataStr === currentInitialDataStr && 
        prevApprovalLogsStr === currentApprovalLogsStr &&
        prevWorkflowConfigStr === currentWorkflowConfigStr &&
        prevParsedFieldsStr === currentParsedFieldsStr) {
      // 数据没有变化，跳过处理（完全不执行后续逻辑）
      return;
    }
    
    // 🟢 只在 props 真正变化时输出日志（减少日志输出）
    if (process.env.NODE_ENV === 'development') {
      console.log('🔄 [ExcelRenderer] Props变化，开始数据合并:', {
        initialDataChanged: prevInitialDataStr !== currentInitialDataStr,
        approvalLogsChanged: prevApprovalLogsStr !== currentApprovalLogsStr,
        workflowConfigChanged: prevWorkflowConfigStr !== currentWorkflowConfigStr,
        parsedFieldsChanged: prevParsedFieldsStr !== currentParsedFieldsStr
      });
    }
    
    // 更新 ref（在开始处理前更新，避免重复处理）
    prevPropsRef.current = {
      initialDataStr: currentInitialDataStr,
      approvalLogsStr: currentApprovalLogsStr,
      workflowConfigStr: currentWorkflowConfigStr,
      parsedFieldsStr: currentParsedFieldsStr
    };
    
    // 🟢 减少调试日志输出，避免无限循环
    // 调试日志已移除，如有需要可以通过其他方式调试
    
    // 1. 深拷贝初始数据（兼容 JSON 字符串或对象）
    let mergedData: Record<string, any> = {};
    if (initialData) {
      if (typeof initialData === 'string') {
        // 如果 initialData 是 JSON 字符串，先解析再深拷贝
        try {
          mergedData = JSON.parse(JSON.stringify(JSON.parse(initialData)));
        } catch (e) {
          console.warn('Failed to parse initialData string:', e);
          mergedData = {};
        }
      } else {
        // 否则直接深拷贝对象
        mergedData = JSON.parse(JSON.stringify(initialData));
      }
    }

    // 🟢 修复开始：提取 celldata 中的签字数据
    // 后端把签字存进了 celldata 数组，我们需要把它展平为 "行-列": "值" 的格式
    const extractCellData = (source: any) => {
        // 兼容处理：source 可能是数组(多Sheet)或对象
        const sheet = Array.isArray(source) ? source[0] : source;
        
        if (sheet && sheet.celldata && Array.isArray(sheet.celldata)) {
            sheet.celldata.forEach((cell: any) => {
                if (cell && typeof cell.r === 'number' && typeof cell.c === 'number') {
                    const key = `${cell.r}-${cell.c}`;
                    // LuckySheet 数据结构通常是 cell.v.m (显示值) 或 cell.v.v (真实值) 或直接是 cell.v
                    const value = cell.v?.m || cell.v?.v || cell.v;
                    
                    // 只有当解析出有效值时，才覆盖 mergedData
                    if (value !== undefined && value !== null) {
                        mergedData[key] = value;
                    }
                }
            });
        }
    };
    
    // 执行提取
    extractCellData(initialData);
    // 🟢 修复结束

    // 2. 合并审批日志 (保持您原有的逻辑)
    if (approvalLogs && approvalLogs.length > 0 && workflowConfig && workflowConfig.length > 0) {
        approvalLogs.forEach(log => {
            const stepConfig = workflowConfig.find(w => w.step === log.step);
            if (!stepConfig) return;

            const actionMap: Record<string, string> = {
                'pass': '同意', 'reject': '驳回', 'read': '已阅', 'submit': '提交'
            };
            const actionText = actionMap[log.action] || '已办理';
            // 使用 <br/> 或者 \n 都可以，但在 input/textarea 里显示 \n 更稳妥
            const combinedText = `${actionText}\n(签字: ${log.approver}  ${log.time})`;

            if (stepConfig.outputCell?.r !== undefined && stepConfig.outputCell?.c !== undefined) {
                const { r, c } = stepConfig.outputCell;
                // 注意：如果 celldata 里已经有了（上面的逻辑提取了），这里会覆盖它
                // 通常审批日志生成的实时文本优先级更高，或者您可以选择不覆盖
                mergedData[`${r}-${c}`] = combinedText;
            } else if (stepConfig.rowIndex !== undefined) {
                const r = stepConfig.rowIndex;
                let targetCol = 1;
                const rowMerge = merges.find((m: any) => m.s.r === r && m.s.c > 0);
                if (rowMerge) targetCol = rowMerge.s.c;
                mergedData[`${r}-${targetCol}`] = combinedText;
            }
        });
    }

    // 🟢 辅助函数：规范化手写签名数据格式
    const normalizeHandwrittenSignature = (value: any, parsedFields: ParsedField[], key: string): any => {
      if (!value) return value;
      
      // 查找对应的字段定义
      const field = parsedFields?.find((f: any) => {
        if (typeof f.rowIndex === 'number' && typeof f.colIndex === 'number') {
          return `${f.rowIndex}-${f.colIndex}` === key || f.cellKey === key;
        }
        return f.cellKey === key;
      });
      
      // 如果不是手写签名字段，直接返回
      if (field?.fieldType !== 'handwritten') return value;
      
      // 如果是字符串，尝试解析JSON
      if (typeof value === 'string') {
        // 检查是否是JSON字符串化的数组或字符串
        if (value.startsWith('[') || value.startsWith('"')) {
          try {
            const parsed = JSON.parse(value);
            return normalizeHandwrittenSignature(parsed, parsedFields, key);
          } catch (e) {
            // 解析失败，继续处理
          }
        }
        // 检查是否是完整的data URL，如果是则提取base64部分
        if (value.startsWith('data:image')) {
          return value.split(',')[1] || value;
        }
        // 如果是纯base64字符串，直接返回
        return value;
      }
      
      // 如果是数组，处理数组中的每个元素
      if (Array.isArray(value)) {
        return value.map((v: any) => {
          if (typeof v === 'string') {
            // 如果是完整的data URL，提取base64部分
            if (v.startsWith('data:image')) {
              return v.split(',')[1] || v;
            }
            // 如果看起来像是JSON字符串，尝试解析
            if (v.startsWith('"') && v.endsWith('"')) {
              try {
                const parsed = JSON.parse(v);
                // 如果解析后仍然是字符串且是data URL，再次提取
                if (typeof parsed === 'string' && parsed.startsWith('data:image')) {
                  return parsed.split(',')[1] || parsed;
                }
                return parsed;
              } catch (e) {
                return v;
              }
            }
          }
          return v;
        });
      }
      
      return value;
    };

    // 3. 更新状态：智能合并策略，保护用户输入
    // 🟢 优化：只在 props 变化时才重新计算和合并数据，不依赖 formData 的内部变化
    // 使用函数式更新来保留用户已输入的数据
    setFormData(prevFormData => {
      const currentData = prevFormData || {};
      const finalData: Record<string, any> = {};
      
      // 🟢 规范化mergedData中的手写签名数据
      // 同时支持R7C10格式和6-9格式的数据键
      Object.keys(mergedData).forEach(key => {
        // 如果key是R7C10格式，也创建6-9格式的键（兼容SectionFormModal转换后的格式）
        const r7c10Match = key.match(/^R(\d+)C(\d+)$/i);
        if (r7c10Match) {
          const r = parseInt(r7c10Match[1], 10) - 1; // R7 -> 6 (0-based)
          const c = parseInt(r7c10Match[2], 10) - 1; // C10 -> 9 (0-based)
          const convertedKey = `${r}-${c}`;
          finalData[convertedKey] = normalizeHandwrittenSignature(mergedData[key], parsedFields || [], convertedKey);
          // 同时保留原始R7C10格式（向后兼容）
          finalData[key] = normalizeHandwrittenSignature(mergedData[key], parsedFields || [], key);
        } else {
          // 直接使用原始键（可能是6-9格式或其他格式）
          finalData[key] = normalizeHandwrittenSignature(mergedData[key], parsedFields || [], key);
        }
      });
      
      // 🟢 优化：减少调试日志输出（只在开发环境且数据变化显著时输出一次）
      // 注意：这里不需要再输出日志，因为已经在 useEffect 开始处输出了
      
      // 保留用户在当前 formData 中输入的数据（这些数据可能还没有同步到 initialData）
      // 只有当 mergedData 中对应字段为空/未定义时，才保留 currentData 的值
      Object.keys(currentData).forEach(key => {
        const mergedValue = finalData[key];
        const currentValue = currentData[key];
        // 如果 mergedData 中没有该字段，或者值为空/未定义，但 currentData 中有有效值，保留 currentData 的值
        if ((mergedValue === undefined || mergedValue === null || mergedValue === '') && 
            currentValue !== undefined && currentValue !== null && currentValue !== '') {
          // 🟢 规范化currentData中的手写签名数据
          finalData[key] = normalizeHandwrittenSignature(currentValue, parsedFields || [], key);
        }
      });
      
      // 只有当合并后的数据与当前数据不同时才更新
      const finalJson = JSON.stringify(finalData);
      const currentJson = JSON.stringify(currentData);
      
      if (finalJson !== currentJson) {
        // 🟢 只在开发环境且数据变化显著时输出日志
        if (process.env.NODE_ENV === 'development' && 
            (Object.keys(finalData).length !== Object.keys(currentData).length ||
             Object.keys(finalData).slice(0, 10).some(k => finalData[k] !== currentData[k]))) {
          console.log('✅ [ExcelRenderer] formData已更新 (props变化导致):', {
            finalDataKeys: Object.keys(finalData).length,
            prevDataKeys: Object.keys(currentData).length,
            changed: true
          });
        }
        return finalData;
      }
      
      // 数据没有变化，返回原数据（不触发重新渲染）
      // 🟢 注意：即使返回原数据，如果 props 变化了，这个函数仍然会被调用一次
      // 但返回相同的引用不会触发组件重新渲染
      return prevFormData;
    });
  }, [initialDataStr, approvalLogsStr, workflowConfigStr, parsedFieldsStr, initialData, approvalLogs, workflowConfig, parsedFields]);

  // NOTE: Removed syncing effect for templateData -> gridData/cols/rows/styles to avoid repeated
  // setState loops when parent regenerates structurally-equal objects. Parent should pass a stable
  // `templateData` or use a `key={templateId}` when they want to force a full remount and reset.
  // The component now initializes from props only once (lazy init above).
  // (no-op placeholder kept for clarity)
  // useEffect intentionally removed.

  const handleInputChange = (rowIndex: number, colIndex: number, value: any) => {
    // 🟢 追加模式：检查当前行是否在已归档范围内，如果是则不允许修改
    const archivedRowRange = (templateData as any)?._archivedRowRange;
    if (archivedRowRange && 
        typeof archivedRowRange.startRow === 'number' && 
        typeof archivedRowRange.endRow === 'number' &&
        rowIndex >= archivedRowRange.startRow && 
        rowIndex <= archivedRowRange.endRow) {
      // 已归档行不允许修改，直接返回
      console.warn('⚠️ 尝试修改已归档行的数据，操作被阻止', { rowIndex, archivedRowRange });
      return;
    }
    
    // 🟢 统一使用 R1C1 格式作为 Key（同时支持6-9格式）
    const key = `R${rowIndex + 1}C${colIndex + 1}`;
    const key6_9 = `${rowIndex}-${colIndex}`;
    const newData = { ...formData, [key]: value, [key6_9]: value };
    setFormData(newData);
    if (onDataChange) onDataChange(newData);
  };

  // 🟢 处理内联输入框的值变化
  const handleInlineInputChange = (r: number, c: number, index: number, val: string) => {
    const key = `R${r + 1}C${c + 1}-inline-${index}`;
    const newInputs = { ...inlineInputs, [key]: val };
    setInlineInputs(newInputs);
    
    // 同时更新到 formData 中，便于提交时统一处理
    const cellKey = `R${r + 1}C${c + 1}`;
    const cellInlineData: Record<string, string> = {};
    const prefix = `${cellKey}-inline-`;
    Object.keys(newInputs).forEach(k => {
      if (k.startsWith(prefix)) {
        cellInlineData[k] = newInputs[k];
      }
    });
    const newData = { ...formData, [`${cellKey}-inlines`]: cellInlineData };
    setFormData(newData);
    if (onDataChange) onDataChange(newData);
  };

  const handleDesignChange = (rowIndex: number, colIndex: number, value: string) => {
    setGridData(prevGrid => {
      const newGrid = prevGrid.map(row => [...row]);
      newGrid[rowIndex][colIndex] = value;
      setTimeout(() => triggerTemplateUpdate(newGrid, colWidths, rowHeights, styles), 0);
      return newGrid;
    });
  };

  const handleStyleUpdate = (change: Partial<CellStyle>) => {
    if (!selectedCell) return;
    const key = `${selectedCell.r}-${selectedCell.c}`;
    setStyles(prev => {
      const newStyles = { ...prev, [key]: { ...prev[key], ...change } };
      setTimeout(() => triggerTemplateUpdate(gridData, colWidths, rowHeights, newStyles), 0);
      return newStyles;
    });
  };

  const handleColWidthChange = (colIndex: number, newWidth: string) => {
    const widthNum = parseInt(newWidth) || 5;
    setColWidths(prevCols => {
      const newCols = [...prevCols];
      newCols[colIndex] = { ...newCols[colIndex], wpx: widthNum };
      setTimeout(() => triggerTemplateUpdate(gridData, newCols, rowHeights, styles), 0);
      return newCols;
    });
  };

  const handleRowHeightChange = (rowIndex: number, newHeight: string) => {
    const heightNum = parseInt(newHeight) || 20;
    setRowHeights(prevRows => {
      const newRows = [...prevRows];
      while (newRows.length <= rowIndex) newRows.push({ hpx: 30 });
      newRows[rowIndex] = { ...newRows[rowIndex], hpx: heightNum };
      setTimeout(() => triggerTemplateUpdate(gridData, colWidths, newRows, styles), 0);
      return newRows;
    });
  };

  const triggerTemplateUpdate = (grid: any[], cols: any[], rows: any[], currentStyles: any) => {
    if (onTemplateChange) {
      onTemplateChange({ grid, merges, cols, rows, styles: currentStyles });
    }
  };

  const handleDepartmentPick = (deptId: string, deptName: string) => {
    if (!pendingDeptCell) return;
    const { r, c } = pendingDeptCell;
    handleInputChange(r, c, deptName || deptId);
    setDeptModalOpen(false);
    setPendingDeptCell(null);
  };

  const getCellSpan = (r: number, c: number) => {
    const mergeInfo = merges.find((m: any) => r >= m.s.r && r <= m.e.r && c >= m.s.c && c <= m.e.c);
    if (!mergeInfo) return { rowSpan: 1, colSpan: 1, isCovered: false };
    if (r === mergeInfo.s.r && c === mergeInfo.s.c) return {
      rowSpan: mergeInfo.e.r - mergeInfo.s.r + 1,
      colSpan: mergeInfo.e.c - mergeInfo.s.c + 1,
      isCovered: false
    };
    return { rowSpan: 1, colSpan: 1, isCovered: true };
  };

  const getCellStyleObj = (r: number, c: number) => {
    const s = styles[`${r}-${c}`] || {};
    return {
      fontWeight: s.bold ? 'bold' : 'normal',
      fontSize: s.fontSize ? `${s.fontSize}px` : '14px'
    };
  };

  // 计算单元格的实际尺寸（考虑合并单元格）
  const getCellSize = (r: number, c: number) => {
    const { rowSpan, colSpan } = getCellSpan(r, c);
    
    // 计算宽度：累加所有跨越的列的宽度
    let totalWidth = 0;
    for (let i = 0; i < colSpan; i++) {
      const colIndex = c + i;
      const colWidth = colWidths[colIndex]?.wpx || 100;
      totalWidth += colWidth;
    }
    
    // 计算高度：累加所有跨越的行的高度
    let totalHeight = 0;
    for (let i = 0; i < rowSpan; i++) {
      const rowIndex = r + i;
      const rowHeight = getRowHeight(rowIndex);
      totalHeight += rowHeight;
    }
    
    // 减去边框和内边距（每个边框约1px，内边距约4px）
    const borderPadding = 2 + 4; // 边框 + 内边距
    return {
      width: Math.max(50, totalWidth - borderPadding), // 最小宽度50px
      height: Math.max(30, totalHeight - borderPadding) // 最小高度30px
    };
  };

  const currentSelectedStyle = selectedCell ? (styles[`${selectedCell.r}-${selectedCell.c}`] || {}) : {};
  const currentParsed = (() => {
    if (!selectedCell) return null;
    const cellKey = `R${selectedCell.r + 1}C${selectedCell.c + 1}`;
    // 🟢 直接从 parsedFields 数组查找，而不是缓存，确保总是最新的值
    return parsedFields?.find(f => f.cellKey === cellKey) || null;
  })();

  const upsertParsedField = (cellKey: string, draft: Partial<ParsedField>) => {
    const existing = parsedMap.current[cellKey];
    const next: ParsedField = {
      cellKey,
      fieldName: draft.fieldName || existing?.fieldName || '',
      fieldType: (draft.fieldType as ParsedField['fieldType']) || existing?.fieldType || 'text',
      label: draft.label || existing?.label || draft.fieldName || '',
      hint: draft.hint || existing?.hint || '',
      editableHint: draft.editableHint ?? existing?.editableHint,
      required: draft.required !== undefined ? draft.required : existing?.required,  // 🟢 保留或更新 required 状态
    };
    const list = [...parsedFields.filter((f) => f.cellKey !== cellKey), next];
    parsedMap.current[cellKey] = next;
    onParsedFieldsChange?.(list);
  };

  const removeParsedField = (cellKey: string) => {
    const list = parsedFields.filter((f) => f.cellKey !== cellKey);
    delete parsedMap.current[cellKey];
    onParsedFieldsChange?.(list);
  };

  const getRowHeight = (rowIndex: number) => {
    const row = rowHeights[rowIndex];
    return (row && row.hpx) ? row.hpx : 30;
  };

  const renderCellContent = (cellValue: any, rIndex: number, cIndex: number) => {
    const valStr = String(cellValue || "").trim();
    // 🟢 统一使用 R1C1 格式
    const cellKey = `R${rIndex + 1}C${cIndex + 1}`;
    const inputKey = cellKey;
    // 🟢 修复：优先使用6-9格式（SectionFormModal转换后的格式），然后尝试R7C10格式
    const filledValue = formData[`${rIndex}-${cIndex}`] ?? formData[inputKey] ?? formData[cellKey.toLowerCase()] ?? formData[cellKey.toUpperCase()];
    const styleObj = getCellStyleObj(rIndex, cIndex);

    // 🟢 优先检查：如果filledValue或valStr看起来像是base64图片数据，直接渲染为图片
    // 这可以处理某些情况下parsedField没有正确匹配的情况
    const valueToCheckFirst = filledValue || valStr;
    if (valueToCheckFirst) {
      let shouldRenderAsImage = false;
      let normalizedBase64: any = null;
      
      // 检查是否是base64字符串
      if (typeof valueToCheckFirst === 'string' && valueToCheckFirst.length > 100) {
        // 更宽松的base64检测：检查是否以iVBORw0KGgo开头（PNG图片的base64开头）
        // 或者包含data:image，或者长度足够且只包含base64字符
        const trimmed = valueToCheckFirst.trim();
        const isBase64Image = trimmed.startsWith('iVBORw0KGgo') || 
                              trimmed.startsWith('data:image') ||
                              (trimmed.length > 500 && /^[A-Za-z0-9+/=\s]+$/.test(trimmed));
        if (isBase64Image) {
          shouldRenderAsImage = true;
          normalizedBase64 = trimmed;
          if (normalizedBase64.startsWith('data:image')) {
            normalizedBase64 = normalizedBase64.split(',')[1] || normalizedBase64;
          }
          // 移除可能的空白字符
          normalizedBase64 = normalizedBase64.replace(/\s/g, '');
        }
      }
      
      // 检查是否是base64数组
      if (Array.isArray(valueToCheckFirst) && valueToCheckFirst.length > 0) {
        const firstItem = valueToCheckFirst[0];
        if (typeof firstItem === 'string' && firstItem.length > 100) {
          const trimmed = firstItem.trim();
          const isBase64Image = trimmed.startsWith('iVBORw0KGgo') || 
                                trimmed.startsWith('data:image') ||
                                (trimmed.length > 500 && /^[A-Za-z0-9+/=\s]+$/.test(trimmed));
          if (isBase64Image) {
            shouldRenderAsImage = true;
            normalizedBase64 = valueToCheckFirst.map((v: any) => {
              if (typeof v === 'string') {
                let normalized = v.trim();
                if (normalized.startsWith('data:image')) {
                  normalized = normalized.split(',')[1] || normalized;
                }
                return normalized.replace(/\s/g, '');
              }
              return v;
            });
          }
        }
      }
      
      // 如果检测到base64图片数据，直接渲染为图片（不等待parsedField匹配）
      if (shouldRenderAsImage) {
        // 调试日志
        if (process.env.NODE_ENV === 'development') {
          console.log('🔍 [ExcelRenderer] 优先检测到base64图片数据，直接渲染:', {
            cellKey,
            inputKey,
            source: filledValue ? 'filledValue' : 'valStr',
            isArray: Array.isArray(normalizedBase64),
            dataLength: Array.isArray(normalizedBase64) ? normalizedBase64[0]?.length : normalizedBase64?.length,
            preview: Array.isArray(normalizedBase64) ? normalizedBase64[0]?.substring(0, 50) : normalizedBase64?.substring(0, 50)
          });
        }
        
        const cellSize = getCellSize(rIndex, cIndex);
        const signatureMaxWidth = Math.max(100, cellSize.width - 8);
        const signatureMaxHeight = Math.max(60, cellSize.height - 8);
        
        return (
          <div 
            className="w-full h-full flex items-center justify-center p-1" 
            style={{
              ...styleObj,
              minHeight: '30px',
              minWidth: '50px',
              overflow: 'visible',
              position: 'relative',
              zIndex: 1
            }}
          >
            <MultiSignatureDisplay
              signatures={Array.isArray(normalizedBase64) ? normalizedBase64 : [normalizedBase64]}
              onAddSignature={() => {}}
              readonly={mode === 'view'}
              maxWidth={Math.max(signatureMaxWidth, 80)}
              maxHeight={Math.max(signatureMaxHeight, 50)}
            />
          </div>
        );
      }
    }

    // 🟢 检查是否有对应的解析字段（支持多种匹配方式）
    // 🟢 优化：优先通过 rowIndex 和 colIndex 匹配（更可靠，因为新行的 cellKey 可能不同）
    let parsedField = parsedFields?.find(f => {
      if (typeof f.rowIndex === 'number' && typeof f.colIndex === 'number') {
        return f.rowIndex === rIndex && f.colIndex === cIndex;
      }
      return false;
    });
    
    // 如果通过rowIndex和colIndex没找到，尝试通过cellKey匹配
    if (!parsedField) {
      parsedField = parsedFields?.find(f => f.cellKey === cellKey);
    }
    
    // 如果还是没找到，尝试通过R7C10格式匹配
    if (!parsedField && parsedFields) {
      for (const f of parsedFields) {
        if (f.cellKey) {
          const match = f.cellKey.match(/^R(\d+)C(\d+)$/i);
          if (match) {
            const fRow = parseInt(match[1], 10) - 1; // R7 -> 6 (0-based)
            const fCol = parseInt(match[2], 10) - 1; // C10 -> 9 (0-based)
            if (fRow === rIndex && fCol === cIndex) {
              parsedField = f;
              break;
            }
          }
        }
      }
    }
    
    // 🟢 调试：检查新行字段匹配情况（只在开发环境且是新行时输出）
    if (process.env.NODE_ENV === 'development' && rIndex > 20) {
      const archivedRowRange = (templateData as any)?._archivedRowRange;
      if (archivedRowRange && rIndex > archivedRowRange.endRow) {
        // 这是新追加的行
        if (!parsedField) {
          // 字段未匹配（只在首次遇到时输出一次警告）
          const warningKey = `field-missing-${rIndex}-${cIndex}`;
          if (!(window as any).__fieldMissingWarnings) {
            (window as any).__fieldMissingWarnings = new Set();
          }
          if (!(window as any).__fieldMissingWarnings.has(warningKey)) {
            (window as any).__fieldMissingWarnings.add(warningKey);
            // 查找可能匹配的字段
            const possibleFields = parsedFields?.filter(f => {
              if (typeof f.rowIndex === 'number' && typeof f.colIndex === 'number') {
                return f.rowIndex === rIndex;
              }
              return false;
            }) || [];
            console.warn('⚠️ [ExcelRenderer] 新行字段未匹配:', {
              rIndex,
              cIndex,
              cellKey,
              parsedFieldsCount: parsedFields?.length || 0,
              possibleFieldsCount: possibleFields.length,
              possibleFields: possibleFields.map(f => ({
                cellKey: f.cellKey,
                rowIndex: f.rowIndex,
                colIndex: f.colIndex,
                fieldType: f.fieldType
              }))
            });
          }
        } else {
          // 字段匹配成功（只在首次匹配时输出一次，确认字段类型）
          const matchKey = `field-matched-${rIndex}-${cIndex}`;
          if (!(window as any).__fieldMatchedLogs) {
            (window as any).__fieldMatchedLogs = new Set();
          }
          if (!(window as any).__fieldMatchedLogs.has(matchKey) && (
            parsedField.fieldType === 'timenow' || 
            parsedField.fieldType === 'handwritten' || 
            parsedField.fieldType === 'option'
          )) {
            (window as any).__fieldMatchedLogs.add(matchKey);
            console.log('✅ [ExcelRenderer] 新行字段匹配成功（特殊类型）:', {
              rIndex,
              cIndex,
              cellKey,
              matchedField: {
                cellKey: parsedField.cellKey,
                rowIndex: parsedField.rowIndex,
                colIndex: parsedField.colIndex,
                fieldType: parsedField.fieldType,
                label: parsedField.label,
                options: parsedField.options
              }
            });
          }
        }
      }
    }
    const isDesignMode = mode === 'design';
    const isRequired = parsedField?.required === true;
    
    // 🟢 追加模式：检查当前行是否在已归档范围内（只读）
    const archivedRowRange = (templateData as any)?._archivedRowRange;
    const isArchivedRow = archivedRowRange && 
      typeof archivedRowRange.startRow === 'number' && 
      typeof archivedRowRange.endRow === 'number' &&
      rIndex >= archivedRowRange.startRow && 
      rIndex <= archivedRowRange.endRow;
    // 🟢 如果当前行是已归档行，则强制设置为只读模式
    const effectiveMode = isArchivedRow ? 'view' : mode;
    
    // 🟢 优化：移除频繁的调试日志，避免刷屏
    // 调试日志已移除，如有需要可以通过其他方式调试

    // 🟣 V3.4 Section类型单元格处理
    if (parsedField?.fieldType === 'section') {
      console.log('🟣 Rendering section cell:', { 
        cellKey, 
        mode, 
        fieldType: parsedField.fieldType, 
        hasSectionData: !!formData[`SECTION_${cellKey}`],
        sectionData: formData[`SECTION_${cellKey}`]
      });
      
      // 设计模式：显示绑定按钮
      if (mode === 'design') {
        const boundTemplateId = sectionBindings[cellKey];
        const isBound = !!boundTemplateId;
        
        return (
          <button
            type="button"
            onClick={() => onSectionBind && onSectionBind(cellKey)}
            className={`w-full h-full flex flex-col items-center justify-center rounded border-2 transition ${
              isBound
                ? 'bg-purple-100 border-purple-500 text-purple-700 hover:bg-purple-200'
                : 'bg-purple-50 border-purple-300 text-purple-600 hover:bg-purple-100'
            }`}
            style={styleObj}
            title={isBound ? '点击修改绑定' : '点击绑定二级模板'}
          >
            <div className="text-xs font-bold">🟣 SECTION</div>
            {isBound && <div className="text-[10px] mt-1">✓ 已绑定</div>}
            {!isBound && <div className="text-[10px] mt-1">点击绑定</div>}
          </button>
        );
      }
      // 编辑模式：显示填写按钮（暂时显示占位符，后续实现弹窗）
      if (mode === 'edit') {
        const sectionData = formData[`SECTION_${cellKey}`];
        return (
          <button
            type="button"
            className={`w-full h-full px-2 text-xs rounded border-2 transition ${
              sectionData 
                ? 'bg-green-50 border-green-500 text-green-700 font-bold' 
                : 'bg-blue-50 border-blue-400 text-blue-700 hover:bg-blue-100'
            }`}
            onClick={() => {
              console.log('🔵 Section button clicked:', { 
                cellKey, 
                label: parsedField.label, 
                onSectionClick: typeof onSectionClick 
              });
              if (onSectionClick) {
                onSectionClick(cellKey, parsedField.label || '子表单');
              } else {
                console.error('❌ onSectionClick is undefined');
              }
            }}
            style={styleObj}
          >
            {sectionData ? '✓ 已填写' : '📝 填写子表单'}
          </button>
        );
      }
      // 查看模式：显示可点击按钮
      if (mode === 'view') {
        const sectionData = formData[`SECTION_${cellKey}`];
        return (
          <button
            type="button"
            className={`w-full h-full px-2 text-xs rounded border-2 transition print:border-0 print:bg-transparent ${
              sectionData 
                ? 'bg-green-50 border-green-500 text-green-700 font-bold hover:bg-green-100' 
                : 'bg-slate-100 border-slate-300 text-slate-500'
            }`}
            onClick={() => {
              if (sectionData && onSectionClick) {
                console.log('🔵 View mode section clicked:', { cellKey, sectionData });
                onSectionClick(cellKey, parsedField.label || '子表单');
              }
            }}
            disabled={!sectionData}
            style={styleObj}
          >
            <span className="print:hidden">{sectionData ? '👁️ 查看子表单' : '未填写'}</span>
            <span className="hidden print:inline">{sectionData ? '✓ 已填写' : '未填写'}</span>
          </button>
        );
      }
    }

    // ✅ 1. 优先处理流程输出单元格 (修改后的逻辑)
    // 查找当前单元格是否绑定了流程步骤
    const boundStep = workflowConfig && workflowConfig.find((w: any) =>
      w.outputCell &&
      typeof w.outputCell.r === 'number' &&
      typeof w.outputCell.c === 'number' &&
      w.outputCell.r === rIndex &&
      w.outputCell.c === cIndex
    );

    // timenow 字段：显示占位符，自动生成时间，无需填写
    // 🟢 修复：确保 timenow 字段即使在没有值的情况下也能正确显示
    if (parsedField?.fieldType === 'timenow') {
      const display = filledValue || valStr || '';
      if (effectiveMode === 'edit') {
        return (
          <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 text-slate-500 text-xs italic select-none" style={styleObj}>
            {display ? (
              <span className="whitespace-pre-line text-slate-800 not-italic">{display}</span>
            ) : (
              <span>时间自动生成，无需填写</span>
            )}
          </div>
        );
      }
      // 查看模式：显示已填充的时间或占位符
      if (effectiveMode === 'view') {
        return (
          <div className="w-full h-full flex items-center justify-center text-sm text-slate-800" style={styleObj}>
            {display || <span className="text-slate-300">/</span>}
          </div>
        );
      }
      // 设计模式：显示字段提示
      return (
        <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-600 text-xs font-bold" style={styleObj}>
          时间自动生成
        </div>
      );
    }

    // serial 字段：改为手动填写（与 number 类似）
    if (parsedField?.fieldType === 'serial') {
      const display = filledValue || valStr;
      if (mode === 'view') {
        return (
          <div className="w-full h-full flex items-center justify-center text-sm text-slate-800" style={styleObj}>
            {display || <span className="text-slate-300">/</span>}
          </div>
        );
      }
      if (mode === 'design') {
        return (
          <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-600 text-xs font-bold" style={styleObj}>
            序号（手填）
          </div>
        );
      }
      // edit
      return (
        <input
          className="w-full h-full text-sm bg-white outline-none px-1"
          style={styleObj}
          type="number"
          value={filledValue ?? ''}
          placeholder={parsedField.hint || '请输入序号'}
          onChange={(e) => handleInputChange(rIndex, cIndex, e.target.value)}
        />
      );
    }

    // 签字类字段在编辑态不可直接编辑，只显示占位提示
    if (mode === 'edit' && parsedField?.fieldType === 'signature') {
      const approverHint = boundStep?.approvers?.[0]?.userName || boundStep?.userName || parsedField.label || '签核人';
      const display = filledValue || valStr;
      return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-amber-50 text-amber-700 text-xs italic select-none" style={styleObj}>
          {display ? (
            <span className="whitespace-pre-line text-slate-800 not-italic">{display}</span>
          ) : (
            <>
              <span>待 {approverHint} 签核</span>
              <span className="text-[10px] text-amber-500">签核后自动写入意见/签名/日期</span>
            </>
          )}
        </div>
      );
    }

    // 手写签名字段处理（支持多人签名）
    // 🟢 修复：确保 handwritten 字段即使在没有值的情况下也能正确显示输入框
    if (parsedField?.fieldType === 'handwritten') {
      // 🟢 规范化手写签名数据格式
      let normalizedValue = filledValue;
      
      // 调试日志
      if (process.env.NODE_ENV === 'development' && filledValue) {
        console.log('🔍 [ExcelRenderer] 手写签名原始数据:', {
          cellKey,
          inputKey,
          filledValue,
          filledValueType: typeof filledValue,
          isArray: Array.isArray(filledValue),
          isString: typeof filledValue === 'string',
          stringLength: typeof filledValue === 'string' ? filledValue.length : 0,
          startsWithBracket: typeof filledValue === 'string' ? filledValue.startsWith('[') : false,
          startsWithQuote: typeof filledValue === 'string' ? filledValue.startsWith('"') : false,
          startsWithDataImage: typeof filledValue === 'string' ? filledValue.startsWith('data:image') : false
        });
      }
      
      // 如果是字符串，尝试解析JSON
      if (normalizedValue && typeof normalizedValue === 'string') {
        // 检查是否是JSON字符串化的数组或字符串
        if (normalizedValue.startsWith('[') || (normalizedValue.startsWith('"') && normalizedValue.length > 100)) {
          try {
            const parsed = JSON.parse(normalizedValue);
            normalizedValue = parsed;
            if (process.env.NODE_ENV === 'development') {
              console.log('✅ [ExcelRenderer] JSON解析成功:', { original: normalizedValue.substring(0, 50), parsed });
            }
          } catch (e) {
            if (process.env.NODE_ENV === 'development') {
              console.warn('⚠️ [ExcelRenderer] JSON解析失败:', e);
            }
          }
        }
        // 检查是否是完整的data URL，如果是则提取base64部分
        if (typeof normalizedValue === 'string' && normalizedValue.startsWith('data:image')) {
          normalizedValue = normalizedValue.split(',')[1] || normalizedValue;
          if (process.env.NODE_ENV === 'development') {
            console.log('✅ [ExcelRenderer] 提取data URL的base64部分');
          }
        }
      }
      
      // 如果是数组，处理数组中的每个元素
      if (Array.isArray(normalizedValue)) {
        normalizedValue = normalizedValue.map((v: any, idx: number) => {
          if (typeof v === 'string') {
            // 如果是完整的data URL，提取base64部分
            if (v.startsWith('data:image')) {
              const extracted = v.split(',')[1] || v;
              if (process.env.NODE_ENV === 'development') {
                console.log(`✅ [ExcelRenderer] 数组元素[${idx}] 提取data URL的base64部分`);
              }
              return extracted;
            }
            // 如果看起来像是JSON字符串，尝试解析
            if (v.startsWith('"') && v.endsWith('"') && v.length > 100) {
              try {
                const parsed = JSON.parse(v);
                // 如果解析后仍然是字符串且是data URL，再次提取
                if (typeof parsed === 'string' && parsed.startsWith('data:image')) {
                  const extracted = parsed.split(',')[1] || parsed;
                  if (process.env.NODE_ENV === 'development') {
                    console.log(`✅ [ExcelRenderer] 数组元素[${idx}] JSON解析后再次提取data URL`);
                  }
                  return extracted;
                }
                return parsed;
              } catch (e) {
                return v;
              }
            }
          }
          return v;
        });
      }
      
      // 兼容旧数据：如果是字符串，转换为数组；如果是数组，直接使用
      const signatureArray = Array.isArray(normalizedValue) 
        ? normalizedValue 
        : (normalizedValue && typeof normalizedValue === 'string' && normalizedValue.length > 0 ? [normalizedValue] : []);
      const hasSignature = signatureArray.length > 0;
      
      // 调试日志
      if (process.env.NODE_ENV === 'development' && hasSignature) {
        console.log('✅ [ExcelRenderer] 规范化后的签名数组:', {
          cellKey,
          arrayLength: signatureArray.length,
          firstItemType: typeof signatureArray[0],
          firstItemLength: typeof signatureArray[0] === 'string' ? signatureArray[0].length : 0,
          firstItemPreview: typeof signatureArray[0] === 'string' ? signatureArray[0].substring(0, 50) : signatureArray[0]
        });
      }
      
      // 计算单元格实际尺寸（响应式）
      const cellSize = getCellSize(rIndex, cIndex);
      // 🟢 修复：确保签名有足够的显示空间
      // 留出一些内边距空间（约8px），确保签名不会紧贴边缘
      // 同时确保最小尺寸足够大，避免图片太小看不清
      const signatureMaxWidth = Math.max(100, cellSize.width - 8); // 🟢 最小宽度100px
      const signatureMaxHeight = Math.max(60, cellSize.height - 8); // 🟢 最小高度60px
      
      // 调试日志
      if (process.env.NODE_ENV === 'development' && hasSignature) {
        console.log('🔍 [ExcelRenderer] 单元格尺寸:', {
          cellKey,
          cellSize,
          signatureMaxWidth,
          signatureMaxHeight
        });
      }
      
      if (mode === 'view') {
        // 查看模式：显示多个签名
        return (
          <div 
            className="w-full h-full flex items-center justify-center p-1" 
            style={{
              ...styleObj,
              minHeight: '30px', // 🟢 确保最小高度，避免容器太小
              minWidth: '50px', // 🟢 确保最小宽度，避免容器太小
              overflow: 'visible', // 🟢 确保图片不被裁剪
              position: 'relative', // 🟢 确保定位正确
              zIndex: 1 // 🟢 确保图片在上层
            }}
          >
            {hasSignature ? (
              <MultiSignatureDisplay
                signatures={signatureArray}
                onAddSignature={() => {}}
                readonly={true}
                maxWidth={Math.max(signatureMaxWidth, 80)} // 🟢 确保最小宽度80px
                maxHeight={Math.max(signatureMaxHeight, 50)} // 🟢 确保最小高度50px
              />
            ) : (
              <span className="text-slate-300 text-xs">/</span>
            )}
          </div>
        );
      }
      
      if (mode === 'edit') {
        // 编辑模式：显示多个签名和"+"按钮
        return (
          <div 
            className="w-full h-full flex items-center justify-center p-1" 
            style={{
              ...styleObj,
              minHeight: '30px', // 🟢 确保最小高度，避免容器太小
              minWidth: '50px', // 🟢 确保最小宽度，避免容器太小
              overflow: 'visible', // 🟢 确保图片不被裁剪
              position: 'relative', // 🟢 确保定位正确
              zIndex: 1 // 🟢 确保图片在上层
            }}
          >
            <MultiSignatureDisplay
              signatures={signatureArray}
              onAddSignature={() => {
                setPendingSignatureCell({ r: rIndex, c: cIndex });
                setSignatureModalOpen(true);
              }}
              onRemoveSignature={(index) => {
                const newArray = [...signatureArray];
                newArray.splice(index, 1);
                handleInputChange(rIndex, cIndex, newArray.length > 0 ? newArray : '');
              }}
              maxWidth={Math.max(signatureMaxWidth, 80)} // 🟢 确保最小宽度80px
              maxHeight={Math.max(signatureMaxHeight, 50)} // 🟢 确保最小高度50px
              readonly={false}
            />
          </div>
        );
      }
      
      // 设计模式：显示字段提示
      return (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-50 border-l-4 border-purple-500 p-1" style={styleObj}>
          <span className="text-xs text-purple-700 font-bold">手写签名</span>
        </div>
      );
    }

    if (boundStep && mode === 'edit') {
      // 获取审批人列表 (兼容旧数据: 如果没有 approvers 但有 userId)
      let approvers = boundStep.approvers || [];
      if (!approvers.length && boundStep.userId) {
        approvers = [{ userId: boundStep.userId, userName: boundStep.userName }];
      }

      // 情况 A: 只有一个候选审批人 -> 显示静态提示
      if (approvers.length <= 1) {
        const name = approvers[0]?.userName || '审批人';
        return (
          <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 text-slate-500 text-xs italic select-none" style={styleObj}>
            <span>⏳ 待审批</span>
            <span className="font-bold text-slate-700">{name}</span>
          </div>
        );
      }

      // 情况 B: 有多个候选审批人 -> 显示下拉选择
      // 用户选择的 ID 会被存入 formData，随表单一起提交
      return (
        <div className="w-full h-full bg-blue-50/30 flex items-center px-1" style={styleObj}>
          <select
            className="w-full h-full bg-transparent outline-none text-xs text-blue-800 font-bold cursor-pointer appearance-none text-center"
            value={filledValue || ''}
            onChange={(e) => handleInputChange(rIndex, cIndex, e.target.value)}
            title="请指定一名审批人"
          >
            <option value="">▼ 请选择审批人</option>
            {approvers.map((app: any) => (
              <option key={app.userId} value={app.userId}>
                {app.userName}
              </option>
            ))}
          </select>
          {/* 如果还没选，显示一个小红点提示 */}
          {!filledValue && <span className="absolute right-1 top-1 w-2 h-2 bg-red-500 rounded-full animate-pulse pointer-events-none"></span>}
        </div>
      );
    }

    if (mode === 'design') {
      // 解析编辑模式：单击单元格即可选中供右侧/顶部面板编辑
      if (parseEditMode) {
        const handlePick = () => {
          setSelectedCell({ r: rIndex, c: cIndex });
        };
        // 显示解析提示（空或提示字段）
        if (parsedField) {
          return (
            <div onClick={handlePick} className="w-full h-full bg-gradient-to-br from-blue-50 to-cyan-50 border-l-4 border-blue-500 p-1 flex flex-col justify-center overflow-hidden relative group cursor-pointer">
              <div className="text-xs font-bold text-blue-900 line-clamp-2 leading-tight">// {parsedField.fieldName}</div>
              <div className="text-[10px] text-blue-700 line-clamp-1">({parsedField.fieldType})</div>
              <div className="absolute right-1 bottom-1 text-[10px] text-blue-500">编辑</div>
            </div>
          );
        }
        return (
          <div onClick={handlePick} className="w-full h-full flex items-center justify-center text-[11px] text-slate-400 cursor-pointer hover:bg-slate-50">
            <span>+ 添加解析</span>
          </div>
        );
      }

      // 如果有解析字段且单元格为空，显示字段提示
      if (isDesignMode && parsedField && (!valStr || valStr === "点击填写")) {
        return (
          <div className="w-full h-full bg-gradient-to-br from-blue-50 to-cyan-50 border-l-4 border-blue-500 p-1 flex flex-col justify-center overflow-hidden relative group">
            {/* 主要内容区域 */}
            <div className="text-xs font-bold text-blue-900 line-clamp-2 leading-tight">
              // {parsedField.fieldName}
            </div>
            <div className="text-[10px] text-blue-700 line-clamp-1">
              ({parsedField.fieldType})
            </div>
            
            {/* 悬停时显示完整信息 */}
            <div className="absolute inset-0 bg-white/95 p-2 hidden group-hover:flex flex-col gap-1 rounded shadow-lg z-50">
              <div className="text-xs font-bold text-slate-800">
                <span className="text-blue-600">字段名：</span>{parsedField.fieldName}
              </div>
              <div className="text-xs text-slate-700">
                <span className="text-blue-600">类型：</span>{parsedField.fieldType}
              </div>
              <div className="text-xs text-slate-700">
                <span className="text-blue-600">提示：</span>{parsedField.hint}
              </div>
              {parsedField.editableHint && (
                <div className="text-xs text-slate-700 border-t pt-1">
                  <span className="text-amber-600">编辑提示：</span>{parsedField.editableHint}
                </div>
              )}
            </div>
          </div>
        );
      }

      // 普通的编辑 textarea
      return (
        <textarea
          className="w-full h-full bg-transparent outline-none resize-none border-transparent hover:border-blue-300 border focus:bg-blue-100 text-slate-800 font-mono p-0 text-center leading-tight transition-colors"
          value={valStr}
          onChange={(e) => handleDesignChange(rIndex, cIndex, e.target.value)}
          onFocus={() => setSelectedCell({ r: rIndex, c: cIndex })}
          style={{ height: '100%', minHeight: '100%', overflow: 'hidden', ...styleObj }}
        />
      );
    }

    // 部门选择：编辑模式调用部门选择弹窗
    if (mode === 'edit' && parsedField?.fieldType === 'department') {
      const displayValue = filledValue || '';
      return (
        <button
          type="button"
          className="w-full h-full px-1 text-sm text-blue-800 bg-blue-50/40 border border-blue-200 rounded hover:bg-blue-100 truncate"
          onClick={() => {
            setPendingDeptCell({ r: rIndex, c: cIndex });
            setDeptModalOpen(true);
          }}
        >
          {displayValue || '选择部门'}
        </button>
      );
    }

    // 拾取模式：覆盖提示（不隐藏单元格，只展示可点击的遮罩）
    if (isPickingCell) {
      return (
        <div className="w-full h-full flex items-center justify-center bg-blue-50/50 hover:bg-blue-200 cursor-crosshair text-blue-600 text-xs font-bold">
          <MousePointerClick size={16}/> 选择
        </div>
      );
    }

    // 🟢 处理选项字段：区分互斥选项组（单选）和普通选项（多选）
    // 排除单个字母"R"，只有当"R"后面还有其他内容时才识别为选项符号
    const isOptionField = (valStr !== "R" && /^[£R□☑]/.test(valStr)) || valStr.includes("£") || valStr.includes("□");
    if (isOptionField) {
      // 检查是否为互斥选项组（单元格中有多个 £）
      const optionMatches = valStr.match(/[£￡][^£￡]+/g);
      
      if (optionMatches && optionMatches.length > 1) {
        // 🟢 互斥选项组（单选框）
        const options = optionMatches.map(opt => opt.replace(/[£￡]/g, '').trim()).filter(Boolean);
        const selectedValue = filledValue || '';
        
        if (mode === 'view') {
          return (
            <div className="flex items-center gap-1 flex-wrap select-none text-sm" style={styleObj}>
              {options.map((opt, idx) => {
                const isSelected = selectedValue === opt;
                return (
                  <div key={idx} className="flex items-center gap-0.5">
                    <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${isSelected ? 'border-blue-600 bg-blue-100' : 'border-slate-300'}`}>
                      {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />}
                    </div>
                    <span className={isSelected ? 'font-bold text-blue-900' : 'text-slate-600'}>{opt}</span>
                  </div>
                );
              })}
            </div>
          );
        }
        
        // 编辑模式：单选框组
        return (
          <div className="flex items-center gap-1 flex-wrap p-0.5 text-sm" style={styleObj}>
            {options.map((opt, idx) => (
              <label key={idx} className="flex items-center gap-0.5 cursor-pointer hover:bg-blue-50 px-1.5 py-0.5 rounded">
                <input
                  type="radio"
                  name={`radio-${rIndex}-${cIndex}`}
                  checked={selectedValue === opt}
                  onChange={() => handleInputChange(rIndex, cIndex, opt)}
                  className="w-3.5 h-3.5 text-blue-600 border-gray-300 focus:ring-blue-500"
                />
                <span className="whitespace-nowrap">{opt}</span>
              </label>
            ))}
          </div>
        );
      }
      
      // 普通选项（复选框）
      const label = valStr.replace(/[£R□☑]/g, "").trim();
      const isChecked = !!filledValue;
      if (mode === 'view') {
        return <div className="flex items-center gap-1 select-none" style={styleObj}>{isChecked ? <CheckSquare size={16} className="text-blue-600"/> : <Square size={16} className="text-slate-300"/>}<span>{label}</span></div>;
      }
      return <label className="flex items-center gap-1 p-1 rounded cursor-pointer hover:bg-blue-50" style={styleObj}><input type="checkbox" checked={isChecked} onChange={(e) => handleInputChange(rIndex, cIndex, e.target.checked)} className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500" /><span>{label}</span></label>;
    }

    if (valStr.match(/年.*月.*日/)) {
      const key = inputKey;
      return (
        <div className="flex items-center justify-center h-full" style={styleObj}>
          {effectiveMode === 'edit' ? (
            <CustomDatePicker
              value={filledValue || ''}
              onChange={(v) => {
                handleInputChange(rIndex, cIndex, v);
              }}
            />
          ) : (
            <span className="text-sm font-bold text-blue-900 text-center">
              {filledValue ? new Date(filledValue).toLocaleString() : ''}
            </span>
          )}
        </div>
      );
    }

    if (!valStr || valStr === "点击填写") {
      // 🟢 检查filledValue是否是base64图片数据
      if (filledValue) {
        let shouldRenderAsImage = false;
        let normalizedBase64: any = null;
        
        if (typeof filledValue === 'string' && filledValue.length > 100) {
          const isBase64Image = filledValue.startsWith('iVBORw0KGgo') || 
                                filledValue.startsWith('data:image') ||
                                (filledValue.length > 500 && /^[A-Za-z0-9+/=]+$/.test(filledValue.replace(/\s/g, '')));
          if (isBase64Image) {
            shouldRenderAsImage = true;
            normalizedBase64 = filledValue;
            if (normalizedBase64.startsWith('data:image')) {
              normalizedBase64 = normalizedBase64.split(',')[1] || normalizedBase64;
            }
          }
        }
        
        if (Array.isArray(filledValue) && filledValue.length > 0) {
          const firstItem = filledValue[0];
          if (typeof firstItem === 'string' && firstItem.length > 100) {
            const isBase64Image = firstItem.startsWith('iVBORw0KGgo') || 
                                  firstItem.startsWith('data:image') ||
                                  (firstItem.length > 500 && /^[A-Za-z0-9+/=]+$/.test(firstItem.replace(/\s/g, '')));
            if (isBase64Image) {
              shouldRenderAsImage = true;
              normalizedBase64 = filledValue.map((v: any) => {
                if (typeof v === 'string') {
                  if (v.startsWith('data:image')) {
                    return v.split(',')[1] || v;
                  }
                  return v;
                }
                return v;
              });
            }
          }
        }
        
        if (shouldRenderAsImage) {
          const cellSize = getCellSize(rIndex, cIndex);
          const signatureMaxWidth = Math.max(100, cellSize.width - 8);
          const signatureMaxHeight = Math.max(60, cellSize.height - 8);
          
          return (
            <div 
              className="w-full h-full flex items-center justify-center p-1" 
              style={{
                ...styleObj,
                minHeight: '30px',
                minWidth: '50px',
                overflow: 'visible',
                position: 'relative',
                zIndex: 1
              }}
            >
              <MultiSignatureDisplay
                signatures={Array.isArray(normalizedBase64) ? normalizedBase64 : [normalizedBase64]}
                onAddSignature={() => {}}
                readonly={effectiveMode === 'view'}
                maxWidth={Math.max(signatureMaxWidth, 80)}
                maxHeight={Math.max(signatureMaxHeight, 50)}
              />
            </div>
          );
        }
      }
      
      // 查看模式或非解析字段（包括已归档行）
      if (effectiveMode === 'view') return filledValue ? <span className="text-blue-900 font-bold text-sm block text-center whitespace-nowrap" style={styleObj}>{filledValue}</span> : <span className="text-slate-200 block text-center select-none">/</span>;
      
      // 编辑模式或普通输入 - 必填字段在无内容时显示红色星号
      return (
        <div className="w-full h-full flex items-center justify-center">
          {isRequired && !filledValue && <span className="text-red-500 font-bold mr-1 flex-shrink-0">*</span>}
          <input
            type="text"
            placeholder={valStr === "点击填写" ? "点击填写" : ""}
            className="flex-1 h-full min-h-[24px] bg-transparent outline-none focus:bg-blue-50 px-1 text-center text-blue-800 text-sm"
            value={filledValue || ''}
            onChange={(e) => handleInputChange(rIndex, cIndex, e.target.value)}
            style={styleObj}
            readOnly={effectiveMode === 'view'}
          />
        </div>
      );
    }

    // 🟢 处理包含连续下划线的单元格（内联输入框）
    if (valStr.includes('____')) {
      const parts = valStr.split(/(____+)/);
      let inlineIndex = 0;
      
      if (effectiveMode === 'view') {
        // 查看模式：显示已填写的值或下划线（包括已归档行）
        return (
          <div className="flex items-center flex-wrap gap-0.5 text-sm px-1" style={styleObj}>
            {parts.map((part, idx) => {
              if (/^____+$/.test(part)) {
                const key = `${cellKey}-inline-${inlineIndex}`;
                // 优先从 inlineInputs 读取，如果没有则尝试从 formData 的内联对象中读取（兼容加载）
                const value = inlineInputs[key] || (formData[`${cellKey}-inlines`]?.[key]) || (formData[`${rIndex}-${cIndex}-inlines`]?.[`${rIndex}-${cIndex}-inline-${inlineIndex}`]) || '';
                inlineIndex++;
                return (
                  <span key={idx} className="inline-block min-w-[60px] border-b-2 border-blue-400 px-1 font-bold text-blue-900">
                    {value || '______'}
                  </span>
                );
              }
              return <span key={idx}>{part}</span>;
            })}
          </div>
        );
      }
      
      // 编辑模式：显示输入框
      // 检查所有内联输入是否都有值
      const inlineCount = parts.filter(p => /^____+$/.test(p)).length;
      const hasAllInlineValues = Array.from({ length: inlineCount }, (_, i) => {
        const key = `${cellKey}-inline-${i}`;
        return (inlineInputs[key] || formData[`${cellKey}-inlines`]?.[key])?.trim() !== '';
      }).every(Boolean);
      
      return (
        <div className="flex items-center flex-wrap gap-0.5 text-sm px-1" style={styleObj}>
          {isRequired && !hasAllInlineValues && <span className="text-red-500 font-bold mr-1 flex-shrink-0">*</span>}
          {parts.map((part, idx) => {
            if (/^____+$/.test(part)) {
              const key = `${cellKey}-inline-${inlineIndex}`;
              const currentIndex = inlineIndex;
              const value = inlineInputs[key] || (formData[`${cellKey}-inlines`]?.[key]) || '';
              inlineIndex++;
              return (
                <input
                  key={idx}
                  type="text"
                  className="inline-block min-w-[60px] max-w-[120px] border-b-2 border-blue-400 px-1 text-center bg-blue-50/30 focus:bg-blue-100 outline-none text-blue-900 font-bold"
                  value={value}
                  onChange={(e) => handleInlineInputChange(rIndex, cIndex, currentIndex, e.target.value)}
                  placeholder="填写"
                />
              );
            }
            return <span key={idx}>{part}</span>;
          })}
        </div>
      );
    }

    // 🟢 最后检查：如果filledValue看起来像是base64图片数据，尝试渲染为图片
    // 这可以处理某些情况下parsedField没有正确匹配的情况
    if (filledValue && typeof filledValue === 'string' && filledValue.length > 100) {
      // 检查是否是base64字符串（通常以iVBORw0KGgo开头，或者包含data:image）
      const isBase64Image = filledValue.startsWith('iVBORw0KGgo') || 
                            filledValue.startsWith('data:image') ||
                            (filledValue.length > 500 && /^[A-Za-z0-9+/=]+$/.test(filledValue.replace(/\s/g, '')));
      
      if (isBase64Image) {
        // 尝试规范化base64数据
        let normalizedBase64 = filledValue;
        if (normalizedBase64.startsWith('data:image')) {
          normalizedBase64 = normalizedBase64.split(',')[1] || normalizedBase64;
        }
        
        // 调试日志
        if (process.env.NODE_ENV === 'development') {
          console.log('🔍 [ExcelRenderer] 检测到未匹配的base64图片数据，尝试渲染:', {
            cellKey,
            inputKey,
            dataLength: normalizedBase64.length,
            preview: normalizedBase64.substring(0, 50)
          });
        }
        
        // 渲染为图片
        const cellSize = getCellSize(rIndex, cIndex);
        const signatureMaxWidth = Math.max(100, cellSize.width - 8);
        const signatureMaxHeight = Math.max(60, cellSize.height - 8);
        
        return (
          <div 
            className="w-full h-full flex items-center justify-center p-1" 
            style={{
              ...styleObj,
              minHeight: '30px',
              minWidth: '50px',
              overflow: 'visible',
              position: 'relative',
              zIndex: 1
            }}
          >
            <MultiSignatureDisplay
              signatures={[normalizedBase64]}
              onAddSignature={() => {}}
              readonly={true}
              maxWidth={Math.max(signatureMaxWidth, 80)}
              maxHeight={Math.max(signatureMaxHeight, 50)}
            />
          </div>
        );
      }
    }
    
    // 如果是数组且第一个元素看起来像是base64图片数据
    if (Array.isArray(filledValue) && filledValue.length > 0) {
      const firstItem = filledValue[0];
      if (typeof firstItem === 'string' && firstItem.length > 100) {
        const isBase64Image = firstItem.startsWith('iVBORw0KGgo') || 
                              firstItem.startsWith('data:image') ||
                              (firstItem.length > 500 && /^[A-Za-z0-9+/=]+$/.test(firstItem.replace(/\s/g, '')));
        
        if (isBase64Image) {
          // 调试日志
          if (process.env.NODE_ENV === 'development') {
            console.log('🔍 [ExcelRenderer] 检测到未匹配的base64图片数组，尝试渲染:', {
              cellKey,
              inputKey,
              arrayLength: filledValue.length,
              firstItemLength: firstItem.length
            });
          }
          
          // 规范化数组中的每个元素
          const normalizedArray = filledValue.map((v: any) => {
            if (typeof v === 'string') {
              if (v.startsWith('data:image')) {
                return v.split(',')[1] || v;
              }
              return v;
            }
            return v;
          });
          
          const cellSize = getCellSize(rIndex, cIndex);
          const signatureMaxWidth = Math.max(100, cellSize.width - 8);
          const signatureMaxHeight = Math.max(60, cellSize.height - 8);
          
          return (
            <div 
              className="w-full h-full flex items-center justify-center p-1" 
              style={{
                ...styleObj,
                minHeight: '30px',
                minWidth: '50px',
                overflow: 'visible',
                position: 'relative',
                zIndex: 1
              }}
            >
              <MultiSignatureDisplay
                signatures={normalizedArray}
                onAddSignature={() => {}}
                readonly={true}
                maxWidth={Math.max(signatureMaxWidth, 80)}
                maxHeight={Math.max(signatureMaxHeight, 50)}
              />
            </div>
          );
        }
      }
    }
    
    // 🟢 最后检查：如果valStr或filledValue看起来像是base64图片数据，尝试渲染为图片
    // 这可以处理某些情况下数据存储在cellValue而不是formData的情况
    const valueToCheck = filledValue || valStr;
    if (valueToCheck && typeof valueToCheck === 'string' && valueToCheck.length > 100) {
      // 检查是否是base64字符串（通常以iVBORw0KGgo开头，或者包含data:image）
      const isBase64Image = valueToCheck.startsWith('iVBORw0KGgo') || 
                            valueToCheck.startsWith('data:image') ||
                            (valueToCheck.length > 500 && /^[A-Za-z0-9+/=]+$/.test(valueToCheck.replace(/\s/g, '')));
      
      if (isBase64Image) {
        // 尝试规范化base64数据
        let normalizedBase64 = valueToCheck;
        if (normalizedBase64.startsWith('data:image')) {
          normalizedBase64 = normalizedBase64.split(',')[1] || normalizedBase64;
        }
        
        // 调试日志
        if (process.env.NODE_ENV === 'development') {
          console.log('🔍 [ExcelRenderer] 在默认渲染前检测到base64图片数据（valStr或filledValue），尝试渲染:', {
            cellKey,
            inputKey,
            source: filledValue ? 'filledValue' : 'valStr',
            dataLength: normalizedBase64.length,
            preview: normalizedBase64.substring(0, 50)
          });
        }
        
        // 渲染为图片
        const cellSize = getCellSize(rIndex, cIndex);
        const signatureMaxWidth = Math.max(100, cellSize.width - 8);
        const signatureMaxHeight = Math.max(60, cellSize.height - 8);
        
        return (
          <div 
            className="w-full h-full flex items-center justify-center p-1" 
            style={{
              ...styleObj,
              minHeight: '30px',
              minWidth: '50px',
              overflow: 'visible',
              position: 'relative',
              zIndex: 1
            }}
          >
            <MultiSignatureDisplay
              signatures={[normalizedBase64]}
              onAddSignature={() => {}}
              readonly={mode === 'view'}
              maxWidth={Math.max(signatureMaxWidth, 80)}
              maxHeight={Math.max(signatureMaxHeight, 50)}
            />
          </div>
        );
      }
    }
    
    return <span className="text-slate-700 whitespace-pre-wrap break-all inline-block w-full" style={styleObj}>{valStr}</span>;
  };

  const getColWidth = (col: any) => {
    if (!col) return 100;
    // 优先使用 wpx (pixel 宽度)，然后尝试 wch (字符宽度)
    if (col.wpx !== undefined && col.wpx > 0) return col.wpx;
    if (col.wch !== undefined && col.wch > 0) return col.wch * 7.5;
    return 100; // 默认宽度
  };

  return (
    <>
      <style jsx global>{`
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type=number] {
          -moz-appearance: textfield;
        }
        /* 🟢 表格自适应宽度处理 */
        .excel-table {
          table-layout: fixed;
          border-collapse: collapse;
        }
        .excel-table td, .excel-table th {
          word-wrap: break-word;
          overflow-wrap: break-word;
          white-space: normal;
        }
      `}</style>

      {mode === 'design' && (
        <div className="flex items-center gap-4 mb-2 p-2 bg-slate-100 rounded border border-slate-300 sticky top-0 z-20 shadow-sm">
          <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><Type size={14}/> 样式工具栏</span>
          <button
            onClick={() => handleStyleUpdate({ bold: !currentSelectedStyle.bold })}
            className={`p-1.5 rounded transition ${currentSelectedStyle.bold ? 'bg-blue-200 text-blue-800 border border-blue-300' : 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-300'}`}
            title="加粗选中单元格"
          >
            <Bold size={16} />
          </button>
          <div className="flex items-center gap-2 border-l border-slate-300 pl-4">
            <span className="text-xs text-slate-600">字号:</span>
            <input
              type="number"
              className="w-16 p-1 text-sm border rounded text-center focus:ring-2 focus:ring-blue-500 outline-none"
              value={currentSelectedStyle.fontSize || 14}
              onChange={(e) => handleStyleUpdate({ fontSize: parseInt(e.target.value) || 14 })}
            />
            <span className="text-xs text-slate-400">px</span>
          </div>
          <div className="flex-1 text-right text-xs text-orange-600">
            {selectedCell ? `当前选中: 第 ${selectedCell.r + 1} 行, 第 ${selectedCell.c + 1} 列` : '请点击任意单元格进行编辑'}
          </div>
        </div>
      )}

      {mode === 'design' && parseEditMode && (
        <div className="mb-2 p-3 bg-blue-50 border border-blue-200 rounded shadow-sm sticky top-10 z-10 flex flex-col gap-2">
          <div className="text-xs font-bold text-blue-700">解析编辑模式</div>
          {selectedCell ? (
            <div className="grid grid-cols-1 md:grid-cols-5 gap-2 items-center text-xs">
              <div className="md:col-span-1 text-slate-700">
                位置: 第 {selectedCell.r + 1} 行, 第 {selectedCell.c + 1} 列
              </div>
              <input
                className="md:col-span-1 border rounded px-2 py-1 text-xs"
                placeholder="字段名"
                value={currentParsed?.fieldName || ''}
                onChange={(e) => {
                  const cellKey = `R${selectedCell.r + 1}C${selectedCell.c + 1}`;
                  upsertParsedField(cellKey, { fieldName: e.target.value, label: currentParsed?.label || e.target.value });
                }}
              />
              <select
                className="md:col-span-1 border rounded px-2 py-1 text-xs"
                value={currentParsed?.fieldType || 'text'}
                onChange={(e) => {
                  const cellKey = `R${selectedCell.r + 1}C${selectedCell.c + 1}`;
                  upsertParsedField(cellKey, { fieldType: e.target.value as ParsedField['fieldType'] });
                }}
              >
                <option value="text">文本</option>
                <option value="department">部门</option>
                <option value="date">日期</option>
                <option value="number">数字</option>
                <option value="personnel">人员</option>
                <option value="signature">签字</option>
                <option value="handwritten">手写签名</option>
                <option value="option">选项</option>
                <option value="section">🟣 Section(嵌套表单)</option>
                <option value="timenow">时间自动生成</option>
                <option value="other">其他</option>
              </select>
              <input
                className="md:col-span-1 border rounded px-2 py-1 text-xs"
                placeholder="提示"
                value={currentParsed?.hint || ''}
                onChange={(e) => {
                  const cellKey = `R${selectedCell.r + 1}C${selectedCell.c + 1}`;
                  upsertParsedField(cellKey, { hint: e.target.value });
                }}
              />
              <input
                className="md:col-span-1 border rounded px-2 py-1 text-xs"
                placeholder="编辑提示(可选)"
                value={currentParsed?.editableHint || ''}
                onChange={(e) => {
                  const cellKey = `R${selectedCell.r + 1}C${selectedCell.c + 1}`;
                  upsertParsedField(cellKey, { editableHint: e.target.value });
                }}
              />
              <div className="md:col-span-1 flex items-center gap-1">
                <button
                  onClick={() => {
                    const cellKey = `R${selectedCell.r + 1}C${selectedCell.c + 1}`;
                    upsertParsedField(cellKey, { required: !currentParsed?.required });
                  }}
                  className={`px-2 py-1 rounded text-xs font-medium shadow-sm transition ${
                    currentParsed?.required
                      ? 'bg-red-600 text-white'
                      : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                  }`}
                  title={currentParsed?.required ? '点击设为非必填' : '点击设为必填'}
                >
                  {currentParsed?.required ? '✓ 必填' : '非必填'}
                </button>
              </div>
              <div className="md:col-span-1 flex items-center gap-2 justify-end">
                <button
                  onClick={() => {
                    const cellKey = `R${selectedCell.r + 1}C${selectedCell.c + 1}`;
                    upsertParsedField(cellKey, { fieldName: currentParsed?.fieldName || '字段', fieldType: currentParsed?.fieldType || 'text' });
                  }}
                  className="px-3 py-1 bg-blue-600 text-white rounded text-xs shadow-sm"
                >
                  保存解析
                </button>
                {currentParsed && (
                  <button
                    onClick={() => {
                      const cellKey = `R${selectedCell.r + 1}C${selectedCell.c + 1}`;
                      removeParsedField(cellKey);
                    }}
                    className="px-3 py-1 bg-white border border-red-300 text-red-600 rounded text-xs"
                  >
                    清除
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-500">点击任意单元格以添加或编辑解析字段</div>
          )}
        </div>
      )}

      <div 
        className="border-none bg-white overflow-auto relative w-full"
      >
        {/* 🟢 作业单编号显示（右上角） */}
        {permitCode && (
          <div className="permit-code absolute top-0 right-0 px-2 py-1 text-[10px] text-slate-600 font-mono bg-white/80 print:text-[8px] print:bg-transparent print:text-black z-20 border-b border-l border-slate-200 print:border-none">
            编号: {permitCode}
          </div>
        )}
        <table
          className="excel-table border-collapse w-full"
        >
          <colgroup>
            {mode === 'design' && <col style={{ width: '40px' }} />}
            {colWidths.map((col, index) => (<col key={index} style={{ width: `${getColWidth(col)}px` }} />))}
          </colgroup>

          <thead>
            {mode === 'design' && (
              <tr className="bg-slate-100 border-b border-slate-300">
                <th className="p-0 border-r border-slate-300 bg-slate-200">
                  <span className="text-[9px] text-slate-500 block text-center">H \ W</span>
                </th>
                {colWidths.map((col, index) => (
                  <th key={index} className="p-0 border-r border-slate-300 bg-slate-50 relative group">
                    <input
                      type="number"
                      className="w-full h-full text-[10px] bg-transparent text-center focus:bg-white outline-none font-mono text-slate-600"
                      value={Math.round(getColWidth(col))}
                      onChange={(e) => handleColWidthChange(index, e.target.value)}
                    />
                  </th>
                ))}
              </tr>
            )}
          </thead>

          <tbody>
            {gridData.map((row: any[], rIndex: number) => {
              const h = getRowHeight(rIndex);
              // 🔴 检查该行是否为"动态可追加行"（只在设计模式显示红点）
              const isDynamicAddRow = mode === 'design' && (() => {
                const markers = (templateData as any)?.dynamicAddRowMarkers;
                if (!Array.isArray(markers)) return false;
                return markers.some((m: any) => typeof m?.baseRow1 === 'number' && m.baseRow1 === rIndex + 1);
              })();
              return (
                <tr key={rIndex} style={{ height: `${h}px` }}>
                  {mode === 'design' && (
                    <td className="border-r border-b border-slate-300 bg-slate-50 p-0 align-middle text-center relative">
                      {/* 🔴 红色小圆点：标记动态可追加行（仅设计模式） */}
                      {isDynamicAddRow && (
                        <div 
                          className="absolute left-0.5 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-red-500 animate-pulse"
                          title="动态可追加行（ADD 标记）"
                        />
                      )}
                      <input
                        type="number"
                        className="w-full h-full text-[10px] bg-transparent text-center focus:bg-white outline-none font-mono text-slate-600"
                        value={Math.round(h)}
                        onChange={(e) => handleRowHeightChange(rIndex, e.target.value)}
                      />
                    </td>
                  )}
                  {row.map((cellValue, cIndex) => {
                    const { rowSpan, colSpan, isCovered } = getCellSpan(rIndex, cIndex);
                    if (isCovered) return null;

                    const isTitle = colSpan > 1 || (rowSpan === 1 && colSpan === 1 && String(cellValue).trim().length > 0);
                    // 如果该行是流程行，且在设计模式下，高亮显示
                    const isWorkflowRow = workflowConfig && workflowConfig.some(w => w.rowIndex === rIndex);
                    const bgClass = (mode === 'design' && isWorkflowRow)
                      ? 'bg-orange-50'
                      : ((isTitle && !String(cellValue).match(/[£□]/)) ? '#f8fafc' : 'white');
                    
                    // 检查该单元格是否为必填字段（注意：parsedFields中的cellKey是R1C1格式，从1开始）
                    const cellKey = `R${rIndex + 1}C${cIndex + 1}`;
                    const fieldParsed = parsedFields?.find(f => f.cellKey === cellKey);
                    const isRequired = fieldParsed?.required === true;
                    
                    // 检查该单元格是否已填写内容
                    const inputKey = `${rIndex}-${cIndex}`;
                    const valStr = String(cellValue || "").trim();
                    
                    // 如果包含内联输入框（下划线），检查所有内联输入是否都有值
                    let cellFilled = false;
                    if (valStr.includes('____')) {
                      const parts = valStr.split(/(____+)/);
                      const inlineCount = parts.filter(p => /^____+$/.test(p)).length;
                      cellFilled = Array.from({ length: inlineCount }, (_, i) => {
                        const key = `${rIndex}-${cIndex}-inline-${i}`;
                        return inlineInputs[key] && String(inlineInputs[key]).trim() !== '';
                      }).every(Boolean);
                    } else {
                      // 普通输入框
                      cellFilled = formData[inputKey] && String(formData[inputKey]).trim() !== '';
                    }
                    
                    // 只有必填且未填写时才显示红色标识
                    const showRequiredStyle = isRequired && !cellFilled;

                    return (
                      <td
                        key={cIndex}
                        rowSpan={rowSpan}
                        colSpan={colSpan}
                        onClick={() => {
                          if (parseEditMode) setSelectedCell({ r: rIndex, c: cIndex });
                          if (onCellClick) onCellClick(rIndex, cIndex);
                        }}
                        className={`border align-middle relative overflow-hidden print:border-black break-all ${mode === 'design' ? 'p-0' : 'p-0.5'} ${isPickingCell ? 'cursor-pointer' : ''} ${
                          showRequiredStyle ? 'border-red-500 border-2' : 'border-slate-300'
                        }`}
                        style={{
                          textAlign: colSpan > 3 ? 'center' : 'left',
                          backgroundColor: showRequiredStyle ? '#fef2f2' : bgClass
                        }}
                      >
                        <div className="print:bg-white w-full h-full">
                          {renderCellContent(cellValue, rIndex, cIndex)}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <PeopleSelector
        isOpen={deptModalOpen}
        onClose={() => { setDeptModalOpen(false); setPendingDeptCell(null); }}
        mode="dept"
        onConfirm={(selection) => {
             if (Array.isArray(selection) && selection.length > 0) {
                 // @ts-ignore
                 handleDepartmentPick(selection[0].id, selection[0].name);
             }
        }}
        title="选择部门"
      />

      {/* 手写签名模态框 */}
      {signatureModalOpen && pendingSignatureCell && (() => {
        const cellKey = `R${pendingSignatureCell.r + 1}C${pendingSignatureCell.c + 1}`;
        const currentValue = formData[cellKey] || '';
        // 兼容旧数据：如果是字符串，转换为数组；如果是数组，直接使用
        const signatureArray = Array.isArray(currentValue) 
          ? currentValue 
          : (currentValue && typeof currentValue === 'string' && currentValue.length > 0 ? [currentValue] : []);
        
        return (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-slate-800">手写签名</h3>
                <button
                  onClick={() => {
                    setSignatureModalOpen(false);
                    setPendingSignatureCell(null);
                  }}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <HandwrittenSignature
                value={undefined} // 新签名，不传入已有值
                onChange={(base64) => {
                  if (pendingSignatureCell && base64) {
                    // 将新签名添加到数组中
                    const newArray = [...signatureArray, base64];
                    handleInputChange(pendingSignatureCell.r, pendingSignatureCell.c, newArray);
                  }
                }}
                onClose={() => {
                  setSignatureModalOpen(false);
                  setPendingSignatureCell(null);
                }}
                width={600}
                height={300}
              />
            </div>
          </div>
        );
      })()}
    </>
  );
}
