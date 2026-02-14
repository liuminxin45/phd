import type { NextApiRequest, NextApiResponse } from 'next';
import { readTeamRules, writeTeamRules } from '@/lib/gerrit/ai-rules';
import type { AiTeamRules } from '@/lib/gerrit/ai-types';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    return res.status(200).json(readTeamRules());
  }

  if (req.method === 'POST') {
    try {
      const incoming = req.body as Partial<AiTeamRules>;
      const current = readTeamRules();
      const merged: AiTeamRules = { ...current, ...incoming };
      writeTeamRules(merged);
      return res.status(200).json({ success: true, rules: merged });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Failed to save rules' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
