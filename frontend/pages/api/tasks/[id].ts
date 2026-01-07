import type { NextApiRequest, NextApiResponse } from 'next';
import { ConduitClient } from '@/lib/conduit/client';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
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
      return res.status(400).json({ error: 'Missing or invalid task ID' });
    }

    const client = new ConduitClient(host, token);
    
    // Fetch task with attachments (subscribers, projects, columns)
    const result = await client.call('maniphest.search', {
      constraints: {
        ids: [parseInt(id)],
      },
      attachments: {
        subscribers: true,
        projects: true,
        columns: true,
      },
    });

    if (!result.data || result.data.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const task = result.data[0];

    // Fetch transactions (comments, history)
    const transactions = await client.call('transaction.search', {
      objectIdentifier: task.phid,
      limit: 100,
    });

    // Recursively fetch all subtasks
    const fetchSubtasksRecursive = async (parentPHID: string, depth: number = 0): Promise<any[]> => {
      if (depth > 10) return []; // Prevent infinite recursion
      
      try {
        const edgeResult = await client.call('edge.search', {
          sourcePHIDs: [parentPHID],
          types: ['task.subtask'],
        });
        
        if (!edgeResult.data || edgeResult.data.length === 0) {
          return [];
        }
        
        const subtaskPHIDs = edgeResult.data.map((edge: any) => edge.destinationPHID);
        
        // Fetch subtask details
        const subtasksResult = await client.call('maniphest.search', {
          constraints: {
            phids: subtaskPHIDs,
          },
        });
        
        const subtasks = subtasksResult.data || [];
        
        // Recursively fetch subtasks for each subtask
        const subtasksWithChildren = await Promise.all(
          subtasks.map(async (subtask: any) => {
            const children = await fetchSubtasksRecursive(subtask.phid, depth + 1);
            return {
              ...subtask,
              subtasks: children,
              depth: depth,
            };
          })
        );
        
        return subtasksWithChildren;
      } catch (error) {
        return [];
      }
    };
    
    const subtasks = await fetchSubtasksRecursive(task.phid);

    res.status(200).json({
      task,
      transactions: transactions.data || [],
      subtasks,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch task details' });
  }
}
