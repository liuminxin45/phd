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

    const { id } = req.query;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid file ID' });
    }

    const client = new ConduitClient(host, token);
    
    const result = await client.call('file.search', {
      constraints: {
        ids: [parseInt(id)],
      },
    });

    if (!result.data || result.data.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    const fileData = result.data[0];

    const rawUrl = `/api/files/${fileData.id}/raw`;

    // Resolve MIME type — Phabricator often stores images as application/octet-stream
    let mimeType: string = fileData.fields.mimeType || 'application/octet-stream';
    if (mimeType === 'application/octet-stream') {
      const fileName = fileData.fields.name || '';
      const ext = fileName.toLowerCase().split('.').pop() || '';
      const mimeMap: Record<string, string> = {
        png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
        gif: 'image/gif', bmp: 'image/bmp', webp: 'image/webp',
        svg: 'image/svg+xml', ico: 'image/x-icon',
        tiff: 'image/tiff', tif: 'image/tiff',
        pdf: 'application/pdf', txt: 'text/plain',
        md: 'text/markdown', json: 'application/json',
      };
      if (mimeMap[ext]) mimeType = mimeMap[ext];
    }

    const isImage = mimeType.startsWith('image/');

    // Return file metadata with direct URL (no base64)
    res.status(200).json({
      id: fileData.id,
      phid: fileData.phid,
      name: fileData.fields.name,
      mimeType,
      size: fileData.fields.size,
      // Same-origin proxied URL (does not rely on Phabricator cookies)
      url: rawUrl,
      isImage,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch file info' });
  }
}
