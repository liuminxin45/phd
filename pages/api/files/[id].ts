import type { NextApiRequest, NextApiResponse } from 'next';
import { ConduitClient } from '@/lib/conduit/client';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

interface FileInfo {
  id: number;
  phid: string;
  fields: {
    name: string;
    dataURI: string;
    size: number;
    mimeType: string;
  };
}

async function readCachedFileInfo(cachePath: string): Promise<FileInfo | null> {
  try {
    const raw = await fs.readFile(cachePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (typeof parsed.id !== 'number') return null;
    if (!parsed.fields || typeof parsed.fields !== 'object') return null;
    if (typeof parsed.fields.dataURI !== 'string') return null;
    return parsed as FileInfo;
  } catch {
    return null;
  }
}

async function writeCachedFileInfo(cachePath: string, info: FileInfo): Promise<void> {
  const dir = path.dirname(cachePath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(cachePath, JSON.stringify(info), 'utf8');
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<FileInfo | { error: string }>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'File ID is required' });
  }

  try {
    const cacheDir = process.env.PHABDASH_FILE_CACHE_DIR ||
      (process.env.NODE_ENV === 'production'
        ? path.join(process.cwd(), '.cache', 'phabdash', 'files')
        : path.join(os.homedir(), 'cache', 'phabdash', 'files'));
    const cachePath = path.join(cacheDir, `${id}.json`);

    const cached = await readCachedFileInfo(cachePath);
    if (cached) {
      return res.status(200).json(cached);
    }

    const host = process.env.PHA_HOST;
    const token = process.env.PHA_TOKEN;

    if (!host || !token) {
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const client = new ConduitClient(host, token);
    
    // First, get file info
    const searchResult = await client.call('file.search', {
      constraints: {
        ids: [parseInt(id, 10)],
      },
    });

    if (!searchResult.data || searchResult.data.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    const fileInfo = searchResult.data[0];
    // Then download the file content
    const downloadResult = await client.call('file.download', {
      phid: fileInfo.phid,
    });

    // Convert base64 to data URI
    const base64Data = downloadResult;
    let mimeType = fileInfo.fields.mimeType || 'application/octet-stream';
    
    // If MIME type is generic, try to detect from file extension
    if (mimeType === 'application/octet-stream') {
      const fileName = fileInfo.fields.name || '';
      const ext = fileName.toLowerCase().split('.').pop() || '';
      const mimeMap: Record<string, string> = {
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'gif': 'image/gif',
        'bmp': 'image/bmp',
        'webp': 'image/webp',
        'svg': 'image/svg+xml',
        'ico': 'image/x-icon',
        'tiff': 'image/tiff',
        'tif': 'image/tiff',
        'pdf': 'application/pdf',
        'txt': 'text/plain',
        'md': 'text/markdown',
        'json': 'application/json',
      };
      if (mimeMap[ext]) {
        mimeType = mimeMap[ext];
      }
    }
    
    const dataURI = `data:${mimeType};base64,${base64Data}`;
    
    const response: FileInfo = {
      id: fileInfo.id,
      phid: fileInfo.phid,
      fields: {
        name: fileInfo.fields.name,
        dataURI,
        size: fileInfo.fields.size,
        mimeType,
      },
    };

    await writeCachedFileInfo(cachePath, response);

    res.status(200).json(response);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
