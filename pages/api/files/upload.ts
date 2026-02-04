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

    const { data_base64, name } = req.body;

    if (!data_base64 || !name) {
      return res.status(400).json({ error: 'Missing file data or name' });
    }

    const client = new ConduitClient(host, token);

    // Upload to Phabricator - returns PHID
    const uploadResult = await client.call('file.upload', {
      data_base64,
      name,
    });

    const filePHID = uploadResult as string;

    // Get file info to extract numeric ID
    const fileInfo = await client.call('file.search', {
      constraints: {
        phids: [filePHID],
      },
    });

    if (!fileInfo.data || fileInfo.data.length === 0) {
      throw new Error('Failed to get file info after upload');
    }

    const fileId = fileInfo.data[0].id;

    res.status(200).json({
      fileId: String(fileId),
      fileName: name,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
