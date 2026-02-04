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

    const { limit = '100', after, members, queryKey, ids } = req.query;
    
    const client = new ConduitClient(host, token);
    
    // Build constraints
    const constraints: Record<string, any> = {};
    if (ids) {
      // Support single ID or comma-separated IDs
      const idArray = Array.isArray(ids) ? ids : String(ids).split(',').map(id => parseInt(id.trim(), 10));
      constraints.ids = idArray;
    }
    if (members) {
      constraints.members = [members];
    }
    
    const result = await client.search<ConduitSearchResult<Project>>(
      'project.search',
      constraints,
      {},
      parseInt(limit as string),
      after as string | null,
      queryKey as string | undefined
    );
    
    res.status(200).json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
