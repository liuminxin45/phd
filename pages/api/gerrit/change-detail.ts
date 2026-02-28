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
    const [comments, files, relatedRes] = await Promise.all([
      client.get(`/changes/${changeId}/comments`).catch(() => ({})),
      // Get files for selected revision (optionally compared with a base patch set)
      filesPath
        ? client.get(filesPath).catch(() => ({}))
        : Promise.resolve({}),
      effectiveRevision
        ? client.get(`/changes/${changeId}/revisions/${effectiveRevision}/related`).catch(() => ({ changes: [] }))
        : Promise.resolve({ changes: [] }),
    ]);

    const related = relatedRes?.changes || [];

    // Ensure related changes have subjects
    // Some Gerrit versions/configs might not return full commit info in 'related'
    const missingSubjectIds = related
      .filter((rc: any) => !rc.subject && (!rc.commit || typeof rc.commit !== 'object' || !rc.commit.subject))
      .map((rc: any) => rc._change_number)
      .filter((id: any) => !!id);

    if (missingSubjectIds.length > 0) {
      // Chunk queries to avoid URL length limits
      const CHUNK_SIZE = 20;
      for (let i = 0; i < missingSubjectIds.length; i += CHUNK_SIZE) {
        const chunk = missingSubjectIds.slice(i, i + CHUNK_SIZE);
        const query = chunk.map((id: number) => `change:${id}`).join(' OR ');
        try {
          const infos = await client.queryChanges(query, []);
          const infoMap = new Map(infos.map((info: any) => [info._number, info]));
          
          for (const rc of related) {
            if (missingSubjectIds.includes(rc._change_number)) {
              const info = infoMap.get(rc._change_number);
              if (info && info.subject) {
                rc.subject = info.subject;
              }
            }
          }
        } catch (err) {
          console.warn('Failed to backfill related subjects:', err);
        }
      }
    }

    res.status(200).json({
      change,
      comments,
      files,
      related,
    });
  } catch (error: any) {
    console.error('Gerrit change detail error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch change detail' });
  }
}
