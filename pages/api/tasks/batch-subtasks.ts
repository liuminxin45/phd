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

    const { taskIds } = req.body;

    if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
      return res.status(400).json({ error: 'Missing or invalid taskIds array' });
    }

    if (taskIds.length > 50) {
      return res.status(400).json({ error: 'Maximum 50 tasks per batch' });
    }

    const client = new ConduitClient(host, token);

    // First, get task details to obtain PHIDs
    const tasksResult = await client.call('maniphest.search', {
      constraints: {
        ids: taskIds.map((id: number) => parseInt(String(id))),
      },
    });

    const tasks = tasksResult.data || [];
    const taskPhids = tasks.map((t: any) => t.phid);

    if (taskPhids.length === 0) {
      return res.status(200).json({ results: {} });
    }

    // Batch fetch all subtask edges at once
    const edgeResult = await client.call('edge.search', {
      sourcePHIDs: taskPhids,
      types: ['task.subtask'],
    });

    // Group edges by source PHID
    const edgesByParent = new Map<string, string[]>();
    for (const edge of edgeResult.data || []) {
      const sourcePHID = edge.sourcePHID;
      if (!edgesByParent.has(sourcePHID)) {
        edgesByParent.set(sourcePHID, []);
      }
      edgesByParent.get(sourcePHID)!.push(edge.destinationPHID);
    }

    // Collect all subtask PHIDs
    const allSubtaskPhids = new Set<string>();
    edgesByParent.forEach((phids) => {
      phids.forEach((phid) => allSubtaskPhids.add(phid));
    });

    // Batch fetch all subtask details at once
    let subtaskDetails = new Map<string, any>();
    if (allSubtaskPhids.size > 0) {
      const subtaskPhidArray = Array.from(allSubtaskPhids);
      
      // Fetch in chunks of 100 (API limit)
      const chunks: string[][] = [];
      for (let i = 0; i < subtaskPhidArray.length; i += 100) {
        chunks.push(subtaskPhidArray.slice(i, i + 100));
      }

      const chunkResults = await Promise.all(
        chunks.map((chunk) =>
          client.call('maniphest.search', {
            constraints: { phids: chunk },
          })
        )
      );

      for (const result of chunkResults) {
        for (const task of result.data || []) {
          subtaskDetails.set(task.phid, task);
        }
      }
    }

    // Build results map: taskId -> subtasks array
    const results: Record<number, any[]> = {};
    
    // Map PHID back to task ID
    const phidToId = new Map<string, number>();
    for (const task of tasks) {
      phidToId.set(task.phid, task.id);
    }

    for (const task of tasks) {
      const subtaskPhids = edgesByParent.get(task.phid) || [];
      const subtasks = subtaskPhids
        .map((phid) => subtaskDetails.get(phid))
        .filter((st) => st !== undefined);
      results[task.id] = subtasks;
    }

    res.status(200).json({ results });
  } catch (error: any) {
    console.error('Batch subtasks error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch subtasks' });
  }
}
