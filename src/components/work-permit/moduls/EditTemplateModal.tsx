import { useState, useEffect } from 'react';
import { Save, X, ShieldCheck } from 'lucide-react';
import { Template, ParsedField } from '@/types/work-permit';
import { TemplateService } from '@/services/workPermitService';
import ExcelRenderer from '../ExcelRenderer';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  template: Template;
  onSuccess: () => void;
}

export default function EditTemplateModal({ isOpen, onClose, template, onSuccess }: Props) {
  const [name, setName] = useState('');
  const [type, setType] = useState('');
  const [templateData, setTemplateData] = useState<any>(null);
  const [parsedFields, setParsedFields] = useState<ParsedField[]>([]);
  const [parseEditMode, setParseEditMode] = useState(false);
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  
  // 🟢 新增水印状态
  const [watermark, setWatermark] = useState({ text: '仅供内部审批', enabled: true });

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
          enabled: !!template.watermarkSettings.enabled
        });
      } else {
        setWatermark({ text: '仅供内部审批', enabled: true });
      }
    }
  }, [isOpen, template]);

  const handleSave = async () => {
    try {
      await TemplateService.update(template.id, {
        name,
        type,
        structureJson: JSON.stringify(templateData),
        parsedFields: JSON.stringify(parsedFields),
        // 🟢 直接保存 watermarkSettings 字段（与类型定义对齐）
        watermarkSettings: watermark
      });

      alert('修改已保存');
      onSuccess();
      onClose();
    } catch (e) {
      console.error('Save failed', e);
      alert('保存失败');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl w-full max-w-6xl h-[95vh] flex flex-col shadow-2xl">
        <div className="p-4 border-b bg-slate-50 rounded-t-xl flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <h3 className="font-bold text-lg">编辑模板</h3>
              <input
                className="border rounded px-2 py-1 text-sm w-48"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="模板名称"
              />
              <input
                className="border rounded px-2 py-1 text-sm w-24"
                value={type}
                onChange={(e) => setType(e.target.value)}
                placeholder="类型"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setOrientation(o => o === 'portrait' ? 'landscape' : 'portrait')}
                className="p-2 rounded border transition flex items-center justify-center bg-white text-slate-700 border-slate-300 hover:bg-slate-100 hover:border-slate-400"
                title={orientation === 'portrait' ? '当前：竖向纸张，点击切换为横向' : '当前：横向纸张，点击切换为竖向'}
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
              <button
                onClick={() => setParseEditMode((v) => !v)}
                className={`px-3 py-2 rounded border text-sm font-semibold transition flex items-center gap-1 ${parseEditMode ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'}`}
                title="开启后可为单元格新增/编辑解析字段"
              >
                {parseEditMode ? '关闭解析编辑' : '解析编辑模式'}
              </button>
              <button
                onClick={handleSave}
                className="bg-green-600 text-white px-4 py-2 rounded shadow hover:bg-green-700 flex items-center gap-2"
              >
                <Save size={16} /> 保存
              </button>
              <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded text-slate-500">
                <X size={20} />
              </button>
            </div>
          </div>

          {/* 🟢 水印配置区域 */}
          <div className="flex items-center gap-3 pt-2 border-t border-slate-200">
            <span className="text-sm font-bold text-slate-600 flex items-center gap-1">
              <ShieldCheck size={16} /> 防伪水印:
            </span>
            <input
              className="border rounded px-2 py-1 text-xs w-48"
              value={watermark.text}
              onChange={(e) => setWatermark({ ...watermark, text: e.target.value })}
              placeholder="输入水印文字"
            />
            <label className="flex items-center gap-1 text-xs cursor-pointer select-none">
              <input
                type="checkbox"
                checked={watermark.enabled}
                onChange={(e) => setWatermark({ ...watermark, enabled: e.target.checked })}
                className="rounded text-blue-600"
              />
              启用
            </label>
          </div>
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
            {templateData && (
              <ExcelRenderer
                templateData={templateData}
                parsedFields={parsedFields}
                parseEditMode={parseEditMode}
                onParsedFieldsChange={setParsedFields}
                orientation={orientation}
                mode="design"
                onTemplateChange={setTemplateData}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}