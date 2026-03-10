import { useState, useEffect, useCallback } from 'react';
import { httpGet, httpPost } from '@/lib/httpClient';
import type { AiTeamRules } from '@/lib/gerrit/ai-types';
import { DEFAULT_TEAM_RULES } from '@/lib/gerrit/ai-types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  Shield
} from 'lucide-react';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

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
      toast.success('AI 规则保存成功');
    } catch (err: any) {
      toast.error('保存规则失败: ' + (err.message || ''));
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
    <Card className="border border-border/60 shadow-none bg-card/95">
      <CardHeader className="px-4 py-3 bg-muted/[0.03] border-b border-border/30">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between group"
        >
          <div className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            <CardTitle className="text-[13px] font-medium group-hover:text-foreground transition-colors">AI 规则配置</CardTitle>
          </div>
          {isOpen ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
      </CardHeader>

      {isOpen && (
        <CardContent className="p-4 space-y-5 animate-in slide-in-from-top-2 duration-200">
          {/* Enable toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className={cn("h-4 w-4", rules.enabled ? "text-green-600" : "text-muted-foreground")} />
              <Label htmlFor="ai-rules-enabled" className="text-sm font-medium cursor-pointer">
                启用团队规则
              </Label>
            </div>
            <Switch
              id="ai-rules-enabled"
              checked={rules.enabled}
              onCheckedChange={(checked: boolean) => setRules((prev) => ({ ...prev, enabled: checked }))}
            />
          </div>

          {/* Custom instructions */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              自定义指令
            </Label>
            <Textarea
              value={rules.customInstructions}
              onChange={(e) => setRules((prev) => ({ ...prev, customInstructions: e.target.value }))}
              placeholder="例如：重点关注并发安全，检查 SQL 注入风险..."
              rows={3}
              className="text-xs resize-y min-h-[80px] shadow-none bg-muted/[0.02]"
            />
          </div>

          {/* Focus areas */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              关键关注领域
            </Label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {rules.focusAreas.map((area, idx) => (
                <Badge key={idx} variant="secondary" className="text-[10px] gap-1 pr-1 hover:bg-secondary/80">
                  {area}
                  <button onClick={() => removeFocusArea(idx)} className="hover:text-red-500 rounded-full p-0.5 hover:bg-red-50 transition-colors">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              {rules.focusAreas.length === 0 && (
                <span className="text-[10px] text-muted-foreground italic">未定义关注领域</span>
              )}
            </div>
            <div className="flex gap-2">
              <Input
                value={newFocus}
                onChange={(e) => setNewFocus(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addFocusArea(); } }}
                placeholder="添加关注领域 (例如：性能)..."
                className="text-xs h-8 shadow-none bg-muted/[0.02]"
              />
              <Button variant="outline" size="sm" className="h-8 px-2 shrink-0" onClick={addFocusArea}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Ignore patterns */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              忽略文件模式
            </Label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {rules.ignorePatterns.map((pattern, idx) => (
                <Badge key={idx} variant="outline" className="text-[10px] gap-1 pr-1 font-mono bg-muted/20">
                  {pattern}
                  <button onClick={() => removeIgnorePattern(idx)} className="hover:text-red-500 rounded-full p-0.5 hover:bg-red-50 transition-colors">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              {rules.ignorePatterns.length === 0 && (
                <span className="text-[10px] text-muted-foreground italic">未定义忽略模式</span>
              )}
            </div>
            <div className="flex gap-2">
              <Input
                value={newIgnore}
                onChange={(e) => setNewIgnore(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addIgnorePattern(); } }}
                placeholder="添加模式 (例如：*.md, vendor/)..."
                className="text-xs h-8 font-mono shadow-none bg-muted/[0.02]"
              />
              <Button variant="outline" size="sm" className="h-8 px-2 shrink-0" onClick={addIgnorePattern}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Save */}
          <div className="flex justify-end pt-2">
            <Button size="sm" className="text-xs h-8 gap-1.5" onClick={saveRules} disabled={saving}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              保存配置
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
