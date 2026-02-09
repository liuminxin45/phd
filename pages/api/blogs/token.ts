import type { NextApiRequest, NextApiResponse } from 'next';
import { ConduitClient } from '@/lib/conduit/client';

// Cache current user PHID (won't change within process lifetime)
let cachedUserPHID: string | null = null;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const host = process.env.PHA_HOST;
  const token = process.env.PHA_TOKEN;

  if (!host || !token) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const client = new ConduitClient(host, token);

  // GET: Check if current user has liked a specific post
  if (req.method === 'GET') {
    try {
      const { objectPHID } = req.query;
      if (!objectPHID || typeof objectPHID !== 'string') {
        return res.status(400).json({ error: 'objectPHID is required' });
      }

      // Resolve current user PHID
      if (!cachedUserPHID) {
        const whoami = await client.call<any>('user.whoami', {});
        cachedUserPHID = whoami?.phid || null;
      }

      if (!cachedUserPHID) {
        return res.status(200).json({ hasLiked: false });
      }

      // Fetch all tokens — token.given returns {authorPHID, objectPHID, tokenPHID}
      const tokensRaw = await client.call<any>('token.given', {});
      // Normalize: may be array or object with numeric keys
      const tokens: any[] = Array.isArray(tokensRaw)
        ? tokensRaw
        : (typeof tokensRaw === 'object' && tokensRaw !== null)
          ? Object.values(tokensRaw)
          : [];

      const matching = tokens.filter((t: any) => t.objectPHID === objectPHID);

      const hasLiked = matching.some(
        (t: any) => t.authorPHID === cachedUserPHID
      );

      return res.status(200).json({ hasLiked });
    } catch (error: any) {
      console.error('[Blog Token GET] Error:', error.message);
      return res.status(200).json({ hasLiked: false });
    }
  }

  // POST: Toggle like on a post
  if (req.method === 'POST') {
    try {
      const { objectPHID, tokenPHID } = req.body;

      if (!objectPHID || typeof objectPHID !== 'string') {
        return res.status(400).json({ error: 'objectPHID is required' });
      }

      // token.give toggles a token on the object.
      const params: Record<string, any> = { objectPHID };
      if (tokenPHID) {
        params.tokenPHID = tokenPHID;
      }

      await client.call('token.give', params);

      return res.status(200).json({ success: true });
    } catch (error: any) {
      console.error('[Blog Token POST] Error:', error.message);
      return res.status(500).json({ error: error.message || 'Failed to give token' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
