import type { NextApiRequest, NextApiResponse } from 'next';
import { createTaskExportJob } from '@/lib/tasks/export/store';
import { runTaskExportJob } from '@/lib/tasks/export/pipeline';
import type { TaskExportOptions, TaskExportScope } from '@/lib/tasks/export/types';

function normalizeScope(raw: unknown): TaskExportScope {
  if (raw === 'year' || raw === 'quarter' || raw === 'all') return raw;
  return 'all';
}

function normalizeOptions(raw: unknown): TaskExportOptions {
  const input = (raw && typeof raw === 'object') ? (raw as Record<string, unknown>) : {};
  const includeTitle = input.includeTitle !== false;
  const includeDescription = input.includeDescription !== false;
  const includeComments = input.includeComments !== false;
  const descriptionUseLlm = includeDescription && input.descriptionUseLlm === true;
  const commentsUseLlm = includeComments && input.commentsUseLlm !== false;
  return {
    includeTitle,
    includeDescription,
    descriptionUseLlm,
    includeComments,
    commentsUseLlm,
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const assigneePHID = String(req.body?.assigneePHID || '').trim();
    const assigneeName = String(req.body?.assigneeName || '').trim() || undefined;
    const scope = normalizeScope(req.body?.scope);
    const options = normalizeOptions(req.body?.options);

    if (!assigneePHID) {
      return res.status(400).json({ error: 'Missing assigneePHID' });
    }

    const job = createTaskExportJob({
      assigneePHID,
      assigneeName,
      scope,
      options,
    });

    // Fire-and-forget background execution.
    void runTaskExportJob(job.jobId);

    return res.status(200).json({
      jobId: job.jobId,
      state: job,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to start export job';
    return res.status(500).json({ error: message });
  }
}
