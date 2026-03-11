import { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2, RefreshCw, Plus, Trash2 } from 'lucide-react';
import { httpGet, httpPost } from '@/lib/httpClient';
import {
  type LlmConfig,
  type LlmProfile,
  type LlmProfilesConfig,
  DEFAULT_LLM_CONFIG,
  DEFAULT_LLM_PROFILES_CONFIG,
} from '@/lib/settings/types';
import { SecretInput } from './SecretInput';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { GlassIconButton, glassInputClass, glassSectionClass } from '@/components/ui/glass';
const glassSelectContentClass = 'rounded-xl border border-white/60 bg-white/88 shadow-[0_14px_34px_rgba(15,23,42,0.16)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/72';

function normalizeProfilesConfig(payload: unknown): LlmProfilesConfig {
  if (!payload || typeof payload !== 'object') {
    return {
      activeProfileId: DEFAULT_LLM_PROFILES_CONFIG.activeProfileId,
      profiles: DEFAULT_LLM_PROFILES_CONFIG.profiles.map((p) => ({ ...p, config: { ...p.config } })),
    };
  }

  const raw = payload as Record<string, unknown>;
  if (!Array.isArray(raw.profiles)) {
    // Backward compatibility: old payload was a plain LlmConfig.
    return {
      activeProfileId: 'default',
      profiles: [{ id: 'default', name: 'Default Profile', config: { ...DEFAULT_LLM_CONFIG, ...(raw as Partial<LlmConfig>) } }],
    };
  }

  const profiles = raw.profiles
    .map((p, idx) => {
      if (!p || typeof p !== 'object') return null;
      const item = p as Record<string, unknown>;
      const id = typeof item.id === 'string' && item.id.trim() ? item.id : `profile-${idx + 1}`;
      const name = typeof item.name === 'string' && item.name.trim() ? item.name : `Profile ${idx + 1}`;
      const cfg = (item.config && typeof item.config === 'object') ? (item.config as Record<string, unknown>) : {};
      return {
        id,
        name,
        config: { ...DEFAULT_LLM_CONFIG, ...cfg } as LlmConfig,
      };
    })
    .filter((p): p is LlmProfile => !!p);

  const safeProfiles = profiles.length > 0 ? profiles : [{ id: 'default', name: 'Default Profile', config: { ...DEFAULT_LLM_CONFIG } }];
  const activeProfileIdRaw = raw.activeProfileId;
  const activeProfileId = typeof activeProfileIdRaw === 'string' && safeProfiles.some((p) => p.id === activeProfileIdRaw)
    ? activeProfileIdRaw
    : safeProfiles[0].id;

  return { activeProfileId, profiles: safeProfiles };
}

export function LlmTab() {
  const [profilesConfig, setProfilesConfig] = useState<LlmProfilesConfig>({
    activeProfileId: DEFAULT_LLM_PROFILES_CONFIG.activeProfileId,
    profiles: DEFAULT_LLM_PROFILES_CONFIG.profiles.map((p) => ({ ...p, config: { ...p.config } })),
  });
  const [models, setModels] = useState<string[]>([]);
  const [modelQuery, setModelQuery] = useState('');
  const [showModelOptions, setShowModelOptions] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [loadingModels, setLoadingModels] = useState(false);
  const modelBlurTimeoutRef = useRef<number | null>(null);
  const autosaveTimeoutRef = useRef<number | null>(null);
  const lastValidModelRef = useRef<string>('');
  const dirtyRef = useRef(false);

  const activeProfile = profilesConfig.profiles.find((p) => p.id === profilesConfig.activeProfileId) || profilesConfig.profiles[0];
  const config = activeProfile?.config || DEFAULT_LLM_CONFIG;

  useEffect(() => {
    (async () => {
      try {
        const data = await httpGet<LlmProfilesConfig | LlmConfig>('/api/settings/llm');
        setProfilesConfig(normalizeProfilesConfig(data));
      } catch {
        // use defaults
      } finally {
        setLoadingConfig(false);
      }
    })();
  }, []);

  useEffect(() => {
    setModelQuery(config.model || '');
  }, [config.model, profilesConfig.activeProfileId]);

  useEffect(() => {
    return () => {
      if (modelBlurTimeoutRef.current !== null) {
        window.clearTimeout(modelBlurTimeoutRef.current);
      }
      if (autosaveTimeoutRef.current !== null) {
        window.clearTimeout(autosaveTimeoutRef.current);
      }
    };
  }, []);

  const markDirty = () => {
    dirtyRef.current = true;
  };

  const saveConfig = useCallback(async (options?: { silentSuccess?: boolean; force?: boolean }) => {
    if (!options?.force && !dirtyRef.current) return;
    try {
      if (models.length > 0 && !models.includes(config.model)) {
        toast.error('Model must be selected from fetched list');
        return;
      }
      await httpPost('/api/settings/llm', profilesConfig);
      dirtyRef.current = false;
      if (!options?.silentSuccess) {
        toast.success('配置已保存');
      }
    } catch (err: any) {
      toast.error(err.message || 'Save failed');
    }
  }, [config.model, models, profilesConfig]);

  const scheduleAutoSave = useCallback(() => {
    if (autosaveTimeoutRef.current !== null) {
      window.clearTimeout(autosaveTimeoutRef.current);
    }
    autosaveTimeoutRef.current = window.setTimeout(() => {
      void saveConfig({ silentSuccess: true });
    }, 120);
  }, [saveConfig]);

  const fetchModels = useCallback(async () => {
    if (!config.baseUrl || !config.apiKey) {
      toast.error('Please fill Base URL and API Key first');
      return;
    }
    setLoadingModels(true);
    try {
      const res = await httpPost<{ models: string[] }>('/api/settings/models', {
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
      });
      const fetchedModels = res.models || [];
      setModels(fetchedModels);
      if (fetchedModels.includes(config.model)) {
        lastValidModelRef.current = config.model;
      }
      if (res.models.length === 0) {
        toast.info('No models returned');
      } else {
        toast.success(`Fetched ${res.models.length} models successfully`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Fetch model list失败');
    } finally {
      setLoadingModels(false);
    }
  }, [config.baseUrl, config.apiKey]);

  const updateField = <K extends keyof LlmConfig>(key: K, value: LlmConfig[K]) => {
    markDirty();
    setProfilesConfig((prev) => {
      const idx = prev.profiles.findIndex((p) => p.id === prev.activeProfileId);
      if (idx === -1) return prev;
      const nextProfiles = [...prev.profiles];
      nextProfiles[idx] = {
        ...nextProfiles[idx],
        config: {
          ...nextProfiles[idx].config,
          [key]: value,
        },
      };
      return { ...prev, profiles: nextProfiles };
    });
  };

  const createProfile = () => {
    const id = `profile-${Date.now()}`;
    const name = `Profile ${profilesConfig.profiles.length + 1}`;
    setProfilesConfig((prev) => ({
      activeProfileId: id,
      profiles: [...prev.profiles, { id, name, config: { ...config } }],
    }));
    markDirty();
    setModels([]);
    toast.info('New profile created');
  };

  const deleteActiveProfile = () => {
    if (profilesConfig.profiles.length <= 1) {
      toast.info('At least one profile must be kept');
      return;
    }
    setProfilesConfig((prev) => {
      const idx = prev.profiles.findIndex((p) => p.id === prev.activeProfileId);
      if (idx === -1) return prev;
      const nextProfiles = prev.profiles.filter((p) => p.id !== prev.activeProfileId);
      const fallback = nextProfiles[Math.max(0, idx - 1)] || nextProfiles[0];
      return {
        activeProfileId: fallback.id,
        profiles: nextProfiles,
      };
    });
    markDirty();
    setModels([]);
    toast.info('Current profile deleted');
  };

  const switchProfile = (profileId: string) => {
    markDirty();
    setProfilesConfig((prev) => ({ ...prev, activeProfileId: profileId }));
    setModels([]);
    setShowModelOptions(false);
  };

  const renameActiveProfile = (name: string) => {
    markDirty();
    setProfilesConfig((prev) => {
      const idx = prev.profiles.findIndex((p) => p.id === prev.activeProfileId);
      if (idx === -1) return prev;
      const nextProfiles = [...prev.profiles];
      nextProfiles[idx] = { ...nextProfiles[idx], name };
      return { ...prev, profiles: nextProfiles };
    });
  };

  const filteredModels = models.filter((m) => m.toLowerCase().includes(modelQuery.toLowerCase()));

  const handleModelInputChange = (value: string) => {
    setModelQuery(value);
    updateField('model', value);
    if (models.length > 0) {
      setShowModelOptions(true);
    }
  };

  const handleSelectModel = (value: string) => {
    updateField('model', value);
    setModelQuery(value);
    setShowModelOptions(false);
    lastValidModelRef.current = value;
  };

  const handleModelBlur = () => {
    if (modelBlurTimeoutRef.current !== null) {
      window.clearTimeout(modelBlurTimeoutRef.current);
    }
    modelBlurTimeoutRef.current = window.setTimeout(() => {
      if (models.length > 0 && !models.includes(config.model)) {
        const fallback = (lastValidModelRef.current && models.includes(lastValidModelRef.current))
          ? lastValidModelRef.current
          : (models[0] || '');
        updateField('model', fallback);
        setModelQuery(fallback);
      } else if (models.includes(config.model)) {
        lastValidModelRef.current = config.model;
        setModelQuery(config.model);
      }
      setShowModelOptions(false);
      scheduleAutoSave();
    }, 120);
  };

  if (loadingConfig) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading configuration...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className={cn(glassSectionClass, 'rounded-2xl p-5')}>
        <h3 className="text-sm font-semibold text-foreground mb-4">Profiles</h3>
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row gap-2 md:items-center">
            <div className="md:w-64">
              <Select value={profilesConfig.activeProfileId} onValueChange={switchProfile}>
                <SelectTrigger className={cn(glassInputClass, 'rounded-xl')} onBlur={scheduleAutoSave}>
                  <SelectValue placeholder="Select profile" />
                </SelectTrigger>
                <SelectContent className={glassSelectContentClass}>
                  {profilesConfig.profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <GlassIconButton type="button" onClick={createProfile} title="Create profile" aria-label="Create profile">
              <Plus className="h-4 w-4" />
            </GlassIconButton>
            <GlassIconButton
              type="button"
              onClick={deleteActiveProfile}
              disabled={profilesConfig.profiles.length <= 1}
              title="Delete当前配置"
              aria-label="Delete当前配置"
              tone="warning"
            >
              <Trash2 className="h-4 w-4" />
            </GlassIconButton>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Current profile name</label>
            <Input
              type="text"
              value={activeProfile?.name || ''}
              onChange={(e) => renameActiveProfile(e.target.value)}
              onBlur={scheduleAutoSave}
              placeholder="e.g. OpenAI Prod / DeepSeek Backup"
              className={glassInputClass}
            />
          </div>
        </div>
      </section>

      <section className={cn(glassSectionClass, 'rounded-2xl p-5')}>
        <h3 className="text-sm font-semibold text-foreground mb-4">Connection</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Base URL</label>
            <Input
              type="text"
              value={config.baseUrl}
              onChange={(e) => updateField('baseUrl', e.target.value)}
              onBlur={scheduleAutoSave}
              placeholder="https://api.openai.com/v1"
              className={glassInputClass}
            />
            <p className="mt-1 text-xs text-muted-foreground">OpenAI 兼容的 API 地址，如 https://api.openai.com/v1</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">API Key</label>
            <SecretInput
              value={config.apiKey}
              onChange={(v) => updateField('apiKey', v)}
              onBlur={scheduleAutoSave}
              placeholder="sk-..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Model</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type="text"
                  value={modelQuery}
                  onChange={(e) => handleModelInputChange(e.target.value)}
                  onFocus={() => models.length > 0 && setShowModelOptions(true)}
                  onBlur={handleModelBlur}
                  placeholder={models.length > 0 ? '输入模型名筛选并选择...' : 'gpt-4o / deepseek-chat / ...'}
                  className={glassInputClass}
                />
                {showModelOptions && models.length > 0 && (
                  <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-white/60 bg-white/88 shadow-[0_14px_34px_rgba(15,23,42,0.16)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/72">
                    {filteredModels.length > 0 ? (
                      filteredModels.map((m) => (
                        <button
                          type="button"
                          key={m}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleSelectModel(m);
                          }}
                          className={cn(
                            'w-full px-3 py-2 text-left text-sm hover:bg-muted/50',
                            config.model === m && 'bg-primary/10 text-primary'
                          )}
                        >
                          {m}
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-sm text-muted-foreground">No matching models</div>
                    )}
                  </div>
                )}
              </div>
              <GlassIconButton
                onClick={fetchModels}
                disabled={loadingModels}
                title="Fetch model list from API"
                aria-label="Fetch model list"
              >
                {loadingModels ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </GlassIconButton>
            </div>
            {models.length > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                Only models in the list are allowed. You can type to filter; invalid entries on blur will be rolled back.
              </p>
            )}
          </div>
        </div>
      </section>

      <section className={cn(glassSectionClass, 'rounded-2xl p-5')}>
        <h3 className="text-sm font-semibold text-foreground mb-4">Model Parameters</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <RangeField label="Temperature" value={config.temperature} min={0} max={2} step={0.1} labels={['Precise (0)', 'Creative (2)']} onChange={(v) => updateField('temperature', v)} onBlur={scheduleAutoSave} />

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Max Tokens</label>
            <Input
              type="number"
              min="1"
              max="128000"
              value={config.maxTokens}
              onChange={(e) => updateField('maxTokens', parseInt(e.target.value) || 4096)}
              onBlur={scheduleAutoSave}
              className={glassInputClass}
            />
          </div>

          <RangeField label="Top P" value={config.topP} min={0} max={1} step={0.05} labels={['0', '1']} onChange={(v) => updateField('topP', v)} onBlur={scheduleAutoSave} />
          <RangeField label="Frequency Penalty" value={config.frequencyPenalty} min={0} max={2} step={0.1} labels={['0', '2']} onChange={(v) => updateField('frequencyPenalty', v)} onBlur={scheduleAutoSave} />
          <RangeField label="Presence Penalty" value={config.presencePenalty} min={0} max={2} step={0.1} labels={['0', '2']} onChange={(v) => updateField('presencePenalty', v)} onBlur={scheduleAutoSave} />

          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-foreground">Stream</label>
            <button
              onClick={() => {
                updateField('stream', !config.stream);
                scheduleAutoSave();
              }}
              className={cn(
                "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                config.stream ? 'bg-primary' : 'bg-muted'
              )}
            >
              <span className={cn(
                "inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform",
                config.stream ? 'translate-x-[20px]' : 'translate-x-[2px]'
              )} />
            </button>
            <span className="text-xs text-muted-foreground">{config.stream ? 'On' : 'Off'}</span>
          </div>

        </div>
      </section>

      <section className={cn(glassSectionClass, 'rounded-2xl p-5')}>
        <h3 className="text-sm font-semibold text-foreground mb-4">System Prompt</h3>
        <Textarea
          value={config.systemPrompt}
          onChange={(e) => updateField('systemPrompt', e.target.value)}
          onBlur={scheduleAutoSave}
          placeholder="You are a helpful AI assistant..."
          rows={4}
          className={cn('resize-y font-mono', glassInputClass)}
        />
      </section>
    </div>
  );
}

/** Reusable range slider field to eliminate repetition across parameter controls. */
function RangeField({ label, value, min, max, step, labels, onChange, onBlur }: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  labels: [string, string];
  onChange: (v: number) => void;
  onBlur?: () => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1">
        {label} <span className="text-muted-foreground font-normal">({value})</span>
      </label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        onBlur={onBlur}
        className="w-full accent-primary"
      />
      <div className="flex justify-between text-xs text-muted-foreground mt-0.5">
        <span>{labels[0]}</span>
        <span>{labels[1]}</span>
      </div>
    </div>
  );
}
