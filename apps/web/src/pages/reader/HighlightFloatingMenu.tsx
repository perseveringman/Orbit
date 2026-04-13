import { useState, useEffect, useRef, useCallback, type ReactElement } from 'react';
import { Button } from '@heroui/react';
import {
  Highlighter,
  StickyNote,
  Microscope,
  CircleCheckBig,
  PenLine,
} from 'lucide-react';
import { useReaderMutations } from '../../data/use-reader-mutations';

const HIGHLIGHT_COLORS = [
  '#fbbf24', // yellow
  '#34d399', // green
  '#60a5fa', // blue
  '#f472b6', // pink
  '#c084fc', // purple
  '#fb923c', // orange
];

interface ActionDef {
  icon: ReactElement;
  label: string;
  key: string;
}

const ACTIONS: ActionDef[] = [
  { icon: <Highlighter size={14} />, label: '高亮', key: 'highlight' },
  { icon: <StickyNote size={14} />, label: '笔记', key: 'note' },
  { icon: <Microscope size={14} />, label: '研究', key: 'research' },
  { icon: <CircleCheckBig size={14} />, label: '任务', key: 'task' },
  { icon: <PenLine size={14} />, label: '写作', key: 'writing' },
];

export function HighlightFloatingMenu({ articleId }: { articleId: string }): ReactElement | null {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [selectedColor, setSelectedColor] = useState(HIGHLIGHT_COLORS[0]);
  const menuRef = useRef<HTMLDivElement>(null);
  const { createHighlight } = useReaderMutations();

  const handleSelection = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.rangeCount) {
      return;
    }
    const text = selection.toString().trim();
    if (!text) return;

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    setPosition({
      top: rect.top + window.scrollY - 8,
      left: rect.left + window.scrollX + rect.width / 2,
    });
    setVisible(true);
  }, []);

  const handleClickOutside = useCallback(
    (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setVisible(false);
      }
    },
    [],
  );

  useEffect(() => {
    document.addEventListener('mouseup', handleSelection);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mouseup', handleSelection);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [handleSelection, handleClickOutside]);

  const handleAction = (key: string) => {
    const selection = window.getSelection();
    const text = selection?.toString().trim() ?? '';
    if (text && key === 'highlight') {
      createHighlight({
        articleId,
        quoteText: text,
        color: selectedColor,
        highlightKind: 'highlight',
      });
    } else if (text && key === 'note') {
      createHighlight({
        articleId,
        quoteText: text,
        color: selectedColor,
        highlightKind: 'note',
      });
    }
    setVisible(false);
    selection?.removeAllRanges();
  };

  if (!visible) return null;

  return (
    <div
      ref={menuRef}
      className="absolute z-50 -translate-x-1/2 -translate-y-full flex flex-col items-center gap-1.5 bg-surface border border-border rounded-lg shadow-lg p-2"
      style={{ top: position.top, left: position.left }}
    >
      {/* Color circles */}
      <div className="flex items-center gap-1.5">
        {HIGHLIGHT_COLORS.map((color) => (
          <button
            key={color}
            className={`w-5 h-5 rounded-full border-2 transition-transform ${
              selectedColor === color ? 'border-foreground scale-110' : 'border-transparent'
            }`}
            style={{ backgroundColor: color }}
            onClick={() => setSelectedColor(color)}
            aria-label={`颜色 ${color}`}
          />
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-0.5">
        {ACTIONS.map((action) => (
          <Button
            key={action.key}
            variant="ghost"
            size="sm"
            onPress={() => handleAction(action.key)}
          >
            {action.icon}
            <span className="text-xs">{action.label}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}
