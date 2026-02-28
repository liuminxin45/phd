import fs from 'fs';
import path from 'path';
import {
  type LlmConfig,
  type LlmProfilesConfig,
  DEFAULT_LLM_CONFIG,
  DEFAULT_LLM_PROFILES_CONFIG,
} from '@/lib/settings/types';

export const LLM_CONFIG_PATH = path.join(process.cwd(), 'llm-config.json');

function normalizeProfilesConfig(raw: unknown): LlmProfilesConfig {
  if (!raw || typeof raw !== 'object') {
    return {
      activeProfileId: DEFAULT_LLM_PROFILES_CONFIG.activeProfileId,
      profiles: DEFAULT_LLM_PROFILES_CONFIG.profiles.map((p) => ({ ...p, config: { ...p.config } })),
    };
  }

  const asRecord = raw as Record<string, unknown>;

  if (Array.isArray(asRecord.profiles)) {
    const profiles = asRecord.profiles
      .map((profile, idx) => {
        if (!profile || typeof profile !== 'object') return null;
        const p = profile as Record<string, unknown>;
        const id = typeof p.id === 'string' && p.id.trim() ? p.id : `profile-${idx + 1}`;
        const name = typeof p.name === 'string' && p.name.trim() ? p.name : `配置 ${idx + 1}`;
        const configRaw = (p.config && typeof p.config === 'object') ? (p.config as Record<string, unknown>) : {};
        return {
          id,
          name,
          config: { ...DEFAULT_LLM_CONFIG, ...configRaw } as LlmConfig,
        };
      })
      .filter((p): p is { id: string; name: string; config: LlmConfig } => !!p);

    const ensuredProfiles = profiles.length > 0
      ? profiles
      : [{ id: 'default', name: '默认配置', config: { ...DEFAULT_LLM_CONFIG } }];

    const activeProfileIdRaw = asRecord.activeProfileId;
    const activeProfileId = typeof activeProfileIdRaw === 'string' && ensuredProfiles.some((p) => p.id === activeProfileIdRaw)
      ? activeProfileIdRaw
      : ensuredProfiles[0].id;

    return {
      activeProfileId,
      profiles: ensuredProfiles,
    };
  }

  // Backward compatibility: old file shape is a single LlmConfig
  return {
    activeProfileId: 'default',
    profiles: [
      {
        id: 'default',
        name: '默认配置',
        config: { ...DEFAULT_LLM_CONFIG, ...(asRecord as Partial<LlmConfig>) },
      },
    ],
  };
}

export function readLlmProfilesConfig(): LlmProfilesConfig {
  if (!fs.existsSync(LLM_CONFIG_PATH)) {
    return {
      activeProfileId: DEFAULT_LLM_PROFILES_CONFIG.activeProfileId,
      profiles: DEFAULT_LLM_PROFILES_CONFIG.profiles.map((p) => ({ ...p, config: { ...p.config } })),
    };
  }

  try {
    const raw = fs.readFileSync(LLM_CONFIG_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    return normalizeProfilesConfig(parsed);
  } catch {
    return {
      activeProfileId: DEFAULT_LLM_PROFILES_CONFIG.activeProfileId,
      profiles: DEFAULT_LLM_PROFILES_CONFIG.profiles.map((p) => ({ ...p, config: { ...p.config } })),
    };
  }
}

export function writeLlmProfilesConfig(config: LlmProfilesConfig): void {
  const normalized = normalizeProfilesConfig(config);
  fs.writeFileSync(LLM_CONFIG_PATH, JSON.stringify(normalized, null, 2), 'utf-8');
}

export function readLlmConfig(): LlmConfig {
  const profilesConfig = readLlmProfilesConfig();
  const active = profilesConfig.profiles.find((p) => p.id === profilesConfig.activeProfileId) || profilesConfig.profiles[0];
  return { ...DEFAULT_LLM_CONFIG, ...(active?.config || {}) };
}

export function writeLlmConfig(config: LlmConfig): void {
  const profilesConfig = readLlmProfilesConfig();
  const idx = profilesConfig.profiles.findIndex((p) => p.id === profilesConfig.activeProfileId);
  if (idx >= 0) {
    profilesConfig.profiles[idx] = {
      ...profilesConfig.profiles[idx],
      config: { ...DEFAULT_LLM_CONFIG, ...config },
    };
  } else {
    profilesConfig.profiles.push({
      id: profilesConfig.activeProfileId || 'default',
      name: '默认配置',
      config: { ...DEFAULT_LLM_CONFIG, ...config },
    });
    if (!profilesConfig.activeProfileId) {
      profilesConfig.activeProfileId = profilesConfig.profiles[0].id;
    }
  }
  writeLlmProfilesConfig(profilesConfig);
}
