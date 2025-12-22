import { useState, useEffect, useMemo } from 'react';
import { X, Save, FileText } from 'lucide-react';
import { Template, ParsedField } from '@/types/work-permit';
import ExcelRenderer from '../ExcelRenderer';

interface SectionData {
  templateId: string;
  templateName: string;
  code: string;
  data: Record<string, any>;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  cellKey: string; // 例如 "R5C3"
  fieldName: string; // 字段名，用于生成编号
  boundTemplate: Template | null; // 绑定的二级模板
  parentCode: string; // 父表单编号
  existingData?: SectionData; // 已有的section数据（编辑模式）
  onSave: (data: SectionData) => void;
  readOnly?: boolean; // 只读模式
}

export default function SectionFormModal({
  isOpen,
  onClose,
  cellKey,
  fieldName,
  boundTemplate,
  parentCode,
  existingData,
  onSave,
  readOnly = false
}: Props) {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');

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

  // 解析字段配置
  const parsedFields = useMemo(() => {
    if (!boundTemplate?.parsedFields) return [];
    try {
      const fields = JSON.parse(boundTemplate.parsedFields);
      return Array.isArray(fields) ? fields : [];
    } catch (e) {
      return [];
    }
  }, [boundTemplate?.parsedFields]);

  // 初始化表单数据
  useEffect(() => {
    if (isOpen) {
      if (existingData?.data) {
        setFormData(existingData.data);
      } else {
        setFormData({});
      }
    }
  }, [isOpen, existingData]);

  const handleSave = () => {
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
      data: formData
    };

    onSave(sectionData);
    onClose();
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
              <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded text-slate-500">
                <X size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* 表单内容区域 */}
        <div className="flex-1 overflow-auto p-8 bg-slate-100">
          <div 
            className="mx-auto bg-white shadow-lg p-8 relative"
            style={{
              width: orientation === 'portrait' ? '210mm' : '297mm',
              minHeight: orientation === 'portrait' ? '297mm' : '210mm',
              maxWidth: '100%',
            }}
          >
            {/* 二级表单编号显示 */}
            <div className="absolute top-0 right-0 px-2 py-1 text-[10px] text-purple-600 font-mono bg-purple-50 border-b border-l border-purple-200 rounded-bl z-10">
              {sectionCode}
            </div>

            {templateData && (
              <ExcelRenderer
                templateData={templateData}
                initialData={formData}
                parsedFields={parsedFields}
                permitCode={sectionCode}
                orientation={orientation}
                mode={readOnly ? "view" : "edit"}
                onDataChange={readOnly ? undefined : setFormData}
              />
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
    </div>
  );
}
