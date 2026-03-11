import * as fs from 'fs';
import * as path from 'path';
import type {
  ContactChangedRecord,
  ContactFieldChange,
  ContactRecord,
  ContactsDiff,
  ContactsSnapshot,
  ContactsTrendPoint,
} from '@/lib/contacts/types';
import { fetchContactsHtml } from '@/lib/contacts/client';
import { parseContactsHtml } from '@/lib/parsers/contacts-html';

const CACHE_DIR = process.env.PHABDASH_CONTACTS_CACHE_DIR?.trim()
  || path.join(process.cwd(), 'data', 'contacts-cache');
const MIN_EXPECTED_CONTACTS = 2500;

const inFlightFetches = new Map<string, Promise<ContactsSnapshot>>();

function ensureCacheDir(): void {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

export function formatLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isValidSnapshotDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function getSnapshotPath(snapshotDate: string): string {
  return path.join(CACHE_DIR, `${snapshotDate}.json`);
}

export function listContactsSnapshotDates(): string[] {
  try {
    ensureCacheDir();
    return fs.readdirSync(CACHE_DIR)
      .filter((file) => /^\d{4}-\d{2}-\d{2}\.json$/.test(file))
      .map((file) => file.replace(/\.json$/, ''))
      .sort((a, b) => b.localeCompare(a));
  } catch {
    return [];
  }
}

export function readContactsSnapshot(snapshotDate: string): ContactsSnapshot | null {
  if (!isValidSnapshotDate(snapshotDate)) {
    return null;
  }

  try {
    const filePath = getSnapshotPath(snapshotDate);
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as ContactsSnapshot;
    if (!parsed || !Array.isArray(parsed.contacts)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function writeContactsSnapshot(snapshot: ContactsSnapshot): void {
  try {
    ensureCacheDir();
    fs.writeFileSync(getSnapshotPath(snapshot.snapshotDate), JSON.stringify(snapshot, null, 2), 'utf-8');
  } catch (error) {
    console.error('[Contacts] Cache write error:', error);
  }
}

function normalizeStringArray(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function buildSnapshot(snapshotDate: string, contacts: ContactRecord[]): ContactsSnapshot {
  const uniqueDepartments = new Set(
    contacts
      .map((contact) => contact.department.trim())
      .filter(Boolean)
  );

  return {
    snapshotDate,
    fetchedAt: new Date().toISOString(),
    totalContacts: contacts.length,
    contacts,
    statistics: {
      totalPhones: contacts.reduce((sum, contact) => sum + contact.phones.length, 0),
      totalEmails: contacts.reduce((sum, contact) => sum + contact.emails.length, 0),
      totalLocations: contacts.reduce((sum, contact) => sum + contact.locations.length, 0),
      departments: uniqueDepartments.size,
    },
  };
}

async function fetchTodaySnapshot(snapshotDate: string): Promise<ContactsSnapshot> {
  const html = await fetchContactsHtml();
  const contacts = parseContactsHtml(html);

  if (contacts.length === 0) {
    throw new Error('No contacts parsed from portal response');
  }

  const snapshot = buildSnapshot(snapshotDate, contacts);
  writeContactsSnapshot(snapshot);
  return snapshot;
}

export async function ensureContactsSnapshot(
  snapshotDate: string,
  options: { forceRefresh?: boolean } = {},
): Promise<{ snapshot: ContactsSnapshot | null; source: 'cache' | 'remote' | 'empty' }> {
  if (!isValidSnapshotDate(snapshotDate)) {
    throw new Error('Invalid snapshot date');
  }

  const today = formatLocalDateKey(new Date());
  const cached = readContactsSnapshot(snapshotDate);
  const shouldRefreshTodayCache = snapshotDate === today
    && cached !== null
    && cached.totalContacts < MIN_EXPECTED_CONTACTS;

  if (cached && !options.forceRefresh && !shouldRefreshTodayCache) {
    return { snapshot: cached, source: 'cache' };
  }

  if (snapshotDate !== today) {
    return { snapshot: cached, source: cached ? 'cache' : 'empty' };
  }

  const existingFetch = inFlightFetches.get(snapshotDate);
  if (existingFetch) {
    const snapshot = await existingFetch;
    return { snapshot, source: options.forceRefresh ? 'remote' : cached ? 'cache' : 'remote' };
  }

  const fetchPromise = fetchTodaySnapshot(snapshotDate)
    .finally(() => {
      inFlightFetches.delete(snapshotDate);
    });

  inFlightFetches.set(snapshotDate, fetchPromise);
  const snapshot = await fetchPromise;
  return { snapshot, source: 'remote' };
}

function diffField(
  field: ContactFieldChange['field'],
  before: string | string[],
  after: string | string[],
): ContactFieldChange | null {
  const beforeValue = Array.isArray(before) ? normalizeStringArray(before) : before.trim();
  const afterValue = Array.isArray(after) ? normalizeStringArray(after) : after.trim();

  if (JSON.stringify(beforeValue) === JSON.stringify(afterValue)) {
    return null;
  }

  return {
    field,
    before: beforeValue,
    after: afterValue,
  };
}

function buildChangedRecord(before: ContactRecord, after: ContactRecord): ContactChangedRecord | null {
  const fieldsChanged = [
    diffField('name', before.name, after.name),
    diffField('department', before.department, after.department),
    diffField('phones', before.phones, after.phones),
    diffField('locations', before.locations, after.locations),
    diffField('emails', before.emails, after.emails),
  ].filter(Boolean) as ContactFieldChange[];

  if (fieldsChanged.length === 0) {
    return null;
  }

  return {
    key: after.key,
    before,
    after,
    fieldsChanged,
  };
}

export async function compareContactsSnapshots(fromDate: string, toDate: string): Promise<ContactsDiff> {
  const [fromResult, toResult] = await Promise.all([
    ensureContactsSnapshot(fromDate),
    ensureContactsSnapshot(toDate),
  ]);

  const fromSnapshot = fromResult.snapshot;
  const toSnapshot = toResult.snapshot;

  if (!fromSnapshot) {
    throw new Error(`Snapshot not found for ${fromDate}`);
  }
  if (!toSnapshot) {
    throw new Error(`Snapshot not found for ${toDate}`);
  }

  const beforeMap = new Map(fromSnapshot.contacts.map((contact) => [contact.key, contact]));
  const afterMap = new Map(toSnapshot.contacts.map((contact) => [contact.key, contact]));

  const added: ContactRecord[] = [];
  const removed: ContactRecord[] = [];
  const changed: ContactChangedRecord[] = [];
  let unchanged = 0;

  for (const [key, before] of beforeMap.entries()) {
    const after = afterMap.get(key);
    if (!after) {
      removed.push(before);
      continue;
    }

    const changedRecord = buildChangedRecord(before, after);
    if (changedRecord) {
      changed.push(changedRecord);
    } else {
      unchanged += 1;
    }
  }

  for (const [key, after] of afterMap.entries()) {
    if (!beforeMap.has(key)) {
      added.push(after);
    }
  }

  return {
    fromDate,
    toDate,
    summary: {
      totalBefore: fromSnapshot.totalContacts,
      totalAfter: toSnapshot.totalContacts,
      added: added.length,
      removed: removed.length,
      changed: changed.length,
      unchanged,
    },
    added: added.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN')),
    removed: removed.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN')),
    changed: changed.sort((a, b) => a.after.name.localeCompare(b.after.name, 'zh-CN')),
  };
}

export function getContactsTrendPoints(limit = 30): ContactsTrendPoint[] {
  const dates = listContactsSnapshotDates()
    .sort((a, b) => a.localeCompare(b))
    .slice(-limit);

  const snapshots = dates
    .map((date) => readContactsSnapshot(date))
    .filter(Boolean) as ContactsSnapshot[];

  const points: ContactsTrendPoint[] = [];

  for (let index = 0; index < snapshots.length; index += 1) {
    const current = snapshots[index];
    const previous = index > 0 ? snapshots[index - 1] : null;

    if (!previous) {
      points.push({
        date: current.snapshotDate,
        added: 0,
        removed: 0,
        totalContacts: current.totalContacts,
      });
      continue;
    }

    const previousKeys = new Set(previous.contacts.map((contact) => contact.key));
    const currentKeys = new Set(current.contacts.map((contact) => contact.key));

    let added = 0;
    let removed = 0;

    for (const key of currentKeys) {
      if (!previousKeys.has(key)) {
        added += 1;
      }
    }

    for (const key of previousKeys) {
      if (!currentKeys.has(key)) {
        removed += 1;
      }
    }

    points.push({
      date: current.snapshotDate,
      added,
      removed,
      totalContacts: current.totalContacts,
    });
  }

  return points;
}
