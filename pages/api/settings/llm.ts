import type { NextApiRequest, NextApiResponse } from 'next';
import {
  type LlmConfig,
  type LlmProfilesConfig,
} from '@/lib/settings/types';
import {
  readLlmProfilesConfig,
  writeLlmProfilesConfig,
} from '@/lib/llm/config';

function isProfilesPayload(value: unknown): value is Partial<LlmProfilesConfig> {
  return !!value && typeof value === 'object' && ('profiles' in (value as Record<string, unknown>) || 'activeProfileId' in (value as Record<string, unknown>));
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    return res.status(200).json(readLlmProfilesConfig());
  }

  if (req.method === 'POST') {
    try {
      const current = readLlmProfilesConfig();
      const body = req.body as unknown;

      if (isProfilesPayload(body)) {
        const incoming = body as Partial<LlmProfilesConfig>;
        const merged: LlmProfilesConfig = {
          activeProfileId: incoming.activeProfileId ?? current.activeProfileId,
          profiles: incoming.profiles ?? current.profiles,
        };
        writeLlmProfilesConfig(merged);
        return res.status(200).json({ success: true, config: readLlmProfilesConfig() });
      }

      // Backward compatibility: legacy single-profile payload.
      const incomingLegacy = body as Partial<LlmConfig>;
      const profiles = [...current.profiles];
      const activeIdx = profiles.findIndex((p) => p.id === current.activeProfileId);
      if (activeIdx >= 0) {
        profiles[activeIdx] = {
          ...profiles[activeIdx],
          config: { ...profiles[activeIdx].config, ...incomingLegacy },
        };
      }
      const mergedLegacy: LlmProfilesConfig = {
        activeProfileId: current.activeProfileId,
        profiles,
      };
      writeLlmProfilesConfig(mergedLegacy);
      return res.status(200).json({ success: true, config: readLlmProfilesConfig() });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Failed to save LLM config' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
