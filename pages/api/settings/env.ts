import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import type { EnvEntry } from '@/lib/settings/types';

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
      const { created, entries } = ensureEnvLocalExists();
      return res.status(200).json({
        entries,
        envLocalCreated: created,
        needsSetup: detectNeedsSetup(entries),
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

      const content = serializeEnvEntries(entries);
      fs.writeFileSync(ENV_LOCAL_PATH, content, 'utf-8');

      return res.status(200).json({ success: true, needsSetup: detectNeedsSetup(entries) });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Failed to write env file' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
