import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  User,
  Calendar,
  ArrowLeft,
  Save,
  Send,
  FileText,
  Eye,
  Pencil,
  Bold,
  Italic,
  Code,
  Link,
  List,
  Quote,
  ImageIcon,
  Plus,
  X,
  Info,
} from 'lucide-react';
import { CATEGORIES, TAGS, getLastWeekRange } from '@/lib/blog/helpers';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

// ─── Shared toolbar items ────────────────────────────────────────────────────

const TOOLBAR_ITEMS = [
  { icon: Bold, title: '粗体' },
  { icon: Italic, title: '斜体' },
  { icon: Code, title: '代码' },
  { icon: Link, title: '链接' },
  { icon: List, title: '列表' },
  { icon: Quote, title: '引用' },
];

const BLOG_TOOLBAR_ITEMS = [
  ...TOOLBAR_ITEMS,
  { icon: ImageIcon, title: '图片' },
];

// ─── Shared Editor Shell ─────────────────────────────────────────────────────

function EditorShell({ editorMode, setEditorMode, content, setContent, toolbarItems, placeholder }: {
  editorMode: 'edit' | 'preview';
  setEditorMode: (m: 'edit' | 'preview') => void;
  content: string;
  setContent: (v: string) => void;
  toolbarItems: { icon: any; title: string }[];
  placeholder: string;
}) {
  return (
    <Card className="overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b px-4 py-2 bg-muted/20">
        <div className="flex items-center gap-1">
          <Button
            onClick={() => setEditorMode('edit')}
            variant={editorMode === 'edit' ? 'default' : 'ghost'}
            size="sm"
            className="h-7 text-xs gap-1.5"
          >
            <Pencil className="h-3 w-3" />
            编辑
          </Button>
          <Button
            onClick={() => setEditorMode('preview')}
            variant={editorMode === 'preview' ? 'default' : 'ghost'}
            size="sm"
            className="h-7 text-xs gap-1.5"
          >
            <Eye className="h-3 w-3" />
            预览
          </Button>
          <div className="w-px h-4 bg-border mx-1.5" />
          {toolbarItems.map(({ icon: Icon, title }) => (
            <Button
              key={title}
              title={title}
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
            >
              <Icon className="h-3.5 w-3.5" />
            </Button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground">支持 Markdown</span>
      </div>

      {/* Editor / Preview */}
      {editorMode === 'edit' ? (
        <textarea
          placeholder={placeholder}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="w-full min-h-[500px] p-6 text-sm text-foreground placeholder:text-muted-foreground bg-transparent resize-y outline-none font-mono leading-relaxed"
        />
      ) : (
        <div className="min-h-[500px] p-6">
          {content ? (
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {content}
              </ReactMarkdown>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground min-h-[200px]">
              <Eye className="h-8 w-8 mb-2 opacity-20" />
              <p className="text-sm">暂无内容可预览</p>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

// ─── Status Selector ─────────────────────────────────────────────────────────

function StatusSelector({ status, setStatus, draftLabel, publishedLabel, draftHint, publishedHint }: {
  status: 'draft' | 'published';
  setStatus: (s: 'draft' | 'published') => void;
  draftLabel: string;
  publishedLabel: string;
  draftHint: string;
  publishedHint: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sm font-medium text-foreground mb-3">
          {draftLabel === '草稿' ? '周报状态' : '博客状态'}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={() => setStatus('draft')}
            variant={status === 'draft' ? 'secondary' : 'outline'}
            className={cn(
              "text-xs h-8 gap-1.5",
              status === 'draft' && "bg-amber-100 text-amber-700 hover:bg-amber-200 border-transparent"
            )}
          >
            <FileText className="h-3.5 w-3.5" />
            {draftLabel}
          </Button>
          <Button
            onClick={() => setStatus('published')}
            variant={status === 'published' ? 'secondary' : 'outline'}
            className={cn(
              "text-xs h-8 gap-1.5",
              status === 'published' && "bg-green-100 text-green-700 hover:bg-green-200 border-transparent"
            )}
          >
            <Send className="h-3.5 w-3.5" />
            {publishedLabel}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          {status === 'draft' ? draftHint : publishedHint}
        </p>
      </CardContent>
    </Card>
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

export function CreateBlogView({ onBack }: { onBack: () => void }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [editorMode, setEditorMode] = useState<'edit' | 'preview'>('edit');
  const [status, setStatus] = useState<'draft' | 'published'>('draft');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [tagInput, setTagInput] = useState('');

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  const addCustomTag = () => {
    const trimmed = tagInput.trim();
    if (trimmed && !selectedTags.has(trimmed)) {
      setSelectedTags((prev) => new Set(prev).add(trimmed));
      setTagInput('');
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
          <Button variant="outline" className="flex-1 sm:flex-none">
            <Save className="h-4 w-4 mr-2" />
            保存草稿
          </Button>
          <Button className="flex-1 sm:flex-none">
            <Send className="h-4 w-4 mr-2" />
            发布博客
          </Button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Editor */}
        <div className="flex-1 min-w-0 space-y-6">
          <div className="relative">
            <input
              type="text"
              placeholder="请输入博客标题"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-3xl font-bold text-foreground placeholder:text-muted-foreground/50 bg-transparent border-none outline-none py-2"
            />
          </div>
          <EditorShell
            editorMode={editorMode}
            setEditorMode={setEditorMode}
            content={content}
            setContent={setContent}
            toolbarItems={BLOG_TOOLBAR_ITEMS}
            placeholder="在此撰写博客正文…支持 Markdown 格式"
          />
        </div>

        {/* Sidebar */}
        <aside className="w-full lg:w-80 flex-shrink-0 space-y-6">
          <StatusSelector
            status={status}
            setStatus={setStatus}
            draftLabel="Draft"
            publishedLabel="Published"
            draftHint="草稿不会显示在博客首页"
            publishedHint="发布后将出现在博客首页"
          />

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

          {/* Tags */}
          <Card>
            <CardContent className="p-4">
              <p className="text-sm font-medium text-foreground mb-3">标签</p>
              {selectedTags.size > 0 && (
                <div className="flex flex-wrap gap-2 mb-4 p-3 bg-muted/30 rounded-md">
                  {[...selectedTags].map((tag) => (
                    <Badge key={tag} className="gap-1 pr-1">
                      {tag}
                      <button onClick={() => toggleTag(tag)} className="rounded-full hover:bg-primary-foreground/20 p-0.5">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              <div className="flex gap-2 mb-4">
                <Input
                  type="text"
                  placeholder="输入新标签..."
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addCustomTag()}
                  className="h-8 text-xs"
                />
                <Button onClick={addCustomTag} size="sm" variant="secondary" className="h-8 px-2">
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {TAGS.filter((t) => !selectedTags.has(t)).map((tag) => (
                  <Badge
                    key={tag}
                    variant="outline"
                    className="cursor-pointer font-normal hover:bg-muted text-muted-foreground hover:text-foreground"
                    onClick={() => toggleTag(tag)}
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          <AuthorTimeSidebar />
        </aside>
      </div>
    </div>
  );
}

// ─── CreateReportView ────────────────────────────────────────────────────────

export function CreateReportView({ onBack }: { onBack: () => void }) {
  const [title, setTitle] = useState(getLastWeekRange);
  const [content, setContent] = useState('');
  const [editorMode, setEditorMode] = useState<'edit' | 'preview'>('edit');
  const [status, setStatus] = useState<'draft' | 'published'>('draft');

  return (
    <div className="space-y-6 py-6 max-w-7xl mx-auto">
      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <Button onClick={onBack} variant="ghost" className="pl-0 hover:bg-transparent">
          <ArrowLeft className="h-4 w-4 mr-2" />
          返回周报列表
        </Button>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button variant="outline" className="flex-1 sm:flex-none">
            <Save className="h-4 w-4 mr-2" />
            保存草稿
          </Button>
          <Button className="flex-1 sm:flex-none">
            <Send className="h-4 w-4 mr-2" />
            发布周报
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
          <EditorShell
            editorMode={editorMode}
            setEditorMode={setEditorMode}
            content={content}
            setContent={setContent}
            toolbarItems={TOOLBAR_ITEMS}
            placeholder="在此撰写周报正文…支持 Markdown 格式"
          />
        </div>

        {/* Sidebar */}
        <aside className="w-full lg:w-80 flex-shrink-0 space-y-6">
          <StatusSelector
            status={status}
            setStatus={setStatus}
            draftLabel="草稿"
            publishedLabel="发布"
            draftHint="草稿不会显示在周报列表"
            publishedHint="发布后将出现在周报列表"
          />

          <AuthorTimeSidebar />

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
