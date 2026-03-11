import type { NextApiRequest, NextApiResponse } from 'next';
import {
  readAiMonitorState,
  writeAiMonitorState,
  type PersistedAiMonitorState,
} from '@/lib/gerrit/ai-monitor-state';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    return res.status(200).json({ state: readAiMonitorState() });
  }

  if (req.method === 'POST') {
    const incoming = (req.body?.state || {}) as Partial<PersistedAiMonitorState>;
    const current = readAiMonitorState() || { updatedAt: new Date().toISOString() };
    const nextState = writeAiMonitorState({
      ...current,
      ...incoming,
      updatedAt: new Date().toISOString(),
    });
    return res.status(200).json({ ok: true, state: nextState });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
