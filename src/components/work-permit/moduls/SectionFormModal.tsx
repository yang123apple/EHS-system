import { useState, useEffect, useMemo, useRef } from 'react';
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
  parentFormData?: Record<string, any>; // 🔵 母单表单数据，用于Part字段继承
  parentParsedFields?: ParsedField[]; // 🔵 母单解析字段
  parentApprovalLogs?: any[]; // 🔵 母单审批日志（用于提取审核字段）
  parentWorkflowConfig?: any[]; // 🔵 母单流程配置（用于匹配步骤和单元格）
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
  parentFormData = {},
  parentParsedFields = [],
  parentApprovalLogs = [],
  parentWorkflowConfig = [],
  existingData,
  onSave,
  readOnly = false
}: Props) {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  // 使用 ref 跟踪是否已经初始化过，避免无限循环
  const initializedRef = useRef<string | null>(null);

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
      
      // 🟢 V3.4 初始化纸张方向
      if (boundTemplate?.orientation) {
        setOrientation(boundTemplate.orientation as 'portrait' | 'landscape');
      }
    } else {
      // 关闭时清空表单数据和初始化标记，确保下次打开时能正确加载
      setFormData({});
      initializedRef.current = null;
    }
  }, [isOpen, existingData?.code, JSON.stringify(existingData?.data || {}), JSON.stringify(inheritedData), boundTemplate?.orientation]);

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
            {templateData && (
              <ExcelRenderer
                key={`${boundTemplate?.id}-${isOpen ? 'open' : 'closed'}-${existingData?.code || 'new'}`}
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
