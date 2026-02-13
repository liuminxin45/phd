import { useState, useRef, useCallback } from 'react';
import { Eye, Edit3, Maximize2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { httpPost } from '@/lib/httpClient';
import { RemarkupRenderer } from '@/components/ui/RemarkupRenderer';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

interface RemarkupEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
  className?: string;
  autoFocus?: boolean;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip the data:...;base64, prefix
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function uploadFile(file: File): Promise<{ fileId: string; fileName: string }> {
  const data_base64 = await fileToBase64(file);
  return httpPost<{ fileId: string; fileName: string }>('/api/files/upload', { data_base64, name: file.name });
}

function insertTextAtCursor(
  textarea: HTMLTextAreaElement,
  text: string,
  value: string,
  onChange: (v: string) => void
) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const before = value.slice(0, start);
  const after = value.slice(end);
  // Add newlines around the embed if not already at a line boundary
  const prefix = before.length > 0 && !before.endsWith('\n') ? '\n' : '';
  const suffix = after.length > 0 && !after.startsWith('\n') ? '\n' : '';
  const inserted = prefix + text + suffix;
  const newValue = before + inserted + after;
  onChange(newValue);
  // Restore cursor position after the inserted text
  requestAnimationFrame(() => {
    const pos = start + inserted.length;
    textarea.selectionStart = pos;
    textarea.selectionEnd = pos;
    textarea.focus();
  });
}

function useFileUpload(value: string, onChange: (v: string) => void) {
  const [uploading, setUploading] = useState(false);
  const [uploadCount, setUploadCount] = useState({ done: 0, total: 0 });

  // Refs to always access the latest value/onChange inside async handleFiles
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  valueRef.current = value;
  onChangeRef.current = onChange;

  const handleFiles = useCallback(async (files: File[], textarea: HTMLTextAreaElement | null) => {
    if (files.length === 0) return;
    setUploading(true);
    setUploadCount({ done: 0, total: files.length });

    const references: string[] = [];
    let doneCount = 0;

    for (const file of files) {
      try {
        const result = await uploadFile(file);
        references.push(`{F${result.fileId}}`);
      } catch (err: any) {
        references.push(`[上传失败: ${file.name}]`);
      }
      doneCount++;
      setUploadCount({ done: doneCount, total: files.length });
    }

    const text = references.join('\n');
    if (textarea) {
      insertTextAtCursor(textarea, text, valueRef.current, onChangeRef.current);
    } else {
      const cur = valueRef.current;
      const sep = cur.length > 0 && !cur.endsWith('\n') ? '\n' : '';
      onChangeRef.current(cur + sep + text);
    }

    setUploading(false);
  }, []);

  const onPaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].kind === 'file') {
        const file = items[i].getAsFile();
        if (file) files.push(file);
      }
    }
    if (files.length > 0) {
      e.preventDefault();
      handleFiles(files, e.currentTarget);
    }
  }, [handleFiles]);

  const onDrop = useCallback((e: React.DragEvent<HTMLTextAreaElement>) => {
    const files = Array.from(e.dataTransfer?.files || []);
    if (files.length > 0) {
      e.preventDefault();
      handleFiles(files, e.currentTarget);
    }
  }, [handleFiles]);

  const onDragOver = useCallback((e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
  }, []);

  return { uploading, uploadCount, onPaste, onDrop, onDragOver };
}

function UploadIndicator({ uploading, uploadCount }: { uploading: boolean; uploadCount: { done: number; total: number } }) {
  if (!uploading) return null;
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-muted/50 border-t border-border text-xs text-muted-foreground">
      <Loader2 className="h-3 w-3 animate-spin" />
      <span>上传中 ({uploadCount.done}/{uploadCount.total})...</span>
    </div>
  );
}

function TabBar({ tab, setTab, extra }: {
  tab: 'edit' | 'preview';
  setTab: (t: 'edit' | 'preview') => void;
  extra?: React.ReactNode;
}) {
  return (
    <div className="flex items-center border-b border-border bg-muted/30 rounded-t-md px-2">
      <button
        type="button"
        className={cn(
          'flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors border-b-2 -mb-[1px]',
          tab === 'edit'
            ? 'text-foreground border-primary'
            : 'text-muted-foreground border-transparent hover:text-foreground'
        )}
        onClick={() => setTab('edit')}
      >
        <Edit3 className="h-3.5 w-3.5" />
        编辑
      </button>
      <button
        type="button"
        className={cn(
          'flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors border-b-2 -mb-[1px]',
          tab === 'preview'
            ? 'text-foreground border-primary'
            : 'text-muted-foreground border-transparent hover:text-foreground'
        )}
        onClick={() => setTab('preview')}
      >
        <Eye className="h-3.5 w-3.5" />
        预览
      </button>
      {extra && <div className="ml-auto flex items-center py-1">{extra}</div>}
    </div>
  );
}

function EditorBody({ tab, value, onChange, placeholder, minHeight, autoFocus, uploadProps }: {
  tab: 'edit' | 'preview';
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  minHeight: string;
  autoFocus: boolean;
  uploadProps: ReturnType<typeof useFileUpload>;
}) {
  return tab === 'edit' ? (
    <div className="flex flex-col">
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onPaste={uploadProps.onPaste}
        onDrop={uploadProps.onDrop}
        onDragOver={uploadProps.onDragOver}
        placeholder={placeholder}
        style={{ minHeight }}
        className="border-0 rounded-t-none shadow-none focus-visible:ring-0 resize-y text-sm p-3 font-mono leading-relaxed"
        autoFocus={autoFocus}
      />
      <UploadIndicator uploading={uploadProps.uploading} uploadCount={uploadProps.uploadCount} />
    </div>
  ) : (
    <div className="p-4 overflow-y-auto bg-background" style={{ minHeight }}>
      {value.trim() ? (
        <RemarkupRenderer content={value} compact />
      ) : (
        <p className="text-sm text-muted-foreground italic">暂无内容</p>
      )}
    </div>
  );
}

export function RemarkupEditor({
  value,
  onChange,
  placeholder = '输入内容，支持 Remarkup 语法...',
  minHeight = '150px',
  className,
  autoFocus = false,
}: RemarkupEditorProps) {
  const [tab, setTab] = useState<'edit' | 'preview'>('edit');
  const [expanded, setExpanded] = useState(false);
  const uploadProps = useFileUpload(value, onChange);
  const fullscreenTextareaRef = useRef<HTMLTextAreaElement>(null);

  return (
    <>
      <div className={cn('rounded-md border border-input bg-background shadow-sm flex flex-col', className)}>
        <TabBar
          tab={tab}
          setTab={setTab}
          extra={
            <button
              type="button"
              className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
              onClick={() => setExpanded(true)}
              title="全屏编辑"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          }
        />
        <EditorBody
          tab={tab}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          minHeight={minHeight}
          autoFocus={autoFocus}
          uploadProps={uploadProps}
        />
      </div>

      {/* Fullscreen dialog */}
      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent className="!max-w-[95vw] w-[95vw] h-[90vh] p-0 gap-0 overflow-hidden flex flex-col z-[10002]">
          <DialogHeader className="px-6 py-4 border-b border-border bg-muted/10 shrink-0">
            <DialogTitle>Remarkup 编辑器</DialogTitle>
            <DialogDescription className="sr-only">全屏分栏编辑模式</DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 flex min-h-0 bg-background divide-x divide-border">
            {/* Left pane: Editor */}
            <div className="flex-1 flex flex-col min-w-0">
              <div className="px-4 py-2 border-b border-border bg-muted/5 text-xs font-medium text-muted-foreground flex items-center gap-2">
                <Edit3 className="h-3.5 w-3.5" />
                编辑
              </div>
              <textarea
                ref={fullscreenTextareaRef}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onPaste={uploadProps.onPaste}
                onDrop={uploadProps.onDrop}
                onDragOver={uploadProps.onDragOver}
                placeholder={placeholder}
                className="flex-1 w-full resize-none p-6 text-base font-mono leading-relaxed bg-transparent border-0 focus:ring-0 focus:outline-none"
                autoFocus
              />
              <UploadIndicator uploading={uploadProps.uploading} uploadCount={uploadProps.uploadCount} />
            </div>

            {/* Right pane: Preview */}
            <div className="flex-1 flex flex-col min-w-0 bg-muted/5">
              <div className="px-4 py-2 border-b border-border bg-muted/5 text-xs font-medium text-muted-foreground flex items-center gap-2">
                <Eye className="h-3.5 w-3.5" />
                预览
              </div>
              <div className="flex-1 overflow-y-auto p-8">
                {value.trim() ? (
                  <RemarkupRenderer content={value} />
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground italic">
                    暂无内容
                  </div>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
