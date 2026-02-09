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
    <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-2">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setEditorMode('edit')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md transition-colors ${
              editorMode === 'edit'
                ? 'bg-neutral-900 text-white'
                : 'text-neutral-500 hover:bg-neutral-100'
            }`}
          >
            <Pencil className="h-3 w-3" />
            编辑
          </button>
          <button
            onClick={() => setEditorMode('preview')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md transition-colors ${
              editorMode === 'preview'
                ? 'bg-neutral-900 text-white'
                : 'text-neutral-500 hover:bg-neutral-100'
            }`}
          >
            <Eye className="h-3 w-3" />
            预览
          </button>
          <div className="w-px h-4 bg-neutral-200 mx-1.5" />
          {toolbarItems.map(({ icon: Icon, title }) => (
            <button
              key={title}
              title={title}
              className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded transition-colors"
            >
              <Icon className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>
        <span className="text-xs text-neutral-400">支持 Markdown</span>
      </div>

      {/* Editor / Preview */}
      {editorMode === 'edit' ? (
        <textarea
          placeholder={placeholder}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="w-full min-h-[420px] p-4 text-sm text-neutral-800 placeholder:text-neutral-400 bg-transparent resize-y outline-none font-mono leading-relaxed"
        />
      ) : (
        <div className="min-h-[420px] p-4">
          {content ? (
            <div className="prose prose-sm max-w-none text-neutral-800">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {content}
              </ReactMarkdown>
            </div>
          ) : (
            <p className="text-sm text-neutral-400">暂无内容可预览</p>
          )}
        </div>
      )}
    </div>
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
    <div className="bg-white border border-neutral-200 rounded-lg p-4">
      <p className="text-sm font-medium text-neutral-900 mb-3">
        {draftLabel === '草稿' ? '周报状态' : '博客状态'}
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => setStatus('draft')}
          className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs rounded-md border transition-colors ${
            status === 'draft'
              ? 'bg-amber-50 text-amber-700 border-amber-200'
              : 'text-neutral-500 border-neutral-200 hover:bg-neutral-50'
          }`}
        >
          <FileText className="h-3.5 w-3.5" />
          {draftLabel}
        </button>
        <button
          onClick={() => setStatus('published')}
          className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs rounded-md border transition-colors ${
            status === 'published'
              ? 'bg-green-50 text-green-700 border-green-200'
              : 'text-neutral-500 border-neutral-200 hover:bg-neutral-50'
          }`}
        >
          <Send className="h-3.5 w-3.5" />
          {publishedLabel}
        </button>
      </div>
      <p className="text-xs text-neutral-400 mt-2">
        {status === 'draft' ? draftHint : publishedHint}
      </p>
    </div>
  );
}

// ─── Author & Time Sidebar (shared) ──────────────────────────────────────────

function AuthorTimeSidebar() {
  return (
    <>
      <div className="bg-white border border-neutral-200 rounded-lg p-4">
        <p className="text-sm font-medium text-neutral-900 mb-3">作者信息</p>
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-neutral-200 flex items-center justify-center">
            <User className="h-4 w-4 text-neutral-500" />
          </div>
          <div>
            <p className="text-sm text-neutral-800">当前用户</p>
            <p className="text-xs text-neutral-400">作者（只读）</p>
          </div>
        </div>
      </div>

      <div className="bg-white border border-neutral-200 rounded-lg p-4">
        <p className="text-sm font-medium text-neutral-900 mb-3">发布时间</p>
        <div className="flex items-center gap-2 text-sm text-neutral-600">
          <Calendar className="h-4 w-4 text-neutral-400" />
          <span>{new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })}</span>
          <span className="text-xs text-neutral-400 ml-1">（默认当前时间）</span>
        </div>
      </div>
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
    <div className="space-y-4">
      {/* Action Bar */}
      <div className="bg-white border border-neutral-200 rounded-lg px-4 py-3 flex items-center justify-between">
        <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-neutral-600 hover:text-neutral-900 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          返回博客首页
        </button>
        <div className="flex items-center gap-2">
          <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-neutral-600 border border-neutral-200 rounded-md hover:bg-neutral-50 transition-colors">
            <Save className="h-3.5 w-3.5" />
            保存草稿
          </button>
          <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-white bg-neutral-900 rounded-md hover:bg-neutral-800 transition-colors">
            <Send className="h-3.5 w-3.5" />
            发布博客
          </button>
        </div>
      </div>

      <div className="flex gap-5">
        {/* Editor */}
        <div className="flex-1 min-w-0 space-y-4">
          <div className="bg-white border border-neutral-200 rounded-lg p-4">
            <input
              type="text"
              placeholder="请输入博客标题"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-lg font-semibold text-neutral-900 placeholder:text-neutral-400 bg-transparent border-none outline-none"
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
        <aside className="w-72 flex-shrink-0 space-y-4">
          <StatusSelector
            status={status}
            setStatus={setStatus}
            draftLabel="Draft"
            publishedLabel="Published"
            draftHint="草稿不会显示在博客首页"
            publishedHint="发布后将出现在博客首页"
          />

          {/* Category */}
          <div className="bg-white border border-neutral-200 rounded-lg p-4">
            <p className="text-sm font-medium text-neutral-900 mb-3">分类</p>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                  className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                    selectedCategory === cat
                      ? 'bg-neutral-900 text-white border-neutral-900'
                      : 'text-neutral-600 border-neutral-200 hover:bg-neutral-50'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div className="bg-white border border-neutral-200 rounded-lg p-4">
            <p className="text-sm font-medium text-neutral-900 mb-3">标签</p>
            {selectedTags.size > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {[...selectedTags].map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-neutral-900 text-white rounded-md">
                    {tag}
                    <button onClick={() => toggleTag(tag)} className="hover:text-neutral-300">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-1.5 mb-3">
              <input
                type="text"
                placeholder="输入新标签..."
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addCustomTag()}
                className="flex-1 px-2.5 py-1 text-xs border border-neutral-200 rounded-md bg-neutral-50 focus:outline-none focus:ring-1 focus:ring-neutral-300 focus:bg-white"
              />
              <button onClick={addCustomTag} className="px-2 py-1 text-xs text-neutral-600 border border-neutral-200 rounded-md hover:bg-neutral-50 transition-colors">
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {TAGS.filter((t) => !selectedTags.has(t)).map((tag) => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className="px-2 py-0.5 text-xs text-neutral-500 border border-neutral-100 rounded-md hover:bg-neutral-50 transition-colors"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

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
    <div className="space-y-4">
      {/* Action Bar */}
      <div className="bg-white border border-neutral-200 rounded-lg px-4 py-3 flex items-center justify-between">
        <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-neutral-600 hover:text-neutral-900 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          返回周报列表
        </button>
        <div className="flex items-center gap-2">
          <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-neutral-600 border border-neutral-200 rounded-md hover:bg-neutral-50 transition-colors">
            <Save className="h-3.5 w-3.5" />
            保存草稿
          </button>
          <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-white bg-neutral-900 rounded-md hover:bg-neutral-800 transition-colors">
            <Send className="h-3.5 w-3.5" />
            发布周报
          </button>
        </div>
      </div>

      <div className="flex gap-5">
        {/* Editor */}
        <div className="flex-1 min-w-0 space-y-4">
          <div className="bg-white border border-neutral-200 rounded-lg p-4">
            <input
              type="text"
              placeholder="请输入周报标题"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-lg font-semibold text-neutral-900 placeholder:text-neutral-400 bg-transparent border-none outline-none"
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
        <aside className="w-72 flex-shrink-0 space-y-4">
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
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
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
