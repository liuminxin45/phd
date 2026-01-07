import type { NextApiRequest, NextApiResponse } from 'next';
import { ConduitClient } from '@/lib/conduit/client';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  try {
    const host = process.env.PHA_HOST;
    const token = process.env.PHA_TOKEN;

    if (!host || !token) {
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const { filterPHIDs, limit, after, before, view } = req.body || {};

    const params: Record<string, any> = {};
    if (Array.isArray(filterPHIDs) && filterPHIDs.length > 0) params.filterPHIDs = filterPHIDs;
    if (typeof limit === 'number') params.limit = limit;
    if (typeof after === 'number') params.after = after;
    if (typeof before === 'number') params.before = before;
    if (typeof view === 'string') params.view = view;

    const client = new ConduitClient(host, token);
    const result = await client.call<any>('feed.query', params);

    return res.status(200).json({ params, result });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to query feed' });
  }
}
