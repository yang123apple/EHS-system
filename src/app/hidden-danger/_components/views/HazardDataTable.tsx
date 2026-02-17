/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/(dashboard)/hidden-danger/_components/views/HazardDataTable.tsx
import { FileSpreadsheet, Trash2, ChevronLeft, ChevronRight, FileQuestion } from 'lucide-react';
import { StatusBadge, RiskBadge } from '../Badges';
import { HazardRecord } from '@/types/hidden-danger';
import { ViewMode } from '@/constants/hazard';
import { TableSkeleton } from '@/components/common/Loading';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { canDeleteHazard } from '../../_utils/permissions';
import { hazardService } from '@/services/hazard.service';
import { VIEW_MODES } from '@/constants/hazard';
import { BATCH_LIMITS } from '@/lib/business-constants';
import { exportHazardsToExcel, ExportProgress } from '@/utils/hazardExcelExport';
import { useState } from 'react';

interface Props {
  hazards: HazardRecord[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onSelect: (h: HazardRecord) => void;
  onDelete: (hazard: HazardRecord) => void;
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
  // 导出进度状态
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // 文本截断工具函数：最多显示10个字符
  const truncateText = (text: string | null | undefined, maxLength = 10): string => {
    if (!text) return '-';
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  };

  // 导出所有隐患数据（而非仅当前页）
  const handleExport = async () => {
    if (isExporting) {
      alert('导出正在进行中，请稍候...');
      return;
    }
    try {
      setIsExporting(true);
      setExportProgress(null);

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

      // 判断是否为管理员
      const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

      // 使用新的导出工具（包含图片 + 进度回调）
      const blob = await exportHazardsToExcel(
        allHazards,
        isAdmin,
        (progress) => {
          setExportProgress(progress);
        }
      );

      // 下载文件
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `隐患导出_${new Date().toISOString().slice(0,10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      // 成功提示
      alert('导出成功！');
    } catch (error) {
      console.error('导出Excel失败:', error);
      alert('导出失败，请重试');
    } finally {
      setIsExporting(false);
      setExportProgress(null);
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
          disabled={hazards.length === 0 || isExporting}
          className="gap-2 text-green-700 bg-green-50/50 hover:bg-green-100 hover:border-green-300 border-green-200"
        >
          <FileSpreadsheet size={14} />
          {isExporting ? '导出中...' : '导出 Excel'}
        </Button>
      </div>

      {/* 导出进度提示 */}
      {isExporting && exportProgress && (
        <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-200">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              {/* 进度信息 */}
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" />
                  <span className="text-sm font-semibold text-blue-900">
                    {exportProgress.message}
                  </span>
                  {exportProgress.failedCount && exportProgress.failedCount > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 font-medium">
                      失败 {exportProgress.failedCount} 张
                    </span>
                  )}
                </div>
                <span className="text-sm font-mono font-bold text-blue-700">
                  {exportProgress.current}/{exportProgress.total}
                  <span className="text-xs text-blue-500 ml-1">
                    ({exportProgress.total > 0 ? Math.round((exportProgress.current / exportProgress.total) * 100) : 0}%)
                  </span>
                </span>
              </div>

              {/* 进度条 */}
              <div className="relative w-full bg-blue-200 rounded-full h-2.5 overflow-hidden shadow-inner">
                <div
                  className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-300 ease-out"
                  style={{
                    width: `${exportProgress.total > 0 ? (exportProgress.current / exportProgress.total) * 100 : 0}%`
                  }}
                />
                {/* 动画光效 */}
                <div
                  className="absolute top-0 left-0 h-full w-20 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"
                  style={{
                    width: `${exportProgress.total > 0 ? (exportProgress.current / exportProgress.total) * 100 : 0}%`
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

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
          <table className="w-full text-sm text-left border-collapse table-auto">
            <thead className="bg-slate-50/80 border-b border-slate-100 text-slate-500 sticky top-0 z-10 backdrop-blur-sm">
              <tr>
                {/* 左侧冻结列 - 隐患编号 */}
                <th className="sticky left-0 z-20 px-3 py-3 font-semibold whitespace-nowrap text-center bg-slate-50/90 border-r border-slate-200/50 shadow-[2px_0_4px_rgba(0,0,0,0.05)]">
                  隐患编号
                </th>
                {/* 左侧冻结列 - 隐患情况（合并：状态+风险等级+隐患类型） */}
                <th className="sticky left-[var(--col-1-width)] z-20 px-3 py-3 font-semibold whitespace-nowrap text-center bg-slate-50/90 border-r border-slate-200/50 shadow-[2px_0_4px_rgba(0,0,0,0.05)]" style={{'--col-1-width': '90px'} as React.CSSProperties}>
                  隐患情况
                </th>
                
                {/* 常规列 */}
                <th className="px-3 py-3 font-semibold whitespace-nowrap text-center">位置</th>
                <th className="px-3 py-3 font-semibold whitespace-nowrap text-center">隐患描述</th>
                <th className="px-3 py-3 font-semibold whitespace-nowrap text-center">责任人</th>
                <th className="px-3 py-3 font-semibold whitespace-nowrap text-center">整改措施要求</th>
                <th className="px-3 py-3 font-semibold whitespace-nowrap text-center">整改期限</th>
                <th className="px-3 py-3 font-semibold whitespace-nowrap text-center">整改描述</th>
                <th className="px-3 py-3 font-semibold whitespace-nowrap text-center">整改时间</th>
                
                {/* 右侧冻结列 - 操作 */}
                <th className="sticky right-0 z-20 px-3 py-3 font-semibold whitespace-nowrap text-center bg-slate-50/90 border-l border-slate-200/50 shadow-[-2px_0_4px_rgba(0,0,0,0.05)]">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {hazards.map((h, index) => {
                const isVoided = h.isVoided || false;
                
                // 计算截止日期倒计时
                const getDeadlineInfo = () => {
                  if (!h.deadline) return null;
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const dueDate = new Date(h.deadline);
                  dueDate.setHours(0, 0, 0, 0);
                  const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                  
                  if (diffDays < 0) {
                    return { 
                      days: Math.abs(diffDays),
                      label: `已逾期${Math.abs(diffDays)}天`, 
                      className: 'text-gray-600 bg-gray-100',
                      animate: false 
                    };
                  } else if (diffDays === 0) {
                    return { 
                      days: 0,
                      label: '今天到期', 
                      className: 'text-red-700 bg-red-100 font-semibold',
                      animate: true
                    };
                  } else if (diffDays <= 3) {
                    return { 
                      days: diffDays,
                      label: `剩余${diffDays}天`, 
                      className: 'text-yellow-700 bg-yellow-100 font-medium',
                      animate: false 
                    };
                  } else if (diffDays <= 7) {
                    return { 
                      days: diffDays,
                      label: `剩余${diffDays}天`, 
                      className: 'text-blue-700 bg-blue-100',
                      animate: false 
                    };
                  } else {
                    return { 
                      days: diffDays,
                      label: `剩余${diffDays}天`, 
                      className: 'text-green-700 bg-green-100',
                      animate: false 
                    };
                  }
                };
                
                const deadlineInfo = getDeadlineInfo();
                
                return (
                <tr
                    key={h.id}
                    className={cn(
                        "group transition-all duration-200 cursor-pointer hover:bg-blue-50/40 hover:shadow-sm",
                        index % 2 === 0 ? "bg-white" : "bg-slate-50/30",
                        isVoided && "opacity-50 bg-gray-50/50"
                    )}
                    onClick={() => onSelect(h)}
                >
                  {/* 隐患编号 - 冻结列（包含上报时间） */}
                  <td className="sticky left-0 z-10 p-3 align-middle text-center bg-inherit shadow-[2px_0_4px_rgba(0,0,0,0.03)]">
                    <div className="flex flex-col gap-1.5 items-center">
                      <div className={cn(
                        "text-xs font-mono px-2 py-1 rounded inline-block",
                        isVoided ? "bg-gray-100 text-gray-500" : "bg-slate-100 text-slate-700"
                      )}>
                        {h.code || h.id}
                      </div>
                      {/* ✅ 上报时间 */}
                      <div className={cn(
                        "text-xs px-2 py-0.5 rounded-full inline-flex items-center gap-1 w-fit",
                        isVoided ? "bg-gray-100 text-gray-500" : "bg-green-50 text-green-700"
                      )}>
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>{h.reportTime ? h.reportTime.split('T')[0] : '-'}</span>
                      </div>
                    </div>
                  </td>
                  
                  {/* 隐患情况 - 冻结列（合并：状态+风险等级+隐患类型） */}
                  <td className="sticky left-[112px] z-10 p-3 align-middle text-center bg-inherit shadow-[2px_0_4px_rgba(0,0,0,0.03)]">
                    <div className="flex flex-col gap-1.5 items-center">
                      {/* 状态 */}
                      <StatusBadge status={h.status} />
                      {/* 风险等级 */}
                      <RiskBadge level={h.riskLevel} />
                      {/* 隐患类型 */}
                      <span className={cn(
                        "text-xs px-2 py-0.5 rounded-full inline-flex items-center gap-1 w-fit",
                        isVoided ? "bg-gray-100 text-gray-500" : "bg-purple-50 text-purple-700"
                      )}>
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                        {h.type}
                      </span>
                      {/* 已作废标记 */}
                      {isVoided && (
                        <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-semibold bg-gray-500 text-white w-fit">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                          </svg>
                          <span>已作废</span>
                        </div>
                      )}
                    </div>
                  </td>

                  {/* 位置 - 复合列 */}
                  <td className="p-3 align-middle text-center">
                    <div className="space-y-1 flex flex-col items-center">
                      <div className={cn(
                        "text-sm font-medium",
                        isVoided ? "text-gray-500" : "text-slate-800"
                      )}>
                        {h.location}
                      </div>
                      {h.responsibleDeptName && (
                        <div className={cn(
                          "text-xs px-2 py-0.5 rounded-full inline-flex items-center gap-1 w-fit",
                          isVoided ? "bg-gray-100 text-gray-500" : "bg-blue-50 text-blue-700"
                        )}>
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                          <span>{h.responsibleDeptName}</span>
                        </div>
                      )}
                    </div>
                  </td>

                  {/* 隐患描述 - 带Tooltip */}
                  <td className="p-3 align-middle text-center">
                    <TooltipProvider delayDuration={300}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className={cn(
                            "text-sm line-clamp-2 cursor-help",
                            isVoided ? "text-gray-500 line-through" : "text-slate-800 group-hover:text-blue-700"
                          )}>
                            {h.desc}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-md">
                          <p className="text-sm whitespace-pre-wrap">{h.desc}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </td>

                  {/* 责任人 */}
                  <td className="p-3 align-middle text-center">
                    <div className={cn(
                      "text-sm font-medium px-2 py-1 rounded inline-block",
                      isVoided ? "bg-gray-100 text-gray-500" : "bg-slate-100 text-slate-700"
                    )}>
                      {h.responsibleName || '-'}
                    </div>
                  </td>

                  {/* 整改措施要求 - 带Tooltip（移动到责任人后面） */}
                  <td className="p-3 align-middle text-center">
                    {h.rectificationRequirements || h.rectifyRequirement ? (
                      <TooltipProvider delayDuration={300}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className={cn(
                              "text-sm line-clamp-2 cursor-help",
                              isVoided ? "text-gray-500" : "text-slate-700"
                            )}>
                              {h.rectificationRequirements || h.rectifyRequirement}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-md">
                            <p className="text-sm whitespace-pre-wrap">{h.rectificationRequirements || h.rectifyRequirement}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : (
                      <span className="text-sm text-slate-400">-</span>
                    )}
                  </td>

                  {/* 整改期限 - 带倒计时 */}
                  <td className="p-3 align-middle text-center">
                    <div className="space-y-1 flex flex-col items-center">
                      <div className={cn(
                        "text-xs font-mono",
                        isVoided ? "text-gray-500" : "text-slate-600"
                      )}>
                        {h.deadline ? h.deadline.split('T')[0] : '-'}
                      </div>
                      {deadlineInfo && !isVoided && (
                        <div className={cn(
                          "inline-flex items-center px-1.5 py-0.5 rounded text-xs",
                          deadlineInfo.className,
                          deadlineInfo.animate && "animate-pulse"
                        )}>
                          {deadlineInfo.label}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* 整改描述 - 带Tooltip */}
                  <td className="p-3 align-middle text-center">
                    {h.rectificationNotes || h.rectifyDesc ? (
                      <TooltipProvider delayDuration={300}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className={cn(
                              "text-sm line-clamp-2 cursor-help",
                              isVoided ? "text-gray-500" : "text-slate-700"
                            )}>
                              {h.rectificationNotes || h.rectifyDesc}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-md">
                            <p className="text-sm whitespace-pre-wrap">{h.rectificationNotes || h.rectifyDesc}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : (
                      <span className="text-sm text-slate-400">-</span>
                    )}
                  </td>

                  {/* 整改时间 */}
                  <td className="p-3 align-middle text-center">
                    <span className={cn(
                      "text-xs font-mono",
                      isVoided ? "text-gray-500" : "text-slate-600"
                    )}>
                      {h.rectificationTime ? h.rectificationTime.split('T')[0] : (h.rectifyTime ? h.rectifyTime.split('T')[0] : '-')}
                    </span>
                  </td>

                  {/* 操作 - 冻结列 */}
                  <td className="sticky right-0 z-10 p-3 align-middle text-center bg-inherit shadow-[-2px_0_4px_rgba(0,0,0,0.03)]">
                    {canDeleteHazard(h, user) && (
                      <button 
                        onClick={(e) => {e.stopPropagation(); onDelete(h);}} 
                        className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                        title="删除记录"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              )})}
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
