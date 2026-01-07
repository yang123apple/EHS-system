import { useState, useEffect, useMemo } from 'react';
import { Save, X, ShieldCheck, Link2, Smartphone, RefreshCcw } from 'lucide-react';
import { Template, ParsedField } from '@/types/work-permit';
import { TemplateService } from '@/services/workPermitService';
import ExcelRenderer from '../ExcelRenderer';
import TemplateBindingModal from './TemplateBindingModal';
import MobileFormEditor, { MobileFormConfig } from './MobileFormEditor';
import { apiFetch } from '@/lib/apiClient';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  template: Template;
  onSuccess: () => void;
  allTemplates?: Template[]; // 🟢 V3.4 所有模板列表（用于选择二级模板）
}

export default function EditTemplateModal({ isOpen, onClose, template, onSuccess, allTemplates }: Props) {
  const [name, setName] = useState('');
  const [type, setType] = useState('');
  const [templateData, setTemplateData] = useState<any>(null);
  const [parsedFields, setParsedFields] = useState<ParsedField[]>([]);
  const [parseEditMode, setParseEditMode] = useState(false);
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  
  // 🟢 新增水印状态
  const [watermark, setWatermark] = useState({ 
    text: '仅供内部审批', 
    enabled: true,
    includeUser: false,
    includeTime: false
  });
  
  // 🟢 V3.4 模板级别和section绑定
  const [level, setLevel] = useState<'primary' | 'secondary'>('primary');
  const [sectionBindings, setSectionBindings] = useState<Record<string, string>>({});
  // 🟢 动态记录模板（用于气体检测等“作业过程日志”）
  const [isDynamicLog, setIsDynamicLog] = useState(false);
  const [bindingModalOpen, setBindingModalOpen] = useState(false);
  const [bindingCellKey, setBindingCellKey] = useState<string>('');
  
  // 🟢 移动端表单配置
  const [mobileFormConfig, setMobileFormConfig] = useState<MobileFormConfig | undefined>(undefined);
  const [mobileFormEditorOpen, setMobileFormEditorOpen] = useState(false);
  const [isReparsing, setIsReparsing] = useState(false);
  
  // 🟢 显示用：折叠重复空白行（仅当为二级模板且动态记录启用）
  const displayTemplateData = useMemo(() => {
    if (!templateData) return templateData;
    const dyn = (template as any)?.isDynamicLog;
    const isSecondary = (template.level as any) === 'secondary';
    if (!dyn || !isSecondary) return templateData;
    try {
      const src = JSON.parse(JSON.stringify(templateData));
      const grid: any[][] = Array.isArray(src?.grid) ? src.grid : (Array.isArray(src?.data) ? src.data : null);
      if (!grid || !Array.isArray(grid)) return templateData;
      // 避免折叠涉及合并单元格的行（行号变化会破坏 merge 坐标）
      const mergeRows = new Set<number>();
      const merges = src?.merges || src?.sheets?.[0]?.merges || [];
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
      const maxCols = grid.reduce((m: number, r: any[]) => Math.max(m, Array.isArray(r) ? r.length : 0), 0);
      const normalize = (row: any[]) => {
        const parts: string[] = [];
        for (let c = 0; c < maxCols; c++) {
          const v = row?.[c];
          const s = (v === null || v === undefined || String(v).trim() === '') ? '' : String(v).trim();
          // 将是否/选项类标记标准化为占位，避免因为不同符号导致无法合并
          const normalized = /[£□☑✓✔]/.test(s) ? '[OPT]' : s;
          parts.push(normalized);
        }
        return parts.join('\u001F');
      };
      const folded: any[][] = [];
      let prevSig = '';
      let prevRowIndex = -1;
      for (let r = 0; r < grid.length; r++) {
        const row = Array.isArray(grid[r]) ? grid[r] : [];
        const sig = normalize(row);
        if (r > 0 && sig === prevSig && !mergeRows.has(r) && !mergeRows.has(prevRowIndex)) {
          // 折叠：跳过与上一行完全相同的重复行（动态记录模板常见的预留多行记录区）
          continue;
        }
        folded.push(row);
        prevSig = sig;
        prevRowIndex = r;
      }
      if (Array.isArray(src.grid)) src.grid = folded;
      if (Array.isArray(src.data)) src.data = folded;
      return src;
    } catch {
      return templateData;
    }
  }, [templateData, (template as any)?.isDynamicLog, template.level]);

  useEffect(() => {
    if (isOpen && template) {
      setName(template.name);
      setType(template.type);

      try {
        const parsed = JSON.parse(template.structureJson);
        setTemplateData(parsed);
      } catch (e) {
        console.error('Failed to parse structureJson', e);
        setTemplateData({});
      }

      // 🟢 加载解析的字段信息
      if (template.parsedFields) {
        try {
          const fields = JSON.parse(template.parsedFields);
          setParsedFields(Array.isArray(fields) ? fields : []);
        } catch (e) {
          console.error('Failed to parse parsedFields', e);
          setParsedFields([]);
        }
      } else {
        setParsedFields([]);
      }

      // 🟢 从 template.watermarkSettings 初始化（优先使用）
      if (template.watermarkSettings) {
        setWatermark({
          text: template.watermarkSettings.text || '仅供内部审批',
          enabled: !!template.watermarkSettings.enabled,
          includeUser: !!template.watermarkSettings.includeUser,
          includeTime: !!template.watermarkSettings.includeTime
        });
      } else {
        setWatermark({ 
          text: '仅供内部审批', 
          enabled: true,
          includeUser: false,
          includeTime: false
        });
      }
      
      // 🟢 V3.4 初始化级别和绑定
      setLevel((template.level as 'primary' | 'secondary') || 'primary');
      if (template.sectionBindings) {
        try {
          setSectionBindings(JSON.parse(template.sectionBindings));
        } catch (e) {
          setSectionBindings({});
        }
      } else {
        setSectionBindings({});
      }
      // 🟢 初始化动态记录开关
      setIsDynamicLog(!!(template as any).isDynamicLog);
      
      // 🟢 V3.4 初始化纸张方向
      setOrientation((template.orientation as 'portrait' | 'landscape') || 'portrait');
      
      // 🟢 初始化移动端表单配置
      if (template.mobileFormConfig) {
        try {
          setMobileFormConfig(JSON.parse(template.mobileFormConfig as string));
        } catch (e) {
          setMobileFormConfig(undefined);
        }
      } else {
        setMobileFormConfig(undefined);
      }
    } else if (!isOpen) {
      // 🔴 关闭时清理状态，避免下次打开时闪现旧数据
      setTemplateData(null);
      setParsedFields([]);
      setSectionBindings({});
      setMobileFormConfig(undefined);
    }
  }, [isOpen, template?.id]); // 使用template.id确保模板切换时重新初始化

  // 🟢 V3.4 处理section绑定
  const handleBindTemplate = (cellKey: string) => {
    setBindingCellKey(cellKey);
    setBindingModalOpen(true);
  };

  const handleBindConfirm = (templateId: string) => {
    if (templateId) {
      setSectionBindings(prev => ({ ...prev, [bindingCellKey]: templateId }));
    } else {
      // 解除绑定
      setSectionBindings(prev => {
        const newBindings = { ...prev };
        delete newBindings[bindingCellKey];
        return newBindings;
      });
    }
  };

  const handleSave = async () => {
    try {
      await TemplateService.update(template.id, {
        name,
        type,
        structureJson: JSON.stringify(templateData),
        parsedFields: JSON.stringify(parsedFields),
        // 🟢 直接保存 watermarkSettings 字段（与类型定义对齐）
        watermarkSettings: watermark,
        // 🟢 V3.4 保存级别和绑定
        level,
        sectionBindings: JSON.stringify(sectionBindings),
        // 🟢 V3.4 保存纸张方向
        orientation,
        // 🟢 动态记录开关：仅对二级模板有业务意义，但后端会统一存储
        isDynamicLog,
        // 🟢 保存移动端表单配置
        mobileFormConfig: mobileFormConfig ? JSON.stringify(mobileFormConfig) : undefined
      });

      alert('修改已保存');
      onSuccess();
      onClose();
    } catch (e) {
      console.error('Save failed', e);
      alert('保存失败');
    }
  };

  const handleReparseTemplate = async () => {
    if (!template?.id) return;
    setIsReparsing(true);
    try {
      const res = await apiFetch(`/api/templates/${template.id}/parse`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || '重新解析失败');
      }
      if (json?.structureJson) {
        try {
          setTemplateData(JSON.parse(json.structureJson));
        } catch (e) {
          console.error('Failed to parse returned structureJson', e);
        }
      }
      if (Array.isArray(json?.fields)) {
        setParsedFields(json.fields);
      }
      alert('重新解析完成（已写回可追加行标记）');
    } catch (e) {
      console.error('Reparse failed', e);
      alert('重新解析失败');
    } finally {
      setIsReparsing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl w-full max-w-6xl h-[95vh] flex flex-col shadow-2xl">
        
        {/* 🎨 第一行：标题栏 - 白底，强调标题和主要操作 */}
        <div className="px-6 py-4 border-b border-slate-200 bg-white rounded-t-xl flex justify-between items-center">
          <div className="flex items-center gap-3 min-w-0">
            <h2 className="text-xl font-bold text-slate-800 whitespace-nowrap">编辑模板</h2>
            <input
              className="h-9 border border-slate-300 rounded-lg px-3 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="模板名称"
            />
            <input
              className="h-9 border border-slate-300 rounded-lg px-3 text-sm w-28 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              value={type}
              onChange={(e) => setType(e.target.value)}
              placeholder="类型"
            />
          </div>
          
          {/* 主要操作按钮组 */}
          <div className="flex items-center gap-3">
            {/* 🟢 动态记录二级模板：一键写回“可追加行标记”（dynamicAddRowMarkers） */}
            {level === 'secondary' && isDynamicLog && (
              <button
                onClick={handleReparseTemplate}
                disabled={isReparsing}
                className={`h-9 px-4 rounded-lg border shadow-sm hover:shadow transition-all flex items-center gap-2 font-medium ${
                  isReparsing
                    ? 'bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed'
                    : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                }`}
                title="重新解析模板：折叠重复行并写入可追加行标记（用于填写时显示“+增加一行”）"
              >
                <RefreshCcw size={16} />
                {isReparsing ? '解析中…' : '重新解析模板'}
              </button>
            )}
            <button
              onClick={handleSave}
              className="h-9 px-5 bg-green-600 hover:bg-green-700 text-white rounded-lg shadow-sm hover:shadow transition-all flex items-center gap-2 font-medium"
            >
              <Save size={16} /> 保存
            </button>
            <button 
              onClick={onClose} 
              className="h-9 w-9 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-700 transition-colors flex items-center justify-center"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* 🎨 第二行：工具栏 - 浅灰背景，包含所有配置项 */}
        <div className="px-6 py-3 bg-slate-50/80 border-b border-slate-200">
          <div className="flex items-center gap-4">
            {/* 左侧：模板级别 + 动态记录 */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <select
                className="h-9 border border-slate-300 rounded-lg px-3 text-sm w-28 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
                value={level}
                onChange={(e) => setLevel(e.target.value as 'primary' | 'secondary')}
              >
                <option value="primary">一级模板</option>
                <option value="secondary">二级模板</option>
              </select>

              <label
                className={`h-9 flex items-center gap-2 text-sm cursor-pointer select-none px-3 rounded-lg border transition-all ${
                  level === 'secondary'
                    ? 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100'
                    : 'bg-white border-slate-300 text-slate-400 cursor-not-allowed'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isDynamicLog}
                  onChange={(e) => setIsDynamicLog(e.target.checked)}
                  disabled={level !== 'secondary'}
                  className="rounded text-amber-600 focus:ring-amber-500"
                />
                动态记录
              </label>
            </div>

            {/* 中间：防伪水印（与工具按钮同一行） */}
            <div className="flex-1 min-w-0">
              <div className="h-9 bg-white border border-slate-200 rounded-lg px-3 flex items-center gap-3 shadow-sm min-w-0">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 flex-shrink-0">
                  <ShieldCheck size={18} className="text-blue-600" />
                  防伪水印
                </div>

                <label className="flex items-center gap-2 text-sm cursor-pointer select-none flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={watermark.enabled}
                    onChange={(e) => setWatermark({ ...watermark, enabled: e.target.checked })}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                  />
                  <span className="text-slate-600">启用</span>
                </label>

                <input
                  className="h-8 border border-slate-300 rounded-md px-2 text-sm w-52 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all disabled:bg-slate-100 disabled:text-slate-500 min-w-0"
                  value={watermark.text}
                  onChange={(e) => setWatermark({ ...watermark, text: e.target.value })}
                  placeholder="水印文字"
                  disabled={!watermark.enabled}
                />

                <div className={`flex items-center gap-3 flex-shrink-0 ${watermark.enabled ? '' : 'opacity-50 pointer-events-none'}`}>
                  <label className="flex items-center gap-2 text-sm cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={watermark.includeUser}
                      onChange={(e) => setWatermark({ ...watermark, includeUser: e.target.checked })}
                      className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                      disabled={!watermark.enabled}
                    />
                    <span className="text-slate-600 group-hover:text-slate-800 transition-colors whitespace-nowrap">用户</span>
                  </label>

                  <label className="flex items-center gap-2 text-sm cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={watermark.includeTime}
                      onChange={(e) => setWatermark({ ...watermark, includeTime: e.target.checked })}
                      className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                      disabled={!watermark.enabled}
                    />
                    <span className="text-slate-600 group-hover:text-slate-800 transition-colors whitespace-nowrap">时间</span>
                  </label>
                </div>
              </div>
            </div>

            {/* 右侧：工具按钮（与水印同一行） */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => setOrientation((o) => (o === 'portrait' ? 'landscape' : 'portrait'))}
                className="h-9 w-9 rounded-lg border border-slate-300 transition-all flex items-center justify-center bg-white text-slate-700 hover:bg-slate-100 hover:border-slate-400"
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

              <button
                onClick={() => setParseEditMode((v) => !v)}
                className={`h-9 px-4 rounded-lg border text-sm font-medium transition-all flex items-center gap-2 ${
                  parseEditMode ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                }`}
                title="开启后可为单元格新增/编辑解析字段"
              >
                {parseEditMode ? '关闭解析' : '解析编辑'}
              </button>

              <button
                onClick={() => setMobileFormEditorOpen(true)}
                className={`h-9 px-4 rounded-lg border text-sm font-medium transition-all flex items-center gap-2 ${
                  mobileFormConfig?.enabled ? 'bg-purple-600 text-white border-purple-600 shadow-sm' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                }`}
                title="配置移动端表单显示"
              >
                <Smartphone size={16} /> 移动端
              </button>
            </div>
          </div>

          {/* Section绑定提示 - 信息卡片 */}
          {!parseEditMode && level === 'primary' && parsedFields.some((f) => f.fieldType === 'section') && (
            <div className="mt-3 flex items-center gap-3 bg-purple-50 border border-purple-200 px-4 py-3 rounded-lg">
              <Link2 size={16} className="text-purple-600 flex-shrink-0" />
              <span className="text-sm text-purple-700">💡 提示：点击表格中的紫色 SECTION 单元格可以绑定二级模板</span>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-auto p-8 bg-slate-100">
          <div 
            className="mx-auto bg-white shadow-lg p-8 relative"
            style={{
              width: orientation === 'portrait' ? '210mm' : '297mm',
              minHeight: orientation === 'portrait' ? '297mm' : '210mm',
              maxWidth: '100%',
            }}
          >
            {displayTemplateData && (
              <ExcelRenderer
                key={`${template.id}-${isOpen}`} // 强制在模板切换或弹窗打开时重新渲染
                templateData={displayTemplateData}
                parsedFields={parsedFields}
                parseEditMode={parseEditMode}
                onParsedFieldsChange={setParsedFields}
                orientation={orientation}
                mode="design"
                onTemplateChange={setTemplateData}
                onSectionBind={handleBindTemplate}
                sectionBindings={sectionBindings}
              />
            )}
          </div>
        </div>
      </div>

      {/* 🟣 V3.4 模板绑定弹窗 */}
      <TemplateBindingModal
        isOpen={bindingModalOpen}
        onClose={() => setBindingModalOpen(false)}
        cellKey={bindingCellKey}
        currentTemplateId={sectionBindings[bindingCellKey]}
        templates={allTemplates || []}
        onBind={handleBindConfirm}
      />
      
      {/* 🟢 移动端表单编辑器 */}
      <MobileFormEditor
        isOpen={mobileFormEditorOpen}
        onClose={() => setMobileFormEditorOpen(false)}
        parsedFields={parsedFields}
        currentConfig={mobileFormConfig}
        onSave={async (config) => {
          setMobileFormConfig(config);
          setMobileFormEditorOpen(false);
          
          // 🟢 自动保存到数据库
          try {
            await TemplateService.update(template.id, {
              name,
              type,
              structureJson: JSON.stringify(templateData),
              parsedFields: JSON.stringify(parsedFields),
              watermarkSettings: watermark,
              level,
              sectionBindings: JSON.stringify(sectionBindings),
              orientation,
              mobileFormConfig: JSON.stringify(config)
            });
            alert('移动端表单配置已保存');
            onSuccess(); // 刷新列表
          } catch (e) {
            console.error('Save failed', e);
            alert('保存失败');
          }
        }}
      />
    </div>
  );
}