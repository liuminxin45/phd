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

    const { method, params } = req.body;

    if (!method) {
      return res.status(400).json({ error: 'Missing method parameter' });
    }

    const client = new ConduitClient(host, token);
    const result = await client.call<any>(method, params || {});

    res.status(200).json(result);
  } catch (error: any) {
    console.error('Conduit API error:', error);
    res.status(500).json({ 
      error: error.message || 'Conduit API call failed' 
    });
  }
}
