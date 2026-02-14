/**
 * Team rules persistence for AI code review.
 * Stored as a JSON file alongside llm-config.json.
 */

import fs from 'fs';
import path from 'path';
import { type AiTeamRules, DEFAULT_TEAM_RULES } from './ai-types';

const RULES_PATH = path.join(process.cwd(), 'ai-review-rules.json');

export function readTeamRules(): AiTeamRules {
  if (!fs.existsSync(RULES_PATH)) {
    return { ...DEFAULT_TEAM_RULES };
  }
  try {
    const raw = fs.readFileSync(RULES_PATH, 'utf-8');
    return { ...DEFAULT_TEAM_RULES, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_TEAM_RULES };
  }
}

export function writeTeamRules(rules: AiTeamRules): void {
  fs.writeFileSync(RULES_PATH, JSON.stringify(rules, null, 2), 'utf-8');
}
