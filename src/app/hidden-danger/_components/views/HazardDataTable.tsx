/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/(dashboard)/hidden-danger/_components/views/HazardDataTable.tsx
import { FileSpreadsheet, Trash2, ChevronLeft, ChevronRight, FileQuestion } from 'lucide-react';
import { StatusBadge, RiskBadge } from '../Badges';
import { HazardRecord } from '@/types/hidden-danger';
import { ViewMode } from '@/constants/hazard';
import { TableSkeleton } from '@/components/common/Loading';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import * as XLSX from 'xlsx';
import { cn } from '@/lib/utils';
import { canDeleteHazard } from '../../_utils/permissions';
import { hazardService } from '@/services/hazard.service';
import { VIEW_MODES } from '@/constants/hazard';
import { BATCH_LIMITS } from '@/lib/business-constants';

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
  user?: any; // 用户信息，用于权限检查
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
  viewMode,
  user 
}: Props) {
  
  // 导出所有隐患数据（而非仅当前页）
  const handleExport = async () => {
    try {
      // 构建筛选条件，保留当前视图模式
      const filters: any = {
        viewMode: viewMode === VIEW_MODES.MY_TASKS ? 'my_tasks' : undefined,
        userId: user?.id
      };

      // 🔒 资源控制：限制单次导出最大条数
      const maxExportLimit = BATCH_LIMITS.EXPORT_MAX;
      
      // 获取数据（使用配置的最大限制）
      const response = await hazardService.getHazards(1, maxExportLimit, filters);
      
      let allHazards: HazardRecord[] = [];
      if (response && typeof response === 'object') {
        if (response.data && Array.isArray(response.data)) {
          allHazards = response.data;
        } else if (Array.isArray(response)) {
          allHazards = response;
        }
      }

      if (allHazards.length === 0) {
        alert('没有可导出的隐患数据');
        return;
      }

      // 🔒 二次检查：确保不超过限制
      if (allHazards.length > maxExportLimit) {
        alert(`导出数据量超过限制（${maxExportLimit} 条），请缩小筛选范围或分批导出`);
        return;
      }

      // 导出数据
      const ws = XLSX.utils.json_to_sheet(allHazards.map(h => ({
        '单号': h.code || h.id,
        '描述': h.desc,
        '类型': h.type,
        '位置': h.location,
        '风险等级': h.riskLevel,
        '状态': h.status,
        '责任人': h.responsibleName || '-',
        '截止日期': h.deadline ? h.deadline.split('T')[0] : '-',
        '上报人': h.reporterName || '-',
        '上报时间': h.reportTime ? h.reportTime.split('T')[0] : '-'
      })));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "隐患列表");
      XLSX.writeFile(wb, `隐患导出_${new Date().toISOString().slice(0,10)}.xlsx`);
    } catch (error) {
      console.error('导出Excel失败:', error);
      alert('导出失败，请重试');
    }
  };

  const totalPages = Math.ceil(total / pageSize);
  const showPagination = totalPages > 1;

  return (
    <Card className="h-full border-slate-200 bg-white flex flex-col overflow-hidden shadow-sm">
      {/* Tools */}
      <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-bold text-slate-800 tracking-tight">
            {viewMode === 'my_tasks' ? '我的任务' : '全部隐患'}
          </h3>
          <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
             Total: {total}
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport} 
          disabled={hazards.length === 0}
          className="gap-2 text-green-700 bg-green-50/50 hover:bg-green-100 hover:border-green-300 border-green-200"
        >
          <FileSpreadsheet size={14} /> 导出 Excel
        </Button>
      </div>

      {/* Table Content */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="p-6">
            <TableSkeleton rows={pageSize} />
          </div>
        ) : hazards.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-16 text-slate-400">
            <div className="p-4 bg-slate-50 rounded-full mb-4">
                 <FileQuestion size={40} className="text-slate-300" />
            </div>
            <p className="text-base font-semibold text-slate-600">暂无数据</p>
            <p className="text-sm mt-1 text-slate-400">
              {viewMode === 'my_tasks' ? '您当前没有待处理的任务' : '还没有隐患记录'}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-slate-50/80 border-b border-slate-100 text-slate-500 sticky top-0 z-0 backdrop-blur-sm">
              <tr>
                <th className="p-4 font-semibold w-32">风险等级</th>
                <th className="p-4 font-semibold w-32">状态</th>
                <th className="p-4 font-semibold">隐患描述</th>
                <th className="p-4 font-semibold w-48">责任信息</th>
                <th className="p-4 font-semibold w-24 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {hazards.map((h, index) => (
                <tr
                    key={h.id}
                    className={cn(
                        "group transition-colors cursor-pointer hover:bg-blue-50/30",
                        index % 2 === 0 ? "bg-white" : "bg-slate-50/30" // Zebra striping
                    )}
                    onClick={() => onSelect(h)}
                >
                  <td className="p-4 align-top">
                    <RiskBadge level={h.riskLevel} />
                  </td>
                   <td className="p-4 align-top">
                    <StatusBadge status={h.status} />
                  </td>
                  <td className="p-4 align-top">
                    <div className="font-medium text-slate-800 truncate max-w-md mb-1 group-hover:text-blue-700 transition-colors">
                        {h.desc}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                        <span className="bg-slate-100 px-1.5 rounded">{h.code || h.id}</span>
                        <span>{h.location}</span>
                        <span>•</span>
                        <span>{h.type}</span>
                    </div>
                  </td>
                  <td className="p-4 align-top">
                    {h.responsibleName ? (
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-semibold text-slate-700">{h.responsibleName}</span>
                        <span className="text-xs text-slate-400">截止: {h.deadline?.split('T')[0] || '-'}</span>
                      </div>
                    ) : <span className="text-slate-300 text-xs italic">待指派</span>}
                  </td>
                  <td className="p-4 align-top text-right">
                    {canDeleteHazard(h, user) && (
                      <button 
                        onClick={(e) => {e.stopPropagation(); onDelete(h.id);}} 
                        className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                        title="删除记录"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {showPagination && !loading && (
        <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-white/50 backdrop-blur-sm">
          <div className="text-xs text-slate-500 font-medium">
            显示 {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, total)} 条，共 {total} 条
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => onPageChange(page - 1)}
              disabled={page === 1}
            >
              <ChevronLeft size={14} />
            </Button>
            <span className="text-sm font-bold text-slate-700 w-16 text-center">
               {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => onPageChange(page + 1)}
              disabled={page === totalPages}
            >
              <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
