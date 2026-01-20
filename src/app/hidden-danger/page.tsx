// src/app/hidden-danger/page.tsx
"use client";
import { useHazardData } from './_hooks/useHazardData';
import { useHazardWorkflow } from './_hooks/useHazardWorkflow';
import { OverviewDashboard } from './_components/views/OverviewDashboard';
import { HazardDataTable } from './_components/views/HazardDataTable';
import { WorkflowConfig } from './_components/views/WorkflowConfig';
import { StatsAnalysis } from './_components/views/StatsAnalysis';
import { SystemLogView } from './_components/views/SystemLogView';
import HazardDetailModal from './_components/modals/HazardDetailModal';
import { HazardReportModal } from './_components/modals/HazardReportModal';
import { BatchUploadModal } from './_components/modals/BatchUploadModal';
import { useAuth } from '@/context/AuthContext';
import { useState, useEffect } from 'react';
import { HazardRecord } from '@/types/hidden-danger';
import { hazardService } from '@/services/hazard.service';
import { ViewMode } from '@/constants/hazard';
import { useToast } from '@/components/common/Toast';
import { apiFetch } from '@/lib/apiClient';
import { setEndOfDay, extractDatePart, addDays, todayString, nowISOString } from '@/utils/dateUtils';

interface HiddenDangerPageProps {
  initialViewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
}

export default function HiddenDangerPage({ 
  initialViewMode, 
  onViewModeChange 
}: HiddenDangerPageProps) {
  const { user } = useAuth();
  const toast = useToast();
  const [selectedHazard, setSelectedHazard] = useState<HazardRecord | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showBatchUploadModal, setShowBatchUploadModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [workflowConfig, setWorkflowConfig] = useState<any>(null);
  
  // 使用自定义 Hook 管理数据获取、搜索和分页逻辑
  const { 
    paginatedHazards, 
    page, setPage,
    pageSize,
    filteredHazards,
    refresh, 
    config, 
    workflowRules,
    loading,
    totalCount // 🟢 Destructure totalCount
  } = useHazardData(user, initialViewMode);

  // 处理 URL 参数中的 hazardId，自动打开详情弹窗
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const hazardId = urlParams.get('hazardId');
    
    if (hazardId && filteredHazards.length > 0) {
      const hazard = filteredHazards.find(h => h.id === hazardId);
      if (hazard) {
        setSelectedHazard(hazard);
        // 清除 URL 参数
        window.history.replaceState({}, '', '/hidden-danger');
      }
    }
  }, [filteredHazards]);

  // 获取所有用户（用于指派）
  const fetchUsers = async () => {
    if (!user) return; // 用户未登录时不请求
    try {
      // 🟢 新增：只获取在职用户
      const res = await apiFetch('/api/users?activeOnly=true');
      const data = await res.json();
      setAllUsers(data);
    } catch (error) {
      console.error('获取用户列表失败:', error);
    }
  };

  // 获取部门列表
  const fetchDepartments = async () => {
    if (!user) return; // 用户未登录时不请求
    try {
      const res = await apiFetch('/api/org');
      const data = await res.json();
      
      // 扁平化部门树，保留所有字段（包括 managerId）
      const flattenDepts = (nodes: any[], result: any[] = []): any[] => {
        // 确保 nodes 是数组
        if (!Array.isArray(nodes) || nodes.length === 0) {
          return result;
        }
        
        nodes.forEach(node => {
          result.push({ 
            id: node.id, 
            name: node.name,
            parentId: node.parentId,
            level: node.level,
            managerId: node.managerId
          });
          if (node.children && Array.isArray(node.children) && node.children.length > 0) {
            flattenDepts(node.children, result);
          }
        });
        return result;
      };
      
      // 确保 data 是数组
      setDepartments(flattenDepts(Array.isArray(data) ? data : []));
    } catch (error) {
      console.error('获取部门列表失败:', error);
    }
  };

  // 获取工作流配置
  const fetchWorkflowConfig = async () => {
    if (!user) return; // 用户未登录时不请求
    try {
      const res = await apiFetch('/api/hazards/workflow');
      if (res.ok) {
        const result = await res.json();
        if (result.success && result.data) {
          setWorkflowConfig(result.data);
        }
      }
    } catch (error) {
      console.error('获取工作流配置失败:', error);
    }
  };

  // 初始化时获取用户列表、部门列表和工作流配置
  useEffect(() => {
    if (!user) return; // 用户未登录时不执行
    fetchUsers();
    fetchDepartments();
    fetchWorkflowConfig();
  }, [user]); // 依赖 user，当用户状态变化时重新执行

  // 当前视图模式由 layout 通过 props 传入
  const viewMode = initialViewMode || 'overview';

  // 使用业务 Hook 处理流程流转
  const { processAction: rawProcessAction, loading: actionLoading } = useHazardWorkflow(() => {
    refresh();
    setSelectedHazard(null);
  });

  // 包装 processAction，自动传入 allUsers、workflowConfig 和 departments
  const processAction = (action: string, hazard?: HazardRecord, payload?: any, user?: any, rules?: any) => {
    return rawProcessAction(action, hazard, payload, user, rules, allUsers, workflowConfig, departments);
  };

  // 处理上报
  const handleReport = async (formData: any) => {
    try {
      // 🔒 编号由后端自动生成，确保唯一性（不再在前端生成）
      // 1. 保存隐患基础数据（状态为 reported）
      const newHazard = await hazardService.createHazard({
        ...formData,
        // 不传入 code，由后端自动生成
        reporterId: user?.id,
        reporterName: user?.name,
        reportTime: new Date().toISOString(),
        currentStepIndex: 0,  // 初始化步骤索引为0（第一步）
        currentStepId: 'report',  // 初始化步骤ID
      });

      // 2. 自动执行工作流步骤1（上报并指派）
      // 步骤1的执行人强制为上报人，系统自动执行
      await processAction('submit', newHazard, {}, user);

      setShowReportModal(false);
      refresh();
      toast.success('隐患上报成功，已自动进入处理流程');
    } catch (error) {
      console.error('上报失败:', error);
      toast.error('上报失败，请重试');
    }
  };

  // 处理批量上传
  const handleBatchUpload = async (data: any[]) => {
    try {
      let successCount = 0;
      let failCount = 0;

      // 逐条处理上传的隐患数据
      for (let i = 0; i < data.length; i++) {
        try {
          const item = data[i];

          // 计算截止日期（设置为当天的结束时间 23:59:59.999）
          const deadline = addDays(new Date(), item.deadlineDays || 7, true);

          // 🔒 创建隐患记录（编号由后端自动生成，确保唯一性）
          const newHazard = await hazardService.createHazard({
            type: item.type,
            location: item.location,
            desc: item.desc,
            riskLevel: item.riskLevel,
            responsibleDeptName: item.responsibleDeptName,
            // 不传入 code，由后端自动生成
            reporterId: user?.id,
            reporterName: user?.name,
            reportTime: new Date().toISOString(),
            deadline: deadline.toISOString(),
            photos: [],
          });

          // 自动执行工作流步骤1
          await processAction('submit', newHazard, {}, user);
          successCount++;
        } catch (error) {
          console.error(`第 ${i + 1} 条上传失败:`, error);
          failCount++;
        }
      }

      if (successCount > 0) {
        await refresh();
        toast.success(`批量上传完成：成功 ${successCount} 条${failCount > 0 ? `，失败 ${failCount} 条` : ''}`);
      } else {
        toast.error('批量上传失败，请检查数据后重试');
      }
    } catch (error) {
      console.error('批量上传失败:', error);
      throw error;
    }
  };

  // 删除隐患
  const handleDelete = async (id: string) => {
    setShowDeleteConfirm(id);
  };

  const confirmDelete = async () => {
    if (!showDeleteConfirm) return;
    
    try {
      await hazardService.deleteHazard(showDeleteConfirm);
      setShowDeleteConfirm(null);
      setSelectedHazard(null); // 关闭详情弹窗
      await refresh(); // 等待刷新完成
      toast.success('删除成功');
    } catch (error) {
      console.error('删除失败:', error);
      toast.error('删除失败，请重试');
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* 视图切换器：根据 viewMode 渲染不同视图组件 */}
      <main className="flex-1 overflow-auto p-6">
        {viewMode === 'overview' && (
          <OverviewDashboard 
            hazards={filteredHazards} 
            onSelect={setSelectedHazard}
            onReport={() => setShowReportModal(true)}
            onBatchUpload={() => setShowBatchUploadModal(true)}
            loading={loading}
          />
        )}
        
        {(viewMode === 'all_list' || viewMode === 'my_tasks') && (
          <HazardDataTable 
            hazards={paginatedHazards}
            total={totalCount || filteredHazards.length}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onSelect={setSelectedHazard} 
            onDelete={handleDelete}
            loading={loading}
            viewMode={viewMode}
            user={user}
          />
        )}

        {viewMode === 'stats' && (
          <StatsAnalysis 
            hazards={filteredHazards}
            loading={loading}
          />
        )}

        {viewMode === 'config' && (
          <WorkflowConfig 
            config={config} 
            ccRules={workflowRules.ccRules}
            planRules={workflowRules.planRules}
            allUsers={allUsers}
            departments={departments}
            onRefresh={refresh}
          />
        )}

        {viewMode === 'logs' && (
          <SystemLogView loading={loading} />
        )}
      </main>

      {/* 上报弹窗 */}
      {showReportModal && (
        <HazardReportModal 
          config={config}
          allUsers={allUsers}
          departments={departments}
          workflowConfig={workflowConfig}
          onClose={() => setShowReportModal(false)}
          onSubmit={handleReport}
        />
      )}

      {/* 批量上传弹窗 */}
      {showBatchUploadModal && (
        <BatchUploadModal
          onClose={() => setShowBatchUploadModal(false)}
          onUpload={handleBatchUpload}
        />
      )}

      {/* 全局详情弹窗：通过状态控制显隐 */}
      {selectedHazard && (
        <HazardDetailModal 
          hazard={selectedHazard}
          user={user}
          allUsers={allUsers}
          onClose={() => setSelectedHazard(null)}
          onProcess={processAction}
          onDelete={handleDelete}
          loading={actionLoading}
        />
      )}

      {/* 删除确认弹窗 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full">
            <h3 className="text-lg font-bold mb-4">确认删除</h3>
            <p className="text-slate-600 mb-6">确定要删除这条隐患记录吗？此操作无法撤销。</p>
            <div className="flex gap-3 justify-end">
              <button 
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 border rounded-lg hover:bg-slate-50"
              >
                取消
              </button>
              <button 
                onClick={confirmDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
