import type { NextApiRequest, NextApiResponse } from 'next';
import { createGerritClient } from '@/lib/gerrit/client';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const client = await createGerritClient();
    const query = (req.query.q as string) || 'status:open';
    const limit = parseInt(req.query.n as string) || 25;
    const start = parseInt(req.query.S as string) || 0;

    const options = [
      'LABELS',
      'DETAILED_ACCOUNTS',
      'CURRENT_REVISION',
      'CURRENT_COMMIT',
      'DETAILED_LABELS',
    ];

    const changes = await client.queryChanges(query, options, limit, start || undefined);

    res.status(200).json({ changes: changes || [] });
  } catch (error: any) {
    console.error('Gerrit changes query error:', error);
    res.status(500).json({ error: error.message || 'Failed to query changes' });
  }
}
