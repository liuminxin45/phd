import type { NextApiRequest, NextApiResponse } from 'next';
import {
  deleteReviewDraftByKey,
  deleteReviewDraftsByChangeNumber,
  getReviewDraftByKey,
  readReviewDraftState,
  upsertReviewDraftEntry,
  type PersistedReviewDraftComments,
} from '@/lib/gerrit/review-drafts-state';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const key = typeof req.query.key === 'string' ? req.query.key : '';
    if (key) {
      return res.status(200).json({ draft: getReviewDraftByKey(key) });
    }
    return res.status(200).json({ state: readReviewDraftState() });
  }

  if (req.method === 'POST') {
    const key = String(req.body?.key || '');
    const changeNumber = Number(req.body?.changeNumber);
    const revisionId = req.body?.revisionId ? String(req.body.revisionId) : undefined;
    const comments = (req.body?.comments || {}) as PersistedReviewDraftComments;
    if (!key || !Number.isFinite(changeNumber) || changeNumber <= 0) {
      return res.status(400).json({ error: 'Invalid key or changeNumber' });
    }
    const next = upsertReviewDraftEntry({
      key,
      changeNumber: Math.floor(changeNumber),
      revisionId,
      comments,
      updatedAt: new Date().toISOString(),
    });
    return res.status(200).json({ ok: true, draft: next });
  }

  if (req.method === 'DELETE') {
    const key = typeof req.query.key === 'string' ? req.query.key : '';
    const changeNumber = Number(req.query.changeNumber);
    if (key) {
      const deleted = deleteReviewDraftByKey(key);
      return res.status(200).json({ ok: true, deleted });
    }
    if (Number.isFinite(changeNumber) && changeNumber > 0) {
      const deletedCount = deleteReviewDraftsByChangeNumber(Math.floor(changeNumber));
      return res.status(200).json({ ok: true, deletedCount });
    }
    return res.status(400).json({ error: 'Provide key or changeNumber' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
