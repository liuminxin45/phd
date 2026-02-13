import type { NextApiRequest, NextApiResponse } from 'next';
import { createGerritClient } from '@/lib/gerrit/client';
import type { ReviewInput } from '@/lib/gerrit/types';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const client = await createGerritClient();
    const { changeId, revisionId, message, labels, comments } = req.body as ReviewInput;

    if (!changeId) {
      return res.status(400).json({ error: 'Missing changeId' });
    }

    const revision = revisionId || 'current';

    // Build Gerrit ReviewInput
    const reviewInput: Record<string, any> = {};
    if (message) reviewInput.message = message;
    if (labels && Object.keys(labels).length > 0) reviewInput.labels = labels;
    if (comments && Object.keys(comments).length > 0) reviewInput.comments = comments;

    const result = await client.post(
      `/changes/${changeId}/revisions/${revision}/review`,
      reviewInput
    );

    res.status(200).json(result);
  } catch (error: any) {
    console.error('Gerrit review error:', error);
    res.status(500).json({ error: error.message || 'Failed to submit review' });
  }
}
