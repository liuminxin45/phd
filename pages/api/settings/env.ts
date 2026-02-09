import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

const PROJECT_ROOT = process.cwd();

interface EnvEntry {
  key: string;
  value: string;
  comment?: string;
}

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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const envPath = path.join(PROJECT_ROOT, '.env');
      const envLocalPath = path.join(PROJECT_ROOT, '.env.local');

      const env = parseEnvFile(envPath);
      const envLocal = parseEnvFile(envLocalPath);

      return res.status(200).json({
        env: env.entries,
        envLocal: envLocal.entries,
      });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Failed to read env files' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { file, entries } = req.body as { file: 'env' | 'envLocal'; entries: EnvEntry[] };

      if (!file || !entries) {
        return res.status(400).json({ error: 'file and entries are required' });
      }

      const fileName = file === 'env' ? '.env' : '.env.local';
      const filePath = path.join(PROJECT_ROOT, fileName);

      const content = serializeEnvEntries(entries);
      fs.writeFileSync(filePath, content, 'utf-8');

      return res.status(200).json({ success: true });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Failed to write env file' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
