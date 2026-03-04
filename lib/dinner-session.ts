/**
 * Dinner subsidy session management
 * Handles login to TP-Link CAS and dinner subsidy system
 */

import * as fs from 'fs';
import * as path from 'path';
import { getRuntimeEnv } from '@/lib/settings/runtime-env';

export interface DinnerCookieJar {
  SESSION?: string;
  session_id_dinner?: string;
  [key: string]: string | undefined;
}

let isRefreshing = false;
let refreshPromise: Promise<DinnerCookieJar> | null = null;

function parseCookies(setCookieHeaders: string[]): DinnerCookieJar {
  const cookies: DinnerCookieJar = {};
  for (const header of setCookieHeaders) {
    const match = header.match(/^([^=]+)=([^;]*)/);
    if (match) {
      const [, name, rawValue] = match;
      // Strip surrounding quotes from cookie values (e.g. "value" → value)
      let value = decodeURIComponent(rawValue);
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }
      cookies[name] = value;
    }
  }
  return cookies;
}

function mergeCookies(existing: DinnerCookieJar, newCookies: DinnerCookieJar): DinnerCookieJar {
  return { ...existing, ...newCookies };
}

function cookieString(cookies: DinnerCookieJar): string {
  return Object.entries(cookies)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

/**
 * Login to TP-Link CAS and get dinner subsidy session
 */
export async function refreshDinnerSession(): Promise<DinnerCookieJar> {
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

    let cookies: DinnerCookieJar = {};

    try {
      // Step 1: Access CAS login page
      const casLoginUrl = 'https://tplogin.tp-link.com.cn/cas/login?service=http://selfservice.tp-link.com.cn:8081/dinner/default/user/login';
      
      const loginPageRes = await fetch(casLoginUrl, {
        method: 'GET',
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
        },
        redirect: 'manual',
      });

      const setCookies1 = loginPageRes.headers.getSetCookie?.() || [];
      cookies = mergeCookies(cookies, parseCookies(setCookies1));
      const loginPageHtml = await loginPageRes.text();

      // Extract execution token from login form
      const executionMatch = loginPageHtml.match(/name="execution"\s+value="([^"]+)"/);
      const execution = executionMatch ? executionMatch[1] : 'e1s1';

      // Step 2: Submit CAS login
      const loginFormData = new URLSearchParams();
      loginFormData.append('username', username);
      loginFormData.append('password', password);
      loginFormData.append('rememberMe', 'on');
      loginFormData.append('execution', execution);
      loginFormData.append('_eventId', 'submit');
      loginFormData.append('geolocation', '');

      const loginRes = await fetch(casLoginUrl, {
        method: 'POST',
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cookie': cookieString(cookies),
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
          'Origin': 'https://tplogin.tp-link.com.cn',
          'Referer': casLoginUrl,
        },
        body: loginFormData.toString(),
        redirect: 'manual',
      });

      const setCookies2 = loginRes.headers.getSetCookie?.() || [];
      cookies = mergeCookies(cookies, parseCookies(setCookies2));

      // Step 3: Follow redirect to dinner service with ticket
      const location1 = loginRes.headers.get('location');
      if (!location1) {
        throw new Error('No redirect after CAS login (status=' + loginRes.status + ') - check username/password');
      }

      const ticketRes = await fetch(location1, {
        method: 'GET',
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Cookie': cookieString(cookies),
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
        },
        redirect: 'manual',
      });

      const setCookies3 = ticketRes.headers.getSetCookie?.() || [];
      cookies = mergeCookies(cookies, parseCookies(setCookies3));

      // Step 4: Follow any additional redirects
      const location2 = ticketRes.headers.get('location');
      if (location2) {
        const finalUrl = location2.startsWith('http') ? location2 : `http://selfservice.tp-link.com.cn:8081${location2}`;
        const finalRes = await fetch(finalUrl, {
          method: 'GET',
          headers: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Cookie': cookieString(cookies),
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
          },
          redirect: 'manual',
        });

        const setCookies4 = finalRes.headers.getSetCookie?.() || [];
        cookies = mergeCookies(cookies, parseCookies(setCookies4));
      }

      if (!cookies.session_id_dinner) {
        throw new Error('Failed to obtain dinner session cookie after login');
      }

      // Update .env.local file
      const envPath = path.join(process.cwd(), '.env.local');
      let envContent = '';
      
      if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf-8');
      }

      if (envContent.includes('DINNER_SESSION=')) {
        envContent = envContent.replace(/DINNER_SESSION=.*/, `DINNER_SESSION=${cookies.session_id_dinner}`);
      } else {
        envContent += `\nDINNER_SESSION=${cookies.session_id_dinner}`;
      }

      fs.writeFileSync(envPath, envContent.trim() + '\n');

      // Update process.env for immediate use
      process.env.DINNER_SESSION = cookies.session_id_dinner;

      return cookies;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/**
 * Get current dinner session or refresh if needed
 */
export function getDinnerSession(): string | undefined {
  return process.env.DINNER_SESSION;
}
