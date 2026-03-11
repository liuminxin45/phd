import * as fs from 'fs';
import * as path from 'path';
import { getRuntimeEnv } from '@/lib/settings/runtime-env';

export interface ContactsCookieJar {
  [key: string]: string | undefined;
}

const CONTACTS_SERVICE_URL = 'https://portal.tp-link.com.cn/tp-call-list.html';
const PORTAL_LOGIN_BRIDGE_URL = `http://portal.tp-link.com.cn?url=${encodeURIComponent('http://portal.tp-link.com.cn/tp-call-list.html')}`;
const CAS_LOGIN_URL = `https://tplogin.tp-link.com.cn/cas/login?service=${encodeURIComponent(CONTACTS_SERVICE_URL)}`;
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36';

let isRefreshing = false;
let refreshPromise: Promise<ContactsCookieJar> | null = null;
let cachedCookies: ContactsCookieJar | null = null;

function parseSetCookies(setCookieHeaders: string[]): ContactsCookieJar {
  const cookies: ContactsCookieJar = {};
  for (const header of setCookieHeaders) {
    const match = header.match(/^([^=]+)=([^;]*)/);
    if (!match) continue;
    const [, name, rawValue] = match;
    let value = decodeURIComponent(rawValue);
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    cookies[name] = value;
  }
  return cookies;
}

function parseCookieHeader(cookieHeader: string): ContactsCookieJar {
  const cookies: ContactsCookieJar = {};
  for (const segment of cookieHeader.split(';')) {
    const trimmed = segment.trim();
    if (!trimmed) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex <= 0) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (key && value) {
      cookies[key] = value;
    }
  }
  return cookies;
}

function mergeCookies(existing: ContactsCookieJar, incoming: ContactsCookieJar): ContactsCookieJar {
  return { ...existing, ...incoming };
}

async function fetchTextWithCookies(
  url: string,
  cookies: ContactsCookieJar,
  options: {
    method?: 'GET' | 'POST';
    body?: string;
    headers?: Record<string, string>;
    maxRedirects?: number;
  } = {},
): Promise<{ body: string; cookies: ContactsCookieJar; finalUrl: string; status: number }> {
  const {
    method = 'GET',
    body,
    headers = {},
    maxRedirects = 8,
  } = options;

  let currentUrl = url;
  let currentCookies = { ...cookies };
  let currentMethod: 'GET' | 'POST' = method;
  let currentBody = body;

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount++) {
    const requestHeaders: Record<string, string> = {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Cookie': cookieString(currentCookies),
      'User-Agent': USER_AGENT,
      ...headers,
    };

    if (currentMethod === 'POST') {
      requestHeaders['Content-Type'] = 'application/x-www-form-urlencoded';
    }

    const response = await fetch(currentUrl, {
      method: currentMethod,
      headers: requestHeaders,
      body: currentMethod === 'POST' ? currentBody : undefined,
      redirect: 'manual',
    });

    currentCookies = mergeCookies(currentCookies, parseSetCookies(response.headers.getSetCookie?.() || []));
    const responseBody = await response.text();
    const location = response.headers.get('location');

    if (!location) {
      return {
        body: responseBody,
        cookies: currentCookies,
        finalUrl: currentUrl,
        status: response.status,
      };
    }

    currentUrl = location.startsWith('http') ? location : new URL(location, currentUrl).toString();
    currentMethod = 'GET';
    currentBody = undefined;
  }

  throw new Error(`Too many redirects while visiting ${url}`);
}

function extractPortalLoginLink(html: string): string | null {
  const match = html.match(/<a\s+href=(?:"|')([^"']+portal\.tp-link\.com\.cn\?url=[^"']+)(?:"|')[^>]*>\s*点击此处登录\s*<\/a>/i);
  if (!match) {
    return null;
  }

  return match[1].replace(/&amp;/g, '&');
}

async function establishPortalSession(cookies: ContactsCookieJar): Promise<ContactsCookieJar> {
  let currentCookies = { ...cookies };

  const initial = await fetchTextWithCookies(CONTACTS_SERVICE_URL, currentCookies);
  currentCookies = initial.cookies;

  if (/<a\s+href=.*点击此处登录/i.test(initial.body)) {
    const loginLink = extractPortalLoginLink(initial.body) || PORTAL_LOGIN_BRIDGE_URL;
    const bridged = await fetchTextWithCookies(loginLink, currentCookies, {
      headers: {
        'Referer': CONTACTS_SERVICE_URL,
      },
    });
    currentCookies = bridged.cookies;

    const retried = await fetchTextWithCookies(CONTACTS_SERVICE_URL, currentCookies);
    currentCookies = retried.cookies;
  }

  return currentCookies;
}

export function cookieString(cookies: ContactsCookieJar): string {
  return Object.entries(cookies)
    .filter(([, value]) => value)
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

function persistSession(cookies: ContactsCookieJar): void {
  try {
    const sessionValue = cookieString(cookies);
    const envPath = path.join(process.cwd(), '.env.local');
    let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf-8') : '';

    if (envContent.includes('CONTACTS_SESSION=')) {
      envContent = envContent.replace(/CONTACTS_SESSION=.*/, `CONTACTS_SESSION=${sessionValue}`);
    } else {
      envContent = `${envContent.trimEnd()}\nCONTACTS_SESSION=${sessionValue}\n`;
    }

    fs.writeFileSync(envPath, envContent.trimStart(), 'utf-8');
    process.env.CONTACTS_SESSION = sessionValue;
  } catch (error) {
    console.warn('[Contacts Session] Could not persist CONTACTS_SESSION:', error);
  }
}

export function loadContactsSession(): ContactsCookieJar | null {
  if (cachedCookies) {
    return cachedCookies;
  }

  const raw = getRuntimeEnv('CONTACTS_SESSION');
  if (!raw) {
    return null;
  }

  const parsed = parseCookieHeader(raw);
  if (Object.keys(parsed).length === 0) {
    return null;
  }

  cachedCookies = parsed;
  return parsed;
}

export function clearContactsSession(): void {
  cachedCookies = null;
}

export async function refreshContactsSession(): Promise<ContactsCookieJar> {
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    const username = getRuntimeEnv('LOGIN_USER');
    const password = getRuntimeEnv('LOGIN_PASS');

    if (!username || !password) {
      throw new Error('Missing LOGIN_USER or LOGIN_PASS environment variables');
    }

    let cookies: ContactsCookieJar = {};

    try {
      const loginPageRes = await fetch(CAS_LOGIN_URL, {
        method: 'GET',
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'User-Agent': USER_AGENT,
        },
        redirect: 'manual',
      });

      cookies = mergeCookies(cookies, parseSetCookies(loginPageRes.headers.getSetCookie?.() || []));
      const loginPageHtml = await loginPageRes.text();
      const executionMatch = loginPageHtml.match(/name="execution"\s+value="([^"]+)"/);
      const execution = executionMatch ? executionMatch[1] : 'e1s1';

      const formData = new URLSearchParams();
      formData.append('username', username);
      formData.append('password', password);
      formData.append('rememberMe', 'on');
      formData.append('execution', execution);
      formData.append('_eventId', 'submit');
      formData.append('geolocation', '');

      const loginRes = await fetch(CAS_LOGIN_URL, {
        method: 'POST',
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cookie': cookieString(cookies),
          'Origin': 'https://tplogin.tp-link.com.cn',
          'Referer': CAS_LOGIN_URL,
          'User-Agent': USER_AGENT,
        },
        body: formData.toString(),
        redirect: 'manual',
      });

      cookies = mergeCookies(cookies, parseSetCookies(loginRes.headers.getSetCookie?.() || []));

      let currentUrl: string | null = loginRes.headers.get('location');
      if (!currentUrl) {
        throw new Error(`No redirect after CAS login (status=${loginRes.status})`);
      }

      for (let redirectCount = 0; currentUrl && redirectCount < 8; redirectCount++) {
        const targetUrl: string = currentUrl.startsWith('http')
          ? currentUrl
          : new URL(currentUrl, CONTACTS_SERVICE_URL).toString();
        const redirectRes: Response = await fetch(targetUrl, {
          method: 'GET',
          headers: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Cookie': cookieString(cookies),
            'User-Agent': USER_AGENT,
          },
          redirect: 'manual',
        });

        cookies = mergeCookies(cookies, parseSetCookies(redirectRes.headers.getSetCookie?.() || []));
        currentUrl = redirectRes.headers.get('location');

        if (!currentUrl) {
          await redirectRes.text().catch(() => '');
          break;
        }
      }

      cookies = await establishPortalSession(cookies);

      if (Object.keys(cookies).length === 0) {
        throw new Error('Failed to obtain contacts session cookies');
      }

      cachedCookies = cookies;
      persistSession(cookies);
      return cookies;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function ensureContactsSession(): Promise<ContactsCookieJar> {
  const existing = loadContactsSession();
  if (existing) {
    return existing;
  }
  return refreshContactsSession();
}
