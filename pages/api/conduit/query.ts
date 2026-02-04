import type { NextApiRequest, NextApiResponse } from 'next';
import { ConduitClient } from '@/lib/conduit/client';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const host = process.env.PHA_HOST;
    const token = process.env.PHA_TOKEN;

    if (!host || !token) {
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const qParam = req.query.q;
    const q = typeof qParam === 'string' ? qParam.trim().toLowerCase() : '';

    const client = new ConduitClient(host, token);
    const methods = await client.call<Record<string, any>>('conduit.query', {});

    const keys = Object.keys(methods);
    const filteredKeys = q ? keys.filter((k) => k.toLowerCase().includes(q)) : keys;
    filteredKeys.sort();

    return res.status(200).json({
      query: q,
      totalMethods: keys.length,
      matchedMethods: filteredKeys.length,
      methods: filteredKeys.reduce<Record<string, any>>((acc, key) => {
        acc[key] = methods[key];
        return acc;
      }, {}),
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to query conduit methods' });
  }
}
