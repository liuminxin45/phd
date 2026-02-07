import type { NextApiRequest, NextApiResponse } from 'next';
import {
  DINNER_BASE_URL,
  makeHeaders,
  fetchJson,
  getActiveSession,
  refreshAndEstablish,
} from '@/lib/dinner/client';

function formatDate(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // date: 0 = today, -1 = yesterday; times: 0, 1, or 2
    const { date = 0, times = 1 } = req.body;

    if (![0, -1].includes(date)) {
      return res.status(400).json({ error: 'date must be 0 (today) or -1 (yesterday)' });
    }
    if (![0, 1, 2].includes(times)) {
      return res.status(400).json({ error: 'times must be 0, 1, or 2' });
    }

    let session = await getActiveSession();

    // Get current user data to obtain userId
    const userData = await fetchJson<any>(`${DINNER_BASE_URL}/get_user_data`, {
      method: 'GET',
      headers: makeHeaders(session),
    });
    const loginUser = userData?.result || {};
    const userId = loginUser.userId;
    if (!userId) {
      throw new Error('Could not obtain userId from get_user_data');
    }

    const recordDate = formatDate(date);

    // Build form data matching the original JS applyData structure
    const formData = new URLSearchParams();
    formData.append('userId', String(userId));
    formData.append('recordDate', recordDate);
    formData.append('times', String(times));
    formData.append('reason', '');
    formData.append('type', '');
    formData.append('year', '');
    formData.append('month', '');
    formData.append('day', '');

    const doApply = async (s: string) => {
      const resp = await fetch(`${DINNER_BASE_URL}/create`, {
        method: 'POST',
        headers: {
          ...makeHeaders(s),
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        },
        body: formData.toString(),
      });
      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        throw new Error(`Apply failed: ${resp.status} ${text.substring(0, 200)}`);
      }
      return resp.json();
    };

    let data: any;
    try {
      data = await doApply(session);
    } catch {
      session = await refreshAndEstablish(session);
      data = await doApply(session);
    }

    res.status(200).json(data);
  } catch (error: any) {
    console.error('[Dinner Apply] Error:', error.message);
    res.status(500).json({ error: error.message || 'Failed to apply dinner' });
  }
}
