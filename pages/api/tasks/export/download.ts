import fs from 'fs';
import type { NextApiRequest, NextApiResponse } from 'next';
import { getTaskExportJob } from '@/lib/tasks/export/store';

type ExportFormat = 'json' | 'md';

function normalizeFormat(raw: unknown): ExportFormat | null {
  if (raw === 'json' || raw === 'md') return raw;
  return null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const jobId = String(req.query?.jobId || '').trim();
  const format = normalizeFormat(req.query?.format);

  if (!jobId) {
    return res.status(400).json({ error: 'Missing jobId' });
  }
  if (!format) {
    return res.status(400).json({ error: 'Invalid format, expected json|md' });
  }

  const job = getTaskExportJob(jobId);
  if (!job) {
    return res.status(404).json({ error: 'Export job not found' });
  }
  if (job.status !== 'done' || !job.files) {
    return res.status(409).json({ error: 'Export job is not completed yet' });
  }

  const filePath = format === 'json' ? job.files.jsonFilePath : job.files.markdownFilePath;
  const fileName = format === 'json' ? job.files.jsonFileName : job.files.markdownFileName;

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Export file not found' });
  }

  const buffer = fs.readFileSync(filePath);
  const contentType = format === 'json' ? 'application/json; charset=utf-8' : 'text/markdown; charset=utf-8';
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).send(buffer);
}

