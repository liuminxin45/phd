import type { NextApiRequest, NextApiResponse } from 'next';
import {
  DINNER_BASE_URL,
  makeHeaders,
  getActiveSession,
  refreshAndEstablish,
} from '@/lib/dinner/client';

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

    const formData = new URLSearchParams();
    formData.append('date', String(date));
    formData.append('times', String(times));

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
