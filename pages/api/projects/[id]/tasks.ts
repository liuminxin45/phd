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

    const { id } = req.query;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid project ID' });
    }

    const client = new ConduitClient(host, token);

    // Get project info first to get the PHID
    const projectInfo = await client.call<any>('project.search', {
      constraints: {
        ids: [parseInt(id)],
      },
    });

    if (!projectInfo.data || projectInfo.data.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const project = projectInfo.data[0];
    const projectPHID = project.phid;

    // Search for tasks with this project tag
    const tasksResult = await client.call<any>('maniphest.search', {
      constraints: {
        projects: [projectPHID],
      },
      limit: 100,
    });

    res.status(200).json(tasksResult);
  } catch (error: any) {
    console.error('Error fetching project tasks:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch project tasks' });
  }
}
