import * as fs from 'fs';
import * as path from 'path';

type StoredEntry = {
  value: unknown;
  updatedAt: string;
};

type StateFile = {
  version: 1;
  updatedAt: string;
  entries: Record<string, StoredEntry>;
};

type DailyFile = {
  date: string;
  updatedAt: string;
  entries: Record<string, StoredEntry>;
};

const ROOT_DIR = path.join(process.cwd(), 'data', 'local-state');
const STATE_PATH = path.join(ROOT_DIR, 'state.json');
const DAILY_DIR = path.join(ROOT_DIR, 'daily');

function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function readJsonFile<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
  } catch {
    return null;
  }
}

function writeJsonFile(filePath: string, value: unknown): void {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf-8');
}

function todayDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function readState(): StateFile {
  ensureDir(ROOT_DIR);
  const file = readJsonFile<StateFile>(STATE_PATH);
  if (!file || typeof file !== 'object' || typeof file.entries !== 'object' || !file.entries) {
    return {
      version: 1,
      updatedAt: new Date().toISOString(),
      entries: {},
    };
  }
  return file;
}

function writeState(next: StateFile): void {
  ensureDir(ROOT_DIR);
  writeJsonFile(STATE_PATH, next);
}

function writeDailySnapshot(key: string, entry: StoredEntry): void {
  ensureDir(DAILY_DIR);
  const date = todayDateKey();
  const filePath = path.join(DAILY_DIR, `${date}.json`);
  const current = readJsonFile<DailyFile>(filePath);
  const next: DailyFile = current && typeof current === 'object' && current.entries
    ? {
        ...current,
        date,
        updatedAt: new Date().toISOString(),
        entries: {
          ...current.entries,
          [key]: entry,
        },
      }
    : {
        date,
        updatedAt: new Date().toISOString(),
        entries: {
          [key]: entry,
        },
      };
  writeJsonFile(filePath, next);
}

export function getLocalState<T>(key: string): T | undefined {
  const state = readState();
  const entry = state.entries[key];
  return (entry?.value as T) ?? undefined;
}

export function setLocalState<T>(key: string, value: T): void {
  const now = new Date().toISOString();
  const state = readState();
  const entry: StoredEntry = {
    value,
    updatedAt: now,
  };
  state.entries[key] = entry;
  state.updatedAt = now;
  writeState(state);
  writeDailySnapshot(key, entry);
}
