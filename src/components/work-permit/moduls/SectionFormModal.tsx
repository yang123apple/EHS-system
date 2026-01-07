import { useState, useEffect, useMemo, useRef } from 'react';
import { X, Save, FileText, Trash2 } from 'lucide-react';
import { Template, ParsedField } from '@/types/work-permit';
import ExcelRenderer from '../ExcelRenderer';
import { apiFetch } from '@/lib/apiClient';
import MobileFormRenderer from '../views/MobileFormRenderer';

interface SectionData {
  templateId: string;
  templateName: string;
  code: string;
  data: Record<string, any>;
  logs?: Array<any>;
  // 🟢 草稿阶段：桌面端动态记录用“行数”控制折叠行的展开，需随父表单一起暂存，二次打开不丢行
  desktopRowCount?: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  cellKey: string; // 例如 "R5C3"
  fieldName: string; // 字段名，用于生成编号
  boundTemplate: Template | null; // 绑定的二级模板
  parentCode: string; // 父表单编号
  parentPermitId?: string; // 🟢 父表单ID（用于追加式日志写入）
  parentFormData?: Record<string, any>; // 🔵 母单表单数据，用于Part字段继承
  parentParsedFields?: ParsedField[]; // 🔵 母单解析字段
  parentApprovalLogs?: any[]; // 🔵 母单审批日志（用于提取审核字段）
  parentWorkflowConfig?: any[]; // 🔵 母单流程配置（用于匹配步骤和单元格）
  existingData?: SectionData; // 已有的section数据（编辑模式）
  onSave: (data: SectionData) => void;
  readOnly?: boolean; // 只读模式
  appendOnly?: boolean; // 🟢 追加模式（审批后可追加“过程记录”，仅对动态记录模板生效）
  onAfterAppend?: () => void; // 🟢 追加成功后的回调（建议触发父页面刷新）
}

export default function SectionFormModal({
  isOpen,
  onClose,
  cellKey,
  fieldName,
  boundTemplate,
  parentCode,
  parentPermitId,
  parentFormData = {},
  parentParsedFields = [],
  parentApprovalLogs = [],
  parentWorkflowConfig = [],
  existingData,
  onSave,
  readOnly = false,
  appendOnly = false,
  onAfterAppend
}: Props) {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  // 使用 ref 跟踪是否已经初始化过，避免无限循环
  const initializedRef = useRef<string | null>(null);
  const [appendDraft, setAppendDraft] = useState<Record<string, any>>({});
  const [isAppending, setIsAppending] = useState(false);
  const [sectionLogs, setSectionLogs] = useState<any[]>([]);
  const [showAppendCard, setShowAppendCard] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [desktopRowCount, setDesktopRowCount] = useState(1);
  const excelHostRef = useRef<HTMLDivElement | null>(null);
  const [rowPlusTop, setRowPlusTop] = useState<number | null>(null);
  const [rowPlusLeft, setRowPlusLeft] = useState<number | null>(null);
  const [recordRowIndexForPlus, setRecordRowIndexForPlus] = useState<number | null>(null);
  const paperRef = useRef<HTMLDivElement | null>(null);
  const modalScrollRef = useRef<HTMLDivElement | null>(null);
  const [trashButtons, setTrashButtons] = useState<Array<{ rowOffset: number; top: number; left: number }>>([]);
  // 🟢 动态扩展的 parsedFields（新增行时会复制模板行的字段类型）
  const [extendedParsedFields, setExtendedParsedFields] = useState<ParsedField[]>([]);

  const formatZh = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('zh-CN', { hour12: false });
  };

  // 🟢 端判断（仅用于渲染策略：桌面=按行追加；移动端=瀑布流）
  useEffect(() => {
    const update = () => {
      // 🟢 优先用 UA 判断（避免桌面端窗口缩小被误判为移动端，导致悬浮球/桌面逻辑消失）
      const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
      const uaMobile = /Mobi|Android|iPhone|iPad|iPod|Mobile/i.test(ua);
      const smallScreen = window.innerWidth < 768;
      setIsMobile(uaMobile || smallScreen);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // 生成二级编号：父编号-字段名简写
  const sectionCode = useMemo(() => {
    if (existingData?.code) return existingData.code;
    // 简化字段名作为后缀（取前几个字符或拼音首字母）
    const suffix = fieldName.substring(0, 3).toUpperCase();
    return `${parentCode}-${suffix}`;
  }, [parentCode, fieldName, existingData]);

  // 解析模板数据
  const templateData = useMemo(() => {
    if (!boundTemplate?.structureJson) return null;
    try {
      return JSON.parse(boundTemplate.structureJson);
    } catch (e) {
      console.error('Failed to parse template structure:', e);
      return null;
    }
  }, [boundTemplate?.structureJson]);

  const isDynamicTemplate = !!(boundTemplate as any)?.isDynamicLog;
  const isSecondaryTemplate = String((boundTemplate as any)?.level || '') === 'secondary';
  const isDynamicSecondary = isDynamicTemplate && isSecondaryTemplate;
  const dynamicAddRowMarker = useMemo(() => {
    const markers = (templateData as any)?.dynamicAddRowMarkers;
    if (Array.isArray(markers) && markers.length > 0) return markers[0];
    return null;
  }, [templateData]);
  const repeatBaseRow0 = useMemo(() => {
    const r1 = (dynamicAddRowMarker as any)?.baseRow1;
    return typeof r1 === 'number' && Number.isFinite(r1) ? Math.max(0, r1 - 1) : null;
  }, [dynamicAddRowMarker]);

  // ✅ 动态记录二级模板：移动端瀑布流 / 桌面端按行追加
  // 说明：悬浮球/追加能力显示不应因为“标记尚未写回/模板缓存未刷新”而消失，所以这里不强依赖 repeatBaseRow0。
  const showDynamicWaterfall = isDynamicSecondary && isMobile;
  const showDynamicRowsDesktop = isDynamicSecondary && !isMobile;

  // 🟢 记录行定位（更稳）：优先从 grid 中找“序号”所在列的下一行
  const detectRecordRowFromGrid = (grid: any[][] | null) => {
    if (!grid || !Array.isArray(grid)) return null;
    for (let r = 0; r < grid.length; r++) {
      const row = grid[r];
      if (!Array.isArray(row)) continue;
      for (let c = 0; c < row.length; c++) {
        const v = row[c];
        if (v !== null && v !== undefined && String(v).trim() === '序号') {
          return r + 1 < grid.length ? r + 1 : r;
        }
      }
    }
    return null;
  };

  // 🟢 显示用：折叠相邻重复行（仅动态记录二级模板）
  const displayTemplateData = useMemo(() => {
    if (!templateData) return templateData;
    // 折叠相邻重复行（动态记录二级模板）
    if (!isDynamicSecondary) return templateData;
    try {
      const src = JSON.parse(JSON.stringify(templateData));
      const originalGrid: any[][] = Array.isArray(src?.grid) ? src.grid : (Array.isArray(src?.data) ? src.data : null);
      if (!originalGrid || !Array.isArray(originalGrid)) return templateData;
      const merges = src?.merges || src?.sheets?.[0]?.merges || [];
      const mergeRows = new Set<number>();
      if (Array.isArray(merges)) {
        merges.forEach((m: any) => {
          const sr = m?.s?.r ?? m?.r;
          const sc = m?.s?.c ?? m?.c;
          const er = m?.e?.r ?? (typeof m?.rs === 'number' ? sr + m.rs - 1 : (typeof m?.rowspan === 'number' ? sr + m.rowspan - 1 : sr));
          const ec = m?.e?.c ?? (typeof m?.cs === 'number' ? sc + m.cs - 1 : (typeof m?.colspan === 'number' ? sc + m.colspan - 1 : sc));
          if (typeof sr === 'number' && typeof er === 'number') {
            for (let rr = sr; rr <= er; rr++) mergeRows.add(rr);
          }
        });
      }
      const maxCols = originalGrid.reduce((m: number, r: any[]) => Math.max(m, Array.isArray(r) ? r.length : 0), 0);
      const normalize = (row: any[]) => {
        const parts: string[] = [];
        for (let c = 0; c < maxCols; c++) {
          const v = row?.[c];
          const s = (v === null || v === undefined || String(v).trim() === '') ? '' : String(v).trim();
          const normalized = /[£□☑✓✔]/.test(s) ? '[OPT]' : s;
          parts.push(normalized);
        }
        return parts.join('\u001F');
      };
      const folded: any[][] = [];
      let prevSig = '';
      let prevRowIndex = -1;
      for (let r = 0; r < originalGrid.length; r++) {
        const row = Array.isArray(originalGrid[r]) ? originalGrid[r] : [];
        const sig = normalize(row);
        if (r > 0 && sig === prevSig && !mergeRows.has(r) && !mergeRows.has(prevRowIndex)) {
          continue;
        }
        folded.push(row);
        prevSig = sig;
        prevRowIndex = r;
      }
      if (Array.isArray(src.grid)) src.grid = folded;
      if (Array.isArray(src.data)) src.data = folded;
      // 🟢 桌面端：在折叠后的“记录行”基础上按行数扩展（用于 + 增加的行）
      if (showDynamicRowsDesktop) {
        const workingGrid: any[][] = Array.isArray(src?.grid) ? src.grid : (Array.isArray(src?.data) ? src.data : null);
        if (!workingGrid || !Array.isArray(workingGrid)) return src;
        // 🟢 动态记录：优先基于 {ADD=R?} 的 baseRow 做扩展；若没有标记则回退到“序号”下一行
        const recordRowIndex = (typeof repeatBaseRow0 === 'number')
          ? repeatBaseRow0
          : (detectRecordRowFromGrid(workingGrid) ?? null);
        if (typeof recordRowIndex === 'number' && workingGrid[recordRowIndex]) {
          const count = Math.max(1, desktopRowCount);
          const head = workingGrid.slice(0, recordRowIndex + 1);
          const tail = workingGrid.slice(recordRowIndex + 1);
          const recordRow = workingGrid[recordRowIndex];
          const copies = Array.from({ length: count - 1 }, () => JSON.parse(JSON.stringify(recordRow)));
          const expanded = [...head, ...copies, ...tail];
          if (Array.isArray(src.grid)) src.grid = expanded;
          if (Array.isArray(src.data)) src.data = expanded;

          // 🟢 同步 rowHeights（rows）长度，保证新增行的样式/高度一致
          const rowsArr = src?.rows || src?.sheets?.[0]?.rows;
          if (Array.isArray(rowsArr) && rowsArr[recordRowIndex]) {
            const rowMeta = rowsArr[recordRowIndex];
            const headRows = rowsArr.slice(0, recordRowIndex + 1);
            const tailRows = rowsArr.slice(recordRowIndex + 1);
            const rowCopies = Array.from({ length: count - 1 }, () => ({ ...rowMeta }));
            const expandedRows = [...headRows, ...rowCopies, ...tailRows];
            if (Array.isArray(src.rows)) src.rows = expandedRows;
            if (src?.sheets?.[0] && Array.isArray(src.sheets[0].rows)) src.sheets[0].rows = expandedRows;
          }
        }
      }
      return src;
    } catch {
      return templateData;
    }
  }, [templateData, isDynamicSecondary, showDynamicRowsDesktop, desktopRowCount, repeatBaseRow0]);

  // 解析字段配置
  const baseParsedFields = useMemo(() => {
    if (!boundTemplate?.parsedFields) return [];
    try {
      const fields = JSON.parse(boundTemplate.parsedFields);
      return Array.isArray(fields) ? fields : [];
    } catch (e) {
      return [];
    }
  }, [boundTemplate?.parsedFields]);

  // 🟢 实际使用的 parsedFields：优先用扩展后的，没有则用基础的
  const parsedFields = useMemo(() => {
    return extendedParsedFields.length > 0 ? extendedParsedFields : baseParsedFields;
  }, [extendedParsedFields, baseParsedFields]);

  // 🟢 追加模式：选出“可追加行字段”（优先使用 {ADD=R?} 指定的 baseRow）
  const appendFields = useMemo(() => {
    if (!isDynamicSecondary) return [];
    const fields = (parsedFields || []).filter((f: any) => f && f.cellKey && f.fieldType !== 'section');
    if (typeof repeatBaseRow0 === 'number') {
      return fields.filter((f: any) => typeof f.rowIndex === 'number' && f.rowIndex === repeatBaseRow0);
    }
    // fallback：取最靠上的那一行
    const rows = fields
      .map((f: any) => {
        const m = String(f.cellKey).match(/^R(\d+)C(\d+)$/i);
        return m ? parseInt(m[1], 10) : null;
      })
      .filter((n: any) => typeof n === 'number' && Number.isFinite(n)) as number[];
    if (rows.length === 0) return fields;
    const minRow = Math.min(...rows);
    return fields.filter((f: any) => {
      const m = String(f.cellKey).match(/^R(\d+)C(\d+)$/i);
      return m ? parseInt(m[1], 10) === minRow : true;
    });
  }, [isDynamicSecondary, parsedFields, repeatBaseRow0]);

  const recordBaseRow0 = useMemo(() => {
    if (typeof repeatBaseRow0 === 'number') return repeatBaseRow0;
    const f0 = appendFields[0];
    return typeof f0?.rowIndex === 'number' ? f0.rowIndex : null;
  }, [appendFields]);

  const serialCol0 = useMemo(() => {
    const f = appendFields.find((x: any) => x?.fieldType === 'serial');
    return typeof f?.colIndex === 'number' ? f.colIndex : null;
  }, [appendFields]);

  // 🟢 同步记录行索引（用于“+按钮”贴到正确行）
  useEffect(() => {
    if (!showDynamicRowsDesktop) {
      setRecordRowIndexForPlus(null);
      return;
    }
    // 🟢 “增加一行”按钮应绑定到被标记的 baseRow（例如 {ADD=R5} -> R5）
    setRecordRowIndexForPlus(typeof repeatBaseRow0 === 'number' ? repeatBaseRow0 : recordBaseRow0);
  }, [showDynamicRowsDesktop, repeatBaseRow0, recordBaseRow0]);

  const buildDraftPayload = () => {
    const data: Record<string, any> = {};
    appendFields.forEach((f: any) => {
      if (!f?.cellKey) return;
      // timenow 由系统写入；serial 改为手动填写，不再跳过
      if (f.fieldType === 'timenow') return;
      const v = appendDraft[f.cellKey];
      data[f.cellKey] = v;
    });
    return data;
  };

  const updateSnapshotRowFromEntry = (idx: number, entry: any) => {
    if (!entry) return;
    // 🟢 只填充“模板记录行”的那一行（保持 Excel 表格中只看到一行）
    const next: Record<string, any> = { ...(formData || {}) };
    appendFields.forEach((f: any) => {
      const r0 = typeof f.rowIndex === 'number' ? f.rowIndex : undefined;
      const c0 = typeof f.colIndex === 'number' ? f.colIndex : undefined;
      if (r0 === undefined || c0 === undefined) return;
      const key = `${r0}-${c0}`;
      if (f.fieldType === 'timenow') next[key] = entry.timestamp ? formatZh(entry.timestamp) : '';
      else next[key] = entry?.data?.[f.cellKey] ?? '';
    });
    setFormData(next);
  };

  const recalcDesktopGridFromLogs = (logs: any[]) => {
    // 将 logs 映射到多行（从记录行开始向下）
    if (appendFields.length === 0) return;
    const baseRow0 = recordBaseRow0;
    if (typeof baseRow0 !== 'number') return;
    const next: Record<string, any> = { ...(formData || {}) };
    // 清理动态区：清理 200 行窗口（够用）
    const clearRows = 200;
    const cols = new Set<number>(appendFields.map((f: any) => f.colIndex).filter((n: any) => typeof n === 'number'));
    Object.keys(next).forEach(k => {
      const m = k.match(/^(\d+)-(\d+)$/);
      if (!m) return;
      const r0 = parseInt(m[1], 10);
      const c0 = parseInt(m[2], 10);
      if (r0 >= baseRow0 && r0 < baseRow0 + clearRows && cols.has(c0)) delete next[k];
    });

    const rowCount = Math.max(1, logs.length);
    for (let i = 0; i < rowCount; i++) {
      const entry = logs[i];
      appendFields.forEach((f: any) => {
        if (typeof f.rowIndex !== 'number' || typeof f.colIndex !== 'number') return;
        const key = `${baseRow0 + i}-${f.colIndex}`;
        if (f.fieldType === 'timenow') next[key] = entry?.timestamp ? formatZh(entry.timestamp) : '';
        else next[key] = entry?.data?.[f.cellKey] ?? '';
      });
    }
    setFormData(next);
  };

  const ensureSerialVisibleForDraft = (rows: number) => {
    if (!showDynamicRowsDesktop) return;
    if (appendOnly) return;
    // serial 改为手动填写：不再自动补齐 1..n
    return;
  };

  const addDesktopBlankRow = () => {
    if (recordBaseRow0 === null || baseParsedFields.length === 0) {
      setDesktopRowCount(prev => prev + 1);
      return;
    }

    const templateRowFields = baseParsedFields.filter(
      (f: any) => typeof f.rowIndex === 'number' && f.rowIndex === recordBaseRow0
    );
    
    if (templateRowFields.length === 0) {
      setDesktopRowCount(prev => prev + 1);
      return;
    }

    // 🟢 同步更新：先计算好所有更新，再一起 setState，避免时序问题
    setDesktopRowCount(prev => {
      const nextCount = prev + 1;
      const newRowIndex = recordBaseRow0 + (nextCount - 1);
      
      // 1️⃣ 生成新行的字段定义
      const newRowFields = templateRowFields.map((f: any) => ({
        ...f,
        cellKey: `R${newRowIndex + 1}C${f.colIndex + 1}`,
        rowIndex: newRowIndex,
        _pos: { r1: newRowIndex + 1, c1: f.colIndex + 1 }
      }));
      
      // 2️⃣ 更新扩展字段（同步执行）
      setExtendedParsedFields(prevFields => {
        const filtered = prevFields.filter((pf: any) => 
          !(typeof pf.rowIndex === 'number' && pf.rowIndex === newRowIndex)
        );
        return [...filtered, ...newRowFields];
      });

      // 3️⃣ 为新行的特殊字段类型自动填充值（同步执行）
      setFormData(prevData => {
        const next: Record<string, any> = { ...prevData };
        const now = new Date().toISOString();
        
        templateRowFields.forEach((f: any) => {
          if (typeof f.colIndex !== 'number') return;
          const key = `${newRowIndex}-${f.colIndex}`;
          
          // timenow 字段：自动填充当前时间
          if (f.fieldType === 'timenow') {
            next[key] = formatZh(now);
          }
          // 其他字段类型保持为空，由用户填写
        });
        
        return next;
      });
      
      return nextCount;
    });
  };

  // 🗑️ 草稿阶段：删除某一条“新增的记录行”（只影响动态记录区，并把下方行整体上移）
  const deleteDesktopRowAtOffset = (rowOffset: number) => {
    if (appendOnly) return; // 审批后不允许删除历史
    if (!showDynamicRowsDesktop) return;
    if (desktopRowCount <= 1) return;
    if (rowOffset <= 0) return; // 仅允许删除用户新增行（从第2行起）
    if (recordBaseRow0 === null) return;

    const ok = confirm('确认删除这一行新增内容？删除后无法恢复。');
    if (!ok) return;

    const baseRow0 = recordBaseRow0;
    const cols = new Set<number>(
      (appendFields || [])
        .map((f: any) => f?.colIndex)
        .filter((n: any) => typeof n === 'number' && Number.isFinite(n)) as number[]
    );

    // 目标：删除 baseRow0 + rowOffset 这行；把其后的行整体上移；最后一行清理；行数 -1
    setFormData(prev => {
      const next: Record<string, any> = { ...(prev || {}) };
      const lastOffset = desktopRowCount - 1;
      for (let i = rowOffset; i < lastOffset; i++) {
        const fromR = baseRow0 + i + 1;
        const toR = baseRow0 + i;
        cols.forEach(c0 => {
          const fromKey = `${fromR}-${c0}`;
          const toKey = `${toR}-${c0}`;
          next[toKey] = next[fromKey] ?? '';
        });
      }
      const lastR = baseRow0 + lastOffset;
      cols.forEach(c0 => {
        const k = `${lastR}-${c0}`;
        delete next[k];
      });

      // serial 改为手动填写：不再重排/重写序号
      return next;
    });

    // 🟢 同步更新 extendedParsedFields：删除目标行，后续行上移
    setExtendedParsedFields(prev => {
      const deletedRowIndex = baseRow0 + rowOffset;
      const lastRowIndex = baseRow0 + (desktopRowCount - 1);
      
      return prev
        .filter((f: any) => f.rowIndex !== deletedRowIndex) // 移除被删除行的字段
        .map((f: any) => {
          // 后续行上移
          if (typeof f.rowIndex === 'number' && f.rowIndex > deletedRowIndex && f.rowIndex <= lastRowIndex) {
            const newRowIndex = f.rowIndex - 1;
            return {
              ...f,
              rowIndex: newRowIndex,
              cellKey: `R${newRowIndex + 1}C${f.colIndex + 1}`,
              _pos: { r1: newRowIndex + 1, c1: f.colIndex + 1 }
            };
          }
          return f;
        });
    });

    setDesktopRowCount(prev => Math.max(1, prev - 1));
  };

  // 🟢 桌面端：把“+增加一行”按钮贴到记录行右侧（跟随滚动）
  useEffect(() => {
    if (!showDynamicRowsDesktop) {
      setRowPlusTop(null);
      setRowPlusLeft(null);
      setTrashButtons([]);
      return;
    }
    const host = excelHostRef.current;
    if (!host) return;

    const table = host.querySelector('table.excel-table') as HTMLTableElement | null;
    const scrollWrap = table?.parentElement as HTMLElement | null;
    if (!table || !scrollWrap) return;

    const recordRowIndex = typeof recordRowIndexForPlus === 'number' ? recordRowIndexForPlus : null;
    if (recordRowIndex === null) return;

    const updatePos = () => {
      const rows = table.querySelectorAll('tbody > tr');
      const tr = rows.item(recordRowIndex) as HTMLElement | null;
      if (!tr) {
        setRowPlusTop(null);
        setRowPlusLeft(null);
        setTrashButtons([]);
        return;
      }
      const trRect = tr.getBoundingClientRect();
      const paperRect = paperRef.current?.getBoundingClientRect();
      const left = paperRect ? Math.min(window.innerWidth - 12, paperRect.right + 12) : Math.min(window.innerWidth - 12, trRect.right + 12);
      const top = trRect.top + trRect.height / 2;
      setRowPlusLeft(left);
      setRowPlusTop(top);

      // 🗑️ 仅草稿：为“新增行（offset>=1）”计算垃圾桶位置
      if (!appendOnly && !readOnly && desktopRowCount > 1) {
        const btns: Array<{ rowOffset: number; top: number; left: number }> = [];
        for (let off = 1; off < desktopRowCount; off++) {
          const targetTr = rows.item(recordRowIndex + off) as HTMLElement | null;
          if (!targetTr) continue;
          const r = targetTr.getBoundingClientRect();
          btns.push({ rowOffset: off, top: r.top + r.height / 2, left });
        }
        setTrashButtons(btns);
      } else {
        setTrashButtons([]);
      }
    };

    updatePos();
    // 🟢 兼容首次渲染 table 尚未完全挂载/尺寸尚未稳定
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(() => updatePos());
    }
    setTimeout(() => updatePos(), 50);
    const onScroll = () => updatePos();
    scrollWrap.addEventListener('scroll', onScroll, { passive: true } as any);
    const outer = modalScrollRef.current;
    outer?.addEventListener('scroll', onScroll as any, { passive: true } as any);
    window.addEventListener('resize', updatePos);
    return () => {
      scrollWrap.removeEventListener('scroll', onScroll as any);
      outer?.removeEventListener('scroll', onScroll as any);
      window.removeEventListener('resize', updatePos);
    };
  }, [showDynamicRowsDesktop, recordRowIndexForPlus, desktopRowCount, isOpen]);

  // 🟢 子模板移动端配置（用于移动端子表单“页面化”渲染）
  const mobileConfig = useMemo(() => {
    if (!boundTemplate) return null;
    let cfg: any = null;
    try {
      if ((boundTemplate as any)?.mobileFormConfig) {
        const parsed = JSON.parse((boundTemplate as any).mobileFormConfig);
        cfg = parsed?.enabled && parsed?.groups ? parsed : parsed;
      }
    } catch {}
    if (cfg && cfg.groups) {
      // 确保 fields 带 id，MobileFormRenderer 以 id 为 key
      if (!cfg.fields || cfg.fields.length === 0) {
        cfg.fields = (parsedFields || []).filter((f: any) => f?.cellKey).map((f: any) => ({ ...f, id: f.cellKey }));
      } else {
        cfg.fields = cfg.fields.map((f: any) => ({ ...f, id: f.id || f.cellKey || f.fieldKey }));
      }
      return cfg;
    }
    // 自动生成（按 group 分组）
    const sorted = [...(parsedFields || [])].sort((a: any, b: any) => (a.rowIndex - b.rowIndex) || (a.colIndex - b.colIndex));
    const groups = new Map<string, any[]>();
    sorted.forEach((f: any) => {
      if (!f?.cellKey) return;
      if (f.fieldType === 'section') return;
      const g = f.group || '基础信息';
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g)!.push({ ...f, id: f.cellKey });
    });
    return {
      title: boundTemplate.name,
      groups: Array.from(groups.entries()).map(([title, list]) => ({
        title,
        fieldKeys: list.map((x: any) => x.cellKey),
      })),
      fields: sorted.filter((f: any) => f?.cellKey).map((f: any) => ({ ...f, id: f.cellKey })),
    };
  }, [boundTemplate?.id, (boundTemplate as any)?.mobileFormConfig, boundTemplate?.name, JSON.stringify(parsedFields || [])]);

  const parsedFieldByCellKey = useMemo(() => {
    const m = new Map<string, any>();
    (parsedFields || []).forEach((f: any) => { if (f?.cellKey) m.set(f.cellKey, f); });
    return m;
  }, [JSON.stringify(parsedFields || [])]);

  const mobileFormData = useMemo(() => {
    // 将内部 `${r}-${c}` 数据映射为 cellKey -> value，供 MobileFormRenderer 使用
    const out: Record<string, any> = {};
    (parsedFields || []).forEach((f: any) => {
      if (!f?.cellKey) return;
      if (typeof f.rowIndex !== 'number' || typeof f.colIndex !== 'number') return;
      const key = `${f.rowIndex}-${f.colIndex}`;
      out[f.cellKey] = formData?.[key] ?? '';
    });
    return out;
  }, [JSON.stringify(parsedFields || []), JSON.stringify(formData || {})]);

  const handleMobileFieldChange = (cellKey: string, value: any) => {
    const f = parsedFieldByCellKey.get(cellKey);
    if (!f || typeof f.rowIndex !== 'number' || typeof f.colIndex !== 'number') return;
    const key = `${f.rowIndex}-${f.colIndex}`;
    setFormData(prev => ({ ...(prev || {}), [key]: value }));
  };

  // 🔵 解析Part配置（二级模板的workflowConfig）
  const workflowParts = useMemo(() => {
    if (!boundTemplate?.workflowConfig) return [];
    try {
      const config = JSON.parse(boundTemplate.workflowConfig);
      return Array.isArray(config) ? config : [];
    } catch (e) {
      console.error('Failed to parse workflow parts:', e);
      return [];
    }
  }, [boundTemplate?.workflowConfig]);

  // 🔵 Part字段继承：从母单数据或审批日志中提取字段值
  const inheritedData = useMemo(() => {
    const inherited: Record<string, any> = {};
    
    if (workflowParts.length === 0) {
      return inherited;
    }

    console.log('🔵 Part字段继承开始:', {
      workflowParts,
      parentParsedFields,
      parentFormData,
      parentApprovalLogs,
      parentWorkflowConfig
    });

    // 遍历每个Part配置
    workflowParts.forEach((part: any) => {
      if (part.pickStrategy === 'field_match' && part.pickConfig?.fieldName && part.outputCell) {
        const targetFieldName = part.pickConfig.fieldName;
        
        // 在母单解析字段中查找匹配的字段
        const matchedField = parentParsedFields.find(
          (field) => field.label === targetFieldName || field.fieldName === targetFieldName
        );

        if (matchedField) {
          const cellKey = matchedField.cellKey; // 例如 "R30C4"
          const [r, c] = cellKey.substring(1).split('C').map(n => parseInt(n) - 1);
          const inputKey = `${r}-${c}`;
          let value = parentFormData[inputKey];

          // 🟢 如果formData中没有值，尝试从审批日志中提取（针对workflow审核字段）
          if (!value && parentApprovalLogs.length > 0 && parentWorkflowConfig.length > 0) {
            console.log('🔍 尝试从审批日志提取:', {
              cellKey,
              r: r + 1,
              parentWorkflowConfig,
              parentApprovalLogs
            });

            // 查找该单元格对应的workflow步骤
            const workflowStep = parentWorkflowConfig.find(
              (step: any) => {
                console.log('🔍 检查workflow步骤:', {
                  step,
                  cellKey,
                  r,
                  matchCellKey: step.cellKey === cellKey,
                  matchRowIndex: step.rowIndex === r
                });
                return step.cellKey === cellKey || step.rowIndex === r;
              }
            );

            console.log('🔍 找到workflow步骤:', workflowStep);

            if (workflowStep) {
              // 在审批日志中查找该步骤的签核记录
              const approvalLog = parentApprovalLogs.find(
                (log: any) => {
                  console.log('🔍 检查审批日志:', {
                    log,
                    matchStep: log.step === workflowStep.step,
                    matchStepIndex: log.stepIndex === workflowStep.step
                  });
                  return log.step === workflowStep.step || log.stepIndex === workflowStep.step;
                }
              );

              console.log('🔍 找到审批日志:', approvalLog);

              if (approvalLog) {
                // 拼接审核信息：意见 + 人名 + 日期
                const parts = [];
                if (approvalLog.opinion) parts.push(approvalLog.opinion);
                // 优先使用approver，其次operatorName，最后userName
                const name = approvalLog.approver || approvalLog.operatorName || approvalLog.userName;
                if (name) parts.push(name);
                if (approvalLog.timestamp) {
                  const date = new Date(approvalLog.timestamp);
                  parts.push(date.toLocaleDateString('zh-CN'));
                }
                value = parts.join(' ');

                console.log('✅ 从审批日志提取字段值:', {
                  part: part.name,
                  fieldName: targetFieldName,
                  cellKey,
                  workflowStep: workflowStep.name,
                  approvalLog,
                  extractedParts: parts,
                  value
                });
              }
            }
          }

          if (value) {
            // 计算子单outputCell的inputKey
            const [outR, outC] = part.outputCell.substring(1).split('C').map((n: string) => parseInt(n) - 1);
            const outputKey = `${outR}-${outC}`;
            inherited[outputKey] = value;

            console.log('✅ Part字段继承成功:', {
              part: part.name,
              fieldName: targetFieldName,
              fromCell: cellKey,
              toCell: part.outputCell,
              value
            });
          } else {
            console.warn('⚠️ Part字段值为空:', {
              part: part.name,
              fieldName: targetFieldName,
              cellKey,
              inputKey,
              formDataValue: parentFormData[inputKey],
              hasApprovalLogs: parentApprovalLogs.length > 0,
              hasWorkflowConfig: parentWorkflowConfig.length > 0,
              noWorkflowStepFound: '未找到对应的workflow步骤'
            });
          }
        } else {
          console.warn('⚠️ Part字段未找到:', {
            part: part.name,
            targetFieldName,
            availableFields: parentParsedFields.map(f => ({ label: f.label, fieldName: f.fieldName }))
          });
        }
      }
    });

    return inherited;
  }, [parentFormData, parentParsedFields, parentApprovalLogs, parentWorkflowConfig, workflowParts]);

  // 初始化表单数据（合并继承数据）
  useEffect(() => {
    if (isOpen) {
      // 生成一个唯一标识，用于判断是否需要重新初始化
      const dataKey = existingData?.code || 'new';
      const existingDataStr = JSON.stringify(existingData?.data || {});
      const inheritedDataStr = JSON.stringify(inheritedData);
      const currentKey = `${dataKey}-${existingDataStr}-${inheritedDataStr}`;
      
      // 如果已经初始化过相同的数据，跳过
      if (initializedRef.current === currentKey) {
        return;
      }
      
      console.log('🔵 子表单打开，检查 existingData:', existingData);
      console.log('🔵 existingData?.data:', existingData?.data);
      console.log('🔵 inheritedData:', inheritedData);
      
      if (existingData?.data && Object.keys(existingData.data).length > 0) {
        // 编辑模式：合并已有数据和继承数据（继承数据优先级更低）
        // 注意：已有数据的优先级更高，覆盖继承数据
        const mergedData = { ...inheritedData, ...existingData.data };
        console.log('🔵 子单合并数据:', { 
          inheritedData, 
          existingData: existingData.data, 
          mergedData,
          mergedDataKeys: Object.keys(mergedData),
          mergedDataSample: Object.keys(mergedData).slice(0, 5).reduce((acc, key) => {
            acc[key] = mergedData[key];
            return acc;
          }, {} as Record<string, any>)
        });
        // 强制更新，确保数据正确加载
        setFormData(mergedData);
        initializedRef.current = currentKey;
      } else {
        // 新建时使用继承的数据
        console.log('🔵 子单初始化数据 - inheritedData:', inheritedData);
        // 强制更新，确保数据正确加载
        setFormData(inheritedData);
        initializedRef.current = currentKey;
      }

      // 🟢 初始化 logs（动态记录：草稿也允许本地追加）
      const initLogs = Array.isArray((existingData as any)?.logs) ? (existingData as any).logs : [];
      setSectionLogs(initLogs);
      setShowAppendCard(false);
      setAppendDraft({});
      const persistedRowCount = (existingData as any)?.desktopRowCount;
      const initRowCount =
        typeof persistedRowCount === 'number' && Number.isFinite(persistedRowCount)
          ? Math.max(1, persistedRowCount)
          : Math.max(1, initLogs.length || 1);
      setDesktopRowCount(initRowCount);
      
      // 🟢 初始化 extendedParsedFields：根据恢复的行数，复制模板行的字段类型到新行
      if (showDynamicRowsDesktop && recordBaseRow0 !== null && baseParsedFields.length > 0 && initRowCount > 1) {
        const templateRowFields = baseParsedFields.filter(
          (f: any) => typeof f.rowIndex === 'number' && f.rowIndex === recordBaseRow0
        );
        
        if (templateRowFields.length > 0) {
          const newFields: ParsedField[] = [];
          for (let i = 1; i < initRowCount; i++) {
            const newRowIndex = recordBaseRow0 + i;
            templateRowFields.forEach((f: any) => {
              newFields.push({
                ...f,
                cellKey: `R${newRowIndex + 1}C${f.colIndex + 1}`,
                rowIndex: newRowIndex,
                _pos: { r1: newRowIndex + 1, c1: f.colIndex + 1 }
              });
            });
          }
          setExtendedParsedFields(newFields);
        }
      }
      
      // 草稿阶段：首个序号也应可见（1..n）
      if (showDynamicRowsDesktop) {
        if (appendOnly) {
          // 审批后：用 logs 映射为多行
          recalcDesktopGridFromLogs(initLogs);
        } else {
          // 草稿：按当前行数补齐缺失的序号（不覆盖用户已填内容）
          ensureSerialVisibleForDraft(initRowCount);
        }
      }
      
      // 🟢 V3.4 初始化纸张方向
      if (boundTemplate?.orientation) {
        setOrientation(boundTemplate.orientation as 'portrait' | 'landscape');
      }
    } else {
      // 关闭时清空表单数据和初始化标记，确保下次打开时能正确加载
      setFormData({});
      initializedRef.current = null;
      setSectionLogs([]);
      setShowAppendCard(false);
      setAppendDraft({});
      setDesktopRowCount(1);
      setExtendedParsedFields([]);
    }
  }, [isOpen, existingData?.code, JSON.stringify(existingData?.data || {}), JSON.stringify(inheritedData), boundTemplate?.orientation, showDynamicRowsDesktop]);

  const handleSave = () => {
    if (!boundTemplate) return;
    
    // 验证必填字段
    const requiredFields = parsedFields.filter(f => f.required);
    const missingFields: string[] = [];
    
    for (const field of requiredFields) {
      const value = formData[`${parseInt(field.cellKey.substring(1).split('C')[0]) - 1}-${parseInt(field.cellKey.split('C')[1]) - 1}`];
      if (!value || String(value).trim() === '') {
        missingFields.push(field.label || field.fieldName);
      }
    }

    if (missingFields.length > 0) {
      alert(`请填写以下必填项：\n${missingFields.join('\n')}`);
      return;
    }

    // 保存数据
    const sectionData: SectionData = {
      templateId: boundTemplate.id,
      templateName: boundTemplate.name,
      code: sectionCode,
      data: formData,
      ...(showDynamicWaterfall ? { logs: sectionLogs } : {}),
      ...(showDynamicRowsDesktop ? { desktopRowCount } : {})
    };

    onSave(sectionData);
    onClose();
  };

  const handleLocalAdd = () => {
    const data = buildDraftPayload();
    const entry = {
      id: `local_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      timestamp: new Date().toISOString(),
      data,
    };
    const nextLogs = [...sectionLogs, entry];
    setSectionLogs(nextLogs);
    // 桌面端：追加后以“多行”方式显示；移动端：瀑布流展示
    if (showDynamicRowsDesktop) {
      setDesktopRowCount(Math.max(1, nextLogs.length));
      // 草稿期不强制把表格改成 logs 映射（避免覆盖用户直接在表格里输入的内容）
      // 此处仅用于审批后（appendOnly）以 logs 展示多行
      if (appendOnly) recalcDesktopGridFromLogs(nextLogs);
    } else {
      updateSnapshotRowFromEntry(nextLogs.length - 1, entry);
    }
    setAppendDraft({});
    setShowAppendCard(false);
  };

  const handleAppend = async () => {
    if (!appendOnly) return;
    if (!parentPermitId) {
      alert('缺少父表单ID，无法追加记录');
      return;
    }
    if (!boundTemplate?.id) return;

    // 校验必填（timenow/serial 由系统写入，不要求用户填写）
    const required = appendFields.filter((f: any) => f?.required && f.fieldType !== 'timenow' && f.fieldType !== 'serial');
    const missing: string[] = [];
    for (const f of required) {
      const v = appendDraft[f.cellKey];
      if (v === undefined || v === null || String(v).trim() === '') {
        missing.push(f.label || f.fieldName || f.cellKey);
      }
    }
    if (missing.length > 0) {
      alert(`请填写以下必填项：\n${missing.join('\n')}`);
      return;
    }

    const data = buildDraftPayload();

    setIsAppending(true);
    try {
      const res = await apiFetch('/api/permits/sections/append', {
        method: 'POST',
        body: JSON.stringify({ recordId: parentPermitId, cellKey, data }),
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json?.error || '追加失败');
        return;
      }

      // 更新本地展示（无需关闭弹窗）
      if (json?.section?.data && typeof json.section.data === 'object') {
        setFormData(json.section.data);
      }
      if (Array.isArray(json?.section?.logs)) {
        setSectionLogs(json.section.logs);
        setDesktopRowCount(Math.max(1, json.section.logs.length));
      }
      setAppendDraft({});
      setShowAppendCard(false);
      onAfterAppend?.();
    } catch (e) {
      console.error('Append failed', e);
      alert('追加失败');
    } finally {
      setIsAppending(false);
    }
  };

  if (!isOpen) return null;
  
  if (!boundTemplate) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
        <div className="bg-white rounded-lg p-6 max-w-md shadow-xl">
          <h3 className="text-lg font-bold text-red-600 mb-4">⚠️ 错误</h3>
          <p className="text-slate-600 mb-4">无法加载二级模板数据。</p>
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-slate-600 text-white rounded hover:bg-slate-700"
          >
            关闭
          </button>
        </div>
      </div>
    );
  }

  // ✅ 移动端：子表单渲染为移动端页面（不显示 A4 Excel）
  if (isMobile) {
    // 🟢 动态记录（移动端）：将“不重复区(表头)”与“重复记录行”拆开，避免新增时重复填写导致数据不一致
    const repeatCellKeys = new Set<string>(appendFields.map((f: any) => f?.cellKey).filter(Boolean));
    const headerFields = (parsedFields || []).filter((f: any) => f?.cellKey && typeof f.rowIndex === 'number' && typeof recordBaseRow0 === 'number' && f.rowIndex < recordBaseRow0);
    const repeatFields = appendFields;

    const filterMobileConfigByCellKeys = (cfg: any, keys: Set<string>) => {
      if (!cfg || !cfg.groups) return cfg;
      const filteredFields = (cfg.fields || []).filter((f: any) => keys.has(f.id || f.cellKey || f.fieldKey));
      const filteredGroups = cfg.groups
        .map((g: any) => ({
          ...g,
          fieldKeys: (g.fieldKeys || []).filter((k: string) => keys.has(k)),
        }))
        .filter((g: any) => (g.fieldKeys || []).length > 0);
      return { ...cfg, fields: filteredFields, groups: filteredGroups };
    };

    const headerKeys = new Set<string>(headerFields.map((f: any) => f.cellKey).filter(Boolean));
    let headerConfig = mobileConfig ? filterMobileConfigByCellKeys(mobileConfig, headerKeys) : null;
    let repeatConfig = mobileConfig ? filterMobileConfigByCellKeys(mobileConfig, repeatCellKeys) : null;

    // 🟢 兜底：如果 mobileConfig 不存在或过滤后分组为空，自动生成临时配置
    if (!headerConfig || !headerConfig.groups || headerConfig.groups.length === 0) {
      if (headerFields.length > 0) {
        headerConfig = {
          title: '基本信息',
          groups: [{ title: '基本信息', fieldKeys: headerFields.map((f: any) => f.cellKey) }],
          fields: headerFields.map((f: any) => ({ ...f, id: f.cellKey })),
        };
      }
    }
    if (!repeatConfig || !repeatConfig.groups || repeatConfig.groups.length === 0) {
      if (repeatFields.length > 0) {
        repeatConfig = {
          title: '记录行',
          groups: [{ title: '记录信息', fieldKeys: repeatFields.map((f: any) => f.cellKey) }],
          fields: repeatFields.map((f: any) => ({ ...f, id: f.cellKey })),
        };
      }
    }

    console.log('🔍 [SectionFormModal Mobile] 动态记录配置拆分:', {
      recordBaseRow0,
      headerFieldsCount: headerFields.length,
      repeatFieldsCount: repeatFields.length,
      headerKeys: Array.from(headerKeys),
      repeatCellKeys: Array.from(repeatCellKeys),
      headerConfigGroups: headerConfig?.groups?.length,
      repeatConfigGroups: repeatConfig?.groups?.length,
      mobileConfigExists: !!mobileConfig,
      parsedFieldsCount: parsedFields?.length,
      headerConfigFields: headerConfig?.fields?.length,
      repeatConfigFields: repeatConfig?.fields?.length,
    });

    // 默认至少展示一段记录（第1段），而不是先看到"新增一段记录"
    const shouldShowDefaultFirstRecord = showDynamicWaterfall && sectionLogs.length === 0;

    return (
      <div className="fixed inset-0 bg-white z-50 flex flex-col">
        <div className="px-4 py-3 border-b flex items-center justify-between bg-white sticky top-0">
          <div className="flex items-center gap-2">
            <FileText className="text-purple-600" size={20} />
            <div>
              <div className="font-bold text-slate-900">{boundTemplate.name}</div>
              <div className="text-xs text-slate-500">编号 {sectionCode}</div>
            </div>
          </div>
          <button onClick={onClose} className="px-3 py-1.5 rounded border text-slate-700">关闭</button>
        </div>

        <div className="flex-1 overflow-auto bg-slate-100/50">
          {/* 移动端：动态记录用瀑布流；非动态记录直接用移动端表单 */}
          {showDynamicWaterfall ? (
            <div className="p-4 space-y-2">
              {/* 表头/不重复区：只填一次（与桌面一致），不会在新增记录时重复出现 */}
              {headerFields.length > 0 && headerConfig?.groups?.length > 0 && (
                <div className="bg-white rounded-xl border overflow-hidden">
                  <div className="px-4 py-3 border-b bg-white">
                    <div className="font-bold text-slate-800">基本信息</div>
                    <div className="text-xs text-slate-500">以下内容只填写一次</div>
                  </div>
                  <MobileFormRenderer
                    config={headerConfig}
                    parsedFields={headerConfig?.fields}
                    formData={mobileFormData}
                    mode={appendOnly || readOnly ? 'readonly' : 'edit'}
                    onDataChange={(k, v) => handleMobileFieldChange(k, v)}
                  />
                </div>
              )}

              {sectionLogs.map((entry, idx) => {
                const ts = entry?.timestamp ? formatZh(entry.timestamp) : '';
                const data = { ...(entry?.data || {}) };
                // 填充 timenow 的显示值（serial 改为手动填写，不再自动注入）
                (repeatConfig?.fields || []).forEach((f: any) => {
                  if (!f?.id) return;
                  if (f.fieldType === 'timenow') data[f.id] = ts;
                });
                return (
                  <div key={entry?.id || idx} className="bg-white rounded-xl border overflow-hidden">
                    <div className="px-4 py-3 border-b bg-white flex items-center justify-between">
                      <div className="font-bold text-slate-800">记录 #{idx + 1}</div>
                      <div className="text-xs text-slate-500">{ts || '时间自动生成'}</div>
                    </div>
                    <MobileFormRenderer
                      config={repeatConfig}
                      parsedFields={repeatConfig?.fields}
                      formData={data}
                      mode="readonly"
                    />
                  </div>
                );
              })}

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                {(!showAppendCard && !shouldShowDefaultFirstRecord) ? (
                  <button
                    type="button"
                    onClick={() => setShowAppendCard(true)}
                    className="w-full min-h-[120px] flex items-center justify-center gap-2 text-amber-800 font-bold hover:bg-amber-100 rounded-lg transition"
                  >
                    <span className="text-2xl">＋</span> 新增一段记录
                  </button>
                ) : (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-bold text-amber-800">记录 #{sectionLogs.length + 1}</div>
                      {!shouldShowDefaultFirstRecord && (
                        <button type="button" onClick={() => { setShowAppendCard(false); setAppendDraft({}); }} className="text-xs text-slate-600">取消</button>
                      )}
                    </div>
                    <MobileFormRenderer
                      config={repeatConfig}
                      parsedFields={repeatConfig?.fields}
                      formData={{
                        ...appendDraft,
                      }}
                      mode="edit"
                      onDataChange={(k, v) => setAppendDraft(prev => ({ ...prev, [k]: v }))}
                    />
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={appendOnly ? handleAppend : handleLocalAdd}
                        disabled={isAppending}
                        className={`w-full px-4 py-2 rounded font-bold ${
                          isAppending ? 'bg-slate-300 text-slate-600 cursor-not-allowed' : 'bg-amber-600 text-white hover:bg-amber-700'
                        }`}
                      >
                        {isAppending ? '提交中...' : '提交新增'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-4">
              <MobileFormRenderer
                config={mobileConfig}
                parsedFields={mobileConfig?.fields}
                title={mobileConfig?.title || boundTemplate.name}
                code={sectionCode}
                formData={mobileFormData}
                mode={readOnly ? 'readonly' : 'edit'}
                onDataChange={readOnly ? undefined : handleMobileFieldChange}
              />
              {!readOnly && (
                <div className="p-4">
                  <button
                    type="button"
                    onClick={handleSave}
                    className="w-full bg-green-600 text-white px-4 py-3 rounded-lg font-bold"
                  >
                    保存
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl w-full max-w-6xl h-[95vh] flex flex-col shadow-2xl">
        {/* 头部 */}
        <div className="p-4 border-b bg-gradient-to-r from-purple-50 to-blue-50">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <FileText className="text-purple-600" size={24} />
              <div>
                <h3 className="font-bold text-lg">{boundTemplate.name}</h3>
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <span>二级表单编号: <span className="font-mono font-bold text-purple-700">{sectionCode}</span></span>
                  <span className="text-slate-400">|</span>
                  <span>关联单元格: {cellKey}</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setOrientation(o => o === 'portrait' ? 'landscape' : 'portrait')}
                className="p-2 rounded border transition flex items-center justify-center bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                title={orientation === 'portrait' ? '切换为横向' : '切换为竖向'}
              >
                {orientation === 'portrait' ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="7" y="2" width="10" height="20" rx="1" />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="7" width="20" height="10" rx="1" />
                  </svg>
                )}
              </button>
              {!readOnly && (
                <button
                  onClick={handleSave}
                  className="bg-green-600 text-white px-4 py-2 rounded shadow hover:bg-green-700 flex items-center gap-2"
                >
                  <Save size={16} /> 保存
                </button>
              )}
              {appendOnly && (
                <button
                  onClick={handleAppend}
                  disabled={isAppending}
                  className={`px-4 py-2 rounded shadow flex items-center gap-2 ${
                    isAppending ? 'bg-slate-300 text-slate-600 cursor-not-allowed' : 'bg-amber-600 text-white hover:bg-amber-700'
                  }`}
                  title="仅追加新记录，不修改既有行"
                >
                  <Save size={16} /> {isAppending ? '追加中...' : '追加记录'}
                </button>
              )}
              <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded text-slate-500">
                <X size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* 表单内容区域 */}
        <div ref={modalScrollRef} className="flex-1 overflow-auto p-8 bg-slate-100">
          <div 
            ref={paperRef}
            className="mx-auto bg-white shadow-lg p-8 relative"
            style={{
              width: orientation === 'portrait' ? '210mm' : '297mm',
              minHeight: orientation === 'portrait' ? '297mm' : '210mm',
              maxWidth: '100%',
            }}
          >
            <div ref={excelHostRef} className="relative">
              {templateData && (
                <ExcelRenderer
                // 🟢 ExcelRenderer 内部对 templateData 采用惰性初始化，为了让"+增加一行"立刻生效，
                // 在桌面动态记录模式下把 key 绑定到 desktopRowCount 和 extendedParsedFields，确保字段定义同步更新。
                key={`${boundTemplate?.id}-${isOpen ? 'open' : 'closed'}-${existingData?.code || 'new'}-${showDynamicRowsDesktop ? `${desktopRowCount}-${extendedParsedFields.length}` : 'static'}`}
                templateData={displayTemplateData || templateData}
                initialData={formData}
                parsedFields={parsedFields}
                permitCode={sectionCode}
                orientation={orientation}
                mode={readOnly ? "view" : "edit"}
                onDataChange={readOnly ? undefined : setFormData}
                onParsedFieldsChange={(fields) => {
                  // 🟢 允许 ExcelRenderer 在设计模式下更新字段定义
                  // 在动态记录模式下，我们主要通过 extendedParsedFields 管理新增行的字段
                  if (extendedParsedFields.length === 0) {
                    // 仅在未手动扩展时，接受来自 ExcelRenderer 的更新
                    setExtendedParsedFields(fields);
                  }
                }}
                />
              )}
            </div>

            {/* ✅ 移动端：动态记录瀑布流（使用子模板移动端样式） */}
            {showDynamicWaterfall && (() => {
              // 生成/读取子模板移动端配置
              let cfg: any = null;
              try {
                if ((boundTemplate as any)?.mobileFormConfig) {
                  const parsed = JSON.parse((boundTemplate as any).mobileFormConfig);
                  cfg = parsed?.enabled ? parsed : parsed; // 兼容无 enabled 字段
                }
              } catch {}
              if (!cfg || !cfg.groups) {
                // 自动按 group 分组
                const sorted = [...(parsedFields || [])].sort((a: any, b: any) => (a.rowIndex - b.rowIndex) || (a.colIndex - b.colIndex));
                const groups = new Map<string, any[]>();
                sorted.forEach((f: any) => {
                  if (!f?.cellKey) return;
                  if (f.fieldType === 'section') return;
                  const g = f.group || '基础信息';
                  if (!groups.has(g)) groups.set(g, []);
                  groups.get(g)!.push({ ...f, id: f.cellKey });
                });
                cfg = {
                  title: boundTemplate.name,
                  groups: Array.from(groups.entries()).map(([title, list]) => ({
                    title,
                    fieldKeys: list.map((x: any) => x.cellKey),
                  })),
                  fields: sorted.filter((f: any) => f?.cellKey).map((f: any) => ({ ...f, id: f.cellKey })),
                };
              } else {
                // 确保 fields 带 id=cellKey，便于 MobileFormRenderer 用 cellKey 做 key
                if (!cfg.fields || cfg.fields.length === 0) {
                  cfg.fields = (parsedFields || []).filter((f: any) => f?.cellKey).map((f: any) => ({ ...f, id: f.cellKey }));
                } else {
                  cfg.fields = cfg.fields.map((f: any) => ({ ...f, id: f.id || f.cellKey || f.fieldKey }));
                }
              }

              return (
                <div className="mt-6 border-t pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm font-bold text-amber-700">动态记录（瀑布流）</div>
                    <div className="text-xs text-slate-500">每条记录是一段表单；点击“+”新增一段</div>
                  </div>

                  <div className="space-y-4">
                    {sectionLogs.map((entry, idx) => (
                      <div key={entry?.id || idx} className="bg-white border rounded-xl overflow-hidden shadow-sm">
                        <div className="px-4 py-3 border-b bg-slate-50 flex items-center justify-between">
                          <div className="font-bold text-slate-800 text-sm">记录 #{idx + 1}</div>
                          <div className="text-xs text-slate-500">{entry?.timestamp ? formatZh(entry.timestamp) : '时间自动生成'}</div>
                        </div>
                        <MobileFormRenderer
                          config={cfg}
                          parsedFields={cfg.fields}
                          formData={{ ...(entry?.data || {}) }}
                          mode="readonly"
                        />
                      </div>
                    ))}

                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 shadow-sm">
                      {!showAppendCard ? (
                        <button
                          type="button"
                          onClick={() => setShowAppendCard(true)}
                          className="w-full min-h-[120px] flex items-center justify-center gap-2 text-amber-800 font-bold hover:bg-amber-100 rounded-lg transition"
                        >
                          <span className="text-2xl">＋</span> 新增一段记录
                        </button>
                      ) : (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-sm font-bold text-amber-800">新增记录</div>
                            <button type="button" onClick={() => { setShowAppendCard(false); setAppendDraft({}); }} className="text-xs text-slate-600">取消</button>
                          </div>
                          <MobileFormRenderer
                            config={cfg}
                            parsedFields={cfg.fields}
                            formData={{ ...appendDraft }}
                            mode="edit"
                            onDataChange={(k, v) => setAppendDraft(prev => ({ ...prev, [k]: v }))}
                          />
                          <div className="mt-3 flex gap-2">
                            <button
                              type="button"
                              onClick={appendOnly ? handleAppend : handleLocalAdd}
                              disabled={isAppending}
                              className={`flex-1 px-4 py-2 rounded font-bold ${
                                isAppending ? 'bg-slate-300 text-slate-600 cursor-not-allowed' : 'bg-amber-600 text-white hover:bg-amber-700'
                              }`}
                            >
                              {isAppending ? '提交中...' : '提交新增'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* ✅ 桌面端审批后：追加一行输入面板（仅追加，不改历史） */}
            {showDynamicRowsDesktop && appendOnly && showAppendCard && (
              <div className="mt-4 border rounded-xl bg-amber-50 border-amber-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="font-bold text-amber-800">新增一行记录</div>
                  <button
                    type="button"
                    onClick={() => { setShowAppendCard(false); setAppendDraft({}); }}
                    className="text-xs text-slate-600 hover:text-slate-900"
                  >
                    取消
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {appendFields.map((f: any) => {
                    const label = f.label || f.fieldName || f.cellKey;
                    const value = appendDraft[f.cellKey] ?? '';
                    const disabled = isAppending || f.fieldType === 'timenow';
                    const commonClass = 'w-full border rounded px-3 py-2 text-sm outline-none focus:border-amber-400 transition bg-white';
                    return (
                      <div key={`desktop-append-${f.cellKey}`} className="space-y-1">
                        <label className="text-xs font-medium text-amber-900">
                          {label}{f.required ? <span className="text-red-500"> *</span> : null}
                        </label>
                        {f.fieldType === 'option' && Array.isArray(f.options) ? (
                          <select
                            className={commonClass}
                            value={value}
                            disabled={disabled}
                            onChange={(e) => setAppendDraft(prev => ({ ...prev, [f.cellKey]: e.target.value }))}
                          >
                            <option value="">请选择</option>
                            {f.options.map((opt: string) => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            className={`${commonClass} ${disabled ? 'bg-slate-100 text-slate-500' : ''}`}
                            type={f.fieldType === 'number' ? 'number' : (f.fieldType === 'date' ? 'datetime-local' : 'text')}
                            value={f.fieldType === 'timenow' ? '' : value}
                            placeholder={f.fieldType === 'timenow' ? '将由系统自动写入时间' : (f.hint || (f.fieldType === 'serial' ? '请输入序号' : '请输入'))}
                            disabled={disabled}
                            onChange={(e) => setAppendDraft(prev => ({ ...prev, [f.cellKey]: e.target.value }))}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={handleAppend}
                    disabled={isAppending}
                    className={`flex-1 px-4 py-2 rounded font-bold ${
                      isAppending ? 'bg-slate-300 text-slate-600 cursor-not-allowed' : 'bg-amber-600 text-white hover:bg-amber-700'
                    }`}
                  >
                    {isAppending ? '提交中...' : '提交新增'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 底部提示 */}
        <div className="p-3 border-t bg-slate-50 text-xs text-slate-600 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold text-purple-600">提示:</span>
            <span>此表单为 <strong>{boundTemplate.name}</strong> 的附属表单</span>
          </div>
          <div className="text-slate-500">
            必填字段标记为 <span className="text-red-500 font-bold">*</span>
          </div>
        </div>
      </div>

      {/* 🟢 桌面端：把“+增加一行”悬浮球放到 A4 白纸外（灰底区域），并对齐到 {ADD=R?} 标记行 */}
      {showDynamicRowsDesktop && rowPlusTop !== null && rowPlusLeft !== null && !readOnly && (
        <button
          type="button"
          onClick={() => {
            if (!appendOnly) {
              addDesktopBlankRow();
            } else {
              setShowAppendCard(true);
            }
          }}
          className="fixed z-[60] w-10 h-10 rounded-full bg-amber-600 text-white text-xl font-bold shadow-lg hover:bg-amber-700 active:scale-95 transition"
          style={{ top: rowPlusTop, left: rowPlusLeft, transform: 'translateY(-50%)' }}
          title={appendOnly ? '审批后：新增一行并提交追加' : '草稿：新增一行'}
        >
          +
        </button>
      )}

      {/* 🗑️ 草稿阶段：给用户新增的行提供“删除该行”入口（不影响模板基础行） */}
      {showDynamicRowsDesktop && !appendOnly && !readOnly && trashButtons.length > 0 && (
        <>
          {trashButtons.map(b => (
            <button
              key={`trash-${b.rowOffset}`}
              type="button"
              onClick={() => deleteDesktopRowAtOffset(b.rowOffset)}
              className="fixed z-[60] w-9 h-9 rounded-full bg-white border border-red-200 text-red-600 shadow hover:bg-red-50 active:scale-95 transition flex items-center justify-center"
              style={{ top: b.top, left: b.left, transform: 'translateY(-50%)' }}
              title={`删除第 ${b.rowOffset + 1} 行`}
            >
              <Trash2 size={18} />
            </button>
          ))}
        </>
      )}
    </div>
  );
}
