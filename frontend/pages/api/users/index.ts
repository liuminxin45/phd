import type { NextApiRequest, NextApiResponse } from 'next';
import { ConduitClient } from '@/lib/conduit/client';
import { ConduitSearchResult, User } from '@/lib/conduit/types';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ConduitSearchResult<User> | { error: string }>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const host = process.env.PHA_HOST;
    const token = process.env.PHA_TOKEN;

    if (!host || !token) {
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const client = new ConduitClient(host, token);
    
    // Fetch all users with pagination
    let allUsers: User[] = [];
    let after: string | null = null;
    let hasMore = true;
    
    while (hasMore) {
      const result: ConduitSearchResult<User> = await client.search<ConduitSearchResult<User>>(
        'user.search',
        {},
        {},
        100, // Fetch 100 users per page
        after
      );
      
      allUsers = allUsers.concat(result.data);
      
      // Check if there are more results
      if (result.cursor && result.cursor.after) {
        after = result.cursor.after;
      } else {
        hasMore = false;
      }
    }
    
    // Return all users in the same format
    res.status(200).json({
      data: allUsers,
      maps: {},
      query: {
        queryKey: null,
      },
      cursor: {
        limit: allUsers.length,
        after: null,
        before: null,
        order: null,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
