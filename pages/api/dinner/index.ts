import type { NextApiRequest, NextApiResponse } from 'next';
import * as fs from 'fs';
import * as path from 'path';
import {
  DINNER_BASE_URL,
  makeHeaders,
  getActiveSession,
  refreshAndEstablish,
  fetchJson,
} from '@/lib/dinner/client';
import type { ParsedDinnerData, DinnerUserData } from '@/lib/dinner/types';

const CACHE_DIR = path.join(process.cwd(), 'data', 'dinner-cache');
const LEGACY_CACHE_DIRS = Array.from(new Set([
  process.env.PHABDASH_DINNER_CACHE_DIR?.trim(),
  process.env.PHABDASH_DINNER_LEGACY_CACHE_DIR?.trim(),
].filter((dir): dir is string => !!dir && dir !== CACHE_DIR)));
let hasMigratedLegacyCache = false;

// --- Cache ---

function getDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getMonthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function getMonthCacheDir(year: number, month: number): string {
  return path.join(CACHE_DIR, getMonthKey(year, month));
}

function getCachePath(year: number, month: number, dateKey = getDateKey()): string {
  return path.join(getMonthCacheDir(year, month), `${dateKey}.json`);
}

function migrateLegacyDinnerCache(): void {
  if (hasMigratedLegacyCache) return;
  hasMigratedLegacyCache = true;

  try {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
  } catch {
    return;
  }

  const sourceDirs = [CACHE_DIR, ...LEGACY_CACHE_DIRS];
  for (const legacyDir of sourceDirs) {
    try {
      if (!fs.existsSync(legacyDir)) continue;
      const files = fs.readdirSync(legacyDir).filter((file) => /^\d{4}-\d{2}\.json$/.test(file));
      for (const file of files) {
        const fullPath = path.join(legacyDir, file);
        const [yearText, monthText] = file.replace(/\.json$/, '').split('-');
        const year = Number(yearText);
        const month = Number(monthText);
        if (!Number.isFinite(year) || !Number.isFinite(month)) continue;

        const stat = fs.statSync(fullPath);
        const dateKey = getDateKey(stat.mtime);
        const destination = getCachePath(year, month, dateKey);
        const destinationDir = path.dirname(destination);
        if (!fs.existsSync(destinationDir)) {
          fs.mkdirSync(destinationDir, { recursive: true });
        }
        if (!fs.existsSync(destination)) {
          fs.copyFileSync(fullPath, destination);
        }

        // Remove legacy flat file when it already lives inside CACHE_DIR.
        if (legacyDir === CACHE_DIR) {
          try {
            fs.rmSync(fullPath, { force: true });
          } catch {
            // ignore cleanup failure
          }
        }
      }
    } catch {
      // ignore migration failures
    }
  }
}

function readCache(year: number, month: number): ParsedDinnerData | null {
  migrateLegacyDinnerCache();
  try {
    const dir = getMonthCacheDir(year, month);
    if (!fs.existsSync(dir)) return null;
    const files = fs.readdirSync(dir)
      .filter((file) => /^\d{4}-\d{2}-\d{2}\.json$/.test(file))
      .sort((a, b) => b.localeCompare(a));
    const latest = files[0];
    if (!latest) return null;
    return JSON.parse(fs.readFileSync(path.join(dir, latest), 'utf-8'));
  } catch { /* ignore */ }
  return null;
}

function writeCache(year: number, month: number, data: ParsedDinnerData): void {
  migrateLegacyDinnerCache();
  try {
    const monthDir = getMonthCacheDir(year, month);
    if (!fs.existsSync(monthDir)) {
      fs.mkdirSync(monthDir, { recursive: true });
    }
    fs.writeFileSync(getCachePath(year, month), JSON.stringify(data));
  } catch (e: any) {
    console.error('[Dinner] Cache write error:', e.message);
  }
}

function isValidData(data: ParsedDinnerData): boolean {
  return data.allUsers.length > 0 && data.totalUsers > 0;
}

// --- Data processing ---

function processRecordsData(
  recordsData: any,
  year: number,
  month: number,
  currentUserName?: string,
): ParsedDinnerData {
  const users = recordsData.users || [];
  const userRecords = recordsData.user_records || {};
  const daysInMonth = new Date(year, month, 0).getDate();

  const allUsers: DinnerUserData[] = users.map((u: any, idx: number) => {
    const userId = String(u.userId || u.user_id);
    const records: any[] = userRecords[userId] || [];

    const dailyRecords: (number | null)[] = new Array(daysInMonth).fill(null);
    let monthTotal = 0;
    for (const r of records) {
      const times = parseInt(r.times) || 0;
      monthTotal += times;
      const day = parseInt(r.record_date?.split('-')[2]) || 0;
      if (day >= 1 && day <= daysInMonth) {
        dailyRecords[day - 1] = (dailyRecords[day - 1] || 0) + times;
      }
    }

    return {
      index: idx + 1,
      employeeNo: u.employeeNumber || u.employee_number || '',
      name: u.userName || u.user_name || '',
      department: '',
      dailyRecords,
      monthTotal,
    };
  });

  const sorted = [...allUsers].sort((a, b) => b.monthTotal - a.monthTotal);
  const rankMap = new Map<string, number>();
  sorted.forEach((u, i) => rankMap.set(u.employeeNo, i + 1));

  const currentUser = currentUserName
    ? allUsers.find(u => u.name === currentUserName) || null
    : null;
  const currentUserRank = currentUser ? (rankMap.get(currentUser.employeeNo) || null) : null;

  const totals = allUsers.map(u => u.monthTotal);
  const grandTotal = totals.reduce((a, b) => a + b, 0);
  const sortedTotals = [...totals].sort((a, b) => a - b);
  const mid = Math.floor(sortedTotals.length / 2);

  return {
    currentUser,
    allUsers,
    totalUsers: allUsers.length,
    currentUserRank,
    daysInMonth,
    year: year.toString(),
    month: month.toString(),
    statistics: {
      maxTotal: totals.length > 0 ? Math.max(...totals) : 0,
      minTotal: totals.length > 0 ? Math.min(...totals) : 0,
      avgTotal: totals.length > 0 ? grandTotal / totals.length : 0,
      medianTotal: sortedTotals.length % 2 !== 0
        ? sortedTotals[mid]
        : sortedTotals.length > 0 ? (sortedTotals[mid - 1] + sortedTotals[mid]) / 2 : 0,
      grandTotal,
    },
  };
}

// --- Helpers ---

/** Re-resolve currentUser + rank for a given user name against cached/fetched data (mutates). */
function resolveCurrentUser(data: ParsedDinnerData, userName?: string): void {
  if (!userName) return;
  data.currentUser = data.allUsers.find(u => u.name === userName) || null;
  if (data.currentUser) {
    const sorted = [...data.allUsers].sort((a, b) => b.monthTotal - a.monthTotal);
    data.currentUserRank = sorted.findIndex(u => u.employeeNo === data.currentUser!.employeeNo) + 1;
  }
}

const EMPTY_RESPONSE = (year: number, month: number): ParsedDinnerData => ({
  currentUser: null, allUsers: [], totalUsers: 0, currentUserRank: null,
  daysInMonth: 0, year: String(year), month: String(month),
  statistics: { maxTotal: 0, minTotal: 0, avgTotal: 0, medianTotal: 0, grandTotal: 0 },
});

// --- Handler ---

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const now = new Date();
  const currentUserName = req.query.userName as string | undefined;
  const qYear = req.query.year ? parseInt(req.query.year as string) : now.getFullYear();
  const qMonth = req.query.month ? parseInt(req.query.month as string) : now.getMonth() + 1;
  const cacheOnly = req.query.cacheOnly === 'true';

  try {
    // If cacheOnly, just return cached data (for month switching)
    if (cacheOnly) {
      const cached = readCache(qYear, qMonth);
      if (cached) {
        resolveCurrentUser(cached, currentUserName);
        return res.status(200).json(cached);
      }
    }

    // Determine if this month is accessible remotely (current month or last month)
    const isCurrentMonth = qYear === now.getFullYear() && qMonth === now.getMonth() + 1;
    const lastMonth = now.getMonth() === 0 ? 12 : now.getMonth();
    const lastMonthYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const isLastMonth = qYear === lastMonthYear && qMonth === lastMonth;
    const isRemoteAccessible = isCurrentMonth || isLastMonth;

    // For months older than last month, only use cache (no remote access)
    if (!isRemoteAccessible) {
      const cached = readCache(qYear, qMonth);
      if (cached) {
        resolveCurrentUser(cached, currentUserName);
        return res.status(200).json(cached);
      }
      return res.status(200).json(EMPTY_RESPONSE(qYear, qMonth));
    }

    // Fetch from remote with automatic session retry
    let session = await getActiveSession();

    let userData: any;
    try {
      userData = await fetchJson<any>(`${DINNER_BASE_URL}/get_user_data`, {
        method: 'GET', headers: makeHeaders(session),
      });
    } catch {
      session = await refreshAndEstablish(session);
      userData = await fetchJson<any>(`${DINNER_BASE_URL}/get_user_data`, {
        method: 'GET', headers: makeHeaders(session),
      });
    }

    const loginUser = userData?.result || {};
    const matchName = currentUserName || loginUser.userName;

    const queryData = {
      year: qYear,
      month: qMonth,
      primaryDeptId: loginUser.primaryDept?.deptId || null,
      childDeptId: loginUser.department?.deptId || null,
      sortColumn: null,
      sortReverse: false,
    };

    const formData = new URLSearchParams();
    formData.append('filter', JSON.stringify(queryData));

    const recordsData = await fetchJson<any>(`${DINNER_BASE_URL}/find_by_page`, {
      method: 'POST',
      headers: { ...makeHeaders(session), 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      body: formData.toString(),
    });

    const result = processRecordsData(recordsData, qYear, qMonth, matchName);

    if (isValidData(result)) {
      writeCache(qYear, qMonth, result);
    }

    res.status(200).json(result);
  } catch (error: any) {
    const cached = readCache(qYear, qMonth);
    if (cached) {
      console.log('[Dinner] Fetch failed, returning cache:', error.message);
      return res.status(200).json(cached);
    }
    console.error('[Dinner] Error:', error.message);
    res.status(500).json({ error: error.message || 'Failed to fetch dinner data' });
  }
}
