import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Loader2, AlertCircle, Link2, Link2Off } from 'lucide-react';
import { httpDelete, httpGet, httpPost } from '@/lib/httpClient';
import { type EnvEntry, SESSION_KEYS, SECRET_KEYS } from '@/lib/settings/types';
import { SecretInput } from './SecretInput';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { GlassIconButton, glassInputClass, glassSectionClass } from '@/components/ui/glass';

/** Keys removed from the env schema — hide from UI entirely. */
const DEPRECATED_KEYS = new Set([
  'PORTAL_SESSION', 'DINNER_LOGIN_USER', 'DINNER_LOGIN_PASS', 'PHA_LOGIN_USER', 'PHA_LOGIN_PASS',
]);

/** Keys that should not be edited manually in Settings UI. */
const HIDDEN_KEYS = new Set([
  ...DEPRECATED_KEYS,
  'PHA_HOST',
  'GERRIT_URL',
  'PHA_SESSION',
  'DINNER_SESSION',
  'CONTACTS_SESSION',
  'GERRIT_SESSION',
  'PHA_USER',
  'BLOG_PHID_MAP',
]);

function derivePhaUser(loginUser: string): string {
  const trimmed = loginUser.trim();
  if (!trimmed) return '';
  const suffix = '@tp-link.com.cn';
  if (trimmed.toLowerCase().endsWith(suffix)) {
    return trimmed.slice(0, -suffix.length);
  }
  return trimmed.split('@')[0] || trimmed;
}

function normalizeEnvEntries(entries: EnvEntry[]): EnvEntry[] {
  const next = [...entries];
  const loginUser = next.find((e) => e.key === 'LOGIN_USER')?.value || '';
  const derivedPhaUser = derivePhaUser(loginUser);

  if (!derivedPhaUser) {
    return next;
  }

  const phaUserIdx = next.findIndex((e) => e.key === 'PHA_USER');
  if (phaUserIdx >= 0) {
    next[phaUserIdx] = { ...next[phaUserIdx], value: derivedPhaUser };
  } else {
    next.push({ key: 'PHA_USER', value: derivedPhaUser });
  }

  return next;
}

export function EnvTab() {
  const [entries, setEntries] = useState<EnvEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bindingBlog, setBindingBlog] = useState(false);
  const [unbindingBlog, setUnbindingBlog] = useState(false);
  const [blogBound, setBlogBound] = useState(false);
  const [boundBlogLabel, setBoundBlogLabel] = useState('');
  const dirtyRef = useRef(false);
  const autosaveTimeoutRef = useRef<number | null>(null);

  const loadBlogBindingStatus = useCallback(async () => {
    try {
      const data = await httpGet<{ data?: { bound?: boolean; resolvedBlog?: { id?: number; name?: string } } }>('/api/settings/auto-bind-blog');
      const bound = Boolean(data?.data?.bound);
      setBlogBound(bound);
      const name = data?.data?.resolvedBlog?.name || '';
      const id = data?.data?.resolvedBlog?.id;
      setBoundBlogLabel(bound ? (id ? `${name} #${id}` : name) : '');
    } catch {
      setBlogBound(false);
      setBoundBlogLabel('');
    }
  }, []);

  const loadEntries = useCallback(async () => {
    try {
      const data = await httpGet<{ entries: EnvEntry[]; envLocalCreated?: boolean; needsSetup?: boolean; warnings?: string[] }>('/api/settings/env');
      setEntries(normalizeEnvEntries(data.entries || []));
      dirtyRef.current = false;
      if (data.envLocalCreated) {
        toast.info('检测到缺失 .env.local，已自动创建模板。请先填写必填项，失焦后会自动保存。');
      } else if (data.needsSetup) {
        toast.info('当前环境变量尚未配置完整，请补全必填项，失焦后会自动保存。');
      }
      const loadWarning = data.warnings?.[0];
      if (loadWarning) {
        toast.info(`部分自动刷新未完成：${loadWarning}`);
      }
      await loadBlogBindingStatus();
    } catch {
      toast.error('Failed to load environment variables');
    } finally {
      setLoading(false);
    }
  }, [loadBlogBindingStatus]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const updateEntry = (index: number, value: string) => {
    dirtyRef.current = true;
    setEntries((prev) => prev.map((e, i) => (i === index ? { ...e, value } : e)));
  };

  const save = useCallback(async (options?: { silentSuccess?: boolean; force?: boolean }) => {
    if (!options?.force && !dirtyRef.current) return;
    setSaving(true);
    try {
      const normalizedEntries = normalizeEnvEntries(entries);
      setEntries(normalizedEntries);
      const result = await httpPost<{ entries?: EnvEntry[]; warnings?: string[] }>('/api/settings/env', { entries: normalizedEntries });
      if (result.entries) {
        setEntries(normalizeEnvEntries(result.entries));
      }
      const saveWarning = result.warnings?.[0];
      if (saveWarning) {
        toast.info(`部分自动刷新未完成：${saveWarning}`);
      }
      dirtyRef.current = false;
      if (!options?.silentSuccess) {
        toast.success('Environment variables saved');
      }
    } catch (err: any) {
      toast.error(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [entries]);

  const scheduleAutoSave = useCallback(() => {
    if (autosaveTimeoutRef.current !== null) {
      window.clearTimeout(autosaveTimeoutRef.current);
    }
    autosaveTimeoutRef.current = window.setTimeout(() => {
      void save({ silentSuccess: true });
    }, 120);
  }, [save]);

  useEffect(() => {
    return () => {
      if (autosaveTimeoutRef.current !== null) {
        window.clearTimeout(autosaveTimeoutRef.current);
      }
    };
  }, []);

  const autoBindCurrentUserBlog = useCallback(async () => {
    setBindingBlog(true);
    try {
      const result = await httpPost<{ message?: string; data?: { resolvedBlog?: { id?: number; name?: string } } }>('/api/settings/auto-bind-blog', {});
      await loadEntries();
      const blogName = result?.data?.resolvedBlog?.name || '目标博客';
      const blogId = result?.data?.resolvedBlog?.id;
      toast.success(`${result?.message || 'Auto-binding succeeded'} ${blogId ? `(${blogName} #${blogId})` : `(${blogName})`}`);
    } catch (err: any) {
      toast.error(err.message || 'Auto-binding failed');
    } finally {
      setBindingBlog(false);
    }
  }, [loadEntries]);

  const unbindCurrentUserBlog = useCallback(async () => {
    setUnbindingBlog(true);
    try {
      const result = await httpDelete<{ message?: string }>('/api/settings/auto-bind-blog');
      await loadEntries();
      toast.success(result?.message || 'Blog unbound');
    } catch (err: any) {
      toast.error(err.message || 'Failed to unbind blog');
    } finally {
      setUnbindingBlog(false);
    }
  }, [loadEntries]);

  const visibleEntries = useMemo(
    () => entries
      .map((e, i) => ({ ...e, _idx: i }))
      .filter((e) => !HIDDEN_KEYS.has(e.key)),
    [entries],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading environment variables...</span>
      </div>
    );
  }

  const renderEntryRow = (entry: EnvEntry & { _idx: number }) => {
    const isSession = SESSION_KEYS.has(entry.key);
    const isSecret = SECRET_KEYS.has(entry.key);

    return (
      <div key={entry.key} className="flex items-center gap-3">
        <label className="w-48 flex-shrink-0 text-sm font-mono text-foreground truncate" title={entry.key}>
          {entry.key}
          {isSession && (
            <span className="ml-1.5 text-xs text-muted-foreground font-sans">(只读)</span>
          )}
        </label>
        <div className="flex-1">
          {isSecret ? (
            <SecretInput
              value={entry.value}
              onChange={isSession ? undefined : (v) => updateEntry(entry._idx, v)}
              onBlur={isSession ? undefined : scheduleAutoSave}
              disabled={isSession}
              placeholder={isSession ? '自动更新' : `输入 ${entry.key}`}
            />
          ) : (
            <Input
              type="text"
              value={entry.value}
              onChange={(e) => updateEntry(entry._idx, e.target.value)}
              onBlur={isSession ? undefined : scheduleAutoSave}
              disabled={isSession}
              readOnly={isSession}
              placeholder={isSession ? '自动更新' : `输入 ${entry.key}`}
              className={cn(glassInputClass, isSession && "bg-muted text-muted-foreground cursor-not-allowed")}
            />
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <Card className={cn(glassSectionClass, 'rounded-2xl border-white/60')}>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">.env.local</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Local environment variables (not committed to Git)
                {blogBound && boundBlogLabel ? ` · Bound: ${boundBlogLabel}` : ' · No blog binding'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <GlassIconButton
                onClick={autoBindCurrentUserBlog}
                disabled={bindingBlog || saving || unbindingBlog || blogBound}
                title={blogBound ? '已Bind blog' : 'Bind blog'}
                aria-label="Bind blog"
              >
                {bindingBlog ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
              </GlassIconButton>
              <GlassIconButton
                onClick={unbindCurrentUserBlog}
                disabled={unbindingBlog || saving || bindingBlog || !blogBound}
                title={!blogBound ? 'No blog binding' : 'Unbind'}
                aria-label="Unbind"
                tone="warning"
              >
                {unbindingBlog ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2Off className="h-3.5 w-3.5" />}
              </GlassIconButton>
            </div>
          </div>
          <div className="space-y-3">
            {visibleEntries.map((entry) => renderEntryRow(entry))}
            {visibleEntries.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">.env.local is empty</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Alert variant="default" className="rounded-2xl border-amber-200/70 bg-amber-50/72 text-amber-900 backdrop-blur-lg supports-[backdrop-filter]:bg-amber-50/58">
        <AlertCircle className="h-4 w-4 text-amber-900" />
        <AlertTitle className="text-amber-900">Notice</AlertTitle>
        <AlertDescription className="text-amber-700">
          Some variables are hidden and maintained automatically (session info, fixed endpoints, and PHA_USER). You may need to restart the dev server after changes.
        </AlertDescription>
      </Alert>
    </div>
  );
}
