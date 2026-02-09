import { useState, useEffect, useCallback, useMemo } from 'react';
import { Save, Loader2, AlertCircle } from 'lucide-react';
import { httpGet, httpPost } from '@/lib/httpClient';
import { type EnvEntry, type StatusState, EMPTY_STATUS, SESSION_KEYS, SECRET_KEYS } from '@/lib/settings/types';
import { INPUT_CLASS, DISABLED_CLASS } from '@/lib/settings/styles';
import { SecretInput } from './SecretInput';
import { StatusMessage } from './StatusMessage';

/** Keys removed from the env schema — hide from UI entirely. */
const DEPRECATED_KEYS = new Set([
  'PORTAL_SESSION', 'DINNER_LOGIN_USER', 'DINNER_LOGIN_PASS', 'PHA_LOGIN_USER', 'PHA_LOGIN_PASS',
]);

const SAVE_BTN_CLASS =
  'inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-neutral-700 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors disabled:opacity-50';

export function EnvTab() {
  const [entries, setEntries] = useState<EnvEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<StatusState>(EMPTY_STATUS);

  useEffect(() => {
    (async () => {
      try {
        const data = await httpGet<{ entries: EnvEntry[] }>('/api/settings/env');
        setEntries(data.entries || []);
      } catch {
        setStatus({ message: '加载环境变量失败', type: 'error' });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const updateEntry = (index: number, value: string) => {
    setEntries((prev) => prev.map((e, i) => (i === index ? { ...e, value } : e)));
  };

  const save = useCallback(async () => {
    setSaving(true);
    setStatus(EMPTY_STATUS);
    try {
      await httpPost('/api/settings/env', { entries });
      setStatus({ message: '环境变量已保存', type: 'success' });
    } catch (err: any) {
      setStatus({ message: err.message || '保存失败', type: 'error' });
    } finally {
      setSaving(false);
    }
  }, [entries]);

  const visibleEntries = useMemo(
    () => entries
      .map((e, i) => ({ ...e, _idx: i }))
      .filter((e) => !DEPRECATED_KEYS.has(e.key)),
    [entries],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
        <span className="ml-2 text-sm text-neutral-500">加载环境变量...</span>
      </div>
    );
  }

  const renderEntryRow = (entry: EnvEntry & { _idx: number }) => {
    const isSession = SESSION_KEYS.has(entry.key);
    const isSecret = SECRET_KEYS.has(entry.key);

    return (
      <div key={entry.key} className="flex items-center gap-3">
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
              onChange={isSession ? undefined : (v) => updateEntry(entry._idx, v)}
              disabled={isSession}
              placeholder={isSession ? '自动更新' : `输入 ${entry.key}`}
            />
          ) : (
            <input
              type="text"
              value={entry.value}
              onChange={(e) => updateEntry(entry._idx, e.target.value)}
              disabled={isSession}
              readOnly={isSession}
              placeholder={isSession ? '自动更新' : `输入 ${entry.key}`}
              className={`${INPUT_CLASS} ${isSession ? DISABLED_CLASS : ''}`}
            />
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <section className="bg-white border border-neutral-200 rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-neutral-900">.env.local</h3>
            <p className="text-xs text-neutral-400 mt-0.5">本地环境变量（不提交 Git）</p>
          </div>
          <button onClick={save} disabled={saving} className={SAVE_BTN_CLASS}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            保存
          </button>
        </div>
        <div className="space-y-3">
          {visibleEntries.map((entry) => renderEntryRow(entry))}
          {visibleEntries.length === 0 && (
            <p className="text-sm text-neutral-400 text-center py-4">.env.local 文件为空</p>
          )}
        </div>
      </section>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <p className="text-sm font-medium text-amber-900 flex items-center gap-1.5 mb-1">
          <AlertCircle className="h-3.5 w-3.5" />
          注意
        </p>
        <p className="text-xs text-amber-700 leading-relaxed">
          SESSION 字段为只读，由系统在登录时自动更新。修改环境变量后，可能需要重启开发服务器才能生效。
        </p>
      </div>

      {status.message && (
        <StatusMessage message={status.message} type={status.type} />
      )}
    </div>
  );
}
