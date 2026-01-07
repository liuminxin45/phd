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

    const { id } = req.query;
    
    if (!id) {
      return res.status(400).json({ error: 'Project ID is required' });
    }
    
    const client = new ConduitClient(host, token);
    
    // First, get the project without attachments to get the PHID
    const initialResult = await client.call<ConduitSearchResult<Project>>('project.search', {
      constraints: {
        ids: [parseInt(id as string)]
      },
      limit: 1
    });
    
    if (!initialResult.data || initialResult.data.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const projectPHID = initialResult.data[0].phid;
    
    // Then query again with the PHID to get attachments
    const result = await client.call<ConduitSearchResult<Project>>('project.search', {
      constraints: {
        phids: [projectPHID]
      },
      attachments: {
        members: true,
        watchers: true
      },
      limit: 1
    });
    
    res.status(200).json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
