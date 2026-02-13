import type { NextApiRequest, NextApiResponse } from 'next';
import { createGerritClient } from '@/lib/gerrit/client';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const client = await createGerritClient();
    const { changeId } = req.query;

    if (!changeId) {
      return res.status(400).json({ error: 'Missing changeId' });
    }

    // DELETE (real or via _method override): Remove reviewer
    if (req.method === 'DELETE' || (req.method === 'POST' && req.body?._method === 'DELETE')) {
      const { accountId } = req.body;
      if (!accountId) {
        return res.status(400).json({ error: 'Missing accountId' });
      }

      const result = await client.delete(
        `/changes/${changeId}/reviewers/${accountId}`
      );
      return res.status(200).json(result);
    }

    // POST: Add reviewer or CC
    if (req.method === 'POST') {
      const { reviewer, state } = req.body; // state: 'REVIEWER' | 'CC'
      if (!reviewer) {
        return res.status(400).json({ error: 'Missing reviewer (email or account ID)' });
      }

      const input: Record<string, string> = { reviewer, state: state || 'REVIEWER' };
      // If a previous call required confirmation (large group), auto-confirm
      if (req.body.confirmed) input.confirmed = 'true';

      const result = await client.post(
        `/changes/${changeId}/reviewers`,
        input
      );

      // Gerrit may return 200 but with an error in the body
      if (result.error) {
        return res.status(400).json({ error: result.error });
      }
      return res.status(200).json(result);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Gerrit reviewers error:', error);
    res.status(500).json({ error: error.message || 'Failed to manage reviewers' });
  }
}
