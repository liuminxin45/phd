import type { NextApiRequest, NextApiResponse } from 'next';
import type { ContactsTrendPoint } from '@/lib/contacts/types';
import { getContactsTrendPoints } from '@/lib/contacts/service';

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<ContactsTrendPoint[] | { error: string }>,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const limitParam = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : 30;
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 120) : 30;

  try {
    return res.status(200).json(getContactsTrendPoints(limit));
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || 'Failed to load contacts trend' });
  }
}
