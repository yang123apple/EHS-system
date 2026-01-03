"use client";

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { 
  Bell, 
  Plus, 
  Edit2, 
  Trash2, 
  Save,
  X,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Code,
  FileText,
  Zap,
  Eye,
  EyeOff
} from 'lucide-react';

interface NotificationTemplate {
  id: string;
  name: string;
  title: string;
  content: string;
  type: string;
  triggerEvent: string;
  triggerCondition: string | null;
  variables: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface NotificationRecord {
  id: string;
  userId: string;
  type: string;
  title: string;
  content: string;
  relatedType: string | null;
  relatedId: string | null;
  isRead: boolean;
  createdAt: string;
  user?: {
    name: string;
    department: string;
  };
}

interface NotificationStats {
  total: number;
  unread: number;
  byType: Record<string, number>;
}

export default function NotificationsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [stats, setStats] = useState<NotificationStats>({ total: 0, unread: 0, byType: {} });
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<NotificationTemplate | null>(null);
  const [activeTab, setActiveTab] = useState<'templates' | 'records'>('templates');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterRead, setFilterRead] = useState<string>('all');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    title: '',
    content: '',
    type: 'hazard',
    triggerEvent: '',
    triggerCondition: '',
    variables: '',
    isActive: true,
  });

  // 权限检查
  if (user && user.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-800 mb-2">权限不足</h2>
            <p className="text-gray-600">只有管理员可以访问通知管理</p>
          </div>
        </div>
      </div>
    );
  }

  useEffect(() => {
    if (activeTab === 'templates') {
      fetchTemplates();
    } else {
      fetchNotifications();
    }
  }, [activeTab]);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      console.log('[通知模板] 开始获取模板...');
      const response = await fetch('/api/admin/notification-templates');
      console.log('[通知模板] API 响应状态:', response.status);
      const result = await response.json();
      console.log('[通知模板] API 返回结果:', result);
      if (result.success) {
        console.log('[通知模板] 设置模板数据，数量:', result.data?.length);
        setTemplates(result.data);
      } else {
        console.error('[通知模板] API 返回失败:', result.message);
      }
    } catch (error) {
      console.error('[通知模板] 获取模板失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterType !== 'all') params.append('type', filterType);
      if (filterRead !== 'all') params.append('isRead', filterRead);
      if (searchKeyword) params.append('keyword', searchKeyword);
      
      const response = await fetch(`/api/admin/notifications?${params}`);
      const result = await response.json();
      
      if (result.success) {
        setNotifications(result.data);
        setStats(result.stats);
      }
    } catch (error) {
      console.error('获取消息记录失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingTemplate(null);
    setFormData({
      name: '',
      title: '',
      content: '',
      type: 'hazard',
      triggerEvent: '',
      triggerCondition: '',
      variables: '',
      isActive: true,
    });
    setShowModal(true);
  };

  const handleEdit = (template: NotificationTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      title: template.title,
      content: template.content,
      type: template.type,
      triggerEvent: template.triggerEvent,
      triggerCondition: template.triggerCondition || '',
      variables: template.variables || '',
      isActive: template.isActive,
    });
    setShowModal(true);
  };

  const handleSubmit = async () => {
    try {
      const url = '/api/admin/notification-templates';
      const method = editingTemplate ? 'PUT' : 'POST';
      
      const body: any = { ...formData };
      if (editingTemplate) {
        body.id = editingTemplate.id;
      }

      // 解析JSON字段
      if (body.triggerCondition) {
        try {
          // 如果已经是字符串，尝试解析；如果已经是对象，保持不变
          body.triggerCondition = typeof body.triggerCondition === 'string' 
            ? JSON.parse(body.triggerCondition) 
            : body.triggerCondition;
        } catch (e) {
          console.warn('解析 triggerCondition 失败:', e);
          body.triggerCondition = null;
        }
      }
      if (body.variables) {
        try {
          // 如果已经是字符串，尝试解析；如果已经是对象，保持不变
          body.variables = typeof body.variables === 'string'
            ? JSON.parse(body.variables)
            : body.variables;
        } catch (e) {
          console.warn('解析 variables 失败:', e);
          body.variables = null;
        }
      }

      console.log('[前端] 准备保存模板:', { method, url, body });

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const result = await response.json();
      console.log('[前端] API 响应:', result);
      
      if (result.success) {
        alert(editingTemplate ? '更新成功' : '创建成功');
        setShowModal(false);
        setEditingTemplate(null);
        fetchTemplates();
      } else {
        const errorMsg = result.error 
          ? `${result.message}: ${result.error}` 
          : result.message || '操作失败';
        console.error('[前端] 保存失败:', errorMsg);
        alert(errorMsg);
      }
    } catch (error: any) {
      console.error('[前端] 保存失败:', error);
      alert(`保存失败: ${error?.message || '未知错误'}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确认删除此模板？')) return;

    try {
      const response = await fetch(`/api/admin/notification-templates?id=${id}`, {
        method: 'DELETE',
      });
      const result = await response.json();
      if (result.success) {
        fetchTemplates();
      } else {
        alert(result.message || '删除失败');
      }
    } catch (error) {
      console.error('删除失败:', error);
      alert('删除失败');
    }
  };

  const insertVariable = (variable: string) => {
    setFormData({
      ...formData,
      content: formData.content + `{{${variable}}}`,
    });
  };

  const commonVariables = [
    'user.name',
    'user.department',
    'hazard.code',
    'hazard.location',
    'hazard.status',
    'task.title',
    'permit.code',
  ];

  const typeLabels: Record<string, string> = {
    hazard: '隐患',
    training: '培训',
    training_assigned: '培训分配',
    training_updated: '培训更新',
    training_completed: '培训完成',
    work_permit: '作业票',
    permit_submitted: '作业票提交',
    permit_approved: '作业票通过',
    permit_rejected: '作业票驳回',
    permit_pending_approval: '待审批',
    approval_pending: '待审批',
    approval_passed: '审批通过',
    approval_rejected: '审批驳回',
    system: '系统',
  };

  const getTypeLabel = (type: string) => typeLabels[type] || type;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-7xl mx-auto">
        {/* 页头 */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 mb-2">通知管理</h1>
              <p className="text-gray-600">管理站内信模板和查看消息记录</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => activeTab === 'templates' ? fetchTemplates() : fetchNotifications()}
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
              >
                <RefreshCw size={16} />
                刷新
              </button>
              {activeTab === 'templates' && (
                <button
                  onClick={handleCreate}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                  <Plus size={16} />
                  新建模板
                </button>
              )}
            </div>
          </div>

          {/* 标签页切换 */}
          <div className="mt-6 flex gap-4 border-b border-gray-200">
            <button
              onClick={() => setActiveTab('templates')}
              className={`px-4 py-2 -mb-px transition-colors ${
                activeTab === 'templates'
                  ? 'border-b-2 border-blue-600 text-blue-600 font-medium'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <div className="flex items-center gap-2">
                <FileText size={18} />
                通知模板
              </div>
            </button>
            <button
              onClick={() => setActiveTab('records')}
              className={`px-4 py-2 -mb-px transition-colors ${
                activeTab === 'records'
                  ? 'border-b-2 border-blue-600 text-blue-600 font-medium'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <div className="flex items-center gap-2">
                <Bell size={18} />
                消息记录
                {stats.total > 0 && (
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-600 text-xs rounded-full">
                    {stats.total}
                  </span>
                )}
              </div>
            </button>
          </div>
        </div>

        {/* 模板列表 */}
        {activeTab === 'templates' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {loading ? (
              <div className="col-span-2 text-center py-12">
                <RefreshCw className="animate-spin inline-block mr-2" size={24} />
                加载中...
              </div>
            ) : templates.length === 0 ? (
              <div className="col-span-2 text-center py-12 bg-white rounded-xl shadow-sm">
                <Bell className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">暂无通知模板</p>
              </div>
            ) : (
              templates.map((template) => (
              <div key={template.id} className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold text-gray-800">{template.name}</h3>
                      {template.isActive ? (
                        <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full flex items-center gap-1">
                          <CheckCircle2 size={12} />
                          已启用
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                          已禁用
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                      <span className="px-2 py-1 bg-blue-50 text-blue-600 rounded">
                        {template.type}
                      </span>
                      <span className="px-2 py-1 bg-purple-50 text-purple-600 rounded">
                        {template.triggerEvent}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(template)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(template.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">标题模板</p>
                    <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded">{template.title}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">内容模板</p>
                    <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded line-clamp-2">{template.content}</p>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-100 text-xs text-gray-400">
                  更新时间: {new Date(template.updatedAt).toLocaleString('zh-CN')}
                </div>
              </div>
            ))
          )}
        </div>
        )}

        {/* 消息记录列表 */}
        {activeTab === 'records' && (
          <>
            {/* 统计卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-lg shadow-sm p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">总消息数</p>
                    <p className="text-2xl font-bold text-gray-800 mt-1">{stats.total}</p>
                  </div>
                  <Bell className="w-10 h-10 text-blue-500" />
                </div>
              </div>
              <div className="bg-white rounded-lg shadow-sm p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">未读消息</p>
                    <p className="text-2xl font-bold text-orange-600 mt-1">{stats.unread}</p>
                  </div>
                  <AlertCircle className="w-10 h-10 text-orange-500" />
                </div>
              </div>
              <div className="bg-white rounded-lg shadow-sm p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">已读消息</p>
                    <p className="text-2xl font-bold text-green-600 mt-1">{stats.total - stats.unread}</p>
                  </div>
                  <CheckCircle2 className="w-10 h-10 text-green-500" />
                </div>
              </div>
              <div className="bg-white rounded-lg shadow-sm p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">阅读率</p>
                    <p className="text-2xl font-bold text-purple-600 mt-1">
                      {stats.total > 0 ? Math.round(((stats.total - stats.unread) / stats.total) * 100) : 0}%
                    </p>
                  </div>
                  <Eye className="w-10 h-10 text-purple-500" />
                </div>
              </div>
            </div>

            {/* 筛选器 */}
            <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">消息类型</label>
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">全部类型</option>
                    <option value="hazard">隐患</option>
                    <option value="training">培训</option>
                    <option value="work_permit">作业票</option>
                    <option value="system">系统</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">阅读状态</label>
                  <select
                    value={filterRead}
                    onChange={(e) => setFilterRead(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">全部状态</option>
                    <option value="false">未读</option>
                    <option value="true">已读</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">搜索关键词</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={searchKeyword}
                      onChange={(e) => setSearchKeyword(e.target.value)}
                      placeholder="搜索标题或内容..."
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={fetchNotifications}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      搜索
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* 消息列表 */}
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              {loading ? (
                <div className="text-center py-12">
                  <RefreshCw className="animate-spin inline-block mr-2" size={24} />
                  加载中...
                </div>
              ) : notifications.length === 0 ? (
                <div className="text-center py-12">
                  <Bell className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">暂无消息记录</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          状态
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          类型
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          标题
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          内容
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          接收人
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          时间
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {notifications.map((notification) => (
                        <tr key={notification.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            {notification.isRead ? (
                              <span className="flex items-center gap-1 text-green-600 text-sm">
                                <CheckCircle2 size={16} />
                                已读
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-orange-600 text-sm">
                                <AlertCircle size={16} />
                                未读
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                              {getTypeLabel(notification.type)}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm font-medium text-gray-900">{notification.title}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-600 max-w-md truncate">
                              {notification.content}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{notification.user?.name || '-'}</div>
                            <div className="text-xs text-gray-500">{notification.user?.department || '-'}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(notification.createdAt).toLocaleString('zh-CN', {
                              month: 'numeric',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* 编辑/新建模态框 */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-800">
                  {editingTemplate ? '编辑模板' : '新建模板'}
                </h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* 基础信息 */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      模板名称 *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="唯一标识名称"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      触发事件 *
                    </label>
                    <input
                      type="text"
                      value={formData.triggerEvent}
                      onChange={(e) => setFormData({ ...formData, triggerEvent: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="如: hazard_created"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      类型 *
                    </label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="hazard">隐患</option>
                      <option value="training">培训</option>
                      <option value="work_permit">作业票</option>
                      <option value="system">系统</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      状态
                    </label>
                    <select
                      value={formData.isActive ? 'true' : 'false'}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.value === 'true' })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="true">启用</option>
                      <option value="false">禁用</option>
                    </select>
                  </div>
                </div>

                {/* 标题模板 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    标题模板 * <span className="text-xs text-gray-500">（支持变量占位符，如 {`{{user.name}}`}）</span>
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="如: {{user.name}} 分配给您一个新的隐患"
                  />
                </div>

                {/* 内容模板 */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      内容模板 *
                    </label>
                    <div className="flex gap-2">
                      {commonVariables.map((variable) => (
                        <button
                          key={variable}
                          onClick={() => insertVariable(variable)}
                          className="px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors"
                        >
                          {variable}
                        </button>
                      ))}
                    </div>
                  </div>
                  <textarea
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    rows={6}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                    placeholder="支持变量占位符，如: 隐患编号 {{hazard.code}} 位于 {{hazard.location}}"
                  />
                </div>

                {/* 触发条件（JSON） */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    触发条件（JSON格式，可选）
                  </label>
                  <textarea
                    value={formData.triggerCondition}
                    onChange={(e) => setFormData({ ...formData, triggerCondition: e.target.value })}
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                    placeholder='{"riskLevel": "high", "status": "assigned"}'
                  />
                </div>

                {/* 可用变量（JSON数组） */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    可用变量列表（JSON数组，可选）
                  </label>
                  <textarea
                    value={formData.variables}
                    onChange={(e) => setFormData({ ...formData, variables: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                    placeholder='["user.name", "user.department", "hazard.code"]'
                  />
                </div>
              </div>

              <div className="sticky bottom-0 bg-gray-50 p-6 flex justify-end gap-3 border-t border-gray-200">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleSubmit}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <Save size={16} />
                  保存
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
