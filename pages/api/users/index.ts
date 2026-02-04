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
    
    // Fetch all users with concurrent pagination (10 parallel streams)
    let allUsers: User[] = [];
    const concurrency = 10;
    
    // First request to get initial data and cursor
    const firstResult: ConduitSearchResult<User> = await client.search<ConduitSearchResult<User>>(
      'user.search',
      {},
      {},
      100,
      null
    );
    
    allUsers = allUsers.concat(firstResult.data);
    
    // If there are more pages, fetch them concurrently
    if (firstResult.cursor?.after) {
      const cursors: (string | null)[] = [firstResult.cursor.after];
      
      while (cursors.some(c => c !== null)) {
        const batchPromises = cursors.slice(0, concurrency).map(async (cursor, index) => {
          if (!cursor) return { data: [], cursor: null, index };
          
          try {
            const result: ConduitSearchResult<User> = await client.search<ConduitSearchResult<User>>(
              'user.search',
              {},
              {},
              100,
              cursor
            );
            return {
              data: result.data,
              cursor: result.cursor?.after || null,
              index
            };
          } catch {
            return { data: [], cursor: null, index };
          }
        });
        
        const results = await Promise.all(batchPromises);
        
        results.forEach(({ data, cursor, index }) => {
          if (data.length > 0) {
            allUsers = allUsers.concat(data);
          }
          cursors[index] = cursor;
        });
        
        // Remove exhausted cursors
        for (let i = cursors.length - 1; i >= 0; i--) {
          if (cursors[i] === null) {
            cursors.splice(i, 1);
          }
        }
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
