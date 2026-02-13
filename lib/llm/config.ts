import fs from 'fs';
import path from 'path';
import { type LlmConfig, DEFAULT_LLM_CONFIG } from '@/lib/settings/types';

export const LLM_CONFIG_PATH = path.join(process.cwd(), 'llm-config.json');

export function readLlmConfig(): LlmConfig {
  if (!fs.existsSync(LLM_CONFIG_PATH)) {
    return { ...DEFAULT_LLM_CONFIG };
  }
  try {
    const raw = fs.readFileSync(LLM_CONFIG_PATH, 'utf-8');
    return { ...DEFAULT_LLM_CONFIG, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_LLM_CONFIG };
  }
}

export function writeLlmConfig(config: LlmConfig): void {
  fs.writeFileSync(LLM_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}
