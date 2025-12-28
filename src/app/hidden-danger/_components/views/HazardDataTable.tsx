// src/app/(dashboard)/hidden-danger/_components/views/HazardDataTable.tsx
import { FileSpreadsheet, Trash2, Search as SearchIcon, ChevronLeft, ChevronRight, FileQuestion } from 'lucide-react';
import { StatusBadge, RiskBadge } from '../Badges';
import { HazardRecord } from '@/types/hidden-danger';
import { ViewMode } from '@/constants/hazard';
import { TableSkeleton } from '@/components/common/Loading';
import * as XLSX from 'xlsx';

interface Props {
  hazards: HazardRecord[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onSelect: (h: HazardRecord) => void;
  onDelete: (id: string) => void;
  loading?: boolean;
  viewMode: ViewMode;
}

export function HazardDataTable({ 
  hazards, 
  total, 
  page, 
  pageSize, 
  onPageChange, 
  onSelect, 
  onDelete, 
  loading = false,
  viewMode 
}: Props) {
  
  const handleExport = () => {
    const ws = XLSX.utils.json_to_sheet(hazards.map(h => ({
      '单号': h.id, '描述': h.desc, '状态': h.status, '责任人': h.responsibleName || '-'
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "隐患列表");
    XLSX.writeFile(wb, `隐患导出_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const totalPages = Math.ceil(total / pageSize);
  const showPagination = totalPages > 1;

  return (
    <div className="bg-white rounded-xl shadow-sm border overflow-hidden flex flex-col h-full">
      {/* 工具栏 */}
      <div className="p-4 border-b flex justify-between items-center bg-white">
        <div className="flex items-center gap-4">
          <h3 className="font-bold text-slate-800">
            {viewMode === 'my_tasks' ? '我的任务' : '全部隐患'}
          </h3>
          <span className="text-sm text-slate-500">共 {total} 条</span>
        </div>
        <button 
          onClick={handleExport} 
          disabled={hazards.length === 0}
          className="flex items-center gap-2 text-green-700 bg-green-50 px-4 py-2 rounded-lg border border-green-200 hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <FileSpreadsheet size={16} /> 导出 Excel
        </button>
      </div>

      {/* 表格体 */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="p-6">
            <TableSkeleton rows={pageSize} />
          </div>
        ) : hazards.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-16 text-slate-400">
            <FileQuestion size={64} className="mb-4" />
            <p className="text-lg font-medium">暂无数据</p>
            <p className="text-sm mt-2">
              {viewMode === 'my_tasks' ? '您当前没有待处理的任务' : '还没有隐患记录'}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 border-b text-slate-500 sticky top-0">
              <tr>
                <th className="p-4">风险/状态</th>
                <th className="p-4">描述</th>
                <th className="p-4">责任信息</th>
                <th className="p-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {hazards.map(h => (
                <tr key={h.id} className="border-b hover:bg-slate-50 cursor-pointer transition-colors" onClick={() => onSelect(h)}>
                  <td className="p-4 space-y-1">
                    <RiskBadge level={h.riskLevel} />
                    <div className="mt-1"><StatusBadge status={h.status} /></div>
                  </td>
                  <td className="p-4">
                    <div className="font-medium text-slate-800 truncate max-w-xs">{h.desc}</div>
                    <div className="text-xs text-slate-400 mt-1">{h.location} | {h.type}</div>
                  </td>
                  <td className="p-4">
                    {h.responsibleName ? (
                      <div>
                        <div className="font-bold">{h.responsibleName}</div>
                        <div className="text-xs text-slate-400">截止: {h.deadline}</div>
                      </div>
                    ) : <span className="text-slate-400">-</span>}
                  </td>
                  <td className="p-4 text-right">
                    <button 
                      onClick={(e) => {e.stopPropagation(); onDelete(h.id);}} 
                      className="text-red-500 p-2 hover:bg-red-50 rounded transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 分页器 */}
      {showPagination && !loading && (
        <div className="p-4 border-t flex items-center justify-between bg-slate-50">
          <div className="text-sm text-slate-600">
            显示 {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, total)} 条，共 {total} 条
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page === 1}
              className="px-3 py-1 border rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-medium">
              第 {page} / {totalPages} 页
            </span>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page === totalPages}
              className="px-3 py-1 border rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
