import { useRef, useState } from 'react';
import { X, Upload, GitMerge, Edit, Trash2, AlertTriangle, Lock, Unlock } from 'lucide-react';
import { Template } from '@/types/work-permit';
import { TemplateService } from '@/services/workPermitService';
import * as XLSX from 'xlsx';

// 🟢 智能列宽计算工具函数：优先用 Excel 原生宽度，其次只根据非合并单元格计算
const calculateSmartWidths = (data: any[][], merges: any[], explicitCols: any[]) => {
  // 1. 如果 Excel 里已经存了列宽 (ws['!cols'])，直接用 Excel 的设置！这是最准的。
  if (explicitCols && explicitCols.length > 0) {
    return explicitCols.map((col: any) => {
      // Excel 的 wch (字符宽) 转像素算法
      if (col && typeof col.wch === 'number') {
        return { wpx: Math.round(col.wch * 7.5 + 5) };
      }
      // Excel 的 wpx (像素宽)
      if (col && typeof col.wpx === 'number') {
        return { wpx: col.wpx };
      }
      return { wpx: 70 };
    });
  }

  // 2. 如果 Excel 没存列宽，我们自己算，但【绝对忽略合并单元格】
  const colCount = data.reduce((max, row) => Math.max(max, row.length), 0);
  const colWidths = new Array(colCount).fill(0);

  // 遍历每一个单元格
  data.forEach((row, rIndex) => {
    row.forEach((cellVal, cIndex) => {
      // 检查是否在任何合并范围内
      const inMerge = merges.some(m => 
        rIndex >= m.s.r && rIndex <= m.e.r && 
        cIndex >= m.s.c && cIndex <= m.e.c
      );

      // 🟢 关键策略：如果是合并单元格，直接跳过！不参与宽度计算！
      if (inMerge) return;

      // 计算单格内容的宽度（只基于"工程名称"、"电话"这种短词）
      const str = String(cellVal || "");
      let len = 0;
      for (const char of str) {
        // 中文算 14px，英文算 7.5px
        len += char.charCodeAt(0) > 255 ? 14 : 7.5;
      }
      const needed = Math.ceil(len + 12); // 加上 padding

      // 更新该列最大宽度
      if (needed > colWidths[cIndex]) {
        colWidths[cIndex] = needed;
      }
    });
  });

  // 3. 返回结果，给一个合理的最小值和最大值
  return colWidths.map(w => ({
    wpx: w === 0 ? 80 : Math.max(60, Math.min(w, 200))
  }));
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  templates: Template[];
  hasPerm: (perm: string) => boolean;
  onRefresh: () => void;
  onEdit: (t: Template) => void;
  onConfigWorkflow: (t: Template) => void;
}

export default function TemplateManageModal({
  isOpen,
  onClose,
  templates,
  hasPerm,
  onRefresh,
  onEdit,
  onConfigWorkflow,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  // 处理 Excel 上传
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
        
        const rows = ws['!rows'] || [];
        const merges = ws['!merges'] || [];
        const explicitCols = ws['!cols'] || [];

        // 🟢 使用新的智能算法计算列宽
        const cols = calculateSmartWidths(data as any[][], merges, explicitCols);

        // 简单的自动检测流程
        const detectedWorkflow: any[] = [];
        let stepCount = 0;
        data.forEach((row: any, rIndex: number) => {
          const rowStr = JSON.stringify(row);
          if (rowStr.includes("意见") || rowStr.includes("签字") || rowStr.includes("审批")) {
            detectedWorkflow.push({
              step: stepCount++,
              name: `步骤 ${stepCount} (Row ${rIndex + 1})`,
              rowIndex: rIndex,
              type: 'approval',
              approvers: []
            });
          }
        });

        const templatePayload = {
          grid: data,
          merges: merges,
          cols: cols,
          rows: rows,
          styles: {}
        };

        const name = prompt("请输入模板名称", file.name.replace(/\.xlsx$/i, ""));
        if (!name) return;

        const type = prompt("请输入作业类型 (如: 动火作业)", "通用作业");
        if (!type) return;

        setLoading(true);
        await TemplateService.create({
          name,
          type,
          structureJson: JSON.stringify(templatePayload),
          isLocked: false,
          workflowConfig: JSON.stringify(detectedWorkflow)
        });

        alert("上传成功！");
        onRefresh();
      } catch (e: any) {
        console.error("上传失败", e);
        alert("上传失败: " + (e.message || "未知错误"));
      } finally {
        setLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  // 处理锁定/解锁
  const handleToggleLock = async (t: Template) => {
    if (!confirm(`确认${t.isLocked ? "解锁" : "锁定"}?`)) return;
    try {
      await TemplateService.update(t.id, { isLocked: !t.isLocked });
      onRefresh();
    } catch (e: any) {
      alert("操作失败: " + e.message);
    }
  };

  // 🟢 修复核心：增加 try-catch 捕获删除失败，并优化提示
  const handleDelete = async (id: string) => {
    // 🟢 修改提示文案，让用户意识到后果
    if (!confirm("⚠️ 高风险操作：确认删除该模板吗？\n\n1. 删除后无法恢复。\n2. 如果有历史作业记录正在使用该模板，删除可能会失败或导致记录显示异常。")) return;
    
    setLoading(true);
    try {
      await TemplateService.delete(id);
      onRefresh();
    } catch (error: any) {
      console.error("删除失败:", error);
      // 🟢 优化错误提示逻辑
      let msg = error.message || "未知错误";
      // 后端通常因为外键约束报错 (Prisma error code P2003)
      if (msg.includes("Foreign key constraint") || msg.includes("500")) {
        msg = "无法删除：检测到该模板已被历史作业记录引用。\n\n建议：\n1. 不要删除，而是点击“锁定”按钮禁用该模板。\n2. 或者先删除所有关联的作业记录（不推荐）。";
      }
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl w-full max-w-3xl h-[80vh] flex flex-col shadow-2xl">
        <div className="p-5 border-b flex justify-between">
          <h3 className="font-bold text-lg">模板管理</h3>
          <button onClick={onClose}><X /></button>
        </div>

        <div className="p-4 border-b flex justify-between items-center bg-slate-50">
          <div className="text-sm text-slate-500">共 {templates.length} 个模板</div>
          {hasPerm('upload_template') && (
            <>
              <input
                type="file"
                ref={fileInputRef}
                accept=".xlsx"
                className="hidden"
                onChange={handleUpload}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                className="bg-blue-600 text-white px-4 py-2 rounded flex gap-2 hover:bg-blue-700 transition disabled:opacity-50"
              >
                <Upload size={16} /> {loading ? "处理中..." : "上传 Excel"}
              </button>
            </>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 bg-slate-50">
          <div className="grid gap-3">
            {templates.map(t => (
              <div
                key={t.id}
                className="bg-white p-4 rounded border flex justify-between items-center hover:shadow-sm transition"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-bold text-slate-800">{t.name}</h4>
                    {t.isLocked && (
                      <span className="text-[10px] bg-amber-50 text-amber-600 border border-amber-100 px-1.5 py-0.5 rounded flex items-center gap-1">
                        <Lock size={10} /> 已锁定
                      </span>
                    )}
                  </div>
                  <span className="text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-500">{t.type}</span>
                </div>
                <div className="flex gap-2">
                  {hasPerm('edit_template') && (
                    <>
                      <button
                        onClick={() => onConfigWorkflow(t)}
                        className="px-3 py-1.5 text-xs border rounded flex items-center gap-1 text-purple-600 border-purple-200 hover:bg-purple-50 transition"
                        title="配置审批流程"
                      >
                        <GitMerge size={14} /> 流程
                      </button>
                      <button
                        onClick={() => onEdit(t)}
                        className="px-3 py-1.5 text-xs border rounded flex items-center gap-1 text-blue-600 border-blue-200 hover:bg-blue-50 transition"
                        title="编辑模板内容"
                      >
                        <Edit size={14} /> 编辑
                      </button>
                    </>
                  )}

                  {hasPerm('lock_template') && (
                    <button
                      onClick={() => handleToggleLock(t)}
                      className={`px-3 py-1.5 text-xs border rounded flex items-center gap-1 transition ${
                        t.isLocked
                          ? 'text-green-600 border-green-200 bg-green-50 hover:bg-green-100'
                          : 'text-amber-600 border-amber-200 hover:bg-amber-50'
                      }`}
                    >
                      {t.isLocked ? <Unlock size={14} /> : <Lock size={14} />}
                      {t.isLocked ? '解锁' : '锁定'}
                    </button>
                  )}

                  {hasPerm('delete_template') && (
                    <button
                      onClick={() => handleDelete(t.id)}
                      disabled={loading}
                      className="px-3 py-1.5 text-xs text-red-600 border border-red-200 rounded hover:bg-red-50 flex items-center gap-1 transition disabled:opacity-50"
                    >
                      <Trash2 size={14} /> 删除
                    </button>
                  )}
                </div>
              </div>
            ))}

            {templates.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <AlertTriangle size={32} className="mb-2 opacity-50" />
                <p>暂无模板，请点击上方按钮上传</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}