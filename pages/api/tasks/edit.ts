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

    const { objectIdentifier, transactions } = parsedBody;

    if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
      return res.status(400).json({ 
        error: 'Invalid transactions',
        received: transactions 
      });
    }

    const client = new ConduitClient(host, token);
    
    // If objectIdentifier is provided, we're editing an existing task
    // If not provided, we're creating a new task
    const params: any = { transactions };
    if (objectIdentifier) {
      params.objectIdentifier = objectIdentifier;
    }
    
    const result = await client.call('maniphest.edit', params);

    res.status(200).json(result);
  } catch (error: any) {
    res.status(500).json({ 
      error: 'Failed to edit task',
      details: error.message,
    });
  }
}
