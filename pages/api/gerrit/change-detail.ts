import type { NextApiRequest, NextApiResponse } from 'next';
import { createGerritClient } from '@/lib/gerrit/client';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const changeId = req.query.id as string;
  const revisionId = req.query.revision as string | undefined;
  const baseRevisionId = req.query.base as string | undefined;
  if (!changeId) {
    return res.status(400).json({ error: 'Missing change id' });
  }

  try {
    const client = await createGerritClient();

    // Fetch change detail with all useful options
    // Use queryChanges-style URL building for multiple 'o' params
    const detailOptions = ['ALL_REVISIONS', 'LABELS', 'DETAILED_ACCOUNTS', 'DETAILED_LABELS', 'CURRENT_COMMIT', 'MESSAGES', 'SUBMITTABLE'];
    const optionQuery = detailOptions.map((o) => `o=${o}`).join('&');
    const change = await client.get(`/changes/${changeId}/detail?${optionQuery}`);

    const effectiveRevision = revisionId || change.current_revision;
    const filesPath = effectiveRevision
      ? `/changes/${changeId}/revisions/${effectiveRevision}/files${baseRevisionId ? `?base=${encodeURIComponent(baseRevisionId)}` : ''}`
      : null;

    // Also fetch with other options in parallel
    const [comments, files, related] = await Promise.all([
      client.get(`/changes/${changeId}/comments`).catch(() => ({})),
      // Get files for selected revision (optionally compared with a base patch set)
      filesPath
        ? client.get(filesPath).catch(() => ({}))
        : Promise.resolve({}),
      effectiveRevision
        ? client.get(`/changes/${changeId}/revisions/${effectiveRevision}/related`).catch(() => ({ changes: [] }))
        : Promise.resolve({ changes: [] }),
    ]);

    res.status(200).json({
      change,
      comments,
      files,
      related: related?.changes || [],
    });
  } catch (error: any) {
    console.error('Gerrit change detail error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch change detail' });
  }
}
