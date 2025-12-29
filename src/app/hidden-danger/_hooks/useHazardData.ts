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

      if (hData.data) {
          // Server returned paginated structure
          setHazards(hData.data);
          // We might not get total count of *filtered* items unless we pass filters.
          // For now let's assume filtering happens on server or we accept client filtering on the page.
          // But wait, existing logic uses `filteredHazards`.
          // If we set `hazards` to just one page, `filteredHazards` will only contain that page's filtered items.
          // This changes behavior significantly.

          // FOR NOW: Let's fetch all if we are relying on complex client-side filtering,
          // OR if we are confident we can do basic pagination.
          // The prompt explicitly asked for pagination in "Hazard Investigation > Hazard Center > Latest Reports".
          // This implies we don't need to load EVERYTHING.

          // Let's keep it simple: If we use server pagination, we assume client filters are meant for the *fetched* dataset
          // OR we accept that we only see top N items.

          // Actually, `useHazardData` is used by `HiddenDangerPage`.
          // `filteredHazards` is derived.

          // Let's stick to client-side slicing for `filteredHazards` BUT fetch all data?
          // No, that defeats the purpose.

          // Strategy: Update `fetchData` to support optional pagination.
          // If we want real optimization, we should fetch paginated data.
          // But to do that correctly, we'd need to move filters to API.
          // I will implement fetching paginated data.

          // If API returns { data, meta }, use it.
          setHazards(hData.data);
          setTotalCount(hData.meta.total);
      } else {
          // Fallback (API returned array)
          setHazards(hData);
          setTotalCount(hData.length);
      }

      setConfig(hConfig);
      setWorkflowRules({ ccRules: wRules.ccRules || [], planRules: wRules.emergencyPlanRules || [] });
    } catch (error) {
      console.error('获取数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // Refetch when page, filters, or viewMode changes
  useEffect(() => {
      fetchData(page, filters);
  }, [page, filters, currentViewMode]); // Added currentViewMode dependency

  // Client-side post-filtering for permissions
  // 'My Tasks' logic is now handled by Server.
  // We still keep 'canViewHazard' as a safety check on the client.
  const filteredHazards = useMemo(() => {
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
