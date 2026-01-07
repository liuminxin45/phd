import type { NextApiRequest, NextApiResponse } from 'next';
import { ConduitClient } from '@/lib/conduit/client';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ success: boolean; error?: string }>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const host = process.env.PHA_HOST;
    const token = process.env.PHA_TOKEN;

    if (!host || !token) {
      return res.status(500).json({ success: false, error: 'Server configuration error' });
    }

    const { projectPHID, transactions } = req.body;
    
    if (!projectPHID || !transactions) {
      return res.status(400).json({ success: false, error: 'Project PHID and transactions are required' });
    }
    
    const client = new ConduitClient(host, token);
    
    await client.call('project.edit', {
      objectIdentifier: projectPHID,
      transactions: transactions
    });
    
    res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Project edit error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}
