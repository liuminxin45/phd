import type { NextApiRequest, NextApiResponse } from 'next';
import { ConduitClient } from '@/lib/conduit/client';
import { extractLikeState, findLikeTokenPHID } from '@/lib/blog/tokenState';

// Cache current user PHID (won't change within process lifetime)
let cachedUserPHID: string | null = null;
let cachedLikeTokenPHID: string | null = null;

async function resolveCurrentUserPHID(client: ConduitClient): Promise<string | null> {
  if (cachedUserPHID) return cachedUserPHID;
  const whoami = await client.call<any>('user.whoami', {});
  cachedUserPHID = whoami?.phid || null;
  return cachedUserPHID;
}

async function resolveLikeTokenPHID(client: ConduitClient): Promise<string | null> {
  if (cachedLikeTokenPHID) return cachedLikeTokenPHID;

  const tokens = await client.call<any>('token.query', {});
  const resolved = findLikeTokenPHID(tokens);
  cachedLikeTokenPHID = resolved;
  return resolved;
}

async function checkHasLiked(
  client: ConduitClient,
  objectPHID: string,
  userPHID: string,
  likeTokenPHID: string
): Promise<{ hasLiked: boolean; likeCount: number }> {
  const tokensRaw = await client.call<any>('token.given', {
    objectPHIDs: [objectPHID],
    tokenPHIDs: [likeTokenPHID],
  });
  return extractLikeState(tokensRaw, userPHID);
}

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

      const userPHID = await resolveCurrentUserPHID(client);
      if (!userPHID) {
        return res.status(200).json({ hasLiked: false });
      }

      const likeTokenPHID = await resolveLikeTokenPHID(client);
      if (!likeTokenPHID) {
        return res.status(503).json({ error: 'Like token is not available', hasLiked: false });
      }
      const state = await checkHasLiked(client, objectPHID, userPHID, likeTokenPHID);

      return res.status(200).json({
        hasLiked: state.hasLiked,
        likeCount: state.likeCount,
        likeTokenPHID,
      });
    } catch (error: any) {
      console.error('[Blog Token GET] Error:', error.message);
      return res.status(200).json({ hasLiked: false });
    }
  }

  // POST: Toggle like on a post
  if (req.method === 'POST') {
    try {
      const { objectPHID } = req.body;

      if (!objectPHID || typeof objectPHID !== 'string') {
        return res.status(400).json({ error: 'objectPHID is required' });
      }

      const traceId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const userPHID = await resolveCurrentUserPHID(client);
      if (!userPHID) {
        return res.status(500).json({ error: 'Failed to resolve user PHID' });
      }
      const likeTokenPHID = await resolveLikeTokenPHID(client);
      if (!likeTokenPHID) {
        return res.status(503).json({ error: 'Like token is not available' });
      }

      const before = await checkHasLiked(client, objectPHID, userPHID, likeTokenPHID);

      if (before.hasLiked) {
        return res.status(200).json({
          success: true,
          status: 'already-liked',
          changed: false,
          verified: true,
          hasLikedAfter: true,
          likeTokenPHID,
          likeCountBefore: before.likeCount,
          likeCountAfter: before.likeCount,
          traceId,
        });
      }

      // token.give is toggle-based, so we only call it when before.hasLiked === false.
      await client.call('token.give', { objectPHID, tokenPHID: likeTokenPHID });

      const after = await checkHasLiked(client, objectPHID, userPHID, likeTokenPHID);

      if (!after.hasLiked) {
        return res.status(500).json({
          error: 'Like verification failed after token.give',
          traceId,
          likeTokenPHID,
          hasLikedBefore: before.hasLiked,
          hasLikedAfter: after.hasLiked,
          likeCountBefore: before.likeCount,
          likeCountAfter: after.likeCount,
        });
      }

      return res.status(200).json({
        success: true,
        status: 'liked',
        changed: true,
        verified: true,
        hasLikedAfter: true,
        likeTokenPHID,
        likeCountBefore: before.likeCount,
        likeCountAfter: after.likeCount,
        traceId,
      });
    } catch (error: any) {
      console.error('[Blog Token POST] Error:', error.message);
      return res.status(500).json({ error: error.message || 'Failed to give token' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
