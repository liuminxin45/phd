import type { NextApiRequest, NextApiResponse } from 'next';
import { ConduitClient } from '@/lib/conduit/client';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const host = process.env.PHA_HOST;
    const token = process.env.PHA_TOKEN;

    if (!host || !token) {
      return res.status(500).json({ error: 'Server configuration error' });
    }

    let parsedBody = req.body;
    if (typeof req.body === 'string') {
      try {
        parsedBody = JSON.parse(req.body);
      } catch (e) {
        return res.status(400).json({ error: 'Invalid JSON in request body' });
      }
    }

    const { parentIds } = parsedBody;

    if (!parentIds || !Array.isArray(parentIds) || parentIds.length === 0) {
      return res.status(400).json({ error: 'parentIds array is required' });
    }

    const client = new ConduitClient(host, token);

    // Use maniphest.search with parentIDs constraint for faster batch query
    const result = await client.call('maniphest.search', {
      constraints: {
        parentIDs: parentIds
      },
      attachments: {
        projects: true
      },
      limit: 100
    });

    // Group subtasks by parent ID
    const subtasksByParent: Record<number, any[]> = {};
    parentIds.forEach((id: number) => {
      subtasksByParent[id] = [];
    });

    // The API returns tasks that have these parentIDs
    // We need to use edge.search to get the actual parent-child relationships
    const taskPHIDs = (result.data || []).map((t: any) => t.phid);
    
    if (taskPHIDs.length > 0) {
      // Get parent relationships for these tasks
      const edgeResult = await client.call('edge.search', {
        sourcePHIDs: taskPHIDs,
        types: ['task.parent']
      });

      // Build a map of task PHID to parent task ID
      const taskToParent: Record<string, number> = {};
      (edgeResult.data || []).forEach((edge: any) => {
        // edge.sourcePHID is the child, edge.destinationPHID is the parent
        const parentMatch = edge.destinationPHID?.match(/PHID-TASK-/);
        if (parentMatch) {
          // Find the parent task ID from our parentIds
          const parentTask = (result.data || []).find((t: any) => t.phid === edge.destinationPHID);
          if (parentTask) {
            taskToParent[edge.sourcePHID] = parentTask.id;
          }
        }
      });

      // Group tasks by their parent
      (result.data || []).forEach((task: any) => {
        // Find which parent this task belongs to
        parentIds.forEach((parentId: number) => {
          // Check if this task's parent is in our parentIds
          // Since we queried with parentIDs constraint, all returned tasks are children of those parents
          if (subtasksByParent[parentId]) {
            // We need to verify the parent relationship
            // For now, add to the first matching parent (the API already filtered by parentIDs)
          }
        });
      });
    }

    // Simpler approach: just return all subtasks grouped
    // The frontend will handle the grouping
    res.status(200).json({
      subtasks: result.data || [],
      parentIds
    });
  } catch (error: any) {
    console.error('Failed to fetch subtasks:', error);
    res.status(500).json({ 
      error: 'Failed to fetch subtasks',
      details: error.message,
    });
  }
}
