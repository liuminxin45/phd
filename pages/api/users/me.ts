import type { NextApiRequest, NextApiResponse } from 'next';
import { ConduitClient } from '@/lib/conduit/client';
import { User } from '@/lib/conduit/types';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<User | { error: string }>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const host = process.env.PHA_HOST;
    const token = process.env.PHA_TOKEN;

    if (!host || !token) {
      return res.status(500).json({ error: 'Server configuration error: Missing PHA_HOST or PHA_TOKEN' });
    }

    const client = new ConduitClient(host, token);
    const user = await client.call<User>('user.whoami');
    res.status(200).json(user);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
