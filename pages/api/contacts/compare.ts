import type { NextApiRequest, NextApiResponse } from 'next';
import type { ContactsDiff } from '@/lib/contacts/types';
import { compareContactsSnapshots, isValidSnapshotDate } from '@/lib/contacts/service';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ContactsDiff | { error: string }>,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const fromDate = typeof req.query.from === 'string' ? req.query.from : '';
  const toDate = typeof req.query.to === 'string' ? req.query.to : '';

  if (!isValidSnapshotDate(fromDate) || !isValidSnapshotDate(toDate)) {
    return res.status(400).json({ error: 'Invalid compare dates' });
  }

  try {
    const diff = await compareContactsSnapshots(fromDate, toDate);
    return res.status(200).json(diff);
  } catch (error: any) {
    console.error('[Contacts] Compare error:', error);
    return res.status(500).json({ error: error?.message || 'Failed to compare contacts snapshots' });
  }
}
