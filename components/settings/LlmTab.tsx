import { useState, useEffect, useCallback, useRef } from 'react';
import { Save, Loader2, RefreshCw, Check } from 'lucide-react';
import { httpGet, httpPost } from '@/lib/httpClient';
import { type LlmConfig, DEFAULT_LLM_CONFIG, type StatusState, EMPTY_STATUS } from '@/lib/settings/types';
import { SecretInput } from './SecretInput';
import { StatusMessage } from './StatusMessage';
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
import { cn } from '@/lib/utils';

export function LlmTab() {
  const [config, setConfig] = useState<LlmConfig>({ ...DEFAULT_LLM_CONFIG });
  const [models, setModels] = useState<string[]>([]);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [loadingModels, setLoadingModels] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<StatusState>(EMPTY_STATUS);

  useEffect(() => {
    (async () => {
      try {
        const data = await httpGet<LlmConfig>('/api/settings/llm');
        if (!data.systemPrompt) {
          data.systemPrompt = DEFAULT_LLM_CONFIG.systemPrompt;
        }
        setConfig(data);
      } catch {
        // use defaults
      } finally {
        setLoadingConfig(false);
      }
    })();
  }, []);

  const fetchModels = useCallback(async () => {
    if (!config.baseUrl || !config.apiKey) {
      setStatus({ message: '请先填写 Base URL 和 API Key', type: 'error' });
      return;
    }
    setLoadingModels(true);
    setStatus(EMPTY_STATUS);
    try {
      const res = await httpPost<{ models: string[] }>('/api/settings/models', {
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
      });
      setModels(res.models || []);
      if (res.models.length === 0) {
        setStatus({ message: '未获取到任何模型', type: 'info' });
      } else {
        setStatus({ message: `成功获取 ${res.models.length} 个模型`, type: 'success' });
      }
    } catch (err: any) {
      setStatus({ message: err.message || '获取模型列表失败', type: 'error' });
    } finally {
      setLoadingModels(false);
    }
  }, [config.baseUrl, config.apiKey]);

  const saveConfig = useCallback(async () => {
    setSaving(true);
    setStatus(EMPTY_STATUS);
    try {
      await httpPost('/api/settings/llm', config);
      setStatus({ message: '配置已保存', type: 'success' });
    } catch (err: any) {
      setStatus({ message: err.message || '保存失败', type: 'error' });
    } finally {
      setSaving(false);
    }
  }, [config]);

  const updateField = <K extends keyof LlmConfig>(key: K, value: LlmConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
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
                {models.length > 0 ? (
                  <Select 
                    value={config.model} 
                    onValueChange={(value) => updateField('model', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择模型..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {models.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    type="text"
                    value={config.model}
                    onChange={(e) => updateField('model', e.target.value)}
                    placeholder="gpt-4o / deepseek-chat / ..."
                  />
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

      <div className="flex items-center justify-between">
        <StatusMessage message={status.message} type={status.type} />
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
