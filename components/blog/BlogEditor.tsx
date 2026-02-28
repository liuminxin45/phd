import { useEffect, useRef, useState, useCallback } from 'react';
import {
  User,
  Calendar,
  ArrowLeft,
  Save,
  Send,
  X,
  Info,
  Tag,
  Check,
  Loader2,
  Search,
} from 'lucide-react';
import { CATEGORIES, getLastWeekRange } from '@/lib/blog/helpers';
import type { ApiBlogPost } from '@/lib/blog/types';
import { httpGet, httpPost } from '@/lib/httpClient';
import { AiBlogWriter } from './AiBlogWriter';
import { AiReportWriter } from './AiReportWriter';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { RemarkupEditor } from '@/components/ui/RemarkupEditor';
import { cn } from '@/lib/utils';

const REPORT_PROJECT_PHID = 'PHID-PROJ-5r2wcb3ptiy7lmdawmbg';
const REPORT_PROJECT_NAME = '工作周报/日报';

function handlePublishErrorWithBindingGuide(rawMessage: string | undefined): boolean {
  const msg = rawMessage || '';
  const needBinding = msg.includes('BLOG_NOT_BOUND') || msg.includes('绑定博客') || msg.includes('未在 BLOG_PHID_MAP');
  if (!needBinding) return false;

  toast.error('当前账号尚未绑定博客，正在跳转到“设置 -> 环境变量”执行绑定。');
  if (typeof window !== 'undefined') {
    window.setTimeout(() => {
      window.location.href = '/settings';
    }, 500);
  }
  return true;
}

interface BlogTagItem {
  phid: string;
  name: string;
  slug?: string;
}

interface ProjectSearchResult {
  phid: string;
  fields: {
    name: string;
    slug: string;
  };
}

function BlogTagSelector({
  selected,
  onChange,
  placeholder,
}: {
  selected: BlogTagItem[];
  onChange: (items: BlogTagItem[]) => void;
  placeholder?: string;
}) {
  const [inputValue, setInputValue] = useState('');
  const [searchResults, setSearchResults] = useState<ProjectSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const query = inputValue.trim();
    if (!query) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await httpGet<{ data?: ProjectSearchResult[] }>('/api/projects/search', {
          query,
          limit: 10,
        });
        const selectedPhids = new Set(selected.map((item) => item.phid));
        const items = (res.data || []).filter((item) => !selectedPhids.has(item.phid));
        setSearchResults(items);
        setShowDropdown(items.length > 0);
        setSelectedIndex(-1);
      } catch {
        setSearchResults([]);
        setShowDropdown(false);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [inputValue, selected]);

  const removeTag = (phid: string) => {
    onChange(selected.filter((item) => item.phid !== phid));
  };

  const addTag = (project: ProjectSearchResult) => {
    onChange([
      ...selected,
      { phid: project.phid, name: project.fields.name, slug: project.fields.slug },
    ]);
    setInputValue('');
    setSearchResults([]);
    setShowDropdown(false);
    setSelectedIndex(-1);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < searchResults.length - 1 ? prev + 1 : prev));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && searchResults[selectedIndex]) {
        addTag(searchResults[selectedIndex]);
      }
      return;
    }
    if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  return (
    <div className="space-y-2" ref={dropdownRef}>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((item) => (
            <Badge key={item.phid} variant="outline" className="gap-1 pr-1 font-normal bg-purple-50 text-purple-700 border-purple-200">
              <Tag className="h-3 w-3" />
              <span>{item.name}</span>
              <button
                type="button"
                onClick={() => removeTag(item.phid)}
                className="rounded-full p-0.5 hover:bg-purple-100"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder || '搜索并添加标签'}
          className="h-8 pl-8 pr-8 text-xs"
        />
        {isSearching && <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />}

        {showDropdown && searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 max-h-56 overflow-auto rounded-md border bg-popover p-1 shadow-md z-50">
            {searchResults.map((item, index) => (
              <button
                key={item.phid}
                type="button"
                onClick={() => addTag(item)}
                className={cn(
                  'w-full rounded-sm px-2 py-1.5 text-left text-xs hover:bg-accent hover:text-accent-foreground flex items-center gap-2',
                  index === selectedIndex && 'bg-accent text-accent-foreground',
                )}
              >
                <Tag className="h-3 w-3 text-purple-600" />
                <span className="truncate flex-1">{item.fields.name}</span>
                <Check className="h-3 w-3 opacity-50" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Author & Time Sidebar (shared) ──────────────────────────────────────────

function AuthorTimeSidebar() {
  return (
    <>
      <Card>
        <CardContent className="p-4">
          <p className="text-sm font-medium text-foreground mb-3">作者信息</p>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
              <User className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">当前用户</p>
              <p className="text-xs text-muted-foreground">作者（只读）</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <p className="text-sm font-medium text-foreground mb-3">发布时间</p>
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/30 p-2 rounded-md">
            <Calendar className="h-4 w-4 shrink-0" />
            <span>{new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })}</span>
            <span className="text-xs ml-auto">（当前）</span>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

// ─── CreateBlogView ──────────────────────────────────────────────────────────

export function CreateBlogView({ onBack, onPublished }: { onBack: () => void; onPublished?: () => Promise<void> | void }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedProjectTags, setSelectedProjectTags] = useState<BlogTagItem[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [draftPosts, setDraftPosts] = useState<ApiBlogPost[]>([]);
  const [loadingDrafts, setLoadingDrafts] = useState(true);
  const [editingDraftId, setEditingDraftId] = useState<number | null>(null);

  const fetchDrafts = useCallback(async () => {
    setLoadingDrafts(true);
    try {
      const res = await httpGet<{ data?: ApiBlogPost[] }>('/api/blogs/posts', {
        type: 'tech',
        status: 'draft',
        mine: 'true',
        sort: 'newest',
        limit: 100,
      });
      setDraftPosts(res.data || []);
    } catch {
      setDraftPosts([]);
    } finally {
      setLoadingDrafts(false);
    }
  }, []);

  useEffect(() => {
    fetchDrafts();
  }, [fetchDrafts]);

  const applyDraftToEditor = (draft: ApiBlogPost) => {
    setEditingDraftId(draft.id);
    setTitle(draft.title || '');
    setContent(draft.body || '');
    setSelectedCategory(draft.category || null);
    setSelectedProjectTags(
      (draft.projectPHIDs || []).map((phid, idx) => ({
        phid,
        name: draft.projectTags?.[idx] || phid,
      }))
    );
    toast.success(`已载入草稿 #${draft.id}，可继续编辑`);
  };

  const resetEditorAsNewDraft = () => {
    setEditingDraftId(null);
    setTitle('');
    setContent('');
    setSelectedCategory(null);
    setSelectedProjectTags([]);
  };

  const handlePublish = async (status: 'draft' | 'published') => {
    if (!title.trim()) {
      toast.error('请先输入博客标题');
      return;
    }
    if (!content.trim()) {
      toast.error('请先输入博客正文');
      return;
    }

    setPublishing(true);
    try {
      await httpPost('/api/blogs/publish', {
        type: 'tech',
        title,
        body: content,
        status,
        category: selectedCategory,
        projectPHIDs: selectedProjectTags.map((item) => item.phid),
        objectIdentifier: editingDraftId,
      });
      toast.success(status === 'draft' ? '博客草稿已保存' : '博客发布成功');
      await fetchDrafts();
      await onPublished?.();
      if (status === 'published') {
        resetEditorAsNewDraft();
        onBack();
      }
    } catch (err: any) {
      if (handlePublishErrorWithBindingGuide(err?.message)) {
        return;
      }
      toast.error(err.message || '发布博客失败');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="space-y-6 py-6 max-w-7xl mx-auto">
      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <Button onClick={onBack} variant="ghost" className="pl-0 hover:bg-transparent">
          <ArrowLeft className="h-4 w-4 mr-2" />
          返回博客首页
        </Button>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <AiBlogWriter onFill={(t, c) => { setTitle(t); setContent(c); }} />
          <Button variant="outline" className="flex-1 sm:flex-none" onClick={() => handlePublish('draft')} disabled={publishing}>
            <Save className="h-4 w-4 mr-2" />
            保存草稿
          </Button>
          <Button className="flex-1 sm:flex-none" onClick={() => handlePublish('published')} disabled={publishing}>
            <Send className="h-4 w-4 mr-2" />
            {publishing ? '提交中...' : '发布博客'}
          </Button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Editor */}
        <div className="flex-1 min-w-0 space-y-6">
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">我的草稿</p>
                <Button type="button" variant="outline" size="sm" onClick={resetEditorAsNewDraft}>
                  新建空白
                </Button>
              </div>

              {loadingDrafts ? (
                <div className="text-xs text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  加载草稿中...
                </div>
              ) : draftPosts.length === 0 ? (
                <p className="text-xs text-muted-foreground">暂无草稿，点击“保存草稿”后会出现在这里。</p>
              ) : (
                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {draftPosts.map((draft) => (
                    <button
                      key={draft.id}
                      type="button"
                      onClick={() => applyDraftToEditor(draft)}
                      className={cn(
                        'w-full text-left rounded-md border px-3 py-2 transition-colors',
                        editingDraftId === draft.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:bg-muted/30'
                      )}
                    >
                      <div className="text-sm font-medium text-foreground truncate">{draft.title || `未命名草稿 #${draft.id}`}</div>
                      <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                        <Calendar className="h-3 w-3" />
                        更新于 {new Date((draft.dateModified || draft.dateCreated) * 1000).toLocaleString('zh-CN')}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="relative">
            <input
              type="text"
              placeholder="请输入博客标题"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-3xl font-bold text-foreground placeholder:text-muted-foreground/50 bg-transparent border-none outline-none py-2"
            />
          </div>
          <RemarkupEditor
            value={content}
            onChange={setContent}
            placeholder="在此撰写博客正文…支持 Markdown 格式"
            minHeight="500px"
          />
        </div>

        {/* Sidebar */}
        <aside className="w-full lg:w-80 flex-shrink-0 space-y-6">
          {/* Category */}
          <Card>
            <CardContent className="p-4">
              <p className="text-sm font-medium text-foreground mb-3">分类</p>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((cat) => (
                  <Badge
                    key={cat}
                    variant={selectedCategory === cat ? 'default' : 'outline'}
                    className="cursor-pointer hover:bg-primary/20 hover:text-primary transition-colors"
                    onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                  >
                    {cat}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <p className="text-sm font-medium text-foreground mb-3">博客标签筛选器</p>
              <BlogTagSelector
                selected={selectedProjectTags}
                onChange={setSelectedProjectTags}
                placeholder="搜索项目标签（可多选）"
              />
            </CardContent>
          </Card>

          <AuthorTimeSidebar />
        </aside>
      </div>
    </div>
  );
}

// ─── CreateReportView ────────────────────────────────────────────────────────

export function CreateReportView({ onBack, onPublished }: { onBack: () => void; onPublished?: () => Promise<void> | void }) {
  const [title, setTitle] = useState(getLastWeekRange);
  const [content, setContent] = useState('');
  const [selectedProjectTags, setSelectedProjectTags] = useState<BlogTagItem[]>([
    { phid: REPORT_PROJECT_PHID, name: REPORT_PROJECT_NAME },
  ]);
  const [publishing, setPublishing] = useState(false);

  const handlePublish = async (status: 'draft' | 'published') => {
    if (!title.trim()) {
      toast.error('请先输入周报标题');
      return;
    }
    if (!content.trim()) {
      toast.error('请先输入周报正文');
      return;
    }

    setPublishing(true);
    try {
      await httpPost('/api/blogs/publish', {
        type: 'report',
        title,
        body: content,
        status,
        projectPHIDs: selectedProjectTags.map((item) => item.phid),
      });

      toast.success(status === 'draft' ? '周报草稿已保存' : '周报发布成功');
      await onPublished?.();
      onBack();
    } catch (err: any) {
      if (handlePublishErrorWithBindingGuide(err?.message)) {
        return;
      }
      toast.error(err.message || '发布周报失败');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="space-y-6 py-6 max-w-7xl mx-auto">
      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <Button onClick={onBack} variant="ghost" className="pl-0 hover:bg-transparent">
          <ArrowLeft className="h-4 w-4 mr-2" />
          返回周报列表
        </Button>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <AiReportWriter onFill={(t, c) => { setTitle(t); setContent(c); }} />
          <Button variant="outline" className="flex-1 sm:flex-none" onClick={() => handlePublish('draft')} disabled={publishing}>
            <Save className="h-4 w-4 mr-2" />
            保存草稿
          </Button>
          <Button className="flex-1 sm:flex-none" onClick={() => handlePublish('published')} disabled={publishing}>
            <Send className="h-4 w-4 mr-2" />
            {publishing ? '提交中...' : '发布博客'}
          </Button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Editor */}
        <div className="flex-1 min-w-0 space-y-6">
          <div className="relative">
            <input
              type="text"
              placeholder="请输入周报标题"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-3xl font-bold text-foreground placeholder:text-muted-foreground/50 bg-transparent border-none outline-none py-2"
            />
          </div>
          <RemarkupEditor
            value={content}
            onChange={setContent}
            placeholder="在此撰写周报正文…支持 Markdown 格式"
            minHeight="500px"
          />
        </div>

        {/* Sidebar */}
        <aside className="w-full lg:w-80 flex-shrink-0 space-y-6">
          <AuthorTimeSidebar />

          <Card>
            <CardContent className="p-4">
              <p className="text-sm font-medium text-foreground mb-3">博客标签筛选器</p>
              <BlogTagSelector
                selected={selectedProjectTags}
                onChange={setSelectedProjectTags}
                placeholder="默认已选“工作周报/日报”，可继续添加"
              />
            </CardContent>
          </Card>

          {/* Week range info */}
          <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-4">
            <p className="text-sm font-medium text-blue-900 mb-2 flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5" />
              自动填充说明
            </p>
            <p className="text-xs text-blue-700 leading-relaxed">
              标题已自动填充为最近过去的工作周（周一至周五）。如需调整日期范围，可直接编辑标题。
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
