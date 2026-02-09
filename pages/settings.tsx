import { useState, useEffect, useCallback } from 'react';
import { httpGet, httpPost } from '@/lib/httpClient';
import {
  Settings,
  Bot,
  Server,
  Save,
  Loader2,
  Eye,
  EyeOff,
  RefreshCw,
  ChevronDown,
  Check,
  AlertCircle,
  Info,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface LlmConfig {
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

interface EnvEntry {
  key: string;
  value: string;
  comment?: string;
}

type TabId = 'llm' | 'env';

const TABS: { id: TabId; label: string; icon: typeof Bot }[] = [
  { id: 'llm', label: 'AI / LLM', icon: Bot },
  { id: 'env', label: '环境变量', icon: Server },
];

const SESSION_KEYS = new Set(['PHA_SESSION', 'PORTAL_SESSION', 'DINNER_SESSION']);
const SECRET_KEYS = new Set(['PHA_TOKEN', 'PHA_LOGIN_PASS', 'DINNER_LOGIN_PASS', 'PORTAL_SESSION', 'PHA_SESSION', 'DINNER_SESSION']);

// ─── Secret Input with eye toggle ────────────────────────────────────────────

function SecretInput({ value, onChange, placeholder, disabled, className }: {
  value: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={!onChange}
        className={`w-full pr-9 ${className || 'px-3 py-2 text-sm border border-neutral-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-neutral-300 transition-colors'} ${disabled ? 'bg-neutral-50 text-neutral-500 cursor-not-allowed' : ''}`}
      />
      <button
        type="button"
        onClick={() => setVisible(!visible)}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition-colors"
        tabIndex={-1}
        title={visible ? '隐藏' : '显示'}
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

// ─── Toast / Status Message ──────────────────────────────────────────────────

function StatusMessage({ message, type }: { message: string; type: 'success' | 'error' | 'info' }) {
  if (!message) return null;
  const styles = {
    success: 'bg-green-50 text-green-700 border-green-200',
    error: 'bg-red-50 text-red-700 border-red-200',
    info: 'bg-blue-50 text-blue-700 border-blue-200',
  };
  const icons = {
    success: <Check className="h-4 w-4" />,
    error: <AlertCircle className="h-4 w-4" />,
    info: <Info className="h-4 w-4" />,
  };
  return (
    <div className={`flex items-center gap-2 px-3 py-2 text-sm border rounded-lg ${styles[type]}`}>
      {icons[type]}
      {message}
    </div>
  );
}

// ─── LLM Tab ─────────────────────────────────────────────────────────────────

function LlmTab() {
  const [config, setConfig] = useState<LlmConfig>({
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
  });
  const [models, setModels] = useState<string[]>([]);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [loadingModels, setLoadingModels] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ message: string; type: 'success' | 'error' | 'info' }>({ message: '', type: 'info' });
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await httpGet<LlmConfig>('/api/settings/llm');
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
    setStatus({ message: '', type: 'info' });
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
    setStatus({ message: '', type: 'info' });
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
        <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
        <span className="ml-2 text-sm text-neutral-500">加载配置...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Connection */}
      <section className="bg-white border border-neutral-200 rounded-lg p-5">
        <h3 className="text-sm font-semibold text-neutral-900 mb-4">连接配置</h3>
        <div className="space-y-4">
          {/* Base URL */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Base URL</label>
            <input
              type="text"
              value={config.baseUrl}
              onChange={(e) => updateField('baseUrl', e.target.value)}
              placeholder="https://api.openai.com/v1"
              className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-neutral-300 transition-colors"
            />
            <p className="mt-1 text-xs text-neutral-400">OpenAI 兼容的 API 地址，如 https://api.openai.com/v1</p>
          </div>

          {/* API Key */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">API Key</label>
            <SecretInput
              value={config.apiKey}
              onChange={(v) => updateField('apiKey', v)}
              placeholder="sk-..."
            />
          </div>

          {/* Model */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Model</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <button
                  type="button"
                  onClick={() => models.length > 0 && setModelDropdownOpen(!modelDropdownOpen)}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm border border-neutral-200 rounded-lg bg-white hover:bg-neutral-50 transition-colors text-left"
                >
                  <span className={config.model ? 'text-neutral-900' : 'text-neutral-400'}>
                    {config.model || '选择模型...'}
                  </span>
                  <ChevronDown className="h-4 w-4 text-neutral-400" />
                </button>
                {modelDropdownOpen && models.length > 0 && (
                  <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {models.map((m) => (
                      <button
                        key={m}
                        onClick={() => { updateField('model', m); setModelDropdownOpen(false); }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-neutral-50 transition-colors flex items-center justify-between ${config.model === m ? 'bg-neutral-50 font-medium' : ''}`}
                      >
                        <span className="truncate">{m}</span>
                        {config.model === m && <Check className="h-3.5 w-3.5 text-neutral-500 flex-shrink-0" />}
                      </button>
                    ))}
                  </div>
                )}
                {/* Allow manual input if no models fetched */}
                {models.length === 0 && (
                  <input
                    type="text"
                    value={config.model}
                    onChange={(e) => updateField('model', e.target.value)}
                    placeholder="gpt-4o / deepseek-chat / ..."
                    className="absolute inset-0 w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-neutral-300 transition-colors"
                  />
                )}
              </div>
              <button
                onClick={fetchModels}
                disabled={loadingModels}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-neutral-700 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors disabled:opacity-50 flex-shrink-0"
                title="从 API 获取模型列表"
              >
                {loadingModels ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                获取模型
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Parameters */}
      <section className="bg-white border border-neutral-200 rounded-lg p-5">
        <h3 className="text-sm font-semibold text-neutral-900 mb-4">模型参数</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Temperature */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Temperature <span className="text-neutral-400 font-normal">({config.temperature})</span>
            </label>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={config.temperature}
              onChange={(e) => updateField('temperature', parseFloat(e.target.value))}
              className="w-full accent-neutral-900"
            />
            <div className="flex justify-between text-xs text-neutral-400 mt-0.5">
              <span>精确 (0)</span>
              <span>创意 (2)</span>
            </div>
          </div>

          {/* Max Tokens */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Max Tokens</label>
            <input
              type="number"
              min="1"
              max="128000"
              value={config.maxTokens}
              onChange={(e) => updateField('maxTokens', parseInt(e.target.value) || 4096)}
              className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-neutral-300 transition-colors"
            />
          </div>

          {/* Top P */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Top P <span className="text-neutral-400 font-normal">({config.topP})</span>
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={config.topP}
              onChange={(e) => updateField('topP', parseFloat(e.target.value))}
              className="w-full accent-neutral-900"
            />
            <div className="flex justify-between text-xs text-neutral-400 mt-0.5">
              <span>0</span>
              <span>1</span>
            </div>
          </div>

          {/* Frequency Penalty */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Frequency Penalty <span className="text-neutral-400 font-normal">({config.frequencyPenalty})</span>
            </label>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={config.frequencyPenalty}
              onChange={(e) => updateField('frequencyPenalty', parseFloat(e.target.value))}
              className="w-full accent-neutral-900"
            />
            <div className="flex justify-between text-xs text-neutral-400 mt-0.5">
              <span>0</span>
              <span>2</span>
            </div>
          </div>

          {/* Presence Penalty */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Presence Penalty <span className="text-neutral-400 font-normal">({config.presencePenalty})</span>
            </label>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={config.presencePenalty}
              onChange={(e) => updateField('presencePenalty', parseFloat(e.target.value))}
              className="w-full accent-neutral-900"
            />
            <div className="flex justify-between text-xs text-neutral-400 mt-0.5">
              <span>0</span>
              <span>2</span>
            </div>
          </div>

          {/* Stream */}
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-neutral-700">Stream</label>
            <button
              onClick={() => updateField('stream', !config.stream)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${config.stream ? 'bg-neutral-900' : 'bg-neutral-300'}`}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${config.stream ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
            </button>
            <span className="text-xs text-neutral-400">{config.stream ? '开启' : '关闭'}</span>
          </div>
        </div>
      </section>

      {/* System Prompt */}
      <section className="bg-white border border-neutral-200 rounded-lg p-5">
        <h3 className="text-sm font-semibold text-neutral-900 mb-4">System Prompt</h3>
        <textarea
          value={config.systemPrompt}
          onChange={(e) => updateField('systemPrompt', e.target.value)}
          placeholder="你是一个有帮助的AI助手..."
          rows={4}
          className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-neutral-300 transition-colors resize-y font-mono"
        />
      </section>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <StatusMessage message={status.message} type={status.type} />
        <button
          onClick={saveConfig}
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-neutral-900 rounded-lg hover:bg-neutral-800 transition-colors disabled:opacity-50 ml-auto"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? '保存中...' : '保存配置'}
        </button>
      </div>
    </div>
  );
}

// ─── Env Tab ─────────────────────────────────────────────────────────────────

function EnvTab() {
  const [envEntries, setEnvEntries] = useState<EnvEntry[]>([]);
  const [envLocalEntries, setEnvLocalEntries] = useState<EnvEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingEnv, setSavingEnv] = useState(false);
  const [savingEnvLocal, setSavingEnvLocal] = useState(false);
  const [status, setStatus] = useState<{ message: string; type: 'success' | 'error' | 'info' }>({ message: '', type: 'info' });

  useEffect(() => {
    (async () => {
      try {
        const data = await httpGet<{ env: EnvEntry[]; envLocal: EnvEntry[] }>('/api/settings/env');
        setEnvEntries(data.env || []);
        setEnvLocalEntries(data.envLocal || []);
      } catch {
        setStatus({ message: '加载环境变量失败', type: 'error' });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const updateEntry = (
    which: 'env' | 'envLocal',
    index: number,
    value: string
  ) => {
    const setter = which === 'env' ? setEnvEntries : setEnvLocalEntries;
    setter((prev) => prev.map((e, i) => (i === index ? { ...e, value } : e)));
  };

  const saveFile = useCallback(async (which: 'env' | 'envLocal') => {
    const setter = which === 'env' ? setSavingEnv : setSavingEnvLocal;
    const entries = which === 'env' ? envEntries : envLocalEntries;
    setter(true);
    setStatus({ message: '', type: 'info' });
    try {
      await httpPost('/api/settings/env', { file: which, entries });
      setStatus({ message: `${which === 'env' ? '.env' : '.env.local'} 已保存`, type: 'success' });
    } catch (err: any) {
      setStatus({ message: err.message || '保存失败', type: 'error' });
    } finally {
      setter(false);
    }
  }, [envEntries, envLocalEntries]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
        <span className="ml-2 text-sm text-neutral-500">加载环境变量...</span>
      </div>
    );
  }

  const renderEntryRow = (entry: EnvEntry, index: number, which: 'env' | 'envLocal') => {
    const isSession = SESSION_KEYS.has(entry.key);
    const isSecret = SECRET_KEYS.has(entry.key);

    return (
      <div key={`${which}-${index}`} className="flex items-center gap-3">
        <label className="w-48 flex-shrink-0 text-sm font-mono text-neutral-700 truncate" title={entry.key}>
          {entry.key}
          {isSession && (
            <span className="ml-1.5 text-xs text-neutral-400 font-sans">(只读)</span>
          )}
        </label>
        <div className="flex-1">
          {isSecret ? (
            <SecretInput
              value={entry.value}
              onChange={isSession ? undefined : (v) => updateEntry(which, index, v)}
              disabled={isSession}
              placeholder={isSession ? '自动更新' : `输入 ${entry.key}`}
            />
          ) : (
            <input
              type="text"
              value={entry.value}
              onChange={(e) => updateEntry(which, index, e.target.value)}
              disabled={isSession}
              readOnly={isSession}
              placeholder={isSession ? '自动更新' : `输入 ${entry.key}`}
              className={`w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-neutral-300 transition-colors ${isSession ? 'bg-neutral-50 text-neutral-500 cursor-not-allowed' : ''}`}
            />
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* .env */}
      <section className="bg-white border border-neutral-200 rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-neutral-900">.env</h3>
            <p className="text-xs text-neutral-400 mt-0.5">基础环境变量（会被 .env.local 覆盖）</p>
          </div>
          <button
            onClick={() => saveFile('env')}
            disabled={savingEnv}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-neutral-700 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors disabled:opacity-50"
          >
            {savingEnv ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            保存
          </button>
        </div>
        <div className="space-y-3">
          {envEntries.map((entry, i) => renderEntryRow(entry, i, 'env'))}
          {envEntries.length === 0 && (
            <p className="text-sm text-neutral-400 text-center py-4">.env 文件为空</p>
          )}
        </div>
      </section>

      {/* .env.local */}
      <section className="bg-white border border-neutral-200 rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-neutral-900">.env.local</h3>
            <p className="text-xs text-neutral-400 mt-0.5">本地环境变量（优先级最高，不提交 Git）</p>
          </div>
          <button
            onClick={() => saveFile('envLocal')}
            disabled={savingEnvLocal}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-neutral-700 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors disabled:opacity-50"
          >
            {savingEnvLocal ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            保存
          </button>
        </div>
        <div className="space-y-3">
          {envLocalEntries.map((entry, i) => renderEntryRow(entry, i, 'envLocal'))}
          {envLocalEntries.length === 0 && (
            <p className="text-sm text-neutral-400 text-center py-4">.env.local 文件为空</p>
          )}
        </div>
      </section>

      {/* Info */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <p className="text-sm font-medium text-amber-900 flex items-center gap-1.5 mb-1">
          <AlertCircle className="h-3.5 w-3.5" />
          注意
        </p>
        <p className="text-xs text-amber-700 leading-relaxed">
          SESSION 字段为只读，由系统在登录时自动更新。修改环境变量后，可能需要重启开发服务器才能生效。
        </p>
      </div>

      {/* Status */}
      {status.message && (
        <StatusMessage message={status.message} type={status.type} />
      )}
    </div>
  );
}

// ─── Settings Page ───────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('llm');

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Page Header */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-neutral-100 flex items-center justify-center">
            <Settings className="h-5 w-5 text-neutral-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-neutral-900">设置</h1>
            <p className="text-sm text-neutral-500">管理 AI 模型配置与环境变量</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-neutral-200">
          <nav className="flex gap-1">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                    isActive
                      ? 'border-neutral-900 text-neutral-900'
                      : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'llm' && <LlmTab />}
        {activeTab === 'env' && <EnvTab />}
      </div>
    </div>
  );
}
