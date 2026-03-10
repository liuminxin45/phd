// ─── Gerrit REST API Client (server-side, cookie-based SAML auth) ────────────

import {
  ensureGerritSession,
  refreshGerritSession,
  clearGerritSession,
  cookieStr,
  GERRIT_UA,
  type GerritCookieJar,
} from './session';
import { gerritFetch, type GerritFetchResponse } from './fetch';
import { getRuntimeEnv } from '@/lib/settings/runtime-env';

export class GerritClient {
  private baseUrl: string;
  private cookies: GerritCookieJar;

  constructor(baseUrl: string, cookies: GerritCookieJar) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.cookies = cookies;
  }

  private cookieHeader(): string {
    return cookieStr(this.cookies);
  }

  /**
   * Gerrit REST responses are prefixed with ")]}'" to prevent XSSI.
   */
  private async parseResponse<T>(response: GerritFetchResponse): Promise<T> {
    const text = await response.text();
    const cleaned = text.replace(/^\)\]\}'\n?/, '');
    if (!cleaned.trim()) return {} as T;
    return JSON.parse(cleaned);
  }

  /**
   * Handle 401/403 by refreshing session and retrying once.
   */
  private async fetchWithRetry(url: string, init: RequestInit): Promise<GerritFetchResponse> {
    let response = await gerritFetch(url, init);

    if (response.status === 401 || response.status === 403) {
      console.log('[GerritClient] Got 401/403, refreshing session...');
      clearGerritSession();
      const newCookies = await refreshGerritSession();
      this.cookies = newCookies;

      // Retry with new cookies
      const retryInit = {
        ...init,
        headers: { ...init.headers as Record<string, string>, 'Cookie': this.cookieHeader() },
      };
      response = await gerritFetch(url, retryInit);
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`Gerrit API ${response.status}: ${response.statusText} - ${body.slice(0, 200)}`);
    }

    return response;
  }

  async get<T = any>(path: string, params?: Record<string, string | number | boolean>): Promise<T> {
    const url = new URL(`${this.baseUrl}/a${path}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    const response = await this.fetchWithRetry(url.toString(), {
      method: 'GET',
      headers: {
        'Cookie': this.cookieHeader(),
        'Accept': 'application/json',
        'User-Agent': GERRIT_UA,
      },
    });

    return this.parseResponse<T>(response);
  }

  async post<T = any>(path: string, body?: any): Promise<T> {
    const url = `${this.baseUrl}/a${path}`;
    const headers: Record<string, string> = {
      'Cookie': this.cookieHeader(),
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': GERRIT_UA,
    };
    // Gerrit requires XSRF token header for POST requests
    if (this.cookies.XSRF_TOKEN) {
      headers['X-Gerrit-Auth'] = this.cookies.XSRF_TOKEN;
    }

    const response = await this.fetchWithRetry(url, {
      method: 'POST',
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    return this.parseResponse<T>(response);
  }

  async delete<T = any>(path: string): Promise<T> {
    const url = `${this.baseUrl}/a${path}`;
    const headers: Record<string, string> = {
      'Cookie': this.cookieHeader(),
      'Accept': 'application/json',
      'User-Agent': GERRIT_UA,
    };
    if (this.cookies.XSRF_TOKEN) {
      headers['X-Gerrit-Auth'] = this.cookies.XSRF_TOKEN;
    }

    const response = await this.fetchWithRetry(url, {
      method: 'DELETE',
      headers,
    });

    return this.parseResponse<T>(response);
  }

  /**
   * Query changes with Gerrit search syntax.
   */
  async queryChanges(query: string, options?: string[], limit?: number, start?: number) {
    const url = new URL(`${this.baseUrl}/a/changes/`);
    url.searchParams.append('q', query);
    if (options) {
      options.forEach((o) => url.searchParams.append('o', o));
    }
    if (limit) url.searchParams.append('n', String(limit));
    if (start) url.searchParams.append('S', String(start));

    const response = await this.fetchWithRetry(url.toString(), {
      method: 'GET',
      headers: {
        'Cookie': this.cookieHeader(),
        'Accept': 'application/json',
        'User-Agent': GERRIT_UA,
      },
    });

    return this.parseResponse<any[]>(response);
  }
}

/**
 * Create a GerritClient from environment variables.
 * Uses CAS+SAML session cookies (auto-refreshed on 401).
 *
 * Required env:
 *   GERRIT_URL   — Gerrit base URL
 *   LOGIN_USER   — TP-Link CAS username
 *   LOGIN_PASS   — TP-Link CAS password
 */
export async function createGerritClient(): Promise<GerritClient> {
  const url = getRuntimeEnv('GERRIT_URL');
  if (!url) throw new Error('GERRIT_URL is not configured');

  const cookies = await ensureGerritSession();
  return new GerritClient(url, cookies);
}
