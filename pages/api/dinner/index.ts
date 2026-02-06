import type { NextApiRequest, NextApiResponse } from 'next';
import * as fs from 'fs';
import * as path from 'path';
import { refreshDinnerSession } from '@/lib/dinner-session';
import type { ParsedDinnerData, DinnerUserData } from '@/lib/parsers/dinner-html';

const BASE_URL = 'http://selfservice.tp-link.com.cn:8081/dinner/default';
const CACHE_DIR = path.join(process.cwd(), 'data', 'dinner-cache');

// --- Helpers ---

function makeHeaders(session: string) {
  return {
    'Accept': 'application/json, text/javascript, */*; q=0.01',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Cookie': `session_id_dinner="${session}"`,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
    'X-Requested-With': 'XMLHttpRequest',
  };
}

async function ensureSession(): Promise<string> {
  let session = process.env.DINNER_SESSION;
  if (!session) {
    const cookies = await refreshDinnerSession();
    session = cookies.session_id_dinner;
  }
  if (!session) throw new Error('No dinner session available');
  return session;
}

async function establishSession(session: string): Promise<string> {
  const resp = await fetch(`${BASE_URL}/index`, {
    method: 'GET',
    headers: { 'Accept': 'text/html', 'Cookie': `session_id_dinner="${session}"`, 'User-Agent': 'Mozilla/5.0' },
  });
  const setCookie = resp.headers.getSetCookie?.() || [];
  for (const h of setCookie) {
    const m = h.match(/session_id_dinner="?([^";]+)"?/);
    if (m) session = m[1];
  }
  return session;
}

async function fetchJson<T>(url: string, options: RequestInit): Promise<T> {
  const resp = await fetch(url, options);
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`${resp.status} ${resp.statusText}: ${text.substring(0, 200)}`);
  }
  return await resp.json() as T;
}

// --- Cache ---

function getCachePath(year: number, month: number): string {
  return path.join(CACHE_DIR, `${year}-${String(month).padStart(2, '0')}.json`);
}

function readCache(year: number, month: number): ParsedDinnerData | null {
  try {
    const p = getCachePath(year, month);
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf-8'));
    }
  } catch { /* ignore */ }
  return null;
}

function writeCache(year: number, month: number, data: ParsedDinnerData): void {
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
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

// --- Handler ---

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const currentUserName = req.query.userName as string | undefined;
    const now = new Date();
    const qYear = req.query.year ? parseInt(req.query.year as string) : now.getFullYear();
    const qMonth = req.query.month ? parseInt(req.query.month as string) : now.getMonth() + 1;
    const cacheOnly = req.query.cacheOnly === 'true';

    // If cacheOnly, just return cached data (for month switching)
    if (cacheOnly) {
      const cached = readCache(qYear, qMonth);
      if (cached) {
        // Re-resolve currentUser for the requesting user
        if (currentUserName) {
          cached.currentUser = cached.allUsers.find(u => u.name === currentUserName) || null;
          if (cached.currentUser) {
            const sorted = [...cached.allUsers].sort((a, b) => b.monthTotal - a.monthTotal);
            cached.currentUserRank = sorted.findIndex(u => u.employeeNo === cached.currentUser!.employeeNo) + 1;
          }
        }
        return res.status(200).json(cached);
      }
      // No cache, fall through to fetch
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
        if (currentUserName) {
          cached.currentUser = cached.allUsers.find(u => u.name === currentUserName) || null;
          if (cached.currentUser) {
            const sorted = [...cached.allUsers].sort((a, b) => b.monthTotal - a.monthTotal);
            cached.currentUserRank = sorted.findIndex(u => u.employeeNo === cached.currentUser!.employeeNo) + 1;
          }
        }
        return res.status(200).json(cached);
      }
      // No cache and no remote access
      return res.status(200).json({
        currentUser: null, allUsers: [], totalUsers: 0, currentUserRank: null,
        daysInMonth: 0, year: String(qYear), month: String(qMonth),
        statistics: { maxTotal: 0, minTotal: 0, avgTotal: 0, medianTotal: 0, grandTotal: 0 },
      });
    }

    // Fetch from remote
    let session = await ensureSession();
    session = await establishSession(session);

    let userData: any;
    try {
      userData = await fetchJson<any>(`${BASE_URL}/get_user_data`, {
        method: 'GET', headers: makeHeaders(session),
      });
    } catch {
      const cookies = await refreshDinnerSession();
      session = cookies.session_id_dinner || session;
      session = await establishSession(session);
      userData = await fetchJson<any>(`${BASE_URL}/get_user_data`, {
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

    const recordsData = await fetchJson<any>(`${BASE_URL}/find_by_page`, {
      method: 'POST',
      headers: { ...makeHeaders(session), 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      body: formData.toString(),
    });

    const result = processRecordsData(recordsData, qYear, qMonth, matchName);

    // Only cache valid data
    if (isValidData(result)) {
      writeCache(qYear, qMonth, result);
    }

    res.status(200).json(result);
  } catch (error: any) {
    // On error, try returning cached data
    const now = new Date();
    const qYear = req.query.year ? parseInt(req.query.year as string) : now.getFullYear();
    const qMonth = req.query.month ? parseInt(req.query.month as string) : now.getMonth() + 1;
    const cached = readCache(qYear, qMonth);
    if (cached) {
      console.log('[Dinner] Fetch failed, returning cache:', error.message);
      return res.status(200).json(cached);
    }
    console.error('[Dinner] Error:', error.message);
    res.status(500).json({ error: error.message || 'Failed to fetch dinner data' });
  }
}
