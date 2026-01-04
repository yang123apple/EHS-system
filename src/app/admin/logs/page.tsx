"use client";

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useToast } from '@/components/common/Toast';
import { 
  Activity, 
  User, 
  Clock, 
  Monitor,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  Users,
  FileText,
  Calendar,
  Filter,
  Download,
  RefreshCw,
  Globe,
  Archive,
  Eye,
  X
} from 'lucide-react';

interface SystemLog {
  id: string;
  userId: string | null;
  userName: string | null;
  action: string;
  targetId: string | null;
  targetType: string | null;
  details: string | null;
  ip: string | null;
  createdAt: string;
}

interface LogStats {
  overview: {
    totalLogs: number;
    todayLogs: number;
    todayLogins: number;
    uniqueUsersToday: number;
    loginLogs: number;
    operationLogs: number;
    errorLogs: number;
  };
  topUsers: Array<{ userId: string; userName: string; count: number }>;
  topActions: Array<{ action: string; count: number }>;
  dailyStats: Array<{ date: string; count: number }>;
}

interface ArchiveFile {
  fileName: string;
  size: number;
  sizeFormatted: string;
  createdAt: string;
}

export default function LogsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'login' | 'operation' | 'stats' | 'archives'>('login');
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [stats, setStats] = useState<LogStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({
    userId: '',
    action: '',
    targetType: '',
    startDate: '',
    endDate: '',
  });
  const [archiveFiles, setArchiveFiles] = useState<ArchiveFile[]>([]);
  const [previewArchiveFile, setPreviewArchiveFile] = useState<string | null>(null);

  // 权限检查
  if (user && user.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-800 mb-2">权限不足</h2>
            <p className="text-gray-600">只有管理员可以访问系统日志</p>
          </div>
        </div>
      </div>
    );
  }

  useEffect(() => {
    if (activeTab === 'stats') {
      fetchStats();
    } else if (activeTab === 'archives') {
      fetchArchiveFiles();
    } else {
      fetchLogs();
    }
  }, [activeTab, page, filters]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        type: activeTab,
        ...filters,
      });

      const response = await fetch(`/api/admin/logs?${params}`);
      const result = await response.json();

      if (result.success) {
        setLogs(result.data.logs);
        setTotal(result.data.pagination.total);
      }
    } catch (error) {
      console.error('获取日志失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'stats' }),
      });
      const result = await response.json();

      if (result.success) {
        setStats(result.data);
      }
    } catch (error) {
      console.error('获取统计数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchArchiveFiles = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/system/archive-logs');
      const result = await response.json();

      if (result.success) {
        setArchiveFiles(result.data.files || []);
      }
    } catch (error) {
      console.error('获取归档文件列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadArchive = async (fileName: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/system/archive-logs?file=${encodeURIComponent(fileName)}`);
      const result = await response.json();

      if (result.success && result.data.logs) {
        // 将归档日志转换为 SystemLog 格式
        const archiveLogs: SystemLog[] = result.data.logs.map((log: any) => ({
          id: log.id,
          userId: log.userId,
          userName: log.userName,
          action: log.action,
          targetId: log.targetId,
          targetType: log.targetType,
          details: log.details,
          ip: log.ip,
          createdAt: log.createdAt,
        }));

        setLogs(archiveLogs);
        setTotal(archiveLogs.length);
        setPreviewArchiveFile(fileName);
        
        // 根据日志内容自动切换 tab
        // 检查是否有登录相关的日志
        const hasLoginLogs = archiveLogs.some(log => 
          log.action?.toLowerCase().includes('login') || 
          log.action?.toLowerCase().includes('登录')
        );
        
        if (hasLoginLogs) {
          setActiveTab('login');
        } else {
          setActiveTab('operation');
        }

        // 显示 Toast 提示
        toast.success('已加载归档数据', `已加载 ${archiveLogs.length} 条归档日志`);
      }
    } catch (error) {
      console.error('加载归档文件失败:', error);
      alert('加载归档文件失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadArchive = async (fileName: string) => {
    try {
      const response = await fetch(`/api/admin/system/archive-logs?file=${encodeURIComponent(fileName)}`);
      const result = await response.json();

      if (result.success) {
        // 创建 Blob 并下载
        const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('下载归档文件失败:', error);
      alert('下载归档文件失败');
    }
  };

  const handleExitPreview = () => {
    setPreviewArchiveFile(null);
    setLogs([]);
    setTotal(0);
    setPage(1);
    // 重新获取最新数据库日志
    // 如果当前在 login 或 operation tab，重新获取日志
    if (activeTab === 'login' || activeTab === 'operation') {
      fetchLogs();
    } else {
      // 如果不在日志 tab，切换到 login tab 并获取日志
      setActiveTab('login');
      // useEffect 会自动触发 fetchLogs
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getActionColor = (action: string) => {
    if (action.includes('login') || action.includes('logout') || action.includes('登录') || action.includes('退出')) return 'text-green-600 bg-green-50';
    if (action.includes('create') || action.includes('创建')) return 'text-blue-600 bg-blue-50';
    if (action.includes('update') || action.includes('更新') || action.includes('编辑')) return 'text-yellow-600 bg-yellow-50';
    if (action.includes('delete') || action.includes('删除')) return 'text-red-600 bg-red-50';
    return 'text-gray-600 bg-gray-50';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-7xl mx-auto">
        {/* 页头 */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 mb-2">系统日志管理</h1>
              <p className="text-gray-600">查看和分析系统操作日志</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  if (activeTab === 'stats') {
                    fetchStats();
                  } else if (activeTab === 'archives') {
                    fetchArchiveFiles();
                  } else {
                    fetchLogs();
                  }
                }}
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
              >
                <RefreshCw size={16} />
                刷新
              </button>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
                <Download size={16} />
                导出日志
              </button>
            </div>
          </div>
        </div>

        {/* 预览模式警告条 */}
        {previewArchiveFile && (
          <div className="mb-6 bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600" />
                <div>
                  <p className="font-medium text-yellow-800">
                    当前正在预览归档文件：<span className="font-bold">{previewArchiveFile}</span>
                  </p>
                  <p className="text-sm text-yellow-700 mt-1">这是归档的冷存储数据，不是实时数据库日志</p>
                </div>
              </div>
              <button
                onClick={handleExitPreview}
                className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 flex items-center gap-2 transition-colors"
              >
                <X size={16} />
                返回实时日志
              </button>
            </div>
          </div>
        )}

        {/* Tab 切换 */}
        <div className="bg-white rounded-lg shadow-sm p-1 mb-6 flex gap-1">
          <button
            onClick={() => {
              setActiveTab('login');
              setPreviewArchiveFile(null);
            }}
            className={`flex-1 py-3 px-4 rounded-md font-medium transition-colors ${
              activeTab === 'login'
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <User className="inline-block mr-2" size={18} />
            登录日志
          </button>
          <button
            onClick={() => {
              setActiveTab('operation');
              setPreviewArchiveFile(null);
            }}
            className={`flex-1 py-3 px-4 rounded-md font-medium transition-colors ${
              activeTab === 'operation'
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Activity className="inline-block mr-2" size={18} />
            操作日志
          </button>
          <button
            onClick={() => {
              setActiveTab('stats');
              setPreviewArchiveFile(null);
            }}
            className={`flex-1 py-3 px-4 rounded-md font-medium transition-colors ${
              activeTab === 'stats'
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <TrendingUp className="inline-block mr-2" size={18} />
            统计分析
          </button>
          <button
            onClick={() => {
              setActiveTab('archives');
              setPreviewArchiveFile(null);
            }}
            className={`flex-1 py-3 px-4 rounded-md font-medium transition-colors ${
              activeTab === 'archives'
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Archive className="inline-block mr-2" size={18} />
            归档记录
          </button>
        </div>

        {/* 统计视图 */}
        {activeTab === 'stats' && stats && (
          <div className="space-y-6">
            {/* 概览卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-blue-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">总日志数</p>
                    <p className="text-2xl font-bold text-gray-800">{stats.overview.totalLogs.toLocaleString()}</p>
                  </div>
                  <FileText className="w-10 h-10 text-blue-500 opacity-20" />
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-green-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">今日日志</p>
                    <p className="text-2xl font-bold text-gray-800">{stats.overview.todayLogs}</p>
                  </div>
                  <Calendar className="w-10 h-10 text-green-500 opacity-20" />
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-purple-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">今日登录</p>
                    <p className="text-2xl font-bold text-gray-800">{stats.overview.todayLogins}</p>
                  </div>
                  <User className="w-10 h-10 text-purple-500 opacity-20" />
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-orange-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">活跃用户</p>
                    <p className="text-2xl font-bold text-gray-800">{stats.overview.uniqueUsersToday}</p>
                  </div>
                  <Users className="w-10 h-10 text-orange-500 opacity-20" />
                </div>
              </div>
            </div>

            {/* 详细统计 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 操作最多的用户 */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <Users size={20} className="text-blue-600" />
                  最活跃用户（最近7天）
                </h3>
                <div className="space-y-3">
                  {stats.topUsers.map((user, index) => (
                    <div key={user.userId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">{user.userName}</p>
                          <p className="text-sm text-gray-500">ID: {user.userId}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-blue-600">{user.count}</p>
                        <p className="text-xs text-gray-500">次操作</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 最常见操作 */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <Activity size={20} className="text-green-600" />
                  最常见操作（最近7天）
                </h3>
                <div className="space-y-3">
                  {stats.topActions.map((action, index) => (
                    <div key={action.action} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-bold">
                          {index + 1}
                        </div>
                        <p className="font-medium text-gray-800">{action.action}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-green-600">{action.count}</p>
                        <p className="text-xs text-gray-500">次</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 30天趋势图（简化显示） */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <TrendingUp size={20} className="text-purple-600" />
                最近30天日志趋势
              </h3>
              <div className="space-y-2">
                {stats.dailyStats.slice(0, 10).map((stat) => (
                  <div key={stat.date} className="flex items-center gap-4">
                    <div className="w-24 text-sm text-gray-600">{stat.date}</div>
                    <div className="flex-1 bg-gray-100 rounded-full h-8 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-purple-500 h-full flex items-center justify-end pr-3"
                        style={{ width: `${Math.min((stat.count / Math.max(...stats.dailyStats.map(s => s.count))) * 100, 100)}%` }}
                      >
                        <span className="text-white text-sm font-medium">{stat.count}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 归档记录视图 */}
        {activeTab === 'archives' && (
          <div className="bg-white rounded-xl shadow-sm">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <Archive size={20} className="text-blue-600" />
                归档文件列表
              </h3>
              <p className="text-sm text-gray-500 mt-1">查看和管理已归档的日志文件</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">归档文件名</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">文件大小</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">归档时间</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loading ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                        <RefreshCw className="animate-spin inline-block mr-2" size={20} />
                        加载中...
                      </td>
                    </tr>
                  ) : archiveFiles.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                        暂无归档文件
                      </td>
                    </tr>
                  ) : (
                    archiveFiles.map((file) => (
                      <tr key={file.fileName} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div className="flex items-center gap-2">
                            <FileText size={16} className="text-gray-400" />
                            <span className="font-mono text-xs">{file.fileName}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {file.sizeFormatted}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {formatDate(file.createdAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleLoadArchive(file.fileName)}
                              className="px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-1.5 transition-colors"
                            >
                              <Eye size={14} />
                              加载预览
                            </button>
                            <button
                              onClick={() => handleDownloadArchive(file.fileName)}
                              className="px-3 py-1.5 bg-gray-600 text-white rounded-md hover:bg-gray-700 flex items-center gap-1.5 transition-colors"
                            >
                              <Download size={14} />
                              下载
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 日志列表视图 */}
        {activeTab !== 'stats' && activeTab !== 'archives' && (
          <div className="bg-white rounded-xl shadow-sm">
            {/* 过滤器 */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center gap-2 mb-4">
                <Filter size={18} className="text-gray-600" />
                <h3 className="font-semibold text-gray-800">筛选条件</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <input
                  type="text"
                  placeholder="用户ID"
                  value={filters.userId}
                  onChange={(e) => setFilters({ ...filters, userId: e.target.value })}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <input
                  type="text"
                  placeholder="操作类型"
                  value={filters.action}
                  onChange={(e) => setFilters({ ...filters, action: e.target.value })}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <input
                  type="text"
                  placeholder="目标类型"
                  value={filters.targetType}
                  onChange={(e) => setFilters({ ...filters, targetType: e.target.value })}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* 日志表格 */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">时间</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">用户</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                    {activeTab === 'login' && (
                      <>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IP地址</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">设备信息</th>
                      </>
                    )}
                    {activeTab === 'operation' && (
                      <>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">目标类型</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">目标ID</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">详情</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loading ? (
                    <tr>
                      <td colSpan={activeTab === 'login' ? 5 : 6} className="px-6 py-8 text-center text-gray-500">
                        <RefreshCw className="animate-spin inline-block mr-2" size={20} />
                        加载中...
                      </td>
                    </tr>
                  ) : logs.length === 0 ? (
                    <tr>
                      <td colSpan={activeTab === 'login' ? 5 : 6} className="px-6 py-8 text-center text-gray-500">
                        暂无日志数据
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div className="flex items-center gap-2">
                            <Clock size={14} className="text-gray-400" />
                            {formatDate(log.createdAt)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="flex items-center gap-2">
                            <User size={14} className="text-gray-400" />
                            <div>
                              <p className="font-medium text-gray-900">{log.userName || '未知'}</p>
                              <p className="text-xs text-gray-500">{log.userId}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getActionColor(log.action)}`}>
                            {log.action}
                          </span>
                        </td>
                        {activeTab === 'login' && (
                          <>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              <div className="flex items-center gap-2">
                                <Globe size={14} className="text-gray-400" />
                                {log.ip || '未知'}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">
                              <div className="flex items-center gap-2">
                                <Monitor size={14} className="text-gray-400" />
                                {log.details || '未知设备'}
                              </div>
                            </td>
                          </>
                        )}
                        {activeTab === 'operation' && (
                          <>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {log.targetType || '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {log.targetId || '-'}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                              {log.details || '-'}
                            </td>
                          </>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* 分页 */}
            {!loading && logs.length > 0 && (
              <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  共 {total} 条记录，第 {page} 页
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    上一页
                  </button>
                  <button
                    onClick={() => setPage(page + 1)}
                    disabled={page * 20 >= total}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    下一页
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
