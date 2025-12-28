// src/app/hidden-danger/_components/modals/BatchUploadModal.tsx
"use client";
import { useState, useRef } from 'react';
import { X, Upload, Download, AlertCircle, CheckCircle2, FileSpreadsheet } from 'lucide-react';

interface BatchUploadModalProps {
  onClose: () => void;
  onUpload: (data: any[]) => Promise<void>;
}

export function BatchUploadModal({ onClose, onUpload }: BatchUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<any[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 下载模板
  const handleDownloadTemplate = () => {
    // 创建模板数据
    const template = [
      ['隐患类型', '发现位置', '隐患描述', '风险等级', '责任部门', '整改期限(天)'],
      ['示例：用电安全', '示例：车间A区', '示例：电线老化未更换', 'medium', '示例：安全部', '7'],
      ['', '', '', '', '', '']
    ];

    // 转换为 CSV
    const csvContent = template.map(row => row.join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = '隐患批量上传模板.csv';
    link.click();
  };

  // 处理文件选择
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // 验证文件类型
    const validTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    if (!validTypes.includes(selectedFile.type) && !selectedFile.name.endsWith('.csv')) {
      setErrors(['请上传 CSV 或 Excel 文件']);
      return;
    }

    setFile(selectedFile);
    setErrors([]);

    // 解析文件预览
    try {
      const text = await selectedFile.text();
      const rows = text.split('\n').map(row => {
        // 处理 CSV 中的引号和逗号
        const values: string[] = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < row.length; i++) {
          const char = row[i];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            values.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        values.push(current.trim());
        return values;
      });

      // 跳过标题行，验证数据
      const dataRows = rows.slice(1).filter(row => row.some(cell => cell));
      const validationErrors: string[] = [];
      const previewData: any[] = [];

      dataRows.forEach((row, index) => {
        const [type, location, desc, riskLevel, dept, deadline] = row;
        
        // 验证必填字段
        if (!type || !location || !desc) {
          validationErrors.push(`第 ${index + 2} 行：类型、位置、描述不能为空`);
          return;
        }

        // 验证风险等级
        const validRiskLevels = ['low', 'medium', 'high', 'major'];
        if (riskLevel && !validRiskLevels.includes(riskLevel)) {
          validationErrors.push(`第 ${index + 2} 行：风险等级必须是 low/medium/high/major 之一`);
          return;
        }

        // 验证期限
        if (deadline && isNaN(Number(deadline))) {
          validationErrors.push(`第 ${index + 2} 行：整改期限必须是数字`);
          return;
        }

        previewData.push({
          type,
          location,
          desc,
          riskLevel: riskLevel || 'medium',
          responsibleDeptName: dept || '',
          deadlineDays: deadline ? Number(deadline) : 7
        });
      });

      if (validationErrors.length > 0) {
        setErrors(validationErrors);
        setPreview([]);
      } else {
        setPreview(previewData);
        setErrors([]);
      }
    } catch (error) {
      setErrors(['文件解析失败，请检查文件格式']);
    }
  };

  // 提交上传
  const handleSubmit = async () => {
    if (preview.length === 0) {
      setErrors(['没有可上传的数据']);
      return;
    }

    setUploading(true);
    try {
      await onUpload(preview);
      onClose();
    } catch (error: any) {
      setErrors([error.message || '上传失败，请重试']);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <Upload className="text-blue-600" size={24} />
            <h3 className="text-xl font-bold text-slate-800">批量上传隐患</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* 下载模板 */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <FileSpreadsheet className="text-blue-600 flex-shrink-0" size={20} />
              <div className="flex-1">
                <h4 className="font-medium text-slate-800 mb-2">第一步：下载导入模板</h4>
                <p className="text-sm text-slate-600 mb-3">
                  请先下载模板文件，按照模板格式填写隐患数据。支持 CSV 和 Excel 格式。
                </p>
                <button
                  onClick={handleDownloadTemplate}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Download size={16} />
                  下载模板
                </button>
              </div>
            </div>
          </div>

          {/* 上传文件 */}
          <div className="border-2 border-dashed border-slate-300 rounded-lg p-8">
            <div className="text-center">
              <Upload className="mx-auto text-slate-400 mb-4" size={48} />
              <h4 className="font-medium text-slate-800 mb-2">第二步：上传填写好的文件</h4>
              <p className="text-sm text-slate-600 mb-4">
                支持 CSV 和 Excel 文件，单次最多上传 100 条记录
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-6 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors"
              >
                选择文件
              </button>
              {file && (
                <p className="mt-3 text-sm text-slate-600">
                  已选择：{file.name}
                </p>
              )}
            </div>
          </div>

          {/* 错误提示 */}
          {errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="text-red-600 flex-shrink-0" size={20} />
                <div className="flex-1">
                  <h4 className="font-medium text-red-800 mb-2">发现以下错误：</h4>
                  <ul className="text-sm text-red-700 space-y-1 list-disc list-inside">
                    {errors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* 预览数据 */}
          {preview.length > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start gap-3 mb-4">
                <CheckCircle2 className="text-green-600 flex-shrink-0" size={20} />
                <div className="flex-1">
                  <h4 className="font-medium text-green-800">
                    数据验证通过，共 {preview.length} 条记录
                  </h4>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-white">
                      <th className="px-3 py-2 text-left font-medium text-slate-700">类型</th>
                      <th className="px-3 py-2 text-left font-medium text-slate-700">位置</th>
                      <th className="px-3 py-2 text-left font-medium text-slate-700">描述</th>
                      <th className="px-3 py-2 text-left font-medium text-slate-700">风险等级</th>
                      <th className="px-3 py-2 text-left font-medium text-slate-700">责任部门</th>
                      <th className="px-3 py-2 text-left font-medium text-slate-700">期限(天)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 5).map((item, index) => (
                      <tr key={index} className="border-t border-green-100">
                        <td className="px-3 py-2 text-slate-700">{item.type}</td>
                        <td className="px-3 py-2 text-slate-700">{item.location}</td>
                        <td className="px-3 py-2 text-slate-700 truncate max-w-[200px]">{item.desc}</td>
                        <td className="px-3 py-2 text-slate-700">{item.riskLevel}</td>
                        <td className="px-3 py-2 text-slate-700">{item.responsibleDeptName}</td>
                        <td className="px-3 py-2 text-slate-700">{item.deadlineDays}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.length > 5 && (
                  <p className="text-xs text-slate-500 mt-2 text-center">
                    仅显示前 5 条，共 {preview.length} 条
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 底部操作栏 */}
        <div className="flex gap-3 justify-end p-6 border-t bg-slate-50">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-slate-300 rounded-lg hover:bg-white transition-colors"
            disabled={uploading}
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={preview.length === 0 || uploading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {uploading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                上传中...
              </>
            ) : (
              <>
                <Upload size={16} />
                确认上传 ({preview.length} 条)
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
