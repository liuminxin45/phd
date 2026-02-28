import { useState, useEffect, useCallback, useRef } from 'react';
import { Save, Loader2, RefreshCw, Plus, Trash2 } from 'lucide-react';
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
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';

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
      profiles: [{ id: 'default', name: '默认配置', config: { ...DEFAULT_LLM_CONFIG, ...(raw as Partial<LlmConfig>) } }],
    };
  }

  const profiles = raw.profiles
    .map((p, idx) => {
      if (!p || typeof p !== 'object') return null;
      const item = p as Record<string, unknown>;
      const id = typeof item.id === 'string' && item.id.trim() ? item.id : `profile-${idx + 1}`;
      const name = typeof item.name === 'string' && item.name.trim() ? item.name : `配置 ${idx + 1}`;
      const cfg = (item.config && typeof item.config === 'object') ? (item.config as Record<string, unknown>) : {};
      return {
        id,
        name,
        config: { ...DEFAULT_LLM_CONFIG, ...cfg } as LlmConfig,
      };
    })
    .filter((p): p is LlmProfile => !!p);

  const safeProfiles = profiles.length > 0 ? profiles : [{ id: 'default', name: '默认配置', config: { ...DEFAULT_LLM_CONFIG } }];
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
  const [saving, setSaving] = useState(false);
  const modelBlurTimeoutRef = useRef<number | null>(null);
  const lastValidModelRef = useRef<string>('');

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
    };
  }, []);

  const fetchModels = useCallback(async () => {
    if (!config.baseUrl || !config.apiKey) {
      toast.error('请先填写 Base URL 和 API Key');
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
        toast.info('未获取到任何模型');
      } else {
        toast.success(`成功获取 ${res.models.length} 个模型`);
      }
    } catch (err: any) {
      toast.error(err.message || '获取模型列表失败');
    } finally {
      setLoadingModels(false);
    }
  }, [config.baseUrl, config.apiKey]);

  const saveConfig = useCallback(async () => {
    setSaving(true);
    try {
      if (models.length > 0 && !models.includes(config.model)) {
        toast.error('Model 必须从已获取列表中选择');
        setSaving(false);
        return;
      }
      await httpPost('/api/settings/llm', profilesConfig);
      toast.success('配置已保存');
    } catch (err: any) {
      toast.error(err.message || '保存失败');
    } finally {
      setSaving(false);
    }
  }, [config.model, models, profilesConfig]);

  const updateField = <K extends keyof LlmConfig>(key: K, value: LlmConfig[K]) => {
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
    const name = `配置 ${profilesConfig.profiles.length + 1}`;
    setProfilesConfig((prev) => ({
      activeProfileId: id,
      profiles: [...prev.profiles, { id, name, config: { ...config } }],
    }));
    setModels([]);
    toast.info('已创建新配置，请按需修改后保存');
  };

  const deleteActiveProfile = () => {
    if (profilesConfig.profiles.length <= 1) {
      toast.info('至少需要保留一套配置');
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
    setModels([]);
    toast.info('已删除当前配置，请记得保存');
  };

  const switchProfile = (profileId: string) => {
    setProfilesConfig((prev) => ({ ...prev, activeProfileId: profileId }));
    setModels([]);
    setShowModelOptions(false);
  };

  const renameActiveProfile = (name: string) => {
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
    }, 120);
  };

  if (loadingConfig) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">加载配置...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="bg-card border border-border rounded-lg p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">配置方案</h3>
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row gap-2 md:items-center">
            <div className="md:w-64">
              <Select value={profilesConfig.activeProfileId} onValueChange={switchProfile}>
                <SelectTrigger>
                  <SelectValue placeholder="选择配置" />
                </SelectTrigger>
                <SelectContent>
                  {profilesConfig.profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="button" variant="outline" onClick={createProfile} className="gap-1.5">
              <Plus className="h-4 w-4" />
              新建配置
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={deleteActiveProfile}
              disabled={profilesConfig.profiles.length <= 1}
              className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
              删除当前
            </Button>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">当前配置名称</label>
            <Input
              type="text"
              value={activeProfile?.name || ''}
              onChange={(e) => renameActiveProfile(e.target.value)}
              placeholder="例如：OpenAI 生产 / DeepSeek 备用"
            />
          </div>
        </div>
      </section>

      <section className="bg-card border border-border rounded-lg p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">连接配置</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Base URL</label>
            <Input
              type="text"
              value={config.baseUrl}
              onChange={(e) => updateField('baseUrl', e.target.value)}
              placeholder="https://api.openai.com/v1"
            />
            <p className="mt-1 text-xs text-muted-foreground">OpenAI 兼容的 API 地址，如 https://api.openai.com/v1</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">API Key</label>
            <SecretInput
              value={config.apiKey}
              onChange={(v) => updateField('apiKey', v)}
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
                />
                {showModelOptions && models.length > 0 && (
                  <div className="absolute z-20 mt-1 w-full rounded-md border border-border bg-popover shadow-md max-h-56 overflow-y-auto">
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
                      <div className="px-3 py-2 text-sm text-muted-foreground">没有匹配模型</div>
                    )}
                  </div>
                )}
              </div>
              <Button
                variant="outline"
                onClick={fetchModels}
                disabled={loadingModels}
                className="shrink-0"
                title="从 API 获取模型列表"
              >
                {loadingModels ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                获取模型
              </Button>
            </div>
            {models.length > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                仅允许使用列表中的模型。可手动输入筛选；若失焦时未选中有效模型，将自动回退到上次可用模型。
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="bg-card border border-border rounded-lg p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">模型参数</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <RangeField label="Temperature" value={config.temperature} min={0} max={2} step={0.1} labels={['精确 (0)', '创意 (2)']} onChange={(v) => updateField('temperature', v)} />

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Max Tokens</label>
            <Input
              type="number"
              min="1"
              max="128000"
              value={config.maxTokens}
              onChange={(e) => updateField('maxTokens', parseInt(e.target.value) || 4096)}
            />
          </div>

          <RangeField label="Top P" value={config.topP} min={0} max={1} step={0.05} labels={['0', '1']} onChange={(v) => updateField('topP', v)} />
          <RangeField label="Frequency Penalty" value={config.frequencyPenalty} min={0} max={2} step={0.1} labels={['0', '2']} onChange={(v) => updateField('frequencyPenalty', v)} />
          <RangeField label="Presence Penalty" value={config.presencePenalty} min={0} max={2} step={0.1} labels={['0', '2']} onChange={(v) => updateField('presencePenalty', v)} />

          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-foreground">Stream</label>
            <button
              onClick={() => updateField('stream', !config.stream)}
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
            <span className="text-xs text-muted-foreground">{config.stream ? '开启' : '关闭'}</span>
          </div>

        </div>
      </section>

      <section className="bg-card border border-border rounded-lg p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">System Prompt</h3>
        <Textarea
          value={config.systemPrompt}
          onChange={(e) => updateField('systemPrompt', e.target.value)}
          placeholder="你是一个有帮助的AI助手..."
          rows={4}
          className="resize-y font-mono"
        />
      </section>

      <div className="flex items-center justify-end">
        <Button
          onClick={saveConfig}
          disabled={saving}
          className="ml-auto"
        >
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          {saving ? '保存中...' : '保存配置'}
        </Button>
      </div>
    </div>
  );
}

/** Reusable range slider field to eliminate repetition across parameter controls. */
function RangeField({ label, value, min, max, step, labels, onChange }: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  labels: [string, string];
  onChange: (v: number) => void;
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
        className="w-full accent-primary"
      />
      <div className="flex justify-between text-xs text-muted-foreground mt-0.5">
        <span>{labels[0]}</span>
        <span>{labels[1]}</span>
      </div>
    </div>
  );
}
