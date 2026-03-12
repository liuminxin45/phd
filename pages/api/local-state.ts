import type { NextApiRequest, NextApiResponse } from 'next';
import { getLocalState, setLocalState } from '@/lib/server/localStateStore';

type GetResponse = {
  value?: unknown;
};

type ErrorResponse = {
  error: string;
};

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<GetResponse | ErrorResponse>,
) {
  if (req.method === 'GET') {
    const key = typeof req.query.key === 'string' ? req.query.key.trim() : '';
    if (!key) {
      return res.status(400).json({ error: 'Missing key' });
    }
    return res.status(200).json({ value: getLocalState(key) });
  }

  if (req.method === 'POST') {
    const body = req.body as { key?: string; value?: unknown } | undefined;
    const key = typeof body?.key === 'string' ? body.key.trim() : '';
    if (!key) {
      return res.status(400).json({ error: 'Missing key' });
    }
    setLocalState(key, body?.value);
    return res.status(200).json({ value: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
