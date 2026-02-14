import { useState, useEffect, useCallback } from 'react';
import { httpGet, httpPost } from '@/lib/httpClient';
import type { AiTeamRules } from '@/lib/gerrit/ai-types';
import { DEFAULT_TEAM_RULES } from '@/lib/gerrit/ai-types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  Settings2,
  Save,
  Loader2,
  Plus,
  X,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';

export function AiRulesPanel() {
  const [rules, setRules] = useState<AiTeamRules>({ ...DEFAULT_TEAM_RULES });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  // New item inputs
  const [newFocus, setNewFocus] = useState('');
  const [newIgnore, setNewIgnore] = useState('');

  useEffect(() => {
    httpGet<AiTeamRules>('/api/gerrit/ai-rules')
      .then((data) => setRules({ ...DEFAULT_TEAM_RULES, ...data }))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const saveRules = useCallback(async () => {
    setSaving(true);
    try {
      await httpPost('/api/gerrit/ai-rules', rules);
      toast.success('AI 规则已保存');
    } catch (err: any) {
      toast.error('保存失败: ' + (err.message || ''));
    } finally {
      setSaving(false);
    }
  }, [rules]);

  const addFocusArea = () => {
    if (!newFocus.trim()) return;
    setRules((prev) => ({ ...prev, focusAreas: [...prev.focusAreas, newFocus.trim()] }));
    setNewFocus('');
  };

  const removeFocusArea = (idx: number) => {
    setRules((prev) => ({ ...prev, focusAreas: prev.focusAreas.filter((_, i) => i !== idx) }));
  };

  const addIgnorePattern = () => {
    if (!newIgnore.trim()) return;
    setRules((prev) => ({ ...prev, ignorePatterns: [...prev.ignorePatterns, newIgnore.trim()] }));
    setNewIgnore('');
  };

  const removeIgnorePattern = (idx: number) => {
    setRules((prev) => ({ ...prev, ignorePatterns: prev.ignorePatterns.filter((_, i) => i !== idx) }));
  };

  if (loading) return null;

  return (
    <Card className="border-slate-200/80">
      <CardContent className="p-0">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/30 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-foreground">AI 规则配置</span>
          </div>
          {isOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
        </button>

        {isOpen && (
          <div className="border-t border-border px-3 py-3 space-y-4">
            {/* Enable toggle */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-foreground">启用团队规则</span>
              <button
                onClick={() => setRules((prev) => ({ ...prev, enabled: !prev.enabled }))}
                className={cn(
                  'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
                  rules.enabled ? 'bg-primary' : 'bg-muted'
                )}
              >
                <span className={cn(
                  'inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform',
                  rules.enabled ? 'translate-x-[20px]' : 'translate-x-[2px]'
                )} />
              </button>
            </div>

            {/* Custom instructions */}
            <div>
              <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                自定义指令
              </label>
              <Textarea
                value={rules.customInstructions}
                onChange={(e) => setRules((prev) => ({ ...prev, customInstructions: e.target.value }))}
                placeholder="例如：重点检查并发安全、关注 SQL 注入风险..."
                rows={3}
                className="text-xs resize-y"
              />
            </div>

            {/* Focus areas */}
            <div>
              <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                重点关注领域
              </label>
              <div className="flex flex-wrap gap-1 mb-1.5">
                {rules.focusAreas.map((area, idx) => (
                  <Badge key={idx} variant="secondary" className="text-[10px] gap-1 pr-1">
                    {area}
                    <button onClick={() => removeFocusArea(idx)} className="hover:text-red-500">
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-1">
                <Input
                  value={newFocus}
                  onChange={(e) => setNewFocus(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addFocusArea(); } }}
                  placeholder="添加关注领域..."
                  className="text-xs h-7"
                />
                <Button variant="outline" size="sm" className="h-7 px-2 shrink-0" onClick={addFocusArea}>
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Ignore patterns */}
            <div>
              <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                忽略文件模式
              </label>
              <div className="flex flex-wrap gap-1 mb-1.5">
                {rules.ignorePatterns.map((pattern, idx) => (
                  <Badge key={idx} variant="outline" className="text-[10px] gap-1 pr-1 font-mono">
                    {pattern}
                    <button onClick={() => removeIgnorePattern(idx)} className="hover:text-red-500">
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-1">
                <Input
                  value={newIgnore}
                  onChange={(e) => setNewIgnore(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addIgnorePattern(); } }}
                  placeholder="*.md, *.json, vendor/..."
                  className="text-xs h-7 font-mono"
                />
                <Button variant="outline" size="sm" className="h-7 px-2 shrink-0" onClick={addIgnorePattern}>
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Save */}
            <div className="flex justify-end">
              <Button size="sm" className="text-xs h-7 gap-1" onClick={saveRules} disabled={saving}>
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                保存
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
