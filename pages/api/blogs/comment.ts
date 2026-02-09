import type { NextApiRequest, NextApiResponse } from 'next';
import { ConduitClient } from '@/lib/conduit/client';

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

  // GET: fetch comments for a post via transaction.search
  if (req.method === 'GET') {
    try {
      const { postPHID } = req.query;
      if (!postPHID || typeof postPHID !== 'string') {
        return res.status(400).json({ error: 'postPHID is required' });
      }

      const transactionsResult = await client.call<any>('transaction.search', {
        objectIdentifier: postPHID,
        limit: 200,
      });

      const transactions = transactionsResult?.data || [];
      const comments: any[] = [];
      const userPHIDs = new Set<string>();

      for (const tx of transactions) {
        const raw = tx?.comments?.[0]?.content?.raw || '';
        if (!raw.trim()) continue;

        if (tx.authorPHID) userPHIDs.add(tx.authorPHID);

        comments.push({
          id: tx.id,
          authorPHID: tx.authorPHID || '',
          author: 'Unknown',
          content: raw,
          dateCreated: tx.dateCreated || 0,
          timestamp: new Date((tx.dateCreated || 0) * 1000).toLocaleString('zh-CN'),
        });
      }

      // Resolve author names and images
      if (userPHIDs.size > 0) {
        try {
          const usersResult = await client.call<any>('user.search', {
            constraints: { phids: Array.from(userPHIDs) },
          });
          const userMap: Record<string, { name: string; image: string | null }> = {};
          for (const u of usersResult?.data || []) {
            userMap[u.phid] = {
              name: u.fields?.realName || u.fields?.username || 'Unknown',
              image: u.fields?.image || null,
            };
          }
          for (const c of comments) {
            if (c.authorPHID && userMap[c.authorPHID]) {
              c.author = userMap[c.authorPHID].name;
              c.authorImage = userMap[c.authorPHID].image;
            }
          }
        } catch {
          // ignore user resolution errors
        }
      }

      // Sort newest first
      comments.sort((a, b) => b.dateCreated - a.dateCreated);

      return res.status(200).json({ comments });
    } catch (error: any) {
      console.error('[Blog Comment GET] Error:', error.message);
      return res.status(500).json({ error: error.message || 'Failed to fetch comments' });
    }
  }

  // POST: add a comment via phame.post.edit
  if (req.method === 'POST') {
    try {
      const { postId, content } = req.body;

      if (!postId) {
        return res.status(400).json({ error: 'postId is required' });
      }
      if (!content || typeof content !== 'string' || !content.trim()) {
        return res.status(400).json({ error: 'content is required' });
      }

      const result = await client.call('phame.post.edit', {
        objectIdentifier: String(postId),
        transactions: [
          { type: 'comment', value: content.trim() },
        ],
      });

      return res.status(200).json({ success: true, result });
    } catch (error: any) {
      console.error('[Blog Comment POST] Error:', error.message);
      return res.status(500).json({ error: error.message || 'Failed to add comment' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
