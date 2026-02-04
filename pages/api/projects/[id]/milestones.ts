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

    // Get project info first to get the name
    const projectInfo = await client.call<any>('project.search', {
      constraints: {
        ids: [parseInt(id)],
      },
    });

    if (!projectInfo.data || projectInfo.data.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const project = projectInfo.data[0];
    const projectName = project.fields.name;

    // Step 1: Export all milestone data from schedule system
    const scheduleResult = await client.call<any>('schedule.export.all', {
      objectType: 'milestone',
      allMilestone: '1',
      formatKey: 'json',
    });

    let scheduleData: any[] = [];
    
    if (scheduleResult && scheduleResult['download URI']) {
      const downloadUrl = scheduleResult['download URI'];
      const response = await fetch(downloadUrl);
      if (response.ok) {
        const jsonData = await response.json();
        if (Array.isArray(jsonData)) {
          scheduleData = jsonData;
        } else if (jsonData && Array.isArray(jsonData.data)) {
          scheduleData = jsonData.data;
        }
      }
    }

    // Step 2: Filter milestones for this project by projectName
    const projectMilestones = scheduleData.filter((item: any) => {
      if (item.projectName === projectName) {
        return true;
      }
      if (item.projectName && projectName && 
          item.projectName.toLowerCase().includes(projectName.toLowerCase())) {
        return true;
      }
      return false;
    });

    res.status(200).json(projectMilestones);
  } catch (error: any) {
    console.error('Error fetching project milestones:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch project milestones' });
  }
}
