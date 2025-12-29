"use client";
import { useState, useEffect } from 'react';
import { Bell, CheckCheck, X, FileSignature, AlertTriangle, FileText } from 'lucide-react';
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

export default function NotificationPanel() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  // 获取通知
  const fetchNotifications = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      const res = await fetch(`/api/notifications?userId=${user.id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      });
      
      if (!res.ok) {
        console.error('获取通知失败，状态码:', res.status);
        const errorText = await res.text();
        console.error('错误详情:', errorText);
        return;
      }
      
      const data = await res.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (error) {
      console.error('获取通知失败:', error);
      // 网络错误或其他异常，静默处理，不影响用户体验
      setNotifications([]);
      setUnreadCount(0);
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

    // 跳转到相关页面，并带上记录ID参数（会自动打开详情弹窗）
    if (notification.relatedType === 'permit' && notification.relatedId) {
      window.location.href = `/work-permit?permitId=${notification.relatedId}`;
    } else if (notification.relatedType === 'hazard' && notification.relatedId) {
      window.location.href = `/hidden-danger?hazardId=${notification.relatedId}`;
    } else if (notification.relatedType === 'training' && notification.relatedId) {
      // 培训任务通知跳转到我的任务页面
      window.location.href = `/training/my-tasks`;
    }
  };

  // 格式化时间
  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 7) return `${days}天前`;
    return new Date(date).toLocaleDateString();
  };

  // 获取类型图标
  const getTypeIcon = (type: string) => {
    switch (type) {
      // 作业票相关
      case 'approval_pending':
        return <FileSignature className="w-4 h-4 text-orange-500" />;
      case 'approval_passed':
        return <CheckCheck className="w-4 h-4 text-green-500" />;
      case 'approval_rejected':
        return <X className="w-4 h-4 text-red-500" />;
      
      // 隐患相关
      case 'hazard_assigned':
        return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
      case 'hazard_cc':
        return <Bell className="w-4 h-4 text-blue-500" />;
      case 'hazard_submitted':
        return <FileText className="w-4 h-4 text-blue-600" />;
      case 'hazard_rectified':
        return <CheckCheck className="w-4 h-4 text-green-600" />;
      case 'hazard_verified':
        return <CheckCheck className="w-4 h-4 text-green-700" />;
      case 'hazard_rejected':
        return <X className="w-4 h-4 text-red-600" />;
      case 'hazard_extension':
        return <FileSignature className="w-4 h-4 text-orange-600" />;
      case 'hazard_closed':
        return <CheckCheck className="w-4 h-4 text-emerald-600" />;
      
      default:
        return <FileText className="w-4 h-4 text-blue-500" />;
    }
  };

  // 初始加载
  useEffect(() => {
    if (user?.id) {
      // 首次加载
      fetchNotifications();

      // 每30秒刷新一次，但仅当页面可见时
      const interval = setInterval(() => {
        if (!document.hidden) {
          fetchNotifications();
        }
      }, 30000);

      // 监听可见性变化，当页面变为可见时立即刷新
      const handleVisibilityChange = () => {
        if (!document.hidden) {
          fetchNotifications();
        }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);

      return () => {
        clearInterval(interval);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }
  }, [user?.id]);

  return (
    <div className="relative">
      {/* 通知铃铛按钮 */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) fetchNotifications();
        }}
        className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors"
      >
        <Bell className="w-5 h-5 text-slate-600" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* 通知面板 */}
      {isOpen && (
        <>
          {/* 背景遮罩 */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* 通知列表 */}
          <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl border border-slate-200 z-50 max-h-[600px] flex flex-col">
            {/* 头部 */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Bell className="w-4 h-4" />
                消息通知
                {unreadCount > 0 && (
                  <span className="text-xs text-red-500">({unreadCount}条未读)</span>
                )}
              </h3>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  全部已读
                </button>
              )}
            </div>

            {/* 通知列表 */}
            <div className="overflow-y-auto flex-1">
              {loading ? (
                <div className="p-8 text-center text-slate-400">
                  加载中...
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  <Bell className="w-12 h-12 mx-auto mb-2 opacity-20" />
                  暂无通知
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification)}
                      className={`p-4 cursor-pointer transition-colors ${
                        notification.isRead
                          ? 'bg-white hover:bg-slate-50'
                          : 'bg-blue-50 hover:bg-blue-100'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* 类型图标 */}
                        <div className="flex-shrink-0 mt-1">
                          {getTypeIcon(notification.type)}
                        </div>

                        {/* 内容 */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className={`text-sm font-medium ${
                              notification.isRead ? 'text-slate-700' : 'text-slate-900'
                            }`}>
                              {notification.title}
                            </h4>
                            {!notification.isRead && (
                              <div className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-1" />
                            )}
                          </div>
                          <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                            {notification.content}
                          </p>
                          <p className="text-xs text-slate-400 mt-1">
                            {formatTime(notification.createdAt)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 底部 */}
            {notifications.length > 0 && (
              <div className="p-3 border-t border-slate-200 text-center">
                <button
                  onClick={() => {
                    setIsOpen(false);
                    window.location.href = '/notifications'; // 可以创建一个专门的通知页面
                  }}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  查看全部通知
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
