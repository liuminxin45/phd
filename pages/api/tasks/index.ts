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

    const { limit = '100', after, status, assigned, ids, projects, createdStart, order } = req.query;
    
    const client = new ConduitClient(host, token);
    
    const constraints: Record<string, any> = {};
    if (ids) {
      // Support single ID or comma-separated IDs
      const idArray = Array.isArray(ids) ? ids : String(ids).split(',').map(id => parseInt(id.trim(), 10));
      constraints.ids = idArray;
    }
    
    // [修改开始] 支持多选状态
    if (status) {
      if (Array.isArray(status)) {
        constraints.statuses = status;
      } else {
        // 支持逗号分隔字符串，例如 "open,resolved"
        constraints.statuses = String(status).split(',').filter(Boolean);
      }
    }
    // [修改结束]

    if (assigned) {
      constraints.assigned = [assigned];
    }
    if (projects) {
      constraints.projects = [projects];
    }
    if (createdStart) {
      constraints.createdStart = parseInt(createdStart as string, 10);
    }
    
    const result = await client.search<ConduitSearchResult<Task>>(
      'maniphest.search',
      constraints,
      { projects: true },
      parseInt(limit as string),
      after as string | null,
      undefined, // queryKey
      order as string // order
    );
    
    res.status(200).json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
