/**
 * Gerrit session management via CAS + SAML SSO login flow.
 *
 * Flow:
 *   1. GET CAS login page → extract `execution` token + SESSION cookie
 *   2. POST CAS login with credentials → get redirect with ticket → TGC cookie
 *   3. Follow redirect to SAML2/Callback on tplogin (with ticket) → get SAMLResponse HTML form
 *   4. POST SAMLResponse to Gerrit SAML callback → get JSESSIONID + XSRF_TOKEN
 *   5. Follow redirects → get GerritAccount cookie
 *   6. Store all 3 cookies for API use
 */

import * as fs from 'fs';
import * as path from 'path';
import { getRuntimeEnv } from '@/lib/settings/runtime-env';

export const GERRIT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36';

export interface GerritCookieJar {
  JSESSIONID?: string;
  GerritAccount?: string;
  XSRF_TOKEN?: string;
  [key: string]: string | undefined;
}

// ─── In-memory cache ─────────────────────────────────────────────────────────

let cachedSession: GerritCookieJar | null = null;
let isRefreshing = false;
let refreshPromise: Promise<GerritCookieJar> | null = null;

// ─── Cookie helpers ──────────────────────────────────────────────────────────

function parseCookies(setCookieHeaders: string[]): GerritCookieJar {
  const cookies: GerritCookieJar = {};
  for (const header of setCookieHeaders) {
    const match = header.match(/^([^=]+)=([^;]*)/);
    if (match) {
      const [, name, rawValue] = match;
      let value = rawValue;
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }
      cookies[name] = value;
    }
  }
  return cookies;
}

function mergeCookies(existing: GerritCookieJar, incoming: GerritCookieJar): GerritCookieJar {
  return { ...existing, ...incoming };
}

export function cookieStr(cookies: GerritCookieJar): string {
  return Object.entries(cookies)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

// ─── HTML entity decoder ─────────────────────────────────────────────────────

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

// ─── HTML form parser (for SAML auto-submit forms) ──────────────────────────

interface ParsedForm {
  action: string;
  method: string;
  fields: Record<string, string>;
}

/**
 * Parse an HTML auto-submit form (like SAML AuthnRequest/Response forms).
 * These have `<body onload="document.forms[0].submit()">` and hidden fields.
 */
function parseAutoSubmitForm(html: string, currentUrl: string): ParsedForm | null {
  // Check if this page has any form that auto-submits
  const hasAutoSubmit = html.includes('document.forms') || html.includes('.submit()') || html.includes('onload=');
  const hasForm = html.includes('<form');
  if (!hasAutoSubmit || !hasForm) return null;

  // Extract form action (support action="..." or action='...' or no action)
  let action = currentUrl; // default: submit to self
  const actionMatch = html.match(/<form[^>]*\baction\s*=\s*"([^"]+)"/i)
    || html.match(/<form[^>]*\baction\s*=\s*'([^']+)'/i);
  if (actionMatch) {
    const rawAction = decodeHtmlEntities(actionMatch[1]);
    action = rawAction.startsWith('http') ? rawAction : new URL(rawAction, currentUrl).toString();
  }

  // Extract method (default POST for SAML)
  const methodMatch = html.match(/<form[^>]*\bmethod\s*=\s*["']([^"']+)["']/i);
  const method = (methodMatch ? methodMatch[1] : 'POST').toUpperCase();

  // Extract all hidden input fields (handle various attribute orderings)
  const fields: Record<string, string> = {};
  // Match any <input> that has type="hidden" anywhere in its attributes
  const inputRegex = /<input\b[^>]*>/gi;
  let match;
  while ((match = inputRegex.exec(html)) !== null) {
    const input = match[0];
    if (!/type\s*=\s*["']hidden["']/i.test(input)) continue;
    const nameMatch = input.match(/\bname\s*=\s*["']([^"']+)["']/);
    const valueMatch = input.match(/\bvalue\s*=\s*["']([^"']*)["']/);
    if (nameMatch) {
      fields[nameMatch[1]] = valueMatch ? decodeHtmlEntities(valueMatch[1]) : '';
    }
  }

  return { action, method, fields };
}

// ─── SAML login flow ─────────────────────────────────────────────────────────

export async function refreshGerritSession(): Promise<GerritCookieJar> {
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    const gerritUrl = getRuntimeEnv('GERRIT_URL');
    const username = getRuntimeEnv('LOGIN_USER');
    const password = getRuntimeEnv('LOGIN_PASS');

    if (!gerritUrl) throw new Error('GERRIT_URL is not configured');
    if (!username || !password) throw new Error('LOGIN_USER / LOGIN_PASS are not configured');

    console.log('[Gerrit Session] Logging in via CAS+SAML...');

    // We maintain separate cookie jars for different domains
    let allCookies: GerritCookieJar = {};
    let gerritCookies: GerritCookieJar = {};

    try {
      // ── Step 1: Start from Gerrit's login endpoint ──────────
      // This initiates the SAML AuthnRequest flow:
      //   Gerrit → SAML plugin → IDP (AuthnRequest) → CAS login page
      // We follow all redirects, collecting cookies, until we reach the CAS login form.

      let currentUrl: string | null = `${gerritUrl}/login/`;
      let casLoginUrl: string | null = null;
      let casLoginHtml: string = '';
      let hop = 0;
      const MAX_HOPS = 15;

      while (currentUrl && hop < MAX_HOPS) {
        hop++;

        const res: Response = await fetch(currentUrl, {
          method: 'GET',
          headers: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Cookie': cookieStr(allCookies),
            'User-Agent': GERRIT_UA,
          },
          redirect: 'manual',
        });

        const hopCookies: string[] = res.headers.getSetCookie?.() || [];
        allCookies = mergeCookies(allCookies, parseCookies(hopCookies));

        const loc: string | null = res.headers.get('location');
        if (loc && [301, 302, 303, 307].includes(res.status)) {
          currentUrl = loc.startsWith('http') ? loc : new URL(loc, currentUrl).toString();
          await res.text().catch(() => {});
          continue;
        }

        // Not a redirect — read body
        const html = await res.text();

        // Check if it's a CAS login page
        if (html.includes('name="execution"') || (html.includes('name="username"') && html.includes('_eventId'))) {
          casLoginUrl = currentUrl;
          casLoginHtml = html;
          break;
        }

        // Check if it's a SAML auto-submit form (AuthnRequest etc.)
        const autoForm = parseAutoSubmitForm(html, currentUrl);
        if (autoForm) {

          // Submit the form
          const formBody = new URLSearchParams(autoForm.fields);
          const formRes: Response = await fetch(autoForm.action, {
            method: autoForm.method,
            headers: {
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'Content-Type': 'application/x-www-form-urlencoded',
              'Cookie': cookieStr(allCookies),
              'User-Agent': GERRIT_UA,
              'Origin': new URL(autoForm.action).origin,
              'Referer': currentUrl,
            },
            body: formBody.toString(),
            redirect: 'manual',
          });

          const formCookies: string[] = formRes.headers.getSetCookie?.() || [];
          allCookies = mergeCookies(allCookies, parseCookies(formCookies));

          const formLoc: string | null = formRes.headers.get('location');
          if (formLoc && [301, 302, 303, 307].includes(formRes.status)) {
            currentUrl = formLoc.startsWith('http') ? formLoc : new URL(formLoc, autoForm.action).toString();
            await formRes.text().catch(() => {});
            continue;
          }

          // Form response was not a redirect — check its body too
          const formHtml = await formRes.text();
          if (formHtml.includes('name="execution"') || (formHtml.includes('name="username"') && formHtml.includes('_eventId'))) {
            casLoginUrl = autoForm.action;
            casLoginHtml = formHtml;
            break;
          }

          // Check if response is another auto-submit form in chain
          const nextForm = parseAutoSubmitForm(formHtml, autoForm.action);
          if (nextForm) {
            currentUrl = nextForm.action;
            continue;
          }

          console.error(`[Gerrit Session] Unexpected form response: ${formHtml.substring(0, 200)}`);
          currentUrl = null;
          continue;
        }

        console.error(`[Gerrit Session] Unexpected page: ${html.substring(0, 200)}`);
        currentUrl = null;
      }

      if (!casLoginUrl) {
        throw new Error(`Could not reach CAS login page after ${hop} redirects`);
      }

      // Extract execution token from CAS login form
      const executionMatch = casLoginHtml.match(/name="execution"\s+value="([^"]+)"/);
      const execution = executionMatch ? executionMatch[1] : 'e1s1';

      // ── Step 2: POST CAS login credentials ─────────────────
      const formData = new URLSearchParams();
      formData.append('username', username);
      formData.append('password', password);
      formData.append('rememberMe', 'on');
      formData.append('execution', execution);
      formData.append('_eventId', 'submit');
      formData.append('geolocation', '');

      const loginRes: Response = await fetch(casLoginUrl, {
        method: 'POST',
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cookie': cookieStr(allCookies),
          'User-Agent': GERRIT_UA,
          'Origin': 'https://tplogin.tp-link.com.cn',
          'Referer': casLoginUrl,
        },
        body: formData.toString(),
        redirect: 'manual',
      });

      const loginCookies: string[] = loginRes.headers.getSetCookie?.() || [];
      allCookies = mergeCookies(allCookies, parseCookies(loginCookies));

      const casRedirect = loginRes.headers.get('location');

      if (!casRedirect) {
        throw new Error(`CAS login failed (status=${loginRes.status}) - check username/password`);
      }

      // ── Step 3: Follow redirect chain back through IDP → SAMLResponse ──
      currentUrl = casRedirect;
      let samlResponseValue: string | null = null;
      let relayStateValue: string = '';
      hop = 0;

      while (currentUrl && hop < MAX_HOPS) {
        hop++;

        const res: Response = await fetch(currentUrl, {
          method: 'GET',
          headers: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Cookie': cookieStr(allCookies),
            'User-Agent': GERRIT_UA,
            'Referer': casLoginUrl,
          },
          redirect: 'manual',
        });

        const hopCookies: string[] = res.headers.getSetCookie?.() || [];
        allCookies = mergeCookies(allCookies, parseCookies(hopCookies));

        const loc: string | null = res.headers.get('location');
        if (loc && [301, 302, 303, 307].includes(res.status)) {
          currentUrl = loc.startsWith('http') ? loc : new URL(loc, currentUrl).toString();
          await res.text().catch(() => {});
          continue;
        }

        const html = await res.text();

        const samlMatch = html.match(/name="SAMLResponse"\s+value="([^"]+)"/);
        const relayMatch = html.match(/name="RelayState"\s+value="([^"]+)"/);

        if (samlMatch) {
          samlResponseValue = decodeHtmlEntities(samlMatch[1]);
          relayStateValue = relayMatch ? decodeHtmlEntities(relayMatch[1]) : '';
          // Also extract the form action URL (Gerrit's SAML callback)
          const actionMatch = html.match(/action="([^"]+)"/);
          if (actionMatch) {
            const samlCallbackUrl = decodeHtmlEntities(actionMatch[1]);
            return await completeSamlFlow(gerritUrl, samlCallbackUrl, samlResponseValue, relayStateValue, gerritCookies);
          }
          // Fallback to default callback URL
          return await completeSamlFlow(gerritUrl, `${gerritUrl}/plugins/saml/callback`, samlResponseValue, relayStateValue, gerritCookies);
        }

        console.error(`[Gerrit Session] No SAMLResponse: ${html.substring(0, 200)}`);
        currentUrl = null;
      }

      if (!samlResponseValue) {
        throw new Error(`Could not extract SAMLResponse after Step 3 (${hop} hops)`);
      }

      // Should not reach here, but just in case
      return await completeSamlFlow(gerritUrl, `${gerritUrl}/plugins/saml/callback`, samlResponseValue, relayStateValue, gerritCookies);
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

async function completeSamlFlow(
  gerritUrl: string,
  samlCallbackUrl: string,
  samlResponse: string,
  relayState: string,
  gerritCookies: GerritCookieJar,
): Promise<GerritCookieJar> {
  // ── Step 4: POST SAMLResponse to Gerrit's SAML callback ──
  const callbackFormData = new URLSearchParams();
  callbackFormData.append('SAMLResponse', samlResponse);
  if (relayState) callbackFormData.append('RelayState', relayState);

  const callbackUrl = samlCallbackUrl.includes('client_name=') ? samlCallbackUrl : `${samlCallbackUrl}?client_name=SAML2Client`;
  const callbackRes = await fetch(callbackUrl, {
    method: 'POST',
    headers: {
      'Accept': 'text/html',
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': GERRIT_UA,
      'Origin': 'https://tplogin.tp-link.com.cn',
      'Referer': 'https://tplogin.tp-link.com.cn/',
    },
    body: callbackFormData.toString(),
    redirect: 'manual',
  });

  const setCookies4 = callbackRes.headers.getSetCookie?.() || [];
  gerritCookies = { ...gerritCookies, ...parseCookies(setCookies4) };

  // ── Step 5: Follow redirects to get GerritAccount cookie ──
  let nextLocation = callbackRes.headers.get('location');
  let redirectCount = 0;

  while (nextLocation && redirectCount < 5) {
    redirectCount++;
    const redirectUrl = nextLocation.startsWith('http')
      ? nextLocation
      : `${gerritUrl}${nextLocation}`;

    const redirectRes = await fetch(redirectUrl, {
      method: 'GET',
      headers: {
        'Accept': 'text/html',
        'Cookie': cookieStr(gerritCookies),
        'User-Agent': GERRIT_UA,
        'Referer': 'https://tplogin.tp-link.com.cn/',
      },
      redirect: 'manual',
    });

    const setCookiesN = redirectRes.headers.getSetCookie?.() || [];
    gerritCookies = { ...gerritCookies, ...parseCookies(setCookiesN) };
    nextLocation = redirectRes.headers.get('location');
  }

  // Verify we got the essential cookies
  if (!gerritCookies.JSESSIONID) {
    throw new Error('Failed to obtain Gerrit JSESSIONID after SAML login');
  }

  console.log('[Gerrit Session] Login successful');

  // Cache in memory
  cachedSession = gerritCookies;

  // Persist to .env.local
  persistSession(gerritCookies);

  return gerritCookies;
}

// ─── Session persistence ─────────────────────────────────────────────────────

function persistSession(cookies: GerritCookieJar) {
  try {
    const envPath = path.join(process.cwd(), '.env.local');
    if (!fs.existsSync(envPath)) return;

    let content = fs.readFileSync(envPath, 'utf-8');

    const sessionValue = [
      cookies.JSESSIONID || '',
      cookies.GerritAccount || '',
      cookies.XSRF_TOKEN || '',
    ].join('|');

    if (content.includes('GERRIT_SESSION=')) {
      content = content.replace(/GERRIT_SESSION=.*/, `GERRIT_SESSION=${sessionValue}`);
    } else {
      content = content.trimEnd() + `\nGERRIT_SESSION=${sessionValue}\n`;
    }

    fs.writeFileSync(envPath, content);
    process.env.GERRIT_SESSION = sessionValue;
  } catch (err) {
    console.warn('[Gerrit Session] Could not persist session to .env.local:', err);
  }
}

/**
 * Load session from env (persisted across restarts) or memory cache.
 */
export function loadGerritSession(): GerritCookieJar | null {
  if (cachedSession?.JSESSIONID) return cachedSession;

  const envSession = getRuntimeEnv('GERRIT_SESSION');
  if (envSession) {
    const [jsessionid, gerritAccount, xsrfToken] = envSession.split('|');
    if (jsessionid) {
      cachedSession = {
        JSESSIONID: jsessionid,
        GerritAccount: gerritAccount || undefined,
        XSRF_TOKEN: xsrfToken || undefined,
      };
      return cachedSession;
    }
  }

  return null;
}

/**
 * Get a valid Gerrit session. Loads from cache/env first, refreshes if not available.
 */
export async function ensureGerritSession(): Promise<GerritCookieJar> {
  const existing = loadGerritSession();
  if (existing) return existing;
  return refreshGerritSession();
}

/**
 * Clear cached session (e.g., on 401 errors) so next call will refresh.
 */
export function clearGerritSession() {
  cachedSession = null;
}
