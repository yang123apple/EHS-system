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
  Calendar
} from 'lucide-react';

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

export default function BackupPage() {
  const { user } = useAuth();
  const toast = useToast();
  
  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [backing, setBacking] = useState(false);
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);

  // 加载备份列表
  const loadBackups = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/data-protection');
      const data = await response.json();
      
      if (data.success) {
        setBackups(data.data || []);
      } else {
        toast.error('加载失败', data.error || '无法获取备份列表');
      }
    } catch (error: any) {
      console.error('加载备份列表失败:', error);
      toast.error('加载失败', error.message || '网络错误');
    } finally {
      setLoading(false);
    }
  };

  // 加载备份状态
  const loadStatus = async () => {
    try {
      const response = await fetch('/api/data-protection?action=status');
      const data = await response.json();
      
      if (data.success) {
        setStatus(data.data);
      }
    } catch (error) {
      console.error('加载状态失败:', error);
    }
  };

  // 执行手动备份
  const handleBackup = async () => {
    if (backing) return;
    
    try {
      setBacking(true);
      toast.info('开始备份', '正在执行全量备份，请稍候...');
      
      const response = await fetch('/api/data-protection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast.success('备份成功', `备份文件：${data.backupFile || '已创建'}`);
        // 刷新列表和状态
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

  // 下载备份文件
  const handleDownload = (filename: string) => {
    try {
      setDownloadingFile(filename);
      const downloadUrl = `/api/data-protection/download?filename=${encodeURIComponent(filename)}`;
      
      // 创建隐藏的 a 标签触发下载
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success('开始下载', filename);
      
      // 2秒后清除下载状态
      setTimeout(() => {
        setDownloadingFile(null);
      }, 2000);
    } catch (error: any) {
      console.error('下载失败:', error);
      toast.error('下载失败', error.message);
      setDownloadingFile(null);
    }
  };

  // 格式化日期
  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  // 页面加载时获取数据
  useEffect(() => {
    if (!user) return;
    
    loadBackups();
    loadStatus();
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
          <div className="flex items-center gap-3 mb-2">
            <Shield className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-800">数据保护与恢复</h1>
          </div>
          <p className="text-gray-600 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            上次备份：
            {status?.latestBackup ? (
              <span className="font-medium text-gray-800">
                {status.latestBackup.age} ({formatDate(status.latestBackup.createdAt)})
              </span>
            ) : (
              <span className="text-gray-500">暂无备份</span>
            )}
          </p>
        </div>

        {/* 统计卡片 */}
        {status && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* 备份数量 */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">备份文件</p>
                  <p className="text-2xl font-bold text-gray-800">{status.backupCount}</p>
                </div>
                <Archive className="w-10 h-10 text-blue-500" />
              </div>
            </div>

            {/* 总大小 */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">总大小</p>
                  <p className="text-2xl font-bold text-gray-800">
                    {status.totalSizeMB.toFixed(2)} MB
                  </p>
                </div>
                <HardDrive className="w-10 h-10 text-green-500" />
              </div>
            </div>

            {/* 数据库记录 */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">数据库记录</p>
                  <p className="text-2xl font-bold text-gray-800">
                    {(status.databaseStatus.departments || 0) + 
                     (status.databaseStatus.users || 0) +
                     (status.databaseStatus.hazards || 0) +
                     (status.databaseStatus.trainings || 0)}
                  </p>
                </div>
                <Database className="w-10 h-10 text-purple-500" />
              </div>
            </div>

            {/* 系统状态 */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">系统状态</p>
                  <p className="text-lg font-bold text-green-600 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5" />
                    正常运行
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 操作栏 */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-800 mb-1">备份管理</h2>
              <p className="text-sm text-gray-600">
                全量备份包含数据库、上传文件和配置信息
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { loadBackups(); loadStatus(); }}
                disabled={loading}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                刷新
              </button>
              <button
                onClick={handleBackup}
                disabled={backing}
                className="px-6 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg shadow-lg transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {backing ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    备份中...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    立即备份
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* 备份列表 */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <Archive className="w-5 h-5" />
              备份文件列表
            </h2>
          </div>

          {loading ? (
            <div className="p-12 text-center">
              <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-4" />
              <p className="text-gray-600">加载中...</p>
            </div>
          ) : backups.length === 0 ? (
            <div className="p-12 text-center">
              <Archive className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">暂无备份文件</p>
              <p className="text-sm text-gray-500">点击"立即备份"创建第一个备份</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      备份文件名
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      文件大小
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      备份时间
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      年龄
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {backups.map((backup) => (
                    <tr 
                      key={backup.filename}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Archive className="w-4 h-4 text-gray-400" />
                          <span className="text-sm font-medium text-gray-900">
                            {backup.filename}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-700">
                          {backup.sizeMB.toFixed(2)} MB
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-700">
                            {formatDate(backup.createdAt)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-500">
                          {backup.age}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button
                          onClick={() => handleDownload(backup.filename)}
                          disabled={downloadingFile === backup.filename}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {downloadingFile === backup.filename ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              下载中...
                            </>
                          ) : (
                            <>
                              <Download className="w-4 h-4" />
                              下载
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 提示信息 */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">备份说明</p>
              <ul className="list-disc list-inside space-y-1 text-blue-700">
                <li>系统每天凌晨 2:00 自动执行全量备份</li>
                <li>备份文件包含：数据库、上传文件、配置信息</li>
                <li>系统自动保留最近 30 天的备份文件</li>
                <li>建议定期下载备份文件到安全的异地存储</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
