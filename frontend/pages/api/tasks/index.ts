import type { NextApiRequest, NextApiResponse } from 'next';
import { ConduitClient } from '@/lib/conduit/client';
import { ConduitSearchResult, Task } from '@/lib/conduit/types';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ConduitSearchResult<Task> | { data: Task[] } | { error: string }>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const host = process.env.PHA_HOST;
    const token = process.env.PHA_TOKEN;

    if (!host || !token) {
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const { limit = '100', after, status, assigned } = req.query;
    
    const client = new ConduitClient(host, token);
    
    const constraints: Record<string, any> = {};
    if (status) {
      constraints.statuses = [status];
    }
    if (assigned) {
      constraints.assigned = [assigned];
    }
    
    const result = await client.search<ConduitSearchResult<Task>>(
      'maniphest.search',
      constraints,
      {},
      parseInt(limit as string),
      after as string | null
    );
    
    res.status(200).json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
