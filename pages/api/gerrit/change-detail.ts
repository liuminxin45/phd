import type { NextApiRequest, NextApiResponse } from 'next';
import { createGerritClient } from '@/lib/gerrit/client';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const changeId = req.query.id as string;
  if (!changeId) {
    return res.status(400).json({ error: 'Missing change id' });
  }

  try {
    const client = await createGerritClient();

    // Fetch change detail with all useful options
    const change = await client.get(`/changes/${changeId}/detail`, {
      'o': 'ALL_REVISIONS',
    });

    // Also fetch with other options in parallel
    const [comments, files] = await Promise.all([
      client.get(`/changes/${changeId}/comments`).catch(() => ({})),
      // Get files for current revision
      change.current_revision
        ? client.get(`/changes/${changeId}/revisions/${change.current_revision}/files`).catch(() => ({}))
        : Promise.resolve({}),
    ]);

    res.status(200).json({
      change,
      comments,
      files,
    });
  } catch (error: any) {
    console.error('Gerrit change detail error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch change detail' });
  }
}
