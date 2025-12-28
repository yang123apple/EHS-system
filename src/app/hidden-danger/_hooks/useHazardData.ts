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
  const [filters, setFilters] = useState({ type: '', area: '', status: '', risk: '' });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [hList, hConfig, wRules] = await Promise.all([
        hazardService.getHazards(),
        hazardService.getConfig(),
        workflowService.getRules()
      ]);
      setHazards(hList);
      setConfig(hConfig);
      setWorkflowRules({ ccRules: wRules.ccRules || [], planRules: wRules.emergencyPlanRules || [] });
    } catch (error) {
      console.error('获取数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // 根据当前视图模式和筛选条件过滤数据
  const filteredHazards = useMemo(() => {
    return hazards.filter(h => {
      // 首先检查用户是否有权限查看此隐患
      if (!canViewHazard(h, user)) {
        return false;
      }

      const matchType = !filters.type || h.type === filters.type;
      const matchArea = !filters.area || h.location === filters.area;
      const matchStatus = !filters.status || h.status === filters.status;
      const matchRisk = !filters.risk || h.riskLevel === filters.risk;
      
      // 我的任务视图：只显示与当前用户相关的隐患（包括抄送给我的）
      if (currentViewMode === VIEW_MODES.MY_TASKS) {
        const isMyTask = 
          h.reporterId === user?.id ||           // 我上报的
          h.dopersonal_ID === user?.id ||        // 当前步骤我是执行人
          h.responsibleId === user?.id ||        // 我是整改责任人（保留用于历史查看）
          h.ccUsers?.includes(user?.id) ||       // 抄送给我的
          h.verifierId === user?.id;             // 我验收的
        
        return isMyTask && matchType && matchArea && matchStatus && matchRisk;
      }
      
      return matchType && matchArea && matchStatus && matchRisk;
    });
  }, [hazards, filters, currentViewMode, user]);

  const paginatedHazards = filteredHazards.slice((page - 1) * pageSize, page * pageSize);

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
    filteredHazards,
    paginatedHazards,
    refresh: fetchData
  };
}
