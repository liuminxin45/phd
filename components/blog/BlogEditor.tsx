import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  Save,
  Send,
  X,
  Tag,
  Check,
  Loader2,
  Search,
  FileText,
} from 'lucide-react';
import { getLastWeekRange } from '@/lib/blog/helpers';
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
import { GlassIconButton, GlassPanel, glassToolbarClass } from '@/components/ui/glass';
import { cn } from '@/lib/utils';

const REPORT_PROJECT_PHID = 'PHID-PROJ-5r2wcb3ptiy7lmdawmbg';
const REPORT_PROJECT_NAME = '工作周报';

function handlePublishErrorWithBindingGuide(rawMessage: string | undefined): boolean {
  const msg = rawMessage || '';
  const needBinding = msg.includes('BLOG_NOT_BOUND') || msg.includes('BLOG_PHID_MAP');
  if (!needBinding) return false;

  toast.error('Current account is not blog-bound. Redirecting to Settings -> Environment.');
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
  const dropdownListRef = useRef<HTMLDivElement>(null);
  const inputWrapperRef = useRef<HTMLDivElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: 0,
  });

  const updateDropdownPosition = useCallback(() => {
    if (!inputWrapperRef.current) return;
    const rect = inputWrapperRef.current.getBoundingClientRect();
    setDropdownStyle({
      top: rect.bottom + 6,
      left: rect.left,
      width: rect.width,
    });
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedInsideInput = !!(dropdownRef.current && dropdownRef.current.contains(target));
      const clickedInsideDropdown = !!(dropdownListRef.current && dropdownListRef.current.contains(target));
      if (!clickedInsideInput && !clickedInsideDropdown) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!showDropdown) return;
    updateDropdownPosition();
    const onWindowChange = () => updateDropdownPosition();
    window.addEventListener('resize', onWindowChange);
    window.addEventListener('scroll', onWindowChange, true);
    return () => {
      window.removeEventListener('resize', onWindowChange);
      window.removeEventListener('scroll', onWindowChange, true);
    };
  }, [showDropdown, updateDropdownPosition]);

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
            <Badge key={item.phid} variant="outline" className="gap-1 pr-1 font-normal rounded-full border border-white/65 bg-white/72 text-slate-700 backdrop-blur-md">
              <Tag className="h-3 w-3" />
              <span>{item.name}</span>
              <button
                type="button"
                onClick={() => removeTag(item.phid)}
                className="rounded-full p-0.5 transition-colors hover:bg-white/80"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <div ref={inputWrapperRef} className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder !== undefined ? placeholder : 'Search and add tags'}
          className="glass-input h-9 rounded-xl border-white/60 bg-white/70 pl-8 pr-8 text-xs shadow-none focus-visible:ring-0 focus-visible:outline-none"
        />
        {isSearching && <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      </div>

      {showDropdown && searchResults.length > 0 && typeof window !== 'undefined' && createPortal(
        <div
          ref={dropdownListRef}
          style={{
            position: 'fixed',
            top: `${dropdownStyle.top}px`,
            left: `${dropdownStyle.left}px`,
            width: `${dropdownStyle.width}px`,
            zIndex: 9999,
          }}
          className="max-h-56 overflow-auto rounded-xl border border-white/65 bg-white/88 p-1 shadow-[0_16px_36px_rgba(15,23,42,0.2)] backdrop-blur-2xl"
        >
          {searchResults.map((item, index) => (
            <button
              key={item.phid}
              type="button"
              onClick={() => addTag(item)}
              className={cn(
                'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors hover:bg-white/75',
                index === selectedIndex && 'bg-white/82',
              )}
            >
              <Tag className="h-3 w-3 text-purple-600" />
              <span className="truncate flex-1">{item.fields.name}</span>
              <Check className="h-3 w-3 opacity-50" />
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}

function EditorTopBar({
  onBack,
  actions,
}: {
  onBack: () => void;
  actions: React.ReactNode;
}) {
  return (
    <div className={cn(glassToolbarClass, 'flex items-center justify-between rounded-2xl px-4 py-3 md:px-5')}>
      <Button
        onClick={onBack}
        variant="ghost"
        size="icon"
        className="h-9 w-9 rounded-xl border border-white/45 bg-white/42 text-slate-700 shadow-[0_10px_24px_rgba(15,23,42,0.12)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/28 transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-200/80 hover:bg-white/66 hover:text-slate-900 hover:shadow-[0_14px_30px_rgba(15,23,42,0.16)]"
        aria-label="Back"
      >
        <ArrowLeft className="h-4 w-4" />
      </Button>
      <div className="flex items-center gap-2">{actions}</div>
    </div>
  );
}

function EditorTitleBlock({
  title,
  setTitle,
  titlePlaceholder,
  selectedProjectTags,
  setSelectedProjectTags,
  tagPlaceholder,
  showTagHelper = true,
}: {
  title: string;
  setTitle: (value: string) => void;
  titlePlaceholder: string;
  selectedProjectTags: BlogTagItem[];
  setSelectedProjectTags: (items: BlogTagItem[]) => void;
  tagPlaceholder: string;
  showTagHelper?: boolean;
}) {
  return (
    <GlassPanel className="rounded-[28px] border border-white/60 bg-white/72 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.10)] backdrop-blur-2xl supports-[backdrop-filter]:bg-white/56 md:p-6">
      <div className="space-y-5">
        <div className="relative">
          <input
            type="text"
            placeholder={titlePlaceholder}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border-none bg-transparent py-1 text-3xl font-semibold tracking-tight text-slate-900 outline-none placeholder:text-slate-400 md:text-4xl"
          />
        </div>
        <div className="rounded-2xl border border-white/60 bg-white/65 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/60 bg-white/72 text-sky-700">
              <Tag className="h-3.5 w-3.5" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900">Blog Tag Selector</p>
              {showTagHelper && (
                <p className="text-xs text-slate-500">Attach one or more related projects for better context.</p>
              )}
            </div>
          </div>
          <BlogTagSelector
            selected={selectedProjectTags}
            onChange={setSelectedProjectTags}
            placeholder={tagPlaceholder}
          />
        </div>
      </div>
    </GlassPanel>
  );
}

function DraftPanel({
  loadingDrafts,
  draftPosts,
  editingDraftId,
  onReset,
  onApplyDraft,
}: {
  loadingDrafts: boolean;
  draftPosts: ApiBlogPost[];
  editingDraftId: number | null;
  onReset: () => void;
  onApplyDraft: (draft: ApiBlogPost) => void;
}) {
  return (
    <GlassPanel className="rounded-[28px] border border-white/60 bg-white/72 p-5 shadow-[0_16px_36px_rgba(15,23,42,0.10)] backdrop-blur-2xl supports-[backdrop-filter]:bg-white/56">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">My Drafts</h2>
            <p className="text-xs text-slate-500">Continue editing from a previous draft or start fresh.</p>
          </div>
          <GlassIconButton onClick={onReset} tone="primary" tooltip="New Draft" aria-label="New Draft">
            <FileText className="h-3.5 w-3.5" />
          </GlassIconButton>
        </div>

        {loadingDrafts ? (
          <div className="flex items-center gap-2 rounded-2xl border border-white/55 bg-white/60 px-3 py-4 text-xs text-slate-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading drafts...
          </div>
        ) : draftPosts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/60 bg-white/54 px-3 py-5 text-xs text-slate-500">
            No drafts yet. Save once and it will appear here.
          </div>
        ) : (
          <div className="grid gap-2 min-w-0">
            {draftPosts.map((draft) => (
              <button
                key={draft.id}
                type="button"
                onClick={() => onApplyDraft(draft)}
                className={cn(
                  'w-full max-w-full min-w-0 rounded-2xl border px-4 py-3 text-left transition-all duration-200 overflow-hidden',
                  editingDraftId === draft.id
                    ? 'border-sky-200/90 bg-sky-50/76 shadow-[0_12px_22px_rgba(14,116,144,0.10)]'
                    : 'border-white/55 bg-white/58 hover:-translate-y-0.5 hover:border-sky-200/70 hover:bg-white/80',
                )}
              >
                <div className="max-w-full whitespace-normal break-all text-sm font-medium leading-5 text-slate-900">
                  {draft.title || `Untitled Draft #${draft.id}`}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Updated at {new Date((draft.dateModified || draft.dateCreated) * 1000).toLocaleString('en-US')}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </GlassPanel>
  );
}

// ─── CreateBlogView ──────────────────────────────────────────────────────────

export function CreateBlogView({ onBack, onPublished }: { onBack: () => void; onPublished?: () => Promise<void> | void }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
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
    setSelectedProjectTags(
      (draft.projectPHIDs || []).map((phid, idx) => ({
        phid,
        name: draft.projectTags?.[idx] || phid,
      }))
    );
    toast.success(`Draft #${draft.id} loaded`);
  };

  const resetEditorAsNewDraft = () => {
    setEditingDraftId(null);
    setTitle('');
    setContent('');
    setSelectedProjectTags([]);
  };

  const handlePublish = async (status: 'draft' | 'published') => {
    if (!title.trim()) {
      toast.error('Please enter a title first');
      return;
    }
    if (!content.trim()) {
      toast.error('Please enter the blog content first');
      return;
    }

    setPublishing(true);
    try {
      await httpPost('/api/blogs/publish', {
        type: 'tech',
        title,
        body: content,
        status,
        projectPHIDs: selectedProjectTags.map((item) => item.phid),
        objectIdentifier: editingDraftId,
      });
      toast.success(status === 'draft' ? 'Draft saved' : 'Blog published');
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
      toast.error(err.message || 'Failed to publish blog');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5 py-5">
      <EditorTopBar
        onBack={onBack}
        actions={
          <>
            <AiBlogWriter iconOnly onFill={(t, c) => { setTitle(t); setContent(c); }} />
            <GlassIconButton
              onClick={() => handlePublish('draft')}
              tone="primary"
              tooltip="Save Draft"
              aria-label="Save Draft"
              disabled={publishing}
            >
              <Save className="h-3.5 w-3.5" />
            </GlassIconButton>
            <GlassIconButton
              onClick={() => handlePublish('published')}
              tone="primary"
              tooltip={publishing ? 'Submitting...' : 'Publish'}
              aria-label="Publish"
              disabled={publishing}
            >
              {publishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            </GlassIconButton>
          </>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
        <DraftPanel
          loadingDrafts={loadingDrafts}
          draftPosts={draftPosts}
          editingDraftId={editingDraftId}
          onReset={resetEditorAsNewDraft}
          onApplyDraft={applyDraftToEditor}
        />

        <div className="space-y-5">
          <EditorTitleBlock
            title={title}
            setTitle={setTitle}
            titlePlaceholder="Enter blog title"
            selectedProjectTags={selectedProjectTags}
            setSelectedProjectTags={setSelectedProjectTags}
            tagPlaceholder="Search project tags (multi-select)"
          />
          <GlassPanel className="rounded-[28px] border border-white/60 bg-white/72 p-3 shadow-[0_18px_42px_rgba(15,23,42,0.10)] backdrop-blur-2xl supports-[backdrop-filter]:bg-white/56 md:p-4">
            <RemarkupEditor
              value={content}
              onChange={setContent}
              placeholder="Write blog content here... Markdown is supported"
              minHeight="620px"
            />
          </GlassPanel>
        </div>
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
      toast.error('Please enter a weekly report title first');
      return;
    }
    if (!content.trim()) {
      toast.error('Please enter weekly report content first');
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

      toast.success(status === 'draft' ? 'Weekly report draft saved' : 'Weekly report published');
      await onPublished?.();
      onBack();
    } catch (err: any) {
      if (handlePublishErrorWithBindingGuide(err?.message)) {
        return;
      }
      toast.error(err.message || 'Failed to publish weekly report');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5 py-5">
      <EditorTopBar
        onBack={onBack}
        actions={
          <>
            <AiReportWriter iconOnly onFill={(t, c) => { setTitle(t); setContent(c); }} />
            <GlassIconButton
              onClick={() => handlePublish('draft')}
              tone="primary"
              tooltip="Save Draft"
              aria-label="Save Draft"
              disabled={publishing}
            >
              <Save className="h-3.5 w-3.5" />
            </GlassIconButton>
            <GlassIconButton
              onClick={() => handlePublish('published')}
              tone="primary"
              tooltip={publishing ? 'Submitting...' : 'Publish'}
              aria-label="Publish"
              disabled={publishing}
            >
              {publishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            </GlassIconButton>
          </>
        }
      />

      <div className="space-y-5">
        <EditorTitleBlock
          title={title}
          setTitle={setTitle}
          titlePlaceholder="Enter weekly report title"
          selectedProjectTags={selectedProjectTags}
          setSelectedProjectTags={setSelectedProjectTags}
          tagPlaceholder=""
          showTagHelper={false}
        />
        <GlassPanel className="rounded-[28px] border border-white/60 bg-white/72 p-3 shadow-[0_18px_42px_rgba(15,23,42,0.10)] backdrop-blur-2xl supports-[backdrop-filter]:bg-white/56 md:p-4">
          <RemarkupEditor
            value={content}
            onChange={setContent}
            placeholder="Write weekly report content here... Markdown is supported"
            minHeight="620px"
          />
        </GlassPanel>
      </div>
    </div>
  );
}
