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

    const { projectPHID, debug } = req.query;

    if (typeof projectPHID !== 'string' || !projectPHID.trim()) {
      return res.status(400).json({ error: 'Missing projectPHID parameter' });
    }

    const client = new ConduitClient(host, token);

    // Step 1: Export all milestone data from schedule system
    const scheduleResult = await client.call<any>('schedule.export.all', {
      objectType: 'milestone',
      allMilestone: '1',
      formatKey: 'json',
    });

    // schedule.export.all returns a download URI, need to fetch the actual data
    let scheduleData: any[] = [];
    
    if (scheduleResult && scheduleResult['download URI']) {
      const downloadUrl = scheduleResult['download URI'];
      
      // Fetch the actual JSON data from the download URL
      const response = await fetch(downloadUrl);
      if (response.ok) {
        const jsonData = await response.json();
        
        // The downloaded file should contain an array of milestone data
        if (Array.isArray(jsonData)) {
          scheduleData = jsonData;
        } else if (jsonData && Array.isArray(jsonData.data)) {
          scheduleData = jsonData.data;
        }
      }
    }

    // Debug mode: return first few items to inspect structure
    if (debug === 'true') {
      return res.status(200).json({
        debug: true,
        rawScheduleResult: scheduleResult,
        scheduleResultType: typeof scheduleResult,
        scheduleResultKeys: scheduleResult ? Object.keys(scheduleResult) : [],
        isArray: Array.isArray(scheduleResult),
        scheduleDataLength: scheduleData.length,
        scheduleDataSample: scheduleData.slice(0, 3),
      });
    }

    // Step 2: Filter milestones that belong to this project (by matching project PHID or monogram)
    // First, get project info to find its monogram
    const projectInfo = await client.call<any>('project.search', {
      constraints: {
        phids: [projectPHID.trim()],
      },
    });

    if (!projectInfo.data || projectInfo.data.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const project = projectInfo.data[0];
    const projectId = project.id;
    const projectName = project.fields.name; // e.g., "工业相机Utility 1.5"
    const projectSlug = project.fields.slug || '';
    
    // Step 3: Filter schedule data to only include milestones from this project
    // Match by projectName field in the schedule data
    const projectMilestones = scheduleData.filter((item: any) => {
      // Primary match: exact projectName match
      if (item.projectName === projectName) {
        return true;
      }
      // Secondary match: check if projectName contains the target name (case-insensitive)
      if (item.projectName && projectName && 
          item.projectName.toLowerCase().includes(projectName.toLowerCase())) {
        return true;
      }
      // Tertiary match: check monogram if available
      if (item.monogram && projectSlug && 
          item.monogram.toLowerCase() === projectSlug.toLowerCase()) {
        return true;
      }
      return false;
    });

    // Step 4: Extract unique milestone PHIDs and get their details
    const milestonePHIDs = [...new Set(
      projectMilestones
        .map((item: any) => item.milePHID)
        .filter((phid: any) => phid && phid.startsWith('PHID-MILE-'))
    )];

    let milestoneDetails = {};
    if (milestonePHIDs.length > 0) {
      milestoneDetails = await client.call<any>('phid.query', {
        phids: milestonePHIDs,
      });
    }

    return res.status(200).json({
      projectPHID: projectPHID.trim(),
      projectId,
      projectName,
      projectSlug,
      milestones: projectMilestones,
      milestoneDetails,
      totalCount: projectMilestones.length,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch project milestones' });
  }
}
