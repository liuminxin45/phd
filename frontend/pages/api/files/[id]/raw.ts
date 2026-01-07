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

    const { id } = req.query;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid file ID' });
    }

    const client = new ConduitClient(host, token);

    const searchResult = await client.call('file.search', {
      constraints: {
        ids: [parseInt(id, 10)],
      },
    });

    if (!searchResult?.data || searchResult.data.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    const fileInfo = searchResult.data[0];
    const base64Data = await client.call('file.download', {
      phid: fileInfo.phid,
    });

    let mimeType = fileInfo.fields?.mimeType || 'application/octet-stream';

    if (mimeType === 'application/octet-stream') {
      const fileName = fileInfo.fields?.name || '';
      const ext = fileName.toLowerCase().split('.').pop() || '';
      const mimeMap: Record<string, string> = {
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        gif: 'image/gif',
        bmp: 'image/bmp',
        webp: 'image/webp',
        svg: 'image/svg+xml',
        ico: 'image/x-icon',
        tiff: 'image/tiff',
        tif: 'image/tiff',
        pdf: 'application/pdf',
        txt: 'text/plain',
        md: 'text/markdown',
        json: 'application/json',
      };
      if (mimeMap[ext]) {
        mimeType = mimeMap[ext];
      }
    }

    const buffer = Buffer.from(String(base64Data || ''), 'base64');

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Cache-Control', 'public, max-age=3600');

    const name = fileInfo.fields?.name;
    if (name) {
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(name)}"`);
    }

    return res.status(200).send(buffer);
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || 'Failed to fetch file' });
  }
}
