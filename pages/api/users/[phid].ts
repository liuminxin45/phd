import type { NextApiRequest, NextApiResponse } from 'next';
import { ConduitClient } from '@/lib/conduit/client';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
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

    const { phid } = req.query;

    if (!phid || typeof phid !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid user PHID' });
    }

    const client = new ConduitClient(host, token);
    
    // Fetch user info by PHID
    const result = await client.call('user.search', {
      constraints: {
        phids: [phid],
      },
    });

    if (!result.data || result.data.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = result.data[0];

    // Transform to match our User interface
    const user = {
      phid: userData.phid,
      userName: userData.fields.username,
      realName: userData.fields.realName,
      image: userData.fields.image || null,
      uri: `${host}/p/${userData.fields.username}/`,
      roles: userData.fields.roles || [],
      primaryEmail: userData.fields.primaryEmail || '',
      team: userData.fields.custom?.team || '',
    };

    res.status(200).json(user);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch user info' });
  }
}
