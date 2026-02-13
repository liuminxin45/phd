import type { NextApiRequest, NextApiResponse } from 'next';
import { createGerritClient } from '@/lib/gerrit/client';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const changeId = req.query.id as string;
  const revisionId = (req.query.revision as string) || 'current';
  const filePath = req.query.file as string;

  if (!changeId || !filePath) {
    return res.status(400).json({ error: 'Missing change id or file path' });
  }

  try {
    const client = await createGerritClient();
    const encodedPath = encodeURIComponent(filePath);
    const diff = await client.get(`/changes/${changeId}/revisions/${revisionId}/files/${encodedPath}/diff`);

    res.status(200).json(diff);
  } catch (error: any) {
    console.error('Gerrit diff error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch diff' });
  }
}
