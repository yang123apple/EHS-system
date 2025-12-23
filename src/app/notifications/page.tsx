"use client";
import { useState, useEffect } from 'react';
import { Bell, CheckCheck, X, FileSignature, AlertTriangle, FileText, RefreshCw, Filter } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  content: string;
  relatedType?: string | null;
  relatedId?: string | null;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export default function NotificationsPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  // 获取通知
  const fetchNotifications = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      const res = await fetch(`/api/notifications?userId=${user.id}`);
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (error) {
      console.error('获取通知失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 标记为已读
  const markAsRead = async (notificationIds: string[]) => {
    if (!user?.id) return;

    try {
      const res = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationIds, userId: user.id }),
      });

      if (res.ok) {
        // 更新本地状态
        setNotifications(prev =>
          prev.map(n =>
            notificationIds.includes(n.id) ? { ...n, isRead: true } : n
          )
        );
        setUnreadCount(prev => Math.max(0, prev - notificationIds.length));
      }
    } catch (error) {
      console.error('标记已读失败:', error);
    }
  };

  // 标记全部为已读
  const markAllAsRead = async () => {
    const unreadIds = notifications.filter(n => !n.isRead).map(n => n.id);
    if (unreadIds.length > 0) {
      await markAsRead(unreadIds);
    }
  };

  // 处理通知点击
  const handleNotificationClick = (notification: Notification) => {
    // 标记为已读
    if (!notification.isRead) {
      markAsRead([notification.id]);
    }

    // 跳转到相关页面
    if (notification.relatedType === 'permit' && notification.relatedId) {
      window.location.href = `/work-permit?recordId=${notification.relatedId}`;
    } else if (notification.relatedType === 'hazard' && notification.relatedId) {
      window.location.href = `/hidden-danger?recordId=${notification.relatedId}`;
    }
  };

  // 格式化时间
  const formatTime = (date: Date) => {
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 7) return `${days}天前`;
    
    // 显示完整时间
    return d.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // 获取类型图标和颜色
  const getTypeIconAndColor = (type: string) => {
    switch (type) {
      case 'approval_pending':
        return {
          icon: <FileSignature className="w-5 h-5" />,
          bgColor: 'bg-orange-100',
          textColor: 'text-orange-600',
          label: '待审批'
        };
      case 'approval_passed':
        return {
          icon: <CheckCheck className="w-5 h-5" />,
          bgColor: 'bg-green-100',
          textColor: 'text-green-600',
          label: '已通过'
        };
      case 'approval_rejected':
        return {
          icon: <X className="w-5 h-5" />,
          bgColor: 'bg-red-100',
          textColor: 'text-red-600',
          label: '已驳回'
        };
      case 'hazard_assigned':
        return {
          icon: <AlertTriangle className="w-5 h-5" />,
          bgColor: 'bg-yellow-100',
          textColor: 'text-yellow-600',
          label: '隐患分配'
        };
      default:
        return {
          icon: <FileText className="w-5 h-5" />,
          bgColor: 'bg-blue-100',
          textColor: 'text-blue-600',
          label: '系统通知'
        };
    }
  };

  // 初始加载
  useEffect(() => {
    if (user?.id) {
      fetchNotifications();
    }
  }, [user?.id]);

  // 过滤通知
  const filteredNotifications = filter === 'unread' 
    ? notifications.filter(n => !n.isRead)
    : notifications;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto">
          {/* 页面头部 */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                  <Bell className="w-7 h-7 text-blue-600" />
                  消息通知
                </h1>
                <p className="text-sm text-slate-500 mt-1">
                  共 {notifications.length} 条消息
                  {unreadCount > 0 && (
                    <span className="text-red-500 font-medium ml-2">
                      · {unreadCount} 条未读
                    </span>
                  )}
                </p>
              </div>
              <div className="flex gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2"
                  >
                    <CheckCheck className="w-4 h-4" />
                    全部已读
                  </button>
                )}
                <button
                  onClick={fetchNotifications}
                  disabled={loading}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium flex items-center gap-2 disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  刷新
                </button>
              </div>
            </div>

            {/* 筛选器 */}
            <div className="flex gap-2 border-t border-slate-200 pt-4">
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filter === 'all'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Filter className="w-4 h-4 inline mr-1" />
                全部 ({notifications.length})
              </button>
              <button
                onClick={() => setFilter('unread')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filter === 'unread'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                未读 ({unreadCount})
              </button>
            </div>
          </div>

          {/* 通知列表 */}
          {loading ? (
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center">
              <RefreshCw className="w-8 h-8 mx-auto mb-4 text-slate-400 animate-spin" />
              <p className="text-slate-500">加载中...</p>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center">
              <Bell className="w-16 h-16 mx-auto mb-4 text-slate-300" />
              <p className="text-slate-500 text-lg mb-2">
                {filter === 'unread' ? '没有未读通知' : '暂无通知'}
              </p>
              <p className="text-slate-400 text-sm">
                {filter === 'unread' ? '所有消息已读完毕' : '当有新消息时会显示在这里'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredNotifications.map((notification) => {
                const typeInfo = getTypeIconAndColor(notification.type);
                return (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`bg-white rounded-lg shadow-sm border transition-all cursor-pointer ${
                      notification.isRead
                        ? 'border-slate-200 hover:border-slate-300 hover:shadow'
                        : 'border-blue-200 bg-blue-50 hover:border-blue-300 hover:shadow-md'
                    }`}
                  >
                    <div className="p-5">
                      <div className="flex items-start gap-4">
                        {/* 类型图标 */}
                        <div className={`flex-shrink-0 w-12 h-12 rounded-full ${typeInfo.bgColor} ${typeInfo.textColor} flex items-center justify-center`}>
                          {typeInfo.icon}
                        </div>

                        {/* 内容 */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="flex items-center gap-2">
                              <h3 className={`text-base font-semibold ${
                                notification.isRead ? 'text-slate-800' : 'text-slate-900'
                              }`}>
                                {notification.title}
                              </h3>
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${typeInfo.bgColor} ${typeInfo.textColor}`}>
                                {typeInfo.label}
                              </span>
                            </div>
                            {!notification.isRead && (
                              <div className="flex-shrink-0 w-2.5 h-2.5 bg-blue-500 rounded-full mt-1.5" />
                            )}
                          </div>
                          <p className="text-sm text-slate-600 mb-3 leading-relaxed">
                            {notification.content}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-slate-400">
                            <span>{formatTime(notification.createdAt)}</span>
                            {notification.relatedType && (
                              <span className="flex items-center gap-1">
                                <FileText className="w-3 h-3" />
                                相关记录: {notification.relatedId?.substring(0, 8)}...
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
  );
}
