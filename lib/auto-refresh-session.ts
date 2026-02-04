/**
 * Auto-refresh session utility
 * Automatically refreshes Phabricator session when it expires
 */

import * as fs from 'fs';
import * as path from 'path';

interface CookieJar {
  phusr?: string;
  phsid?: string;
  PHPSESSID?: string;
  next_uri?: string;
  phcid?: string;
}

function parseCookies(setCookieHeaders: string[]): CookieJar {
  const cookies: CookieJar = {};
  for (const header of setCookieHeaders) {
    const match = header.match(/^([^=]+)=([^;]*)/);
    if (match) {
      const [, name, value] = match;
      (cookies as any)[name] = value;
    }
  }
  return cookies;
}

function mergeCookies(existing: CookieJar, newCookies: CookieJar): CookieJar {
  return { ...existing, ...newCookies };
}

function cookieString(cookies: CookieJar): string {
  return Object.entries(cookies)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

let isRefreshing = false;
let refreshPromise: Promise<{ phusr: string; phsid: string }> | null = null;

/**
 * Refresh Phabricator session by logging in with LDAP credentials
 * Returns new session cookies
 */
export async function refreshPhabricatorSession(): Promise<{ phusr: string; phsid: string }> {
  // If already refreshing, wait for that to complete
  if (isRefreshing && refreshPromise) {
    console.log('[Session Refresh] Already refreshing, waiting...');
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    const host = process.env.PHA_HOST;
    const username = process.env.PHA_LOGIN_USER;
    const password = process.env.PHA_LOGIN_PASS;

    if (!host || !username || !password) {
      throw new Error('Missing PHA_HOST, PHA_LOGIN_USER, or PHA_LOGIN_PASS environment variables');
    }

    console.log(`[Session Refresh] Logging in to ${host} as ${username}...`);

    let cookies: CookieJar = {};

    try {
      // Step 1: Access LDAP login form
      const ldapFormUrl = `${host}/auth/login/ldap:self/`;
      const ldapFormRes = await fetch(ldapFormUrl, {
        method: 'GET',
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        redirect: 'manual',
      });

      const setCookies1 = ldapFormRes.headers.getSetCookie?.() || [];
      cookies = mergeCookies(cookies, parseCookies(setCookies1));
      
      const ldapFormHtml = await ldapFormRes.text();
      
      // Extract CSRF token
      let ldapCsrfMatch = ldapFormHtml.match(/name="__csrf__"\s+value="([^"]+)"/);
      let ldapCsrfToken = ldapCsrfMatch ? ldapCsrfMatch[1] : '';
      
      if (!ldapCsrfToken) {
        ldapCsrfMatch = ldapFormHtml.match(/value="([^"]+)"\s+name="__csrf__"/);
        if (ldapCsrfMatch) ldapCsrfToken = ldapCsrfMatch[1];
      }
      
      if (!ldapCsrfToken) {
        ldapCsrfMatch = ldapFormHtml.match(/__csrf__['"]\s*:\s*['"]([^'"]+)['"]/);
        if (ldapCsrfMatch) ldapCsrfToken = ldapCsrfMatch[1];
      }
      
      if (!ldapCsrfToken) {
        throw new Error('Could not find CSRF token on LDAP login form');
      }

      // Step 2: Submit LDAP login
      const loginFormData = new URLSearchParams();
      loginFormData.append('__csrf__', ldapCsrfToken);
      loginFormData.append('__form__', '1');
      loginFormData.append('__dialog__', '1');
      loginFormData.append('ldap_username', username);
      loginFormData.append('ldap_password', password);

      const loginRes = await fetch(ldapFormUrl, {
        method: 'POST',
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cookie': cookieString(cookies),
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Origin': host,
        },
        body: loginFormData.toString(),
        redirect: 'manual',
      });

      const setCookies2 = loginRes.headers.getSetCookie?.() || [];
      cookies = mergeCookies(cookies, parseCookies(setCookies2));

      // Step 3: Follow redirects to complete login
      const location1 = loginRes.headers.get('location');
      
      if (location1) {
        const validateUrl = location1.startsWith('http') ? location1 : `${host}${location1}`;
        const validateRes = await fetch(validateUrl, {
          method: 'GET',
          headers: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Cookie': cookieString(cookies),
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
          redirect: 'manual',
        });

        const setCookies3 = validateRes.headers.getSetCookie?.() || [];
        cookies = mergeCookies(cookies, parseCookies(setCookies3));

        const location2 = validateRes.headers.get('location');
        if (location2) {
          const finishUrl = location2.startsWith('http') ? location2 : `${host}${location2}`;
          const finishRes = await fetch(finishUrl, {
            method: 'GET',
            headers: {
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'Cookie': cookieString(cookies),
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
            redirect: 'manual',
          });

          const setCookies4 = finishRes.headers.getSetCookie?.() || [];
          cookies = mergeCookies(cookies, parseCookies(setCookies4));
        }
      }

      if (!cookies.phusr || !cookies.phsid) {
        throw new Error('Failed to obtain session cookies after login');
      }

      console.log(`[Session Refresh] Login successful! New session: ${cookies.phsid?.substring(0, 20)}...`);

      // Update .env.local file
      const envPath = path.join(process.cwd(), '.env.local');
      let envContent = '';
      
      if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf-8');
      }

      if (envContent.includes('PHA_USER=')) {
        envContent = envContent.replace(/PHA_USER=.*/, `PHA_USER=${cookies.phusr}`);
      } else {
        envContent += `\nPHA_USER=${cookies.phusr}`;
      }

      if (envContent.includes('PHA_SESSION=')) {
        envContent = envContent.replace(/PHA_SESSION=.*/, `PHA_SESSION=${cookies.phsid}`);
      } else {
        envContent += `\nPHA_SESSION=${cookies.phsid}`;
      }

      fs.writeFileSync(envPath, envContent.trim() + '\n');
      console.log('[Session Refresh] .env.local updated');

      // Update process.env for immediate use
      process.env.PHA_USER = cookies.phusr;
      process.env.PHA_SESSION = cookies.phsid;

      return {
        phusr: cookies.phusr,
        phsid: cookies.phsid,
      };
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/**
 * Check if an HTML response indicates session expiry
 */
export function isSessionExpired(html: string): boolean {
  return (
    html.includes('CAS Authentication wanted') ||
    html.includes('You must log in') ||
    html.includes('login required') ||
    html.includes('/auth/start/') ||
    html.length < 500 // Very short response might be a redirect
  );
}
