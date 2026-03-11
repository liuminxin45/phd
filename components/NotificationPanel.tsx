import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { httpClient } from '@/lib/httpClient';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';

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

  const handleToggle = (open: boolean) => {
    setIsOpen(open);
    if (open && !data) {
      fetchNotifications();
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    window.open(notification.url, '_blank');
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={handleToggle}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "glass-interactive relative h-8 w-8 rounded-xl border border-white/45 bg-white/42 text-slate-600 shadow-[0_10px_24px_rgba(15,23,42,0.12)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/28",
            "hover:border-sky-200/80 hover:bg-white/66 hover:text-slate-900",
            isOpen && "border-white/65 bg-white/78 text-slate-900"
          )}
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          {data && data.unreadCount > 0 && (
            <span className="absolute right-1.5 top-1.5 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-80 rounded-3xl border border-white/65 bg-[#f8fbff]/90 p-0 shadow-[0_22px_56px_rgba(15,23,42,0.22)] backdrop-blur-2xl supports-[backdrop-filter]:bg-[#f8fbff]/78 sm:w-96" align="end">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/50 bg-white/36 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-900">Notifications</h3>
          {data && data.unreadCount > 0 && (
            <span className="rounded-full border border-sky-200/70 bg-sky-100/70 px-2 py-0.5 text-xs font-medium text-sky-700">
              {data.unreadCount} new
            </span>
          )}
        </div>

        {/* Notification List */}
        <div className="max-h-[400px] overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <p className="mt-2 text-xs">Loading...</p>
            </div>
          ) : !data || data.notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Bell className="mb-2 h-8 w-8 opacity-20" />
              <p className="text-sm">No notifications</p>
            </div>
          ) : (
            <div className="divide-y divide-white/45">
              {data.notifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 p-4 transition-colors hover:bg-white/68",
                    notification.isUnread && "bg-sky-50/50"
                  )}
                >
                  <div className={cn(
                    "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                    notification.isUnread ? "bg-primary" : "bg-transparent"
                  )} />
                  <div className="flex-1 space-y-1">
                    <p className={cn(
                      "text-sm leading-none",
                      notification.isUnread ? "font-medium text-foreground" : "text-muted-foreground"
                    )}>
                      {notification.title}
                    </p>
                    {notification.content && notification.content !== notification.title && (
                      <p className="line-clamp-2 text-xs text-muted-foreground">
                        {notification.content}
                      </p>
                    )}
                    <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                      {notification.author && <span>{notification.author}</span>}
                      {notification.dateCreated && <span>{notification.dateCreated}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {data && data.notifications.length > 0 && (
          <div className="border-t border-white/50 bg-white/34 p-2">
            <a
              href={`${process.env.NEXT_PUBLIC_PHA_HOST || 'http://pha.tp-link.com.cn'}/notification/`}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full rounded-xl px-2 py-1.5 text-center text-xs font-medium text-sky-700 hover:bg-sky-100/70 hover:underline"
            >
              View all notifications
            </a>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
