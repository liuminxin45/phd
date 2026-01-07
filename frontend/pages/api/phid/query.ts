import type { NextApiRequest, NextApiResponse } from 'next';
import { ConduitClient } from '@/lib/conduit/client';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const host = process.env.PHA_HOST;
    const token = process.env.PHA_TOKEN;

    if (!host || !token) {
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const { phids } = req.body;

    if (!Array.isArray(phids) || phids.length === 0) {
      return res.status(400).json({ error: 'Missing phids array' });
    }

    const client = new ConduitClient(host, token);
    const result = await client.call<Record<string, any>>('phid.query', { phids });

    return res.status(200).json(result);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to query PHIDs' });
  }
}
