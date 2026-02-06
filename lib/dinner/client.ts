/**
 * Shared dinner subsidy API client utilities.
 * Used by both pages/api/dinner/index.ts and pages/api/dinner/apply.ts.
 */

import { refreshDinnerSession } from '@/lib/dinner-session';

export const DINNER_BASE_URL = 'http://selfservice.tp-link.com.cn:8081/dinner/default';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36';

export function makeHeaders(session: string) {
  return {
    'Accept': 'application/json, text/javascript, */*; q=0.01',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Cookie': `session_id_dinner="${session}"`,
    'User-Agent': USER_AGENT,
    'X-Requested-With': 'XMLHttpRequest',
  };
}

export async function ensureSession(): Promise<string> {
  let session = process.env.DINNER_SESSION;
  if (!session) {
    const cookies = await refreshDinnerSession();
    session = cookies.session_id_dinner;
  }
  if (!session) throw new Error('No dinner session available');
  return session;
}

/**
 * Visit the dinner index page to establish/refresh the session cookie.
 * Returns the (potentially updated) session ID.
 */
export async function establishSession(session: string): Promise<string> {
  const resp = await fetch(`${DINNER_BASE_URL}/index`, {
    method: 'GET',
    headers: { 'Accept': 'text/html', 'Cookie': `session_id_dinner="${session}"`, 'User-Agent': USER_AGENT },
  });
  const setCookie = resp.headers.getSetCookie?.() || [];
  for (const h of setCookie) {
    const m = h.match(/session_id_dinner="?([^";]+)"?/);
    if (m) session = m[1];
  }
  return session;
}

export async function fetchJson<T>(url: string, options: RequestInit): Promise<T> {
  const resp = await fetch(url, options);
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`${resp.status} ${resp.statusText}: ${text.substring(0, 200)}`);
  }
  return await resp.json() as T;
}

/**
 * Obtain a working session, refreshing credentials if the first attempt fails.
 * Returns the active session ID.
 */
export async function getActiveSession(): Promise<string> {
  let session = await ensureSession();
  return establishSession(session);
}

/**
 * Re-obtain a session by forcing a credential refresh, then re-establishing.
 */
export async function refreshAndEstablish(currentSession: string): Promise<string> {
  const cookies = await refreshDinnerSession();
  const session = cookies.session_id_dinner || currentSession;
  return establishSession(session);
}
