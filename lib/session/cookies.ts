/**
 * Shared cookie utilities for Phabricator session management
 */

export interface CookieJar {
  phusr?: string;
  phsid?: string;
  PHPSESSID?: string;
  next_uri?: string;
  phcid?: string;
}

export function parseCookies(setCookieHeaders: string[]): CookieJar {
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

export function mergeCookies(existing: CookieJar, newCookies: CookieJar): CookieJar {
  return { ...existing, ...newCookies };
}

export function cookieString(cookies: CookieJar): string {
  return Object.entries(cookies)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

export function extractCsrfToken(html: string): string | null {
  let match = html.match(/name="__csrf__"\s+value="([^"]+)"/);
  if (match) return match[1];

  match = html.match(/value="([^"]+)"\s+name="__csrf__"/);
  if (match) return match[1];

  match = html.match(/__csrf__['"]\s*:\s*['"]([^'"]+)['"]/);
  if (match) return match[1];

  return null;
}
