import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import type { EnvEntry } from '@/lib/settings/types';
import { refreshPhabricatorSession } from '@/lib/auto-refresh-session';
import { refreshDinnerSession } from '@/lib/dinner-session';
import { refreshGerritSession } from '@/lib/gerrit/session';
import { ConduitClient } from '@/lib/conduit/client';
import { reloadProcessEnvFromEnvLocal } from '@/lib/settings/runtime-env';

const PROJECT_ROOT = process.cwd();

const ENV_LOCAL_PATH = path.join(PROJECT_ROOT, '.env.local');

const DEFAULT_ENV_ENTRIES: EnvEntry[] = [
  { key: 'PHA_HOST', value: 'http://pha.tp-link.com.cn/' },
  { key: 'GERRIT_URL', value: 'https://review.tp-link.net/gerrit' },
  { key: 'PHA_TOKEN', value: '' },
  { key: 'LOGIN_USER', value: '' },
  { key: 'LOGIN_PASS', value: '' },
  { key: 'PHA_USER', value: '' },
  { key: 'PHA_SESSION', value: '' },
  { key: 'DINNER_SESSION', value: '' },
  { key: 'GERRIT_SESSION', value: '' },
  { key: 'BLOG_PHID_MAP', value: '{}' },
];

const REQUIRED_SETUP_KEYS = ['PHA_TOKEN', 'LOGIN_USER', 'LOGIN_PASS'];

function parseEnvFile(filePath: string): { entries: EnvEntry[]; raw: string } {
  if (!fs.existsSync(filePath)) {
    return { entries: [], raw: '' };
  }
  const raw = fs.readFileSync(filePath, 'utf-8');
  const entries: EnvEntry[] = [];
  let pendingComment = '';

  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#')) {
      pendingComment += (pendingComment ? '\n' : '') + trimmed;
      continue;
    }
    if (trimmed === '') {
      pendingComment = '';
      continue;
    }
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      const value = trimmed.slice(eqIdx + 1).trim();
      entries.push({ key, value, comment: pendingComment || undefined });
      pendingComment = '';
    }
  }
  return { entries, raw };
}

function serializeEnvEntries(entries: EnvEntry[]): string {
  const lines: string[] = [];
  for (const entry of entries) {
    if (entry.comment) {
      lines.push(entry.comment);
    }
    lines.push(`${entry.key}=${entry.value}`);
  }
  return lines.join('\n') + '\n';
}

function getEntryValue(entries: EnvEntry[], key: string): string {
  return entries.find((e) => e.key === key)?.value || '';
}

function setEntryValue(entries: EnvEntry[], key: string, value: string): EnvEntry[] {
  const idx = entries.findIndex((e) => e.key === key);
  if (idx >= 0) {
    const next = [...entries];
    next[idx] = { ...next[idx], value };
    return next;
  }
  return [...entries, { key, value }];
}

function mergeByKey(base: EnvEntry[], incoming: EnvEntry[]): EnvEntry[] {
  const map = new Map<string, EnvEntry>();
  for (const e of base) {
    map.set(e.key, { ...e });
  }
  for (const e of incoming) {
    map.set(e.key, { ...e });
  }
  return Array.from(map.values());
}

function ensureDefaultEntries(entries: EnvEntry[]): EnvEntry[] {
  const map = new Map(entries.map((e) => [e.key, e]));
  const defaults = DEFAULT_ENV_ENTRIES.map((def) => {
    const existing = map.get(def.key);
    return existing ? { ...existing, key: def.key } : { ...def };
  });
  const defaultKeys = new Set(DEFAULT_ENV_ENTRIES.map((e) => e.key));
  const extras = entries.filter((e) => !defaultKeys.has(e.key));
  return [...defaults, ...extras];
}

function derivePhaUser(loginUser: string): string {
  const trimmed = loginUser.trim();
  if (!trimmed) return '';
  const suffix = '@tp-link.com.cn';
  if (trimmed.toLowerCase().endsWith(suffix)) {
    return trimmed.slice(0, -suffix.length);
  }
  return trimmed.split('@')[0] || '';
}

function normalizeHost(host: string): string {
  return host.trim().replace(/\/+$/, '');
}

function applyEntriesToProcessEnv(entries: EnvEntry[]): void {
  for (const entry of entries) {
    process.env[entry.key] = entry.value;
  }
}

function parseBlogMap(raw: string | undefined): Record<string, string> {
  if (!raw || !raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const normalized = Object.entries(parsed as Record<string, unknown>)
      .map(([key, value]) => [key.trim().toLowerCase(), typeof value === 'string' ? value.trim() : ''] as const)
      .filter(([key, value]) => key && value);
    return Object.fromEntries(normalized);
  } catch {
    return {};
  }
}

function isBlogMapEmpty(raw: string): boolean {
  const parsed = parseBlogMap(raw);
  return Object.keys(parsed).length === 0;
}

interface BlogLite {
  id: number;
  phid: string;
  name: string;
}

function selectUniqueBlog(blogs: BlogLite[], realName: string): BlogLite | null {
  if (blogs.length === 1) return blogs[0];
  const exact = realName
    ? blogs.filter((b) => b.name === `${realName}的博客` || b.name === `${realName}博客` || b.name === realName)
    : [];
  if (exact.length === 1) return exact[0];
  const fuzzy = realName ? blogs.filter((b) => b.name.includes(realName)) : [];
  if (fuzzy.length === 1) return fuzzy[0];
  return null;
}

async function tryBuildBlogMap(existingRaw: string): Promise<string | null> {
  const host = normalizeHost(process.env.PHA_HOST || '');
  const token = (process.env.PHA_TOKEN || '').trim();
  if (!host || !token) return null;

  const client = new ConduitClient(host, token);
  const whoami = await client.call<any>('user.whoami', {});
  const userPHID = (whoami?.phid || '').trim();
  const userName = (whoami?.userName || whoami?.username || '').trim();
  const realName = (whoami?.realName || '').trim();
  if (!userPHID) return null;

  const candidateKeys = [userName, realName, userPHID]
    .map((v) => (v || '').trim().toLowerCase())
    .filter(Boolean);

  let candidateBlogs: BlogLite[] = [];
  const bySubscriber = await client.call<{ data?: Array<{ id?: number; phid?: string; fields?: { name?: string } }> }>('phame.blog.search', {
    queryKey: 'all',
    constraints: { subscribers: [userPHID] },
    order: 'newest',
    limit: 100,
  });
  candidateBlogs = (bySubscriber?.data || []).map((b) => ({
    id: b.id || 0,
    phid: b.phid || '',
    name: b.fields?.name || '',
  })).filter((b) => b.phid);

  if (candidateBlogs.length === 0) {
    const ownPosts = await client.call<{ data?: Array<{ fields?: { blogPHID?: string } }> }>('phame.post.search', {
      queryKey: 'all',
      constraints: { authorPHIDs: [userPHID] },
      order: 'newest',
      limit: 30,
    });
    const uniqueBlogPHIDs = Array.from(new Set((ownPosts?.data || []).map((p) => p.fields?.blogPHID || '').filter(Boolean)));
    if (uniqueBlogPHIDs.length > 0) {
      const fallbackBlogs = await client.call<{ data?: Array<{ id?: number; phid?: string; fields?: { name?: string } }> }>('phame.blog.search', {
        queryKey: 'all',
        constraints: { phids: uniqueBlogPHIDs },
        order: 'newest',
        limit: uniqueBlogPHIDs.length,
      });
      candidateBlogs = (fallbackBlogs?.data || []).map((b) => ({
        id: b.id || 0,
        phid: b.phid || '',
        name: b.fields?.name || '',
      })).filter((b) => b.phid);
    }
  }

  const selected = selectUniqueBlog(candidateBlogs, realName);
  if (!selected) return null;

  const existing = parseBlogMap(existingRaw);
  const nextMap: Record<string, string> = { ...existing };
  for (const key of candidateKeys) {
    nextMap[key] = selected.phid;
  }
  return JSON.stringify(nextMap);
}

async function enrichComputedEntries(entries: EnvEntry[]): Promise<{ entries: EnvEntry[]; warnings: string[] }> {
  const warnings: string[] = [];
  let next = ensureDefaultEntries(entries);

  const host = normalizeHost(getEntryValue(next, 'PHA_HOST') || 'http://pha.tp-link.com.cn/');
  const gerritUrl = normalizeHost(getEntryValue(next, 'GERRIT_URL') || 'https://review.tp-link.net/gerrit');
  const loginUser = getEntryValue(next, 'LOGIN_USER').trim();
  const loginPass = getEntryValue(next, 'LOGIN_PASS').trim();

  next = setEntryValue(next, 'PHA_HOST', host);
  next = setEntryValue(next, 'GERRIT_URL', gerritUrl);

  const derivedPhaUser = derivePhaUser(loginUser);
  if (derivedPhaUser) {
    next = setEntryValue(next, 'PHA_USER', derivedPhaUser);
  }

  applyEntriesToProcessEnv(next);

  const hasLoginCreds = Boolean(loginUser && loginPass);
  const hasPhaHost = Boolean(host);
  const hasGerrit = Boolean(gerritUrl);

  if (!getEntryValue(next, 'PHA_SESSION').trim() && hasLoginCreds && hasPhaHost) {
    try {
      const refreshed = await refreshPhabricatorSession();
      next = setEntryValue(next, 'PHA_USER', refreshed.phusr || derivedPhaUser || '');
      next = setEntryValue(next, 'PHA_SESSION', refreshed.phsid || '');
      applyEntriesToProcessEnv(next);
    } catch (error: any) {
      warnings.push(`PHA_SESSION 自动刷新失败: ${error?.message || 'unknown error'}`);
    }
  }

  if (!getEntryValue(next, 'DINNER_SESSION').trim() && hasLoginCreds) {
    try {
      const refreshed = await refreshDinnerSession();
      const session = refreshed.session_id_dinner || '';
      if (session) {
        next = setEntryValue(next, 'DINNER_SESSION', session);
        applyEntriesToProcessEnv(next);
      }
    } catch (error: any) {
      warnings.push(`DINNER_SESSION 自动刷新失败: ${error?.message || 'unknown error'}`);
    }
  }

  if (!getEntryValue(next, 'GERRIT_SESSION').trim() && hasLoginCreds && hasGerrit) {
    try {
      const refreshed = await refreshGerritSession();
      const sessionValue = [refreshed.JSESSIONID || '', refreshed.GerritAccount || '', refreshed.XSRF_TOKEN || ''].join('|');
      if (sessionValue.replace(/\|/g, '').trim()) {
        next = setEntryValue(next, 'GERRIT_SESSION', sessionValue);
        applyEntriesToProcessEnv(next);
      }
    } catch (error: any) {
      warnings.push(`GERRIT_SESSION 自动刷新失败: ${error?.message || 'unknown error'}`);
    }
  }

  const blogMapRaw = getEntryValue(next, 'BLOG_PHID_MAP');
  if (isBlogMapEmpty(blogMapRaw)) {
    try {
      const mapped = await tryBuildBlogMap(blogMapRaw);
      if (mapped) {
        next = setEntryValue(next, 'BLOG_PHID_MAP', mapped);
        applyEntriesToProcessEnv(next);
      }
    } catch (error: any) {
      warnings.push(`BLOG_PHID_MAP 自动生成失败: ${error?.message || 'unknown error'}`);
    }
  }

  return { entries: ensureDefaultEntries(next), warnings };
}

function ensureEnvLocalExists(): { created: boolean; entries: EnvEntry[] } {
  if (fs.existsSync(ENV_LOCAL_PATH)) {
    const { entries } = parseEnvFile(ENV_LOCAL_PATH);
    return { created: false, entries };
  }

  const content = serializeEnvEntries(DEFAULT_ENV_ENTRIES);
  fs.writeFileSync(ENV_LOCAL_PATH, content, 'utf-8');
  return { created: true, entries: DEFAULT_ENV_ENTRIES };
}

function detectNeedsSetup(entries: EnvEntry[]): boolean {
  const map = new Map(entries.map((e) => [e.key, e.value]));
  return REQUIRED_SETUP_KEYS.some((key) => !(map.get(key) || '').trim());
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      reloadProcessEnvFromEnvLocal();
      const { created, entries } = ensureEnvLocalExists();
      const before = serializeEnvEntries(ensureDefaultEntries(entries));
      const enriched = await enrichComputedEntries(entries);
      const after = serializeEnvEntries(enriched.entries);
      if (before !== after) {
        fs.writeFileSync(ENV_LOCAL_PATH, after, 'utf-8');
      }
      return res.status(200).json({
        entries: enriched.entries,
        envLocalCreated: created,
        needsSetup: detectNeedsSetup(enriched.entries),
        warnings: enriched.warnings,
      });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Failed to read env file' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { entries } = req.body ?? {};

      if (!Array.isArray(entries) || entries.some((e: any) => typeof e.key !== 'string' || typeof e.value !== 'string')) {
        return res.status(400).json({ error: 'entries must be an array of { key: string, value: string }' });
      }

      const { entries: currentEntries } = ensureEnvLocalExists();
      const merged = mergeByKey(currentEntries, entries);
      const enriched = await enrichComputedEntries(merged);
      const content = serializeEnvEntries(enriched.entries);
      fs.writeFileSync(ENV_LOCAL_PATH, content, 'utf-8');
      // Soft backend refresh: reload process env from latest .env.local for subsequent requests.
      reloadProcessEnvFromEnvLocal();

      return res.status(200).json({
        success: true,
        needsSetup: detectNeedsSetup(enriched.entries),
        warnings: enriched.warnings,
        entries: enriched.entries,
      });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Failed to write env file' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
