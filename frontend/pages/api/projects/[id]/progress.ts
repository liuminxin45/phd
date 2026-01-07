import type { NextApiRequest, NextApiResponse } from 'next';
import { ConduitClient } from '@/lib/conduit/client';

interface MilestoneData {
  status: string;
  statistic: number;
}

interface ProgressResponse {
  projectId: number;
  totalMilestones: number;
  completedMilestones: number;
  progressPercentage: number;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ProgressResponse | { error: string }>
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
    const projectName = project.fields.name;

    // Use the same approach as Debug Panel - get milestones via /api/projects/milestones
    // But we need to call the underlying logic directly since we're in an API route
    
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
      // Primary match: exact projectName match
      if (item.projectName === projectName) {
        return true;
      }
      // Secondary match: case-insensitive contains
      if (item.projectName && projectName && 
          item.projectName.toLowerCase().includes(projectName.toLowerCase())) {
        return true;
      }
      return false;
    });

    if (projectMilestones.length === 0) {
      return res.status(200).json({
        projectId: parseInt(id),
        totalMilestones: 0,
        completedMilestones: 0,
        progressPercentage: 0,
      });
    }

    const milestones: MilestoneData[] = projectMilestones;
    
    // Count all milestones (not just statistic === 1)
    const totalMilestones = milestones.length;
    
    // Count completed milestones (status === "已完成")
    const completedMilestones = milestones.filter(
      (m: MilestoneData) => m.status === '已完成'
    ).length;

    const progressPercentage = totalMilestones > 0 
      ? Math.round((completedMilestones / totalMilestones) * 100)
      : 0;

    res.status(200).json({
      projectId: parseInt(id),
      totalMilestones,
      completedMilestones,
      progressPercentage,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch project progress' });
  }
}
