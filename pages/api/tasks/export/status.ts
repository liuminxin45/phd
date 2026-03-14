import type { NextApiRequest, NextApiResponse } from 'next';
import { getTaskExportJob } from '@/lib/tasks/export/store';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const jobId = String(req.query?.jobId || '').trim();
  if (!jobId) {
    return res.status(400).json({ error: 'Missing jobId' });
  }

  const job = getTaskExportJob(jobId);
  if (!job) {
    return res.status(404).json({ error: 'Export job not found' });
  }

  return res.status(200).json({ state: job });
}

