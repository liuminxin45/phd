import type { NextApiRequest, NextApiResponse } from 'next';
import { createGerritClient } from '@/lib/gerrit/client';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { q } = req.query;
  if (!q || typeof q !== 'string' || q.length < 2) {
    return res.status(200).json([]);
  }

  try {
    const client = await createGerritClient();
    const accounts = await client.get('/accounts/', { q, n: 10 });
    res.status(200).json(accounts);
  } catch (error: any) {
    console.error('Gerrit account search error:', error);
    res.status(500).json({ error: error.message || 'Failed to search accounts' });
  }
}
