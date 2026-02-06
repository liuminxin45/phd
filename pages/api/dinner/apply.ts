import type { NextApiRequest, NextApiResponse } from 'next';
import { refreshDinnerSession } from '@/lib/dinner-session';

const BASE_URL = 'http://selfservice.tp-link.com.cn:8081/dinner/default';

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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // date: 0 = today, -1 = yesterday
    // times: 0, 1, or 2
    const { date = 0, times = 1 } = req.body;

    if (![0, -1].includes(date)) {
      return res.status(400).json({ error: 'date must be 0 (today) or -1 (yesterday)' });
    }
    if (![0, 1, 2].includes(times)) {
      return res.status(400).json({ error: 'times must be 0, 1, or 2' });
    }

    let session = await ensureSession();
    session = await establishSession(session);

    const formData = new URLSearchParams();
    formData.append('date', String(date));
    formData.append('times', String(times));

    const resp = await fetch(`${BASE_URL}/create`, {
      method: 'POST',
      headers: {
        ...makeHeaders(session),
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      },
      body: formData.toString(),
    });

    if (!resp.ok) {
      // Try session refresh once
      const cookies = await refreshDinnerSession();
      session = cookies.session_id_dinner || session;
      session = await establishSession(session);

      const retryResp = await fetch(`${BASE_URL}/create`, {
        method: 'POST',
        headers: {
          ...makeHeaders(session),
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        },
        body: formData.toString(),
      });

      if (!retryResp.ok) {
        const text = await retryResp.text().catch(() => '');
        throw new Error(`Apply failed: ${retryResp.status} ${text.substring(0, 200)}`);
      }

      const data = await retryResp.json();
      return res.status(200).json(data);
    }

    const data = await resp.json();
    res.status(200).json(data);
  } catch (error: any) {
    console.error('[Dinner Apply] Error:', error.message);
    res.status(500).json({ error: error.message || 'Failed to apply dinner' });
  }
}
