import type { NextApiRequest, NextApiResponse } from 'next';
import { ConduitClient } from '@/lib/conduit/client';

const PRIORITY_KEY_MAP: Record<string, string> = {
  '100': 'unbreak',
  '90': 'triage',
  '80': 'high',
  '50': 'normal',
  '25': 'low',
  '0': 'wish',
};

const PRIORITY_KEYS = new Set(Object.values(PRIORITY_KEY_MAP));

interface UpdateTaskRequest {
  taskId: string;
  status?: string;
  priority?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { taskId, status, priority } = req.body as UpdateTaskRequest;
  const priorityKey = priority
    ? (PRIORITY_KEY_MAP[priority] ?? (PRIORITY_KEYS.has(priority) ? priority : null))
    : null;
  
  // Build transactions array based on what fields are being updated
  const transactions: Array<{ type: string; value: string }> = [];

  try {
    const host = process.env.PHA_HOST;
    const token = process.env.PHA_TOKEN;

    if (!host || !token) {
      return res.status(500).json({ error: 'Server configuration error' });
    }

    if (!taskId) {
      return res.status(400).json({ error: 'Missing taskId' });
    }

    if (!status && !priority) {
      return res.status(400).json({ error: 'Must provide either status or priority to update' });
    }

    if (priority && !priorityKey) {
      return res.status(400).json({
        error:
          'Invalid priority. Expected one of: 100/90/80/50/25/0 or priority key: unbreak/triage/high/normal/low/wish',
        provided: priority,
      });
    }

    const client = new ConduitClient(host, token);
    
    if (status) {
      transactions.push({
        type: 'status',
        value: status,
      });
    }
    
    if (priorityKey) {
      transactions.push({
        type: 'priority',
        value: priorityKey,
      });
    }

    // Use maniphest.edit to update task
    const result = await client.call('maniphest.edit', {
      objectIdentifier: taskId,
      transactions,
    });

    res.status(200).json(result);
  } catch (error: any) {
    const errorMessage = error.message || 'Failed to update task';

    res.status(500).json({ 
      error: errorMessage,
      details: error.toString(),
      taskId: taskId,
      requestedUpdates: { status: status, priority: priority },
      transactions: transactions
    });
  }
}
