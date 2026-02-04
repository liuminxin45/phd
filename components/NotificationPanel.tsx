import { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';
import { httpClient } from '@/lib/httpClient';

interface Notification {
  id: string;
  title: string;
  content: string;
  url: string;
  isUnread: boolean;
  dateCreated: string;
  author?: string;
}

interface NotificationsResponse {
  notifications: Notification[];
  unreadCount: number;
  total: number;
}

export function NotificationPanel() {
  const [data, setData] = useState<NotificationsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const result = await httpClient<NotificationsResponse>('/api/notifications');
      setData(result);
    } catch (err: any) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    // Refresh notifications every 2 minutes
    const interval = setInterval(fetchNotifications, 120000);
    return () => clearInterval(interval);
  }, []);

  // Close panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleToggle = () => {
    setIsOpen(!isOpen);
    if (!isOpen && !data) {
      fetchNotifications();
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    window.open(notification.url, '_blank');
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell Button */}
      <button
        onClick={handleToggle}
        className="relative p-2 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-md transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {data && data.unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-500 rounded-full">
            {data.unreadCount > 99 ? '99+' : data.unreadCount}
          </span>
        )}
      </button>

      {/* Notification Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-white border border-neutral-200 rounded-lg shadow-lg z-50">
          {/* Header */}
          <div className="p-3 border-b border-neutral-200 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-neutral-900">Notifications</h3>
            {data && (
              <span className="text-xs text-neutral-500">
                {data.unreadCount > 0 && `${data.unreadCount} unread`}
              </span>
            )}
          </div>

          {/* Notification List */}
          <div className="max-h-[400px] overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center">
                <div className="inline-block w-6 h-6 border-2 border-neutral-300 border-t-blue-500 rounded-full animate-spin"></div>
                <p className="text-sm text-neutral-500 mt-2">Loading...</p>
              </div>
            ) : !data || data.notifications.length === 0 ? (
              <div className="p-8 text-center">
                <Bell className="w-12 h-12 mx-auto text-neutral-300 mb-2" />
                <p className="text-sm text-neutral-500">No notifications</p>
              </div>
            ) : (
              <div className="divide-y divide-neutral-100">
                {data.notifications.map((notification) => (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`p-3 hover:bg-neutral-50 cursor-pointer transition-colors ${
                      notification.isUnread ? 'bg-blue-50/50' : ''
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {notification.isUnread && (
                        <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5 flex-shrink-0"></div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${notification.isUnread ? 'font-medium text-neutral-900' : 'text-neutral-700'} line-clamp-2`}>
                          {notification.title}
                        </p>
                        {notification.content && notification.content !== notification.title && (
                          <p className="text-xs text-neutral-500 mt-1 line-clamp-1">
                            {notification.content}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          {notification.author && (
                            <span className="text-xs text-neutral-400">{notification.author}</span>
                          )}
                          {notification.dateCreated && (
                            <span className="text-xs text-neutral-400">{notification.dateCreated}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {data && data.notifications.length > 0 && (
            <div className="p-2 border-t border-neutral-200 bg-neutral-50">
              <a
                href={`${process.env.NEXT_PUBLIC_PHA_HOST || 'http://pha.tp-link.com.cn'}/notification/`}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-center text-xs text-blue-600 hover:text-blue-700 py-1"
              >
                View all notifications
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
