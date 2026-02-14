import type { NextApiRequest, NextApiResponse } from 'next';
import { createGerritClient } from '@/lib/gerrit/client';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { changeId, revisionId } = req.body as { changeId?: number; revisionId?: string };
  if (!changeId) {
    return res.status(400).json({ error: 'Missing changeId' });
  }

  try {
    const client = await createGerritClient();
    const result = await client.post(`/changes/${changeId}/submit`, revisionId ? { revision: revisionId } : undefined);
    return res.status(200).json(result);
  } catch (error: any) {
    console.error('Gerrit submit error:', error);
    return res.status(500).json({ error: error.message || 'Failed to submit change' });
  }
}
