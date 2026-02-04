import type { NextApiRequest, NextApiResponse } from 'next';
import { ConduitClient } from '@/lib/conduit/client';
import { ConduitSearchResult, Project } from '@/lib/conduit/types';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ConduitSearchResult<Project> | { error: string }>
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

    const { query, limit = '10' } = req.query;
    
    if (!query) {
      return res.status(200).json({ 
        data: [], 
        maps: {},
        query: { queryKey: null },
        cursor: { limit: 10, after: null, before: null, order: null } 
      });
    }
    
    const client = new ConduitClient(host, token);
    
    const result = await client.search<ConduitSearchResult<Project>>(
      'project.search',
      { query: query as string },
      {},
      parseInt(limit as string),
      null
    );
    
    res.status(200).json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
