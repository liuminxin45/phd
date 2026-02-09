import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

const CONFIG_PATH = path.join(process.cwd(), 'llm-config.json');

export interface LlmConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
  stream: boolean;
  systemPrompt: string;
}

const DEFAULT_CONFIG: LlmConfig = {
  baseUrl: '',
  apiKey: '',
  model: '',
  temperature: 0.7,
  maxTokens: 4096,
  topP: 1,
  frequencyPenalty: 0,
  presencePenalty: 0,
  stream: true,
  systemPrompt: '',
};

function readConfig(): LlmConfig {
  if (!fs.existsSync(CONFIG_PATH)) {
    return { ...DEFAULT_CONFIG };
  }
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

function writeConfig(config: LlmConfig): void {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    return res.status(200).json(readConfig());
  }

  if (req.method === 'POST') {
    try {
      const incoming = req.body as Partial<LlmConfig>;
      const current = readConfig();
      const merged: LlmConfig = { ...current, ...incoming };
      writeConfig(merged);
      return res.status(200).json({ success: true, config: merged });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Failed to save LLM config' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
