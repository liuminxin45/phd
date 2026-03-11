import type { NextApiRequest, NextApiResponse } from 'next';
import type { ContactsSnapshotResponse } from '@/lib/contacts/types';
import {
  ensureContactsSnapshot,
  formatLocalDateKey,
  isValidSnapshotDate,
  listContactsSnapshotDates,
} from '@/lib/contacts/service';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ContactsSnapshotResponse | { error: string }>,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const today = formatLocalDateKey(new Date());
  const requestedDate = typeof req.query.date === 'string' ? req.query.date : today;
  const refresh = req.query.refresh === 'true';

  if (!isValidSnapshotDate(requestedDate)) {
    return res.status(400).json({ error: 'Invalid date' });
  }

  try {
    const result = await ensureContactsSnapshot(requestedDate, { forceRefresh: refresh });
    return res.status(200).json({
      snapshot: result.snapshot,
      availableDates: listContactsSnapshotDates(),
      today,
      source: result.source,
    });
  } catch (error: any) {
    console.error('[Contacts] Fetch error:', error);
    return res.status(500).json({ error: error?.message || 'Failed to load contacts snapshot' });
  }
}
