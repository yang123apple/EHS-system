// src/app/hidden-danger/_hooks/useHazardData.ts
import { useState, useEffect, useMemo } from 'react';
import { hazardService } from '@/services/hazard.service';
import { workflowService } from '@/services/workflow.service';
import { HazardRecord, HazardConfig, CCRule, EmergencyPlanRule } from '@/types/hidden-danger';
import { ViewMode, VIEW_MODES } from '@/constants/hazard';
import { canViewHazard } from '../_utils/permissions';

export function useHazardData(user: any, currentViewMode?: ViewMode) {
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
