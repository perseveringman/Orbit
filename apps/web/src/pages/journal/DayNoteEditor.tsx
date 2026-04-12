import { useState, useEffect, useRef, type ReactElement } from 'react';
import { BookText, MoreVertical, Check, Loader2 } from 'lucide-react';
import { Card, Button, TextArea } from '@heroui/react';

type PrivacyLevel = 'normal' | 'sensitive' | 'sealed';

const PRIVACY_LABELS: Record<PrivacyLevel, string> = {
  normal: '普通',
  sensitive: '敏感',
  sealed: '密封',
};

const PRIVACY_COLORS: Record<PrivacyLevel, string> = {
  normal: 'text-muted',
  sensitive: 'text-warning',
  sealed: 'text-danger',
};

interface DayNoteEditorProps {
  initialContent?: string;
  initialPrivacy?: PrivacyLevel;
}

export function DayNoteEditor({
  initialContent = '',
  initialPrivacy = 'normal',
}: DayNoteEditorProps): ReactElement {
  const [content, setContent] = useState(initialContent);
  const [privacy, setPrivacy] = useState<PrivacyLevel>(initialPrivacy);
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'idle'>('idle');
  const [showPrivacyMenu, setShowPrivacyMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    if (content === initialContent) return;
    setSaveState('saving');
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setSaveState('saved');
    }, 800);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [content, initialContent]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowPrivacyMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const privacyLevels: PrivacyLevel[] = ['normal', 'sensitive', 'sealed'];

  return (
    <Card>
      <Card.Header>
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <BookText size={16} className="text-accent" />
            <span className="font-semibold text-foreground">日记</span>
          </div>
          <div className="flex items-center gap-2">
            {saveState === 'saving' && (
              <span className="flex items-center gap-1 text-xs text-muted">
                <Loader2 size={12} className="animate-spin" /> 保存中...
              </span>
            )}
            {saveState === 'saved' && (
              <span className="flex items-center gap-1 text-xs text-success">
                <Check size={12} /> 已保存
              </span>
            )}
            <div className="relative" ref={menuRef}>
              <Button
                variant="ghost"
                isIconOnly
                size="sm"
                onPress={() => setShowPrivacyMenu(!showPrivacyMenu)}
              >
                <MoreVertical size={14} />
              </Button>
              {showPrivacyMenu && (
                <div className="absolute right-0 top-full mt-1 bg-surface border border-border rounded-lg shadow-lg py-1 z-20 min-w-[120px]">
                  {privacyLevels.map((level) => (
                    <button
                      key={level}
                      className={`w-full text-left px-3 py-1.5 text-sm hover:bg-surface-secondary transition-colors ${
                        privacy === level ? 'font-semibold' : ''
                      } ${PRIVACY_COLORS[level]}`}
                      onClick={() => {
                        setPrivacy(level);
                        setShowPrivacyMenu(false);
                      }}
                    >
                      {PRIVACY_LABELS[level]}
                      {privacy === level && <Check size={12} className="inline ml-2" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </Card.Header>
      <Card.Content>
        <TextArea
          aria-label="日记内容"
          className="w-full min-h-[120px] resize-y"
          placeholder="记录今天的想法..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        <div className="flex items-center justify-between mt-2">
          <span className={`text-xs ${PRIVACY_COLORS[privacy]}`}>
            {PRIVACY_LABELS[privacy]}
          </span>
          <span className="text-xs text-muted">{content.length} 字</span>
        </div>
      </Card.Content>
    </Card>
  );
}
