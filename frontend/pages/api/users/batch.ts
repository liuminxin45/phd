import type { NextApiRequest, NextApiResponse } from 'next';
import { ConduitClient } from '@/lib/conduit/client';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const host = process.env.PHA_HOST;
    const token = process.env.PHA_TOKEN;

    if (!host || !token) {
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const { phids } = req.body;

    if (!phids || !Array.isArray(phids) || phids.length === 0) {
      return res.status(400).json({ error: 'Missing or invalid user PHIDs array' });
    }

    const client = new ConduitClient(host, token);
    
    // Fetch all users in one request
    const result = await client.call('user.search', {
      constraints: {
        phids: phids,
      },
    });

    if (!result.data) {
      return res.status(200).json({});
    }

    // Transform to a map of PHID -> user data
    const usersMap: Record<string, any> = {};
    
    result.data.forEach((userData: any) => {
      usersMap[userData.phid] = {
        phid: userData.phid,
        userName: userData.fields.username,
        realName: userData.fields.realName,
        image: userData.fields.image || null,
        uri: `${host}/p/${userData.fields.username}/`,
        roles: userData.fields.roles || [],
        primaryEmail: userData.fields.primaryEmail || '',
        team: userData.fields.custom?.team || '',
      };
    });

    res.status(200).json(usersMap);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch users' });
  }
}
