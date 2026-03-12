import type { NextApiRequest, NextApiResponse } from 'next';
import { refreshPhabricatorSession, isSessionExpired } from '@/lib/auto-refresh-session';

export interface Notification {
  id: string;
  title: string;
  content: string;
  url: string;
  isUnread: boolean;
  dateCreated: string;
  author?: string;
  type?: string;
}

export interface NotificationsResponse {
  notifications: Notification[];
  unreadCount: number;
  total: number;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const host = process.env.PHA_HOST;
    const phaUser = process.env.PHA_USER;
    const phaSession = process.env.PHA_SESSION;

    if (!host) {
      return res.status(500).json({ error: 'Server configuration error: PHA_HOST not set' });
    }

    if (!phaUser || !phaSession) {
      return res.status(500).json({ error: 'Server configuration error: PHA_USER or PHA_SESSION not set' });
    }

    const url = `${host}/notification/query/all/`;

    // Make GET request to fetch notifications
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Cookie': `phusr=${phaUser}; phsid=${phaSession}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      throw new Error(`Phabricator request failed: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();

    // Check if session expired
    if (isSessionExpired(html)) {
      console.log('[Notifications API] Session expired, refreshing...');
      
      try {
        // Refresh session
        const newSession = await refreshPhabricatorSession();
        
        // Retry the request with new session
        const retryResponse = await fetch(url, {
          method: 'GET',
          headers: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Cookie': `phusr=${newSession.phusr}; phsid=${newSession.phsid}`,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        });

        if (!retryResponse.ok) {
          throw new Error(`Retry failed: ${retryResponse.status} ${retryResponse.statusText}`);
        }

        const retryHtml = await retryResponse.text();
        const result = parseNotificationsHtml(retryHtml, host);
        return res.status(200).json(result);
      } catch (refreshError: any) {
        console.error('[Notifications API] Session refresh failed:', refreshError);
        return res.status(500).json({ 
          error: 'Session expired and refresh failed: ' + refreshError.message 
        });
      }
    }

    // Parse the HTML response to extract notifications
    const result = parseNotificationsHtml(html, host);

    res.status(200).json(result);
  } catch (error: any) {
    console.error('Notifications API error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to fetch notifications data' 
    });
  }
}

function parseNotificationsHtml(html: string, host: string): NotificationsResponse {
  const notifications: Notification[] = [];
  let unreadCount = 0;

  // Try to extract unread count from aphlictDropdownData JSON
  const aphlictMatch = html.match(/"aphlictDropdownData":\[([^\]]+)\]/);
  if (aphlictMatch) {
    try {
      const aphlictData = JSON.parse('[' + aphlictMatch[1] + ']');
      const notifData = aphlictData.find((d: any) => d.countType === 'notifications');
      if (notifData) {
        unreadCount = notifData.count || 0;
      }
    } catch (e) {
      console.log('[Notifications] Failed to parse aphlictDropdownData:', e);
    }
  }

  // Parse notification divs - Phabricator uses <div class="phabricator-notification">
  const notifRegex = /<div[^>]*class="phabricator-notification"[^>]*data-sigil="notification"[^>]*>([\s\S]*?)<\/div>(?=<div class="phabricator-notification"|<\/div>)/gi;
  let match;
  
  while ((match = notifRegex.exec(html)) !== null) {
    const notifContent = match[1];
    
    // Extract the main content text (everything before phabricator-notification-foot)
    const contentMatch = notifContent.match(/([\s\S]*?)<div class="phabricator-notification-foot">/);
    let title = '';
    if (contentMatch) {
      title = contentMatch[1].replace(/<[^>]*>/g, '').trim();
    }
    
    // Extract date from phabricator-notification-foot
    let dateCreated = '';
    const dateMatch = notifContent.match(/<div class="phabricator-notification-foot">[\s\S]*?>([^<]+)<\/div>/);
    if (dateMatch) {
      dateCreated = dateMatch[1].trim();
    }
    
    // Extract task/blog ID and URL from links
    let url = '';
    let id = '';
    
    // Try to find task link (T123456)
    const taskMatch = notifContent.match(/href="(\/T(\d+))"/);
    if (taskMatch) {
      url = `${host}${taskMatch[1]}`;
      id = `T${taskMatch[2]}`;
    } else {
      // Try to find blog link (J123456)
      const blogMatch = notifContent.match(/href="(\/J(\d+))"/);
      if (blogMatch) {
        url = `${host}${blogMatch[1]}`;
        id = `J${blogMatch[2]}`;
      } else {
        // Try to find any other link
        const anyLinkMatch = notifContent.match(/href="([^"]+)"/);
        if (anyLinkMatch) {
          url = anyLinkMatch[1].startsWith('http') ? anyLinkMatch[1] : `${host}${anyLinkMatch[1]}`;
          id = `notif_${notifications.length}`;
        }
      }
    }
    
    // Extract author from phui-handle phui-link-person
    let author = '';
    const authorMatch = notifContent.match(/<a[^>]*class="[^"]*phui-link-person[^"]*"[^>]*>([^<(]+)/);
    if (authorMatch) {
      author = authorMatch[1].trim();
    }
    
    // Check if unread - notifications without fa-circle-o are unread
    // Actually all notifications shown are read (they have fa-circle)
    // Unread ones would have different styling or be in a different section
    const isUnread = false; // All shown notifications are considered read
    
    if (title && url) {
      notifications.push({
        id,
        title,
        content: '',
        url,
        isUnread,
        dateCreated,
        author,
      });
    }
  }

  if (process.env.DEBUG_NOTIFICATIONS === '1') {
    console.log(`[Notifications] Found ${notifications.length} notifications, ${unreadCount} unread`);
  }

  return {
    notifications,
    unreadCount,
    total: notifications.length,
  };
}
