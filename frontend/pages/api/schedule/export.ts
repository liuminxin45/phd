import type { NextApiRequest, NextApiResponse } from 'next';
import { ConduitClient } from '@/lib/conduit/client';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const host = process.env.PHA_HOST;
    const token = process.env.PHA_TOKEN;

    if (!host || !token) {
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const { objectType, allMilestone, formatKey } = req.query;

    if (typeof objectType !== 'string' || !objectType.trim()) {
      return res.status(400).json({ error: 'Missing objectType (required: "project" or "milestone")' });
    }

    if (typeof formatKey !== 'string' || !formatKey.trim()) {
      return res.status(400).json({ error: 'Missing formatKey (required: "excel", "csv", "json", or "text")' });
    }

    const validObjectTypes = ['project', 'milestone'];
    const validFormatKeys = ['excel', 'csv', 'json', 'text'];

    if (!validObjectTypes.includes(objectType.trim())) {
      return res.status(400).json({ error: 'Invalid objectType. Must be "project" or "milestone"' });
    }

    if (!validFormatKeys.includes(formatKey.trim())) {
      return res.status(400).json({ error: 'Invalid formatKey. Must be "excel", "csv", "json", or "text"' });
    }

    const client = new ConduitClient(host, token);

    const params: Record<string, any> = {
      objectType: objectType.trim(),
      formatKey: formatKey.trim(),
    };

    if (typeof allMilestone === 'string' && allMilestone.trim()) {
      params.allMilestone = allMilestone.trim();
    }

    const result = await client.call<any>('schedule.export.all', params);

    return res.status(200).json({
      objectType: objectType.trim(),
      formatKey: formatKey.trim(),
      allMilestone: typeof allMilestone === 'string' && allMilestone.trim() ? allMilestone.trim() : undefined,
      result,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to export schedule data' });
  }
}
