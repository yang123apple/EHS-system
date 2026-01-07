"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { 
  Bot, 
  Plus, 
  Edit, 
  Trash2, 
  Settings, 
  FileText, 
  BarChart3, 
  Shield,
  Search,
  Filter,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  TrendingUp,
  Users,
  Building2,
  Zap
} from 'lucide-react';
import { apiFetch } from '@/lib/apiClient';

interface AIApiConfig {
  id: string;
  name: string;
  provider: string;
  endpoint: string;
  model?: string;
  maxTokens: number;
  temperature: number;
  isActive: boolean;
  rateLimitPerMinute: number;
  rateLimitPerDay: number;
  apiKey: string;
  createdAt: string;
  updatedAt: string;
}

interface AIApiLog {
  id: string;
  configId: string;
  config: {
    name: string;
    provider: string;
    model?: string;
  };
  requestBy?: string;
  requestSource?: string;
  status: string;
  tokens?: number;
  duration?: number;
  errorMessage?: string;
  createdAt: string;
}

interface RateLimit {
  id: string;
  userId?: string;
  departmentId?: string;
  userName?: string;
  departmentName?: string;
  dailyLimit: number;
  isActive: boolean;
}

type TabType = 'config' | 'logs' | 'rate-limit' | 'stats';

export default function AIApiManagementPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('config');
  
  // 配置管理
  const [configs, setConfigs] = useState<AIApiConfig[]>([]);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [editingConfig, setEditingConfig] = useState<AIApiConfig | null>(null);
  const [configForm, setConfigForm] = useState({
    name: '',
    provider: 'openai',
    apiKey: '',
    endpoint: '',
    model: '',
    maxTokens: 2000,
    temperature: 0.7,
    isActive: true,
    rateLimitPerMinute: 1000,
    rateLimitPerDay: 50000,
  });

  // 调用日志
  const [logs, setLogs] = useState<AIApiLog[]>([]);
  const [logPage, setLogPage] = useState(1);
  const [logTotal, setLogTotal] = useState(0);
  const [logFilters, setLogFilters] = useState({
    configId: '',
    status: '',
    requestSource: '',
  });

  // 限流策略
  const [rateLimits, setRateLimits] = useState<RateLimit[]>([]);
  const [showRateLimitModal, setShowRateLimitModal] = useState(false);
  const [editingRateLimit, setEditingRateLimit] = useState<RateLimit | null>(null);
  const [rateLimitForm, setRateLimitForm] = useState({
    userId: '',
    departmentId: '',
    dailyLimit: 100,
    isActive: true,
  });
  const [users, setUsers] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);

  // 使用统计
  const [stats, setStats] = useState<any>(null);
  const [statsGroupBy, setStatsGroupBy] = useState<'user' | 'department' | 'overall'>('overall');
  const [userStats, setUserStats] = useState<any[]>([]);
  const [deptStats, setDeptStats] = useState<any[]>([]);

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user && user.role !== 'admin') {
      router.push('/dashboard');
      return;
    }
    loadData();
  }, [user, activeTab, logPage, logFilters, statsGroupBy]);

  const loadData = async () => {
    if (!user || user.role !== 'admin') return;

    setLoading(true);
    try {
      if (activeTab === 'config') {
        await loadConfigs();
      } else if (activeTab === 'logs') {
        await loadLogs();
      } else if (activeTab === 'rate-limit') {
        await loadRateLimits();
        await loadUsersAndDepartments();
      } else if (activeTab === 'stats') {
        await loadStats();
      }
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadConfigs = async () => {
    const res = await apiFetch('/api/admin/ai-api');
    const data = await res.json();
    if (data.success) {
      setConfigs(data.data);
    }
  };

  const loadLogs = async () => {
    const params = new URLSearchParams({
      action: 'logs',
      page: logPage.toString(),
      limit: '20',
      ...(logFilters.configId && { configId: logFilters.configId }),
      ...(logFilters.status && { status: logFilters.status }),
      ...(logFilters.requestSource && { requestSource: logFilters.requestSource }),
    });
    const res = await apiFetch(`/api/admin/ai-api?${params}`);
    const data = await res.json();
    if (data.success) {
      setLogs(data.data.logs);
      setLogTotal(data.data.pagination.total);
    }
  };

  const loadRateLimits = async () => {
    const res = await apiFetch('/api/admin/ai-api?action=rate-limits');
    const data = await res.json();
    if (data.success) {
      setRateLimits(data.data);
    }
  };

  const loadUsersAndDepartments = async () => {
    const [usersRes, deptsRes] = await Promise.all([
      apiFetch('/api/users'),
      apiFetch('/api/org'),
    ]);
    const usersData = await usersRes.json();
    const deptsData = await deptsRes.json();
    if (usersData) setUsers(usersData);
    if (deptsData) setDepartments(deptsData);
  };

  const loadStats = async () => {
    if (statsGroupBy === 'overall') {
      const res = await apiFetch('/api/admin/ai-api?action=stats');
      const data = await res.json();
      if (data.success) {
        setStats(data.data);
      }
    } else {
      const res = await apiFetch(`/api/admin/ai-api?action=stats&groupBy=${statsGroupBy}`);
      const data = await res.json();
      if (data.success) {
        if (statsGroupBy === 'user') {
          setUserStats(data.data);
        } else {
          setDeptStats(data.data);
        }
      }
    }
  };

  const handleSaveConfig = async () => {
    try {
      setLoading(true);
      const url = '/api/admin/ai-api';
      const method = editingConfig ? 'PUT' : 'POST';
      const body = editingConfig 
        ? { id: editingConfig.id, ...configForm }
        : configForm;

      const res = await apiFetch(url, {
        method,
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (data.success) {
        alert(editingConfig ? '更新成功' : '创建成功');
        setShowConfigModal(false);
        setEditingConfig(null);
        resetConfigForm();
        loadConfigs();
      } else {
        alert(data.message || '操作失败');
      }
    } catch (error) {
      console.error('保存配置失败:', error);
      alert('操作失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteConfig = async (id: string) => {
    if (!confirm('确定要删除此配置吗？')) return;
    try {
      const res = await apiFetch(`/api/admin/ai-api?id=${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        alert('删除成功');
        loadConfigs();
      } else {
        alert(data.message || '删除失败');
      }
    } catch (error) {
      console.error('删除配置失败:', error);
      alert('删除失败');
    }
  };

  const handleSaveRateLimit = async () => {
    try {
      setLoading(true);
      const url = '/api/admin/ai-api';
      const method = editingRateLimit ? 'PUT' : 'POST';
      const body = editingRateLimit
        ? { id: editingRateLimit.id, action: 'rate-limit', ...rateLimitForm }
        : { action: 'rate-limit', ...rateLimitForm };

      const res = await apiFetch(url, {
        method,
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (data.success) {
        alert(editingRateLimit ? '更新成功' : '创建成功');
        setShowRateLimitModal(false);
        setEditingRateLimit(null);
        resetRateLimitForm();
        loadRateLimits();
      } else {
        alert(data.message || '操作失败');
      }
    } catch (error) {
      console.error('保存限流策略失败:', error);
      alert('操作失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRateLimit = async (id: string) => {
    if (!confirm('确定要删除此限流策略吗？')) return;
    try {
      const res = await apiFetch(`/api/admin/ai-api?id=${id}&action=rate-limit`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        alert('删除成功');
        loadRateLimits();
      } else {
        alert(data.message || '删除失败');
      }
    } catch (error) {
      console.error('删除限流策略失败:', error);
      alert('删除失败');
    }
  };

  const resetConfigForm = () => {
    setConfigForm({
      name: '',
      provider: 'openai',
      apiKey: '',
      endpoint: '',
      model: '',
      maxTokens: 2000,
      temperature: 0.7,
      isActive: true,
      rateLimitPerMinute: 1000,
      rateLimitPerDay: 50000,
    });
  };

  const resetRateLimitForm = () => {
    setRateLimitForm({
      userId: '',
      departmentId: '',
      dailyLimit: 100,
      isActive: true,
    });
  };

  const openEditConfig = (config: AIApiConfig) => {
    setEditingConfig(config);
    setConfigForm({
      name: config.name,
      provider: config.provider,
      apiKey: config.apiKey, // 保持masked值
      endpoint: config.endpoint,
      model: config.model || '',
      maxTokens: config.maxTokens,
      temperature: config.temperature,
      isActive: config.isActive,
      rateLimitPerMinute: config.rateLimitPerMinute,
      rateLimitPerDay: config.rateLimitPerDay,
    });
    setShowConfigModal(true);
  };

  const openEditRateLimit = (limit: RateLimit) => {
    setEditingRateLimit(limit);
    setRateLimitForm({
      userId: limit.userId || '',
      departmentId: limit.departmentId || '',
      dailyLimit: limit.dailyLimit,
      isActive: limit.isActive,
    });
    setShowRateLimitModal(true);
  };

  if (!user || user.role !== 'admin') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* 页面标题 */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-800">AI API管理</h1>
              <p className="text-gray-600">配置AI接口、查看调用日志、管理限流策略和使用统计</p>
            </div>
          </div>
        </div>

        {/* 标签页 */}
        <div className="bg-white rounded-xl shadow-sm mb-6">
          <div className="flex border-b border-gray-200">
            {[
              { id: 'config' as TabType, label: '接口配置', icon: Settings },
              { id: 'logs' as TabType, label: '调用日志', icon: FileText },
              { id: 'rate-limit' as TabType, label: '限流策略', icon: Shield },
              { id: 'stats' as TabType, label: '使用统计', icon: BarChart3 },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors ${
                  activeTab === id
                    ? 'text-indigo-600 border-b-2 border-indigo-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Icon className="w-5 h-5" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* 内容区域 */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-6 h-6 text-indigo-600 animate-spin" />
            </div>
          )}

          {/* 接口配置 */}
          {activeTab === 'config' && !loading && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-800">API接口配置</h2>
                <button
                  onClick={() => {
                    setEditingConfig(null);
                    resetConfigForm();
                    setShowConfigModal(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                >
                  <Plus className="w-4 h-4" />
                  新增配置
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {configs.map((config) => (
                  <div key={config.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-bold text-gray-800">{config.name}</h3>
                        <p className="text-sm text-gray-500">{config.provider}</p>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs ${config.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {config.isActive ? '启用' : '禁用'}
                      </span>
                    </div>
                    <div className="space-y-1 text-sm text-gray-600 mb-3">
                      <p>端点: {config.endpoint}</p>
                      {config.model && <p>模型: {config.model}</p>}
                      <p>每日限制: {config.rateLimitPerDay.toLocaleString()}次</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => openEditConfig(config)}
                        className="flex-1 px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition"
                      >
                        <Edit className="w-4 h-4 inline mr-1" />
                        编辑
                      </button>
                      <button
                        onClick={() => handleDeleteConfig(config.id)}
                        className="flex-1 px-3 py-1.5 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition"
                      >
                        <Trash2 className="w-4 h-4 inline mr-1" />
                        删除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 调用日志 */}
          {activeTab === 'logs' && !loading && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-800">调用日志</h2>
                <div className="flex gap-2">
                  <select
                    value={logFilters.configId}
                    onChange={(e) => setLogFilters({ ...logFilters, configId: e.target.value })}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="">全部接口</option>
                    {configs.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <select
                    value={logFilters.status}
                    onChange={(e) => setLogFilters({ ...logFilters, status: e.target.value })}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="">全部状态</option>
                    <option value="success">成功</option>
                    <option value="error">失败</option>
                    <option value="rate_limited">限流</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">时间</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">接口</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">调用者</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">状态</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Tokens</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">耗时</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {logs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {new Date(log.createdAt).toLocaleString('zh-CN')}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-800">
                          {log.config.name}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {log.requestBy || '系统'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-xs ${
                            log.status === 'success' ? 'bg-green-100 text-green-700' :
                            log.status === 'rate_limited' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {log.status === 'success' ? '成功' : log.status === 'rate_limited' ? '限流' : '失败'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {log.tokens?.toLocaleString() || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {log.duration ? `${log.duration}ms` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 分页 */}
              <div className="flex justify-between items-center mt-6">
                <span className="text-sm text-gray-600">共 {logTotal} 条记录</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setLogPage(p => Math.max(1, p - 1))}
                    disabled={logPage === 1}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm disabled:opacity-50"
                  >
                    上一页
                  </button>
                  <span className="px-4 py-2 text-sm">第 {logPage} 页</span>
                  <button
                    onClick={() => setLogPage(p => p + 1)}
                    disabled={logPage * 20 >= logTotal}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm disabled:opacity-50"
                  >
                    下一页
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 限流策略 */}
          {activeTab === 'rate-limit' && !loading && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-800">限流策略</h2>
                <button
                  onClick={() => {
                    setEditingRateLimit(null);
                    resetRateLimitForm();
                    setShowRateLimitModal(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                >
                  <Plus className="w-4 h-4" />
                  新增策略
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">用户/部门</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">每日限制</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">状态</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {rateLimits.map((limit) => (
                      <tr key={limit.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-800">
                          {limit.userName || limit.departmentName || '全局'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {limit.dailyLimit.toLocaleString()} 次/天
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-xs ${limit.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                            {limit.isActive ? '启用' : '禁用'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button
                              onClick={() => openEditRateLimit(limit)}
                              className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition"
                            >
                              编辑
                            </button>
                            <button
                              onClick={() => handleDeleteRateLimit(limit.id)}
                              className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition"
                            >
                              删除
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 使用统计 */}
          {activeTab === 'stats' && !loading && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-800">使用统计</h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => setStatsGroupBy('overall')}
                    className={`px-4 py-2 rounded-lg text-sm transition ${
                      statsGroupBy === 'overall' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    总体统计
                  </button>
                  <button
                    onClick={() => setStatsGroupBy('user')}
                    className={`px-4 py-2 rounded-lg text-sm transition ${
                      statsGroupBy === 'user' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    按用户
                  </button>
                  <button
                    onClick={() => setStatsGroupBy('department')}
                    className={`px-4 py-2 rounded-lg text-sm transition ${
                      statsGroupBy === 'department' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    按部门
                  </button>
                </div>
              </div>

              {statsGroupBy === 'overall' && stats && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-blue-700 font-medium">总调用次数</span>
                      <Zap className="w-5 h-5 text-blue-600" />
                    </div>
                    <p className="text-2xl font-bold text-blue-900">{stats.totalCalls.toLocaleString()}</p>
                  </div>
                  <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-green-700 font-medium">今日调用</span>
                      <TrendingUp className="w-5 h-5 text-green-600" />
                    </div>
                    <p className="text-2xl font-bold text-green-900">{stats.todayCalls.toLocaleString()}</p>
                  </div>
                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-purple-700 font-medium">成功率</span>
                      <CheckCircle2 className="w-5 h-5 text-purple-600" />
                    </div>
                    <p className="text-2xl font-bold text-purple-900">{stats.successRate.toFixed(1)}%</p>
                  </div>
                  <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-orange-700 font-medium">总Tokens</span>
                      <BarChart3 className="w-5 h-5 text-orange-600" />
                    </div>
                    <p className="text-2xl font-bold text-orange-900">{stats.totalTokens.toLocaleString()}</p>
                  </div>
                </div>
              )}

              {statsGroupBy === 'user' && userStats.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">用户</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">部门</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">总调用</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">今日调用</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">总Tokens</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">成功率</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {userStats.map((stat: any) => (
                        <tr key={stat.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-800">{stat.name}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{stat.departmentName || '-'}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{stat.totalCalls.toLocaleString()}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{stat.todayCalls.toLocaleString()}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{stat.totalTokens.toLocaleString()}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {stat.totalCalls > 0 ? ((stat.successCalls / stat.totalCalls) * 100).toFixed(1) : 0}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {statsGroupBy === 'department' && deptStats.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">部门</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">总调用</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">今日调用</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">总Tokens</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">成功率</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {deptStats.map((stat: any) => (
                        <tr key={stat.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-800">{stat.name}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{stat.totalCalls.toLocaleString()}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{stat.todayCalls.toLocaleString()}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{stat.totalTokens.toLocaleString()}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {stat.totalCalls > 0 ? ((stat.successCalls / stat.totalCalls) * 100).toFixed(1) : 0}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 配置弹窗 */}
        {showConfigModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <h3 className="text-xl font-bold mb-4">{editingConfig ? '编辑配置' : '新增配置'}</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">名称 *</label>
                  <input
                    type="text"
                    value={configForm.name}
                    onChange={(e) => setConfigForm({ ...configForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">提供商 *</label>
                  <select
                    value={configForm.provider}
                    onChange={(e) => setConfigForm({ ...configForm, provider: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="openai">OpenAI</option>
                    <option value="azure">Azure OpenAI</option>
                    <option value="custom">自定义</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">API Key *</label>
                  <input
                    type="password"
                    value={configForm.apiKey}
                    onChange={(e) => setConfigForm({ ...configForm, apiKey: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder={editingConfig ? '留空则不更新' : ''}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">端点 *</label>
                  <input
                    type="text"
                    value={configForm.endpoint}
                    onChange={(e) => setConfigForm({ ...configForm, endpoint: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">模型</label>
                  <input
                    type="text"
                    value={configForm.model}
                    onChange={(e) => setConfigForm({ ...configForm, model: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">每日限制</label>
                    <input
                      type="number"
                      value={configForm.rateLimitPerDay}
                      onChange={(e) => setConfigForm({ ...configForm, rateLimitPerDay: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">每分钟限制</label>
                    <input
                      type="number"
                      value={configForm.rateLimitPerMinute}
                      onChange={(e) => setConfigForm({ ...configForm, rateLimitPerMinute: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={configForm.isActive}
                    onChange={(e) => setConfigForm({ ...configForm, isActive: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <label className="text-sm text-gray-700">启用</label>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleSaveConfig}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                >
                  保存
                </button>
                <button
                  onClick={() => {
                    setShowConfigModal(false);
                    setEditingConfig(null);
                    resetConfigForm();
                  }}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 限流策略弹窗 */}
        {showRateLimitModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md">
              <h3 className="text-xl font-bold mb-4">{editingRateLimit ? '编辑限流策略' : '新增限流策略'}</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">用户（可选）</label>
                  <select
                    value={rateLimitForm.userId}
                    onChange={(e) => setRateLimitForm({ ...rateLimitForm, userId: e.target.value, departmentId: '' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">全部用户</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">部门（可选）</label>
                  <select
                    value={rateLimitForm.departmentId}
                    onChange={(e) => setRateLimitForm({ ...rateLimitForm, departmentId: e.target.value, userId: '' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    disabled={!!rateLimitForm.userId}
                  >
                    <option value="">全部部门</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">每日限制 *</label>
                  <input
                    type="number"
                    value={rateLimitForm.dailyLimit}
                    onChange={(e) => setRateLimitForm({ ...rateLimitForm, dailyLimit: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={rateLimitForm.isActive}
                    onChange={(e) => setRateLimitForm({ ...rateLimitForm, isActive: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <label className="text-sm text-gray-700">启用</label>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleSaveRateLimit}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                >
                  保存
                </button>
                <button
                  onClick={() => {
                    setShowRateLimitModal(false);
                    setEditingRateLimit(null);
                    resetRateLimitForm();
                  }}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}



