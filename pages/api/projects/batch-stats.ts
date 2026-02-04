import type { NextApiRequest, NextApiResponse } from 'next';
import { ConduitClient } from '@/lib/conduit/client';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const host = process.env.PHA_HOST;
    const token = process.env.PHA_TOKEN;

    if (!host || !token) {
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const { projectIds } = req.body;

    if (!projectIds || !Array.isArray(projectIds) || projectIds.length === 0) {
      return res.status(400).json({ error: 'Missing or invalid projectIds array' });
    }

    if (projectIds.length > 50) {
      return res.status(400).json({ error: 'Maximum 50 projects per batch' });
    }

    const client = new ConduitClient(host, token);

    const results: Record<number, { 
      progress: number; 
      total: number;
      open: number;
      inProgress: number;
      completed: number;
    }> = {};

    const projectsResult = await client.call('project.search', {
      constraints: { ids: projectIds.map((id: number) => parseInt(String(id))) },
    });

    const projects = projectsResult.data || [];
    const projectPhidMap = new Map<number, string>();
    projects.forEach((p: any) => {
      projectPhidMap.set(p.id, p.phid);
    });

    // Fetch tasks for each project concurrently
    const fetchPromises = projectIds.map(async (projectId) => {
      const projectPhid = projectPhidMap.get(projectId);
      if (!projectPhid) {
        return { 
          projectId, 
          progress: 0, 
          total: 0,
          open: 0,
          inProgress: 0,
          completed: 0
        };
      }

      // Fetch all tasks for this project with pagination
      let totalTasks = 0;
      let openTasks = 0;
      let inProgressTasks = 0;
      let completedTasks = 0;
      let after: string | null = null;
      
      do {
        const tasksResult: { data?: any[]; cursor?: { after?: string } } = await client.call('maniphest.search', {
          constraints: { projects: [projectPhid] },
          limit: 100,
          after,
        });
        
        const tasks = tasksResult.data || [];
        
        // Count tasks by status without storing full task data
        tasks.forEach((task: any) => {
          totalTasks++;
          const status = task.fields?.status?.value;
          
          if (status === 'open') {
            openTasks++;
          } else if (['inprogress', 'stalled'].includes(status)) {
            inProgressTasks++;
          } else if (['resolved', 'excluded'].includes(status)) {
            completedTasks++;
          }
        });
        
        after = tasksResult.cursor?.after || null;
      } while (after);

      // Calculate progress
      const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      return {
        projectId,
        progress,
        total: totalTasks,
        open: openTasks,
        inProgress: inProgressTasks,
        completed: completedTasks
      };
    });

    const projectResults = await Promise.all(fetchPromises);
    
    projectResults.forEach(({ projectId, progress, total, open, inProgress, completed }) => {
      results[projectId] = { progress, total, open, inProgress, completed };
    });

    res.status(200).json({ results });
  } catch (error: any) {
    console.error('Batch project stats error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch project stats' });
  }
}

