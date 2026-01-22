// src/app/hidden-danger/_components/FilterBar.tsx
"use client";
import { useState } from 'react';
import { ChevronDown, ChevronUp, Filter, X, CalendarIcon, Building2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import PeopleSelector from '@/components/common/PeopleSelector';

interface FilterBarProps {
  filters: {
    type: string;
    startDate: string;
    endDate: string;
    status: string;
    risk: string;
    responsibleDept: string;
    search?: string; // 🟢 新增：全局搜索关键词
  };
  onFilterChange: (filters: any) => void;
  config: {
    types: string[];
    areas: string[];
  };
  departments: Array<{ id: string; name: string }>;
  className?: string;
}

export function FilterBar({ filters, onFilterChange, config, departments, className }: FilterBarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showDeptSelector, setShowDeptSelector] = useState(false);
  
  // 状态选项
  const statusOptions = [
    { value: '', label: '全部状态' },
    { value: 'reported', label: '待整改' },
    { value: 'rectifying', label: '整改中' },
    { value: 'rectified', label: '待验收' },
    { value: 'accepted', label: '已验收' },
  ];
  
  // 风险等级选项
  const riskOptions = [
    { value: '', label: '全部等级' },
    { value: '高', label: '高风险' },
    { value: '中', label: '中风险' },
    { value: '低', label: '低风险' },
  ];
  
  // 日期范围状态
  const [startDate, setStartDate] = useState<Date | undefined>(
    filters.startDate ? new Date(filters.startDate) : undefined
  );
  const [endDate, setEndDate] = useState<Date | undefined>(
    filters.endDate ? new Date(filters.endDate) : undefined
  );
  
  // 检查是否有激活的筛选条件
  const hasActiveFilters = filters.type || filters.startDate || filters.endDate || filters.status || filters.risk || filters.responsibleDept || filters.search;
  const activeFilterCount = [filters.type, filters.startDate, filters.endDate, filters.status, filters.risk, filters.responsibleDept, filters.search].filter(Boolean).length;
  
  // 清空所有筛选
  const handleClearAll = () => {
    setStartDate(undefined);
    setEndDate(undefined);
    onFilterChange({ type: '', startDate: '', endDate: '', status: '', risk: '', responsibleDept: '', search: '' });
  };
  
  // 处理开始日期选择
  const handleStartDateSelect = (date: Date | undefined) => {
    setStartDate(date);
    if (date) {
      // 设置为当天00:00:00
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      onFilterChange({ ...filters, startDate: startOfDay.toISOString() });
    } else {
      onFilterChange({ ...filters, startDate: '' });
    }
  };
  
  // 处理结束日期选择
  const handleEndDateSelect = (date: Date | undefined) => {
    setEndDate(date);
    if (date) {
      // 设置为当天23:59:59
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      onFilterChange({ ...filters, endDate: endOfDay.toISOString() });
    } else {
      onFilterChange({ ...filters, endDate: '' });
    }
  };
  
  // 单个筛选器改变
  const handleChange = (key: string, value: string) => {
    onFilterChange({ ...filters, [key]: value });
  };
  
  return (
    <div className={cn("bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden", className)}>
      {/* 🟢 全局搜索框 - 始终可见 */}
      <div className="px-4 py-3 border-b border-slate-200">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={filters.search || ''}
            onChange={(e) => handleChange('search', e.target.value)}
            placeholder="搜索隐患编号、位置、描述、责任人..."
            className="w-full pl-10 pr-10 py-2.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white placeholder:text-slate-400"
          />
          {filters.search && (
            <button
              onClick={() => handleChange('search', '')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-100 rounded transition-colors"
            >
              <X className="w-4 h-4 text-slate-400" />
            </button>
          )}
        </div>
      </div>

      {/* 筛选栏头部 - 始终可见 */}
      <div 
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-blue-50 rounded-lg">
            <Filter className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800">筛选条件</h3>
            {hasActiveFilters && !isExpanded && (
              <p className="text-xs text-slate-500 mt-0.5">
                {activeFilterCount} 个筛选条件生效
              </p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleClearAll();
              }}
              className="text-xs text-slate-500 hover:text-slate-700 h-7"
            >
              <X className="w-3 h-3 mr-1" />
              清空
            </Button>
          )}
          
          <div className={cn(
            "p-1 rounded transition-transform duration-200",
            isExpanded && "rotate-180"
          )}>
            <ChevronDown className="w-4 h-4 text-slate-400" />
          </div>
        </div>
      </div>
      
      {/* 筛选栏内容 - 可折叠 */}
      <div className={cn(
        "transition-all duration-300 ease-in-out overflow-hidden",
        isExpanded ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
      )}>
        <div className="px-4 py-4 border-t border-slate-100 bg-slate-50/50">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            {/* 隐患类型 */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-600 block">
                隐患类型
              </label>
              <select
                value={filters.type}
                onChange={(e) => handleChange('type', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              >
                <option value="">全部类型</option>
                {config.types.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            
            {/* 上报开始时间 */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-600 block">
                开始时间
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal h-10 text-sm px-2.5",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-1.5 h-4 w-4 shrink-0" />
                    <span className="truncate">
                      {startDate ? format(startDate, "yy/MM/dd", { locale: zhCN }) : "起始日期"}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={handleStartDateSelect}
                    initialFocus
                    locale={zhCN}
                  />
                </PopoverContent>
              </Popover>
            </div>
            
            {/* 上报结束时间 */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-600 block">
                结束时间
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal h-10 text-sm px-2.5",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-1.5 h-4 w-4 shrink-0" />
                    <span className="truncate">
                      {endDate ? format(endDate, "yy/MM/dd", { locale: zhCN }) : "截止日期"}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={handleEndDateSelect}
                    initialFocus
                    locale={zhCN}
                    disabled={(date) => startDate ? date < startDate : false}
                  />
                </PopoverContent>
              </Popover>
            </div>
            
            {/* 责任部门 */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-600 block">
                责任部门
              </label>
              <button
                type="button"
                onClick={() => setShowDeptSelector(true)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white hover:bg-slate-50 transition-colors text-left flex items-center gap-2"
              >
                <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                <span className={cn(
                  "truncate flex-1",
                  !filters.responsibleDept && "text-slate-400"
                )}>
                  {filters.responsibleDept 
                    ? departments.find(d => d.id === filters.responsibleDept)?.name || '未知部门'
                    : '选择部门'}
                </span>
              </button>
            </div>
            
            {/* 处理状态 */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-600 block">
                处理状态
              </label>
              <select
                value={filters.status}
                onChange={(e) => handleChange('status', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              >
                {statusOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            
            {/* 风险等级 */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-600 block">
                风险等级
              </label>
              <select
                value={filters.risk}
                onChange={(e) => handleChange('risk', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              >
                {riskOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
          
          {/* 激活的筛选标签 */}
          {hasActiveFilters && (
            <div className="mt-4 pt-3 border-t border-slate-200">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-slate-500">当前筛选：</span>
                {filters.type && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                    类型: {filters.type}
                    <button
                      onClick={() => handleChange('type', '')}
                      className="hover:bg-blue-200 rounded p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {(filters.startDate || filters.endDate) && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                    时间: {filters.startDate ? format(new Date(filters.startDate), "yyyy-MM-dd") : '不限'} ~ {filters.endDate ? format(new Date(filters.endDate), "yyyy-MM-dd") : '不限'}
                    <button
                      onClick={() => {
                        setStartDate(undefined);
                        setEndDate(undefined);
                        onFilterChange({ ...filters, startDate: '', endDate: '' });
                      }}
                      className="hover:bg-blue-200 rounded p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {filters.responsibleDept && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                    部门: {departments.find(d => d.id === filters.responsibleDept)?.name || filters.responsibleDept}
                    <button
                      onClick={() => handleChange('responsibleDept', '')}
                      className="hover:bg-blue-200 rounded p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {filters.status && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                    状态: {statusOptions.find(s => s.value === filters.status)?.label}
                    <button
                      onClick={() => handleChange('status', '')}
                      className="hover:bg-blue-200 rounded p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {filters.risk && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                    风险: {filters.risk}
                    <button
                      onClick={() => handleChange('risk', '')}
                      className="hover:bg-blue-200 rounded p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 部门选择弹窗 */}
      <PeopleSelector
        isOpen={showDeptSelector}
        onClose={() => setShowDeptSelector(false)}
        mode="dept"
        multiSelect={false}
        onConfirm={(depts) => {
          if (depts.length > 0) {
            const dept = depts[0] as any;
            handleChange('responsibleDept', dept.id);
          }
          setShowDeptSelector(false);
        }}
        title="选择责任部门"
      />
    </div>
  );
}
