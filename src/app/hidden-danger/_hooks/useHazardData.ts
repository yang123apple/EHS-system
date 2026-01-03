// src/app/hidden-danger/_hooks/useHazardData.ts
import { useState, useEffect, useMemo } from 'react';
import { hazardService } from '@/services/hazard.service';
import { workflowService } from '@/services/workflow.service';
import { HazardRecord, HazardConfig, CCRule, EmergencyPlanRule } from '@/types/hidden-danger';
import { ViewMode, VIEW_MODES } from '@/constants/hazard';
import { canViewHazard } from '../_utils/permissions';
import { ApiError } from '@/lib/apiClient';
import { useToast } from '@/components/common/Toast';

export function useHazardData(user: any, currentViewMode?: ViewMode) {
  const toast = useToast();
  const [hazards, setHazards] = useState<HazardRecord[]>([]);
  const [config, setConfig] = useState<HazardConfig>({ types: [], areas: [] });
  const [workflowRules, setWorkflowRules] = useState<{ ccRules: CCRule[], planRules: EmergencyPlanRule[] }>({ ccRules: [], planRules: [] });
  const [loading, setLoading] = useState(true);

  // 分页与筛选
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [totalCount, setTotalCount] = useState(0); // Track total count
  const [filters, setFilters] = useState({ type: '', area: '', status: '', risk: '' });

  const fetchData = async (pageNum = 1, currentFilters = filters) => {
    // 如果用户未登录，直接返回，避免发起请求
    if (!user) {
      setLoading(false);
      setHazards([]);
      setTotalCount(0);
      return;
    }
    
    setLoading(true);
    try {
      // Pass filters and view context to server
      const requestFilters = {
          ...currentFilters,
          viewMode: currentViewMode === VIEW_MODES.MY_TASKS ? 'my_tasks' : undefined,
          userId: user?.id
      };

      const [hData, hConfig, wRules] = await Promise.all([
        hazardService.getHazards(pageNum, pageSize, requestFilters),
        hazardService.getConfig(),
        workflowService.getRules()
      ]);

      // Handle different API response structures
      if (hData && typeof hData === 'object') {
          if (hData.data && Array.isArray(hData.data)) {
              // Paginated response: { data: [], meta: { total, page, ... } }
              setHazards(hData.data);
              setTotalCount(hData.meta?.total || hData.data.length);
          } else if (Array.isArray(hData)) {
              // Direct array response
              setHazards(hData);
              setTotalCount(hData.length);
          } else {
              // Unexpected structure (e.g., stats response { riskStats, recurringIssues })
              // Set empty array to prevent filter errors
              console.warn('Unexpected API response structure:', hData);
              setHazards([]);
              setTotalCount(0);
          }
      } else {
          // Fallback for any other case
          setHazards([]);
          setTotalCount(0);
      }

      setConfig(hConfig);
      setWorkflowRules({ ccRules: wRules.ccRules || [], planRules: wRules.emergencyPlanRules || [] });
    } catch (error: any) {
      // 如果是 401 错误且用户已退出，静默处理
      if (error?.status === 401 && !user) {
        console.debug('用户已退出登录，忽略数据获取错误');
      } else {
        console.error('获取数据失败:', error);
        
        // 显示友好的错误提示
        if (error instanceof ApiError) {
          // 数据库错误
          if (error.message?.includes('数据库操作失败') || error.status === 500) {
            let details = error.data?.details || error.data?.message || '请稍后重试或联系管理员';
            
            // 如果是 Prisma 错误，尝试提供更友好的提示
            if (error.data?.code) {
              const code = error.data.code;
              // 常见的 Prisma 错误代码映射
              const errorMessages: Record<string, string> = {
                'P1001': '无法连接到数据库服务器',
                'P1002': '数据库连接超时',
                'P1003': '数据库不存在',
                'P1008': '操作超时',
                'P1009': '数据库已存在',
                'P1010': '用户访问被拒绝',
                'P1011': 'TLS 连接错误',
                'P1012': '数据库连接池错误',
                'P2000': '值太长，无法存储在列中',
                'P2001': '未找到相关记录',
                'P2002': '唯一约束违反',
                'P2003': '外键约束违反',
                'P2004': '约束违反',
                'P2005': '无效的值',
                'P2006': '提供的值无效',
                'P2007': '数据验证错误',
                'P2008': '查询解析错误',
                'P2009': '查询验证错误',
                'P2010': '原始查询失败',
                'P2011': '空约束违反',
                'P2012': '缺少必需的值',
                'P2013': '缺少必需参数',
                'P2014': '关系违反',
                'P2015': '相关记录未找到',
                'P2016': '查询解释错误',
                'P2017': '记录未满足要求',
                'P2018': '相关记录未找到',
                'P2019': '输入错误',
                'P2020': '值超出范围',
                'P2021': '表不存在',
                'P2022': '列不存在',
                'P2025': '操作失败，记录不存在',
              };
              
              if (errorMessages[code]) {
                details = `${errorMessages[code]} (${code})`;
              } else {
                details = `${details} (错误代码: ${code})`;
              }
            }
            
            toast.error('数据库操作失败', details);
            
            // 在开发环境下，也在控制台输出详细错误信息
            if (process.env.NODE_ENV === 'development') {
              console.error('[数据库错误详情]', {
                message: error.message,
                status: error.status,
                data: error.data,
                stack: error.stack
              });
            }
          } 
          // 权限错误
          else if (error.status === 403) {
            toast.error('权限不足', error.data?.details || '您没有权限访问此数据');
          }
          // 认证错误
          else if (error.status === 401) {
            toast.error('认证失败', '请重新登录');
          }
          // 其他错误
          else {
            toast.error(error.message || '获取数据失败', error.data?.details || '请稍后重试');
          }
        } else {
          // 非 ApiError 的其他错误
          const errorMessage = error?.message || '获取数据失败';
          toast.error(errorMessage, '请稍后重试');
        }
      }
      // Ensure hazards is always an array even on error
      setHazards([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  // Refetch when page, filters, or viewMode changes
  useEffect(() => {
      // 如果用户未登录，不执行数据获取，避免退出登录后的 API 错误
      if (!user) {
        setLoading(false);
        setHazards([]);
        setTotalCount(0);
        return;
      }
      fetchData(page, filters);
  }, [page, filters, currentViewMode, user]); // Added user dependency

  // Client-side post-filtering for permissions
  // 'My Tasks' logic is now handled by Server.
  // We still keep 'canViewHazard' as a safety check on the client.
  const filteredHazards = useMemo(() => {
    // Ensure hazards is an array before filtering
    if (!Array.isArray(hazards)) {
      console.warn('hazards is not an array:', hazards);
      return [];
    }
    
    return hazards.filter(h => {
      // Permission check
      if (!canViewHazard(h, user)) {
        return false;
      }
      return true;
    });
  }, [hazards, user]);

  // paginatedHazards was slicing the filtered list.
  // Now `hazards` is already a slice (from server).
  // If we filter client-side, `filteredHazards` is a subset of that slice.
  // We don't need to slice again if we trust the server page size.
  // However, `filteredHazards` might be smaller than pageSize.

  const paginatedHazards = filteredHazards; // Already "paginated" by source + filtered

  return {
    hazards, 
    setHazards,
    config, 
    setConfig,
    workflowRules,
    loading,
    page, 
    setPage,
    pageSize,
    filters, 
    setFilters,
    filteredHazards, // This is now just the filtered items of current page
    paginatedHazards, // Same as above
    refresh: () => fetchData(page),
    totalCount // Expose total count for pagination UI
  };
}
