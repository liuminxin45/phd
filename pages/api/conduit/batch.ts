import type { NextApiRequest, NextApiResponse } from 'next';
import { ConduitClient } from '@/lib/conduit/client';

interface BatchRequestItem {
  id: string;
  method: string;
  params?: Record<string, any>;
}

interface BatchResultItem {
  id: string;
  success: boolean;
  data?: any;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<BatchResultItem[] | { error: string }>
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

    const { requests } = req.body as { requests: BatchRequestItem[] };

    if (!requests || !Array.isArray(requests) || requests.length === 0) {
      return res.status(400).json({ error: 'Missing or invalid requests array' });
    }

    if (requests.length > 20) {
      return res.status(400).json({ error: 'Maximum 20 requests per batch' });
    }

    const client = new ConduitClient(host, token);

    const results = await Promise.all(
      requests.map(async (item): Promise<BatchResultItem> => {
        try {
          const data = await client.call(item.method, item.params || {});
          return { id: item.id, success: true, data };
        } catch (error: any) {
          return { id: item.id, success: false, error: error.message };
        }
      })
    );

    res.status(200).json(results);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Batch request failed' });
  }
}
