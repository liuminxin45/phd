import { useState, useEffect, useCallback, useMemo } from 'react';
import { Save, Loader2, AlertCircle, Link2 } from 'lucide-react';
import { httpDelete, httpGet, httpPost } from '@/lib/httpClient';
import { type EnvEntry, SESSION_KEYS, SECRET_KEYS } from '@/lib/settings/types';
import { SecretInput } from './SecretInput';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from '@/lib/toast';

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
      if (data.envLocalCreated) {
        toast.info('检测到缺失 .env.local，已自动创建模板。请先填写必填项并点击保存。');
      } else if (data.needsSetup) {
        toast.info('当前环境变量尚未配置完整，请补全必填项后保存。');
      }
      const loadWarning = data.warnings?.[0];
      if (loadWarning) {
        toast.info(`部分自动刷新未完成：${loadWarning}`);
      }
      await loadBlogBindingStatus();
    } catch {
      toast.error('加载环境变量失败');
    } finally {
      setLoading(false);
    }
  }, [loadBlogBindingStatus]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const updateEntry = (index: number, value: string) => {
    setEntries((prev) => prev.map((e, i) => (i === index ? { ...e, value } : e)));
  };

  const save = useCallback(async () => {
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
      toast.success('环境变量已保存');
    } catch (err: any) {
      toast.error(err.message || '保存失败');
    } finally {
      setSaving(false);
    }
  }, [entries]);

  const autoBindCurrentUserBlog = useCallback(async () => {
    setBindingBlog(true);
    try {
      const result = await httpPost<{ message?: string; data?: { resolvedBlog?: { id?: number; name?: string } } }>('/api/settings/auto-bind-blog', {});
      await loadEntries();
      const blogName = result?.data?.resolvedBlog?.name || '目标博客';
      const blogId = result?.data?.resolvedBlog?.id;
      toast.success(`${result?.message || '自动绑定成功'} ${blogId ? `(${blogName} #${blogId})` : `(${blogName})`}`);
    } catch (err: any) {
      toast.error(err.message || '自动绑定失败');
    } finally {
      setBindingBlog(false);
    }
  }, [loadEntries]);

  const unbindCurrentUserBlog = useCallback(async () => {
    setUnbindingBlog(true);
    try {
      const result = await httpDelete<{ message?: string }>('/api/settings/auto-bind-blog');
      await loadEntries();
      toast.success(result?.message || '已解除博客绑定');
    } catch (err: any) {
      toast.error(err.message || '解除绑定失败');
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
        <span className="ml-2 text-sm text-muted-foreground">加载环境变量...</span>
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
              disabled={isSession}
              placeholder={isSession ? '自动更新' : `输入 ${entry.key}`}
            />
          ) : (
            <Input
              type="text"
              value={entry.value}
              onChange={(e) => updateEntry(entry._idx, e.target.value)}
              disabled={isSession}
              readOnly={isSession}
              placeholder={isSession ? '自动更新' : `输入 ${entry.key}`}
              className={isSession ? "bg-muted text-muted-foreground cursor-not-allowed" : ""}
            />
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">.env.local</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                本地环境变量（不提交 Git）
                {blogBound && boundBlogLabel ? ` · 已绑定：${boundBlogLabel}` : ' · 未绑定博客'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={autoBindCurrentUserBlog} disabled={bindingBlog || saving || unbindingBlog || blogBound} variant="outline" className="gap-1.5">
                {bindingBlog ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
                绑定博客
              </Button>
              <Button onClick={unbindCurrentUserBlog} disabled={unbindingBlog || saving || bindingBlog || !blogBound} variant="outline" className="gap-1.5">
                {unbindingBlog ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
                解除绑定
              </Button>
              <Button onClick={save} disabled={saving || bindingBlog || unbindingBlog} className="gap-1.5">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                保存
              </Button>
            </div>
          </div>
          <div className="space-y-3">
            {visibleEntries.map((entry) => renderEntryRow(entry))}
            {visibleEntries.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">.env.local 文件为空</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Alert variant="default" className="bg-amber-50 border-amber-200 text-amber-900">
        <AlertCircle className="h-4 w-4 text-amber-900" />
        <AlertTitle className="text-amber-900">注意</AlertTitle>
        <AlertDescription className="text-amber-700">
          部分环境变量已隐藏并由系统自动维护（如会话信息、固定地址与 PHA_USER）。修改环境变量后，可能需要重启开发服务器才能生效。
        </AlertDescription>
      </Alert>
    </div>
  );
}
