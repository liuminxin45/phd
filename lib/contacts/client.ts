import {
  clearContactsSession,
  cookieString,
  ensureContactsSession,
  refreshContactsSession,
  type ContactsCookieJar,
} from '@/lib/contacts-session';

export const CONTACTS_LIST_URL = 'https://portal.tp-link.com.cn/tp-call-list.html';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0';

function makeHeaders(cookieHeader: string): Record<string, string> {
  return {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8,en-US;q=0.7',
    'Cache-Control': 'max-age=0',
    'Connection': 'keep-alive',
    'Content-Type': 'application/x-www-form-urlencoded',
    'Cookie': cookieHeader,
    'DNT': '1',
    'Origin': 'https://portal.tp-link.com.cn',
    'Referer': CONTACTS_LIST_URL,
    'Upgrade-Insecure-Requests': '1',
    'User-Agent': USER_AGENT,
  };
}

async function requestContactsHtml(cookies: ContactsCookieJar): Promise<string> {
  const response = await fetch(CONTACTS_LIST_URL, {
    method: 'POST',
    headers: makeHeaders(cookieString(cookies)),
    body: 'limit=0',
    redirect: 'manual',
  });

  const body = await response.text();

  if (response.status >= 400) {
    throw new Error(`Contacts request failed: ${response.status} ${response.statusText}`);
  }

  const location = response.headers.get('location');
  if (location && /tplogin\.tp-link\.com\.cn/i.test(location)) {
    throw new Error('Contacts session redirected to CAS login');
  }

  return body;
}

export function isContactsHtml(html: string): boolean {
  return /ldap-table-head/i.test(html) && /list-name/i.test(html);
}

export async function fetchContactsHtml(): Promise<string> {
  let session = await ensureContactsSession();

  try {
    const html = await requestContactsHtml(session);
    if (!isContactsHtml(html)) {
      throw new Error('Contacts HTML did not contain expected table markup');
    }
    return html;
  } catch (error) {
    clearContactsSession();
    session = await refreshContactsSession();
    const html = await requestContactsHtml(session);
    if (!isContactsHtml(html)) {
      throw error instanceof Error ? error : new Error('Contacts HTML did not contain expected table markup');
    }
    return html;
  }
}
