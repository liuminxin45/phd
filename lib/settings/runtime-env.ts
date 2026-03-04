import fs from 'fs';
import path from 'path';

const ENV_LOCAL_PATH = path.join(process.cwd(), '.env.local');

let cacheMtimeMs = -1;
let cacheMap: Record<string, string> = {};

function parseEnvLocal(content: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIdx = line.indexOf('=');
    if (eqIdx <= 0) continue;
    const key = line.slice(0, eqIdx).trim();
    const value = line.slice(eqIdx + 1).trim();
    out[key] = value;
  }
  return out;
}

function ensureCacheFresh(): void {
  try {
    if (!fs.existsSync(ENV_LOCAL_PATH)) {
      cacheMtimeMs = -1;
      cacheMap = {};
      return;
    }
    const stat = fs.statSync(ENV_LOCAL_PATH);
    if (stat.mtimeMs === cacheMtimeMs) return;
    cacheMtimeMs = stat.mtimeMs;
    cacheMap = parseEnvLocal(fs.readFileSync(ENV_LOCAL_PATH, 'utf-8'));
  } catch {
    cacheMap = {};
    cacheMtimeMs = -1;
  }
}

export function reloadProcessEnvFromEnvLocal(): void {
  ensureCacheFresh();
  for (const [key, value] of Object.entries(cacheMap)) {
    process.env[key] = value;
  }
}

export function getRuntimeEnv(key: string): string {
  const direct = process.env[key];
  if (typeof direct === 'string' && direct.trim()) return direct.trim();
  ensureCacheFresh();
  const fromFile = cacheMap[key];
  if (typeof fromFile === 'string' && fromFile.trim()) {
    process.env[key] = fromFile.trim();
    return fromFile.trim();
  }
  return '';
}

