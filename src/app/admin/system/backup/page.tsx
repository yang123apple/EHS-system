"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/common/Toast';
import { 
  Download, 
  Save, 
  Archive, 
  RefreshCw, 
  Clock, 
  HardDrive,
  Database,
  Shield,
  AlertCircle,
  CheckCircle2,
  Calendar,
  FileText,
  Folder,
  Server,
  Activity,
  Play,
  Settings,
  TrendingUp,
  Layers
} from 'lucide-react';

// ============ 类型定义 ============

interface BackupFile {
  filename: string;
  filepath: string;
  sizeBytes: number;
  sizeMB: number;
  createdAt: string;
  age: string;
}

interface BackupStatus {
  backupCount: number;
  latestBackup: BackupFile | null;
  oldestBackup: BackupFile | null;
  totalSizeMB: number;
  databaseStatus: {
    departments: number;
    users: number;
    hazards?: number;
    trainings?: number;
  };
}

// 新的备份系统状态
interface NewBackupStatus {
  scheduler: {
    isRunning: boolean;
    activeTasks: number;
  };
  database: {
    fullBackups: {
      count: number;
      totalSize: number;
      latest: Date | string | null; // API 返回 Date，但 JSON 序列化后是 string
    };
    incrementalBackups: {
      count: number;
      totalSize: number;
      latest: Date | string | null; // API 返回 Date，但 JSON 序列化后是 string
    };
  };
  files: {
    fullBackups: {
      count: number;
      totalSize: number;
      latest: Date | string | null;
    };
    incrementalBackups: {
      count: number;
      totalSize: number;
      latest: Date | string | null;
    };
  };
  logs: {
    totalFiles: number;
    totalSize: number;
    oldestArchive: Date | string | null; // API 返回 Date，但 JSON 序列化后是 string
    newestArchive: Date | string | null; // API 返回 Date，但 JSON 序列化后是 string
  };
}

interface BackupStats {
  database: {
    full: { count: number; totalSize: number; latest: Date | null };
    incremental: { count: number; totalSize: number; latest: Date | null };
    count: number;
    totalSize: number;
  };
  files: {
    full: { count: number; totalSize: number; latest: Date | null };
    incremental: { count: number; totalSize: number; latest: Date | null };
    count: number;
    totalSize: number;
  };
  logs: {
    count: number;
    totalSize: number;
    oldest: Date | null;
    newest: Date | null;
  };
  summary: {
    totalBackupSize: number;
    totalBackupCount: number;
  };
}

export default function BackupPage() {
  const { user } = useAuth();
  const toast = useToast();
  
  // 旧系统状态
  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [status, setStatus] = useState<BackupStatus | null>(null);
  
  // 新系统状态
  const [newStatus, setNewStatus] = useState<NewBackupStatus | null>(null);
  const [stats, setStats] = useState<BackupStats | null>(null);
  
  // UI 状态
  const [loading, setLoading] = useState(true);
  const [backing, setBacking] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'new'>('overview');
  const [triggeringAction, setTriggeringAction] = useState<string | null>(null);

  // ============ 数据加载 ============

  // 加载旧系统备份列表
  const loadBackups = async () => {
    try {
      const response = await fetch('/api/data-protection');
      const data = await response.json();
      
      if (data.success) {
        setBackups(data.data || []);
      }
    } catch (error) {
      console.error('加载旧备份列表失败:', error);
    }
  };

  // 加载旧系统状态
  const loadStatus = async () => {
    try {
      const response = await fetch('/api/data-protection?action=status');
      const data = await response.json();
      
      if (data.success) {
        setStatus(data.data);
      }
    } catch (error) {
      console.error('加载旧状态失败:', error);
    }
  };

  // 加载新系统状态
  const loadNewStatus = async () => {
    try {
      const response = await fetch('/api/backup');
      const data = await response.json();
      
      if (data.success) {
        setNewStatus(data.data);
      }
    } catch (error) {
      console.error('加载新备份状态失败:', error);
    }
  };

  // 加载新系统统计
  const loadStats = async () => {
    try {
      const response = await fetch('/api/backup/stats');
      const data = await response.json();
      
      if (data.success) {
        setStats(data.data);
      }
    } catch (error) {
      console.error('加载备份统计失败:', error);
    }
  };

  // 加载所有数据
  const loadAll = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadBackups(),
        loadStatus(),
        loadNewStatus(),
        loadStats(),
      ]);
    } finally {
      setLoading(false);
    }
  };

  // ============ 备份操作 ============

  // 旧系统：执行全量备份
  const handleOldBackup = async () => {
    if (backing) return;
    
    try {
      setBacking(true);
      toast.info('开始备份', '正在执行全量备份，请稍候...');
      
      const response = await fetch('/api/data-protection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast.success('备份成功', `备份文件：${data.backupFile || '已创建'}`);
        await Promise.all([loadBackups(), loadStatus()]);
      } else {
        toast.error('备份失败', data.error || '未知错误');
      }
    } catch (error: any) {
      console.error('备份失败:', error);
      toast.error('备份失败', error.message || '网络错误');
    } finally {
      setBacking(false);
    }
  };

  // 新系统：触发备份
  const handleNewBackup = async (action: string) => {
    if (triggeringAction) return;
    
    try {
      setTriggeringAction(action);
      const actionNames: Record<string, string> = {
        'database-full': '数据库全量备份',
        'database-incremental': '数据库增量备份',
        'file-full': '文件全量备份',
        'file-incremental': '文件增量备份',
        'log-archive': '日志归档',
      };
      
      toast.info('开始备份', `正在执行${actionNames[action] || action}...`);
      
      const response = await fetch('/api/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        // 检查是否是"无需更新备份"的提示
        if (data.data?.message === '无需更新备份') {
          toast.info('无需更新', data.data?.reason || '没有新数据需要备份');
        } else if (action === 'full-backup-all' && data.data?.details) {
          // 一键全量备份的详细结果
          const details = data.data.details;
          const successCount = [details.database, details.files, details.logs].filter(d => d?.success).length;
          if (successCount === 3) {
            toast.success('备份成功', '数据库、文件和日志备份已全部触发');
          } else {
            toast.warning('部分成功', `成功: ${successCount}/3，请查看详情`);
          }
        } else {
          toast.success('备份成功', data.data?.message || '备份任务已触发');
        }
        await Promise.all([loadNewStatus(), loadStats()]);
      } else {
        toast.error('备份失败', data.error || '未知错误');
      }
    } catch (error: any) {
      console.error('备份失败:', error);
      toast.error('备份失败', error.message || '网络错误');
    } finally {
      setTriggeringAction(null);
    }
  };

  // ============ 工具函数 ============

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString: string | Date | null): string => {
    if (!dateString) return '暂无';
    try {
      const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return String(dateString);
    }
  };

  // ============ 生命周期 ============

  useEffect(() => {
    if (!user) return;
    loadAll();
    
    // 每30秒自动刷新
    const interval = setInterval(loadAll, 30000);
    return () => clearInterval(interval);
  }, [user]);

  // 权限检查
  if (user && user.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-800 mb-2">权限不足</h2>
            <p className="text-gray-600">只有管理员可以访问数据灾备中心</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* 页面标题 */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-blue-600" />
              <div>
            <h1 className="text-3xl font-bold text-gray-800">数据保护与恢复</h1>
                <p className="text-gray-600 mt-1">存算分离架构 · 策略分级备份</p>
              </div>
            </div>
            <button
              onClick={loadAll}
              disabled={loading}
              className="px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 rounded-lg shadow transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              刷新
            </button>
          </div>
        </div>

        {/* 标签页切换 */}
        <div className="mb-6 bg-white rounded-lg shadow p-1 flex gap-2">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
              activeTab === 'overview'
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Layers className="w-4 h-4 inline mr-2" />
            总览
          </button>
          <button
            onClick={() => setActiveTab('new')}
            className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
              activeTab === 'new'
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Database className="w-4 h-4 inline mr-2" />
            新备份系统
          </button>
        </div>

        {/* 总览页面 */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* 系统状态卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 备份调度状态 */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">备份调度</p>
                    <p className={`text-lg font-bold flex items-center gap-2 ${
                      newStatus?.scheduler.isRunning ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {newStatus?.scheduler.isRunning ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : (
                        <AlertCircle className="w-5 h-5" />
                      )}
                      {newStatus?.scheduler.isRunning ? '运行中' : '未运行'}
                    </p>
                  </div>
                  <Activity className="w-10 h-10 text-blue-500" />
                </div>
                <p className="text-xs text-gray-500">
                  活跃任务: {newStatus?.scheduler.activeTasks || 0}
                </p>
              </div>

              {/* 数据库备份 */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">数据库备份</p>
                    <p className="text-2xl font-bold text-gray-800">
                      {stats?.database.count || 0}
                    </p>
                  </div>
                  <Database className="w-10 h-10 text-purple-500" />
                </div>
                <p className="text-xs text-gray-500">
                  {formatBytes(stats?.database.totalSize || 0)}
                </p>
              </div>

              {/* 文件备份 */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">文件备份</p>
                    <p className="text-2xl font-bold text-gray-800">
                      {stats?.files.count || 0}
                    </p>
                  </div>
                  <Folder className="w-10 h-10 text-green-500" />
                </div>
                <p className="text-xs text-gray-500">
                  {formatBytes(stats?.files.totalSize || 0)}
                </p>
              </div>

              {/* 日志归档 */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">日志归档</p>
                    <p className="text-2xl font-bold text-gray-800">
                      {stats?.logs.count || 0}
                    </p>
                  </div>
                  <FileText className="w-10 h-10 text-orange-500" />
                </div>
                <p className="text-xs text-gray-500">
                  {formatBytes(stats?.logs.totalSize || 0)}
                </p>
              </div>
            </div>

            {/* 备份统计 */}
            {stats && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  备份统计
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <p className="text-sm text-gray-600 mb-2">总备份数</p>
                    <p className="text-3xl font-bold text-gray-800">
                      {stats.summary.totalBackupCount}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-2">总备份大小</p>
                    <p className="text-3xl font-bold text-gray-800">
                      {formatBytes(stats.summary.totalBackupSize)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 快速操作 */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Play className="w-5 h-5" />
                快速操作
              </h2>
              <div className="flex justify-center">
                <button
                  onClick={() => handleNewBackup('full-backup-all')}
                  disabled={backing || !!triggeringAction}
                  className="px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg shadow-lg transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed text-lg font-medium"
                >
                  {backing || triggeringAction === 'full-backup-all' ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      备份中...
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      一键全量备份
                    </>
                  )}
                </button>
              </div>
              <p className="text-sm text-gray-500 text-center mt-3">
                执行数据库全量备份、文件全量备份和日志归档
              </p>
            </div>
          </div>
        )}

        {/* 新备份系统页面 */}
        {activeTab === 'new' && (
          <div className="space-y-6">
            {/* 备份调度状态 */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Settings className="w-5 h-5" />
                备份调度状态
              </h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-800">调度服务</p>
                    <p className="text-sm text-gray-600">
                      {newStatus?.scheduler.isRunning ? '运行中' : '未运行'}
                    </p>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                    newStatus?.scheduler.isRunning
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {newStatus?.scheduler.isRunning ? '正常' : '异常'}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">日志归档</p>
                    <p className="font-medium text-gray-800">每日 00:00</p>
                  </div>
                  <div className="p-4 bg-purple-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">数据库全量</p>
                    <p className="font-medium text-gray-800">每日 02:00</p>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">文件增量</p>
                    <p className="font-medium text-gray-800">每日 02:30</p>
                  </div>
                </div>
              </div>
            </div>

            {/* 数据库备份详情 */}
            {newStatus?.database && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <Database className="w-5 h-5" />
                  数据库备份
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="p-4 bg-purple-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">全量备份</p>
                    <p className="text-2xl font-bold text-gray-800">
                      {newStatus.database.fullBackups.count}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatBytes(newStatus.database.fullBackups.totalSize)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      最新: {formatDate(newStatus.database.fullBackups.latest)}
                    </p>
                  </div>
                  <div className="p-4 bg-indigo-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">增量备份</p>
                    <p className="text-2xl font-bold text-gray-800">
                      {newStatus.database.incrementalBackups.count}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatBytes(newStatus.database.incrementalBackups.totalSize)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      最新: {formatDate(newStatus.database.incrementalBackups.latest)}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleNewBackup('database-full')}
                    disabled={!!triggeringAction}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    <Play className="w-4 h-4" />
                    全量备份
                  </button>
                  <button
                    onClick={() => handleNewBackup('database-incremental')}
                    disabled={!!triggeringAction}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    <Play className="w-4 h-4" />
                    增量备份
                  </button>
                </div>
              </div>
            )}

            {/* 文件备份详情 */}
            {(newStatus?.files || stats?.files) && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <Folder className="w-5 h-5" />
                  文件备份
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="p-4 bg-green-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">全量备份</p>
                    <p className="text-2xl font-bold text-gray-800">
                      {newStatus?.files?.fullBackups?.count ?? stats?.files?.full?.count ?? 0}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatBytes(newStatus?.files?.fullBackups?.totalSize ?? stats?.files?.full?.totalSize ?? 0)}
                    </p>
                    {newStatus?.files?.fullBackups?.latest && (
                      <p className="text-xs text-gray-500 mt-1">
                        最新: {formatDate(newStatus.files.fullBackups.latest)}
                      </p>
                    )}
                    {stats?.files?.full?.latest && !newStatus?.files?.fullBackups?.latest && (
                      <p className="text-xs text-gray-500 mt-1">
                        最新: {formatDate(stats.files.full.latest)}
                      </p>
                    )}
                  </div>
                  <div className="p-4 bg-emerald-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">增量备份</p>
                    <p className="text-2xl font-bold text-gray-800">
                      {newStatus?.files?.incrementalBackups?.count ?? stats?.files?.incremental?.count ?? 0}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatBytes(newStatus?.files?.incrementalBackups?.totalSize ?? stats?.files?.incremental?.totalSize ?? 0)}
                    </p>
                    {newStatus?.files?.incrementalBackups?.latest && (
                      <p className="text-xs text-gray-500 mt-1">
                        最新: {formatDate(newStatus.files.incrementalBackups.latest)}
                      </p>
                    )}
                    {stats?.files?.incremental?.latest && !newStatus?.files?.incrementalBackups?.latest && (
                      <p className="text-xs text-gray-500 mt-1">
                        最新: {formatDate(stats.files.incremental.latest)}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleNewBackup('file-full')}
                    disabled={!!triggeringAction}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    <Play className="w-4 h-4" />
                    全量备份
                  </button>
                  <button
                    onClick={() => handleNewBackup('file-incremental')}
                    disabled={!!triggeringAction}
                    className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 min-w-[120px]"
                  >
                    <Play className="w-4 h-4" />
                    增量备份
                  </button>
                </div>
              </div>
            )}

            {/* 日志归档详情 */}
            {newStatus?.logs && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  日志归档
                </h2>
                <div className="p-4 bg-orange-50 rounded-lg mb-4">
                  <p className="text-sm text-gray-600 mb-1">归档文件数</p>
                  <p className="text-2xl font-bold text-gray-800">
                    {newStatus.logs.totalFiles}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {formatBytes(newStatus.logs.totalSize)}
                  </p>
                  <div className="mt-2 text-xs text-gray-500">
                    <p>最早: {formatDate(newStatus.logs.oldestArchive)}</p>
                    <p>最新: {formatDate(newStatus.logs.newestArchive)}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleNewBackup('log-archive')}
                  disabled={!!triggeringAction}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  <Play className="w-4 h-4" />
                  执行归档
                </button>
              </div>
            )}
          </div>
        )}


        {/* 提示信息 */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">备份说明</p>
              <ul className="list-disc list-inside space-y-1 text-blue-700">
                <li><strong>一键全量备份</strong>：包含数据库、上传文件和配置信息的完整备份（ZIP格式）</li>
                <li><strong>新备份系统</strong>：采用存算分离架构，数据库、文件、日志分别备份</li>
                <li><strong>备份策略</strong>：数据库每日全量备份，文件每日增量备份，日志每15天归档</li>
                <li>系统自动保留最近30天的备份文件，建议定期下载到安全的异地存储</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
