import type { NextApiRequest, NextApiResponse } from 'next';
import { ConduitClient } from '@/lib/conduit/client';

// Ensure Next.js parses the body as JSON
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
};

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

    // Parse body if it's a string
    let parsedBody = req.body;
    if (typeof req.body === 'string') {
      try {
        parsedBody = JSON.parse(req.body);
      } catch (e) {
        return res.status(400).json({ 
          error: 'Invalid JSON in request body',
          received: req.body 
        });
      }
    }

    const { title, parentId, parentTask, projectPHIDs, projects } = parsedBody;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ 
        error: 'Title is required',
        received: title 
      });
    }

    const client = new ConduitClient(host, token);
    
    // Build transactions for creating a new task
    const transactions: any[] = [
      { type: 'title', value: title.trim() }
    ];

    // Add parent task if provided (for subtasks)
    // Support both parentId (number) and parentTask (PHID)
    if (parentTask) {
      // parentTask is a PHID like "PHID-TASK-xxx"
      transactions.push({ type: 'parent', value: parentTask });
    } else if (parentId) {
      // parentId is a number, convert to T123 format
      transactions.push({ type: 'parent', value: `T${parentId}` });
    }

    // Add project tags if provided (support both projectPHIDs and projects)
    const projectList = projectPHIDs || projects;
    if (projectList && Array.isArray(projectList) && projectList.length > 0) {
      transactions.push({ type: 'projects.add', value: projectList });
    }

    const result = await client.call('maniphest.edit', { transactions });

    res.status(200).json(result);
  } catch (error: any) {
    console.error('Failed to create task:', error);
    res.status(500).json({ 
      error: 'Failed to create task',
      details: error.message,
    });
  }
}
