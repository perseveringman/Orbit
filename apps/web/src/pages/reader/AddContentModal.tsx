import { useState, useMemo, type ReactElement } from 'react';
import { Button, Chip, Input } from '@heroui/react';
import { Link2, FileText, Headphones, PlayCircle, X } from 'lucide-react';
import type { ReaderContentType } from './ReaderRouter';

interface AddContentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (url: string) => void;
}

interface DetectedInfo {
  type: ReaderContentType | null;
  title: string;
  source: string;
}

function detectContentType(url: string): DetectedInfo {
  const lower = url.toLowerCase();

  if (/youtube\.com|youtu\.be|bilibili\.com|vimeo\.com/.test(lower)) {
    return { type: 'video', title: '视频内容', source: extractDomain(url) };
  }
  if (/podcast|anchor\.fm|spotify\.com\/show|overcast\.fm|castro\.fm/.test(lower)) {
    return { type: 'podcast', title: '播客节目', source: extractDomain(url) };
  }
  if (lower.length > 0) {
    return { type: 'article', title: '网页文章', source: extractDomain(url) };
  }
  return { type: null, title: '', source: '' };
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return '';
  }
}

function typeLabel(type: ReaderContentType): string {
  switch (type) {
    case 'article': return '文章';
    case 'podcast': return '播客';
    case 'video': return '视频';
    case 'book': return '书籍';
  }
}

function TypeIcon({ type }: { type: ReaderContentType }): ReactElement {
  switch (type) {
    case 'article': return <FileText size={14} />;
    case 'podcast': return <Headphones size={14} />;
    case 'video': return <PlayCircle size={14} />;
    case 'book': return <FileText size={14} />;
  }
}

export function AddContentModal({ isOpen, onClose, onSubmit }: AddContentModalProps): ReactElement | null {
  const [url, setUrl] = useState('');

  const detected = useMemo(() => detectContentType(url), [url]);

  const handleSubmit = () => {
    if (!url.trim()) return;
    onSubmit(url.trim());
    setUrl('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-surface border border-border rounded-xl shadow-lg w-full max-w-lg mx-4 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">添加内容</h2>
          <Button variant="ghost" size="sm" isIconOnly onPress={onClose} aria-label="关闭">
            <X size={16} />
          </Button>
        </div>

        {/* URL input */}
        <div className="flex items-center gap-2">
          <Link2 size={14} className="text-muted shrink-0" />
          <Input
            placeholder="粘贴 URL..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            autoFocus
          />
        </div>

        {/* Preview area */}
        {detected.type && url.trim() && (
          <div className="mt-4 p-3 rounded-lg bg-surface-secondary border border-border">
            <div className="flex items-center gap-2 mb-1">
              <Chip size="sm" variant="soft" color="accent">
                <TypeIcon type={detected.type} />
                {typeLabel(detected.type)}
              </Chip>
            </div>
            <p className="text-sm text-foreground">{detected.title}</p>
            <p className="text-xs text-muted">{detected.source}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="secondary" size="sm" onPress={onClose}>
            取消
          </Button>
          <Button
            variant="primary"
            size="sm"
            onPress={handleSubmit}
            isDisabled={!url.trim()}
          >
            添加
          </Button>
        </div>
      </div>
    </div>
  );
}
