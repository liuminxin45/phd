import type { NextApiRequest, NextApiResponse } from 'next';
import { type LlmConfig } from '@/lib/settings/types';
import { readLlmConfig, writeLlmConfig } from '@/lib/llm/config';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    return res.status(200).json(readLlmConfig());
  }

  if (req.method === 'POST') {
    try {
      const incoming = req.body as Partial<LlmConfig>;
      const current = readLlmConfig();
      const merged: LlmConfig = { ...current, ...incoming };
      writeLlmConfig(merged);
      return res.status(200).json({ success: true, config: merged });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Failed to save LLM config' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
