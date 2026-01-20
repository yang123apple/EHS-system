'use client';

/**
 * 事故事件管理 - 列表页
 */

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { Plus, AlertTriangle, Search, Filter, Eye, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { getIncidents } from '@/actions/incident';
import { IncidentTypeLabels, IncidentSeverityLabels, IncidentStatusLabels } from '@/types/incident';
import type { Incident } from '@/types/incident';
import IncidentReportModal from '@/components/incident/IncidentReportModal';
import IncidentDetailModal from '@/components/incident/IncidentDetailModal';

export default function IncidentPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  // 筛选条件
  const [filters, setFilters] = useState({
    status: '',
    type: '',
    severity: '',
    departmentId: '',
    startDate: '',
    endDate: '',
  });

  // 模态框状态
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // 获取事故列表
  const fetchIncidents = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const result = await getIncidents({
        ...filters,
        page,
        limit,
        startDate: filters.startDate ? new Date(filters.startDate) : undefined,
        endDate: filters.endDate ? new Date(filters.endDate) : undefined,
      });

      setIncidents((result.data || []) as unknown as Incident[]);
      setTotalPages(result.meta?.totalPages || 1);
      setTotal(result.meta?.total || 0);
    } catch (error) {
      console.error('获取事故列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidents();
  }, [page, filters, user]);

  // 处理筛选
  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1); // 重置到第一页
  };

  // 清除筛选
  const clearFilters = () => {
    setFilters({
      status: '',
      type: '',
      severity: '',
      departmentId: '',
      startDate: '',
      endDate: '',
    });
    setPage(1);
  };

  // 获取状态颜色
  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      reported: 'bg-blue-100 text-blue-700',
      investigating: 'bg-yellow-100 text-yellow-700',
      reviewed: 'bg-purple-100 text-purple-700',
      closed: 'bg-green-100 text-green-700',
      rejected: 'bg-red-100 text-red-700',
    };
    return colors[status] || 'bg-slate-100 text-slate-700';
  };

  // 获取严重程度颜色
  const getSeverityColor = (severity: string) => {
    const colors: Record<string, string> = {
      minor: 'bg-green-100 text-green-700',
      moderate: 'bg-yellow-100 text-yellow-700',
      serious: 'bg-orange-100 text-orange-700',
      critical: 'bg-red-100 text-red-700',
    };
    return colors[severity] || 'bg-slate-100 text-slate-700';
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
      {/* 头部 */}
      <div className="p-6 bg-white border-b shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">事故事件管理</h1>
            <p className="text-slate-500 mt-1">事故上报、调查、审批与结案管理</p>
          </div>
          <button
            onClick={() => setShowReportModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <Plus size={18} />
            <span>上报事故</span>
          </button>
        </div>

        {/* 筛选条件 */}
        <div className="flex gap-3 flex-wrap">
          <select
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">全部状态</option>
            <option value="reported">已上报</option>
            <option value="investigating">调查中</option>
            <option value="reviewed">待审批</option>
            <option value="closed">已结案</option>
            <option value="rejected">已驳回</option>
          </select>

          <select
            value={filters.type}
            onChange={(e) => handleFilterChange('type', e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">全部类型</option>
            <option value="injury">伤害事故</option>
            <option value="near_miss">未遂事故</option>
            <option value="property_damage">财产损失</option>
            <option value="environmental">环境事故</option>
          </select>

          <select
            value={filters.severity}
            onChange={(e) => handleFilterChange('severity', e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">全部严重程度</option>
            <option value="minor">轻微</option>
            <option value="moderate">中等</option>
            <option value="serious">严重</option>
            <option value="critical">重大</option>
          </select>

          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => handleFilterChange('startDate', e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="开始日期"
          />
          <span className="text-slate-400 flex items-center">至</span>
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => handleFilterChange('endDate', e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="结束日期"
          />

          {(filters.status || filters.type || filters.severity || filters.startDate || filters.endDate) && (
            <button
              onClick={clearFilters}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-600 text-sm"
            >
              清除筛选
            </button>
          )}
        </div>
      </div>

      {/* 列表内容 */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-slate-500">加载中...</span>
          </div>
        ) : incidents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            <AlertTriangle size={48} className="mb-4 opacity-50" />
            <p>暂无事故记录</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="p-4 text-left text-sm font-medium text-slate-700">事故编号</th>
                  <th className="p-4 text-left text-sm font-medium text-slate-700">类型</th>
                  <th className="p-4 text-left text-sm font-medium text-slate-700">严重程度</th>
                  <th className="p-4 text-left text-sm font-medium text-slate-700">发生时间</th>
                  <th className="p-4 text-left text-sm font-medium text-slate-700">地点</th>
                  <th className="p-4 text-left text-sm font-medium text-slate-700">状态</th>
                  <th className="p-4 text-left text-sm font-medium text-slate-700">上报人</th>
                  <th className="p-4 text-left text-sm font-medium text-slate-700">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {incidents.map((incident) => (
                  <tr
                    key={incident.id}
                    className="hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => {
                      setSelectedIncident(incident);
                      setShowDetailModal(true);
                    }}
                  >
                    <td className="p-4 font-mono text-sm text-slate-900">
                      {incident.code || incident.id.slice(0, 8)}
                    </td>
                    <td className="p-4 text-sm text-slate-700">
                      {IncidentTypeLabels[incident.type as keyof typeof IncidentTypeLabels] || incident.type}
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getSeverityColor(incident.severity)}`}>
                        {IncidentSeverityLabels[incident.severity as keyof typeof IncidentSeverityLabels] || incident.severity}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-slate-700">
                      {format(new Date(incident.occurredAt), 'yyyy-MM-dd HH:mm', { locale: zhCN })}
                    </td>
                    <td className="p-4 text-sm text-slate-700">{incident.location}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(incident.status)}`}>
                        {IncidentStatusLabels[incident.status as keyof typeof IncidentStatusLabels] || incident.status}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-slate-700">{incident.reporterName}</td>
                    <td className="p-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedIncident(incident);
                          setShowDetailModal(true);
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Eye size={14} /> 查看
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 分页 */}
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm text-slate-500">
              显示 {(page - 1) * limit + 1} - {Math.min(page * limit, total)} 条，共 {total} 条
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
                className="px-4 py-2 bg-white border rounded-lg text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
              >
                上一页
              </button>
              <span className="px-4 py-2 text-sm font-medium text-slate-700">
                第 {page} 页 / 共 {totalPages} 页
              </span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page === totalPages}
                className="px-4 py-2 bg-white border rounded-lg text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
              >
                下一页
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 上报事故模态框 */}
      {showReportModal && (
        <IncidentReportModal
          isOpen={showReportModal}
          onClose={() => {
            setShowReportModal(false);
            fetchIncidents(); // 刷新列表
          }}
        />
      )}

      {/* 详情模态框 */}
      {showDetailModal && selectedIncident && (
        <IncidentDetailModal
          incident={selectedIncident}
          isOpen={showDetailModal}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedIncident(null);
            fetchIncidents(); // 刷新列表
          }}
        />
      )}
    </div>
  );
}
