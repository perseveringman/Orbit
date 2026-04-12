import type { ReactElement } from 'react';
import { Button } from '@heroui/react';
import {
  Highlighter,
  StickyNote,
  Microscope,
  CircleCheckBig,
  PenLine,
} from 'lucide-react';

interface ExitAction {
  icon: ReactElement;
  label: string;
  key: string;
}

const ACTIONS: ExitAction[] = [
  { icon: <Highlighter size={16} />, label: '高亮', key: 'highlight' },
  { icon: <StickyNote size={16} />, label: '笔记', key: 'note' },
  { icon: <Microscope size={16} />, label: '研究', key: 'research' },
  { icon: <CircleCheckBig size={16} />, label: '任务', key: 'task' },
  { icon: <PenLine size={16} />, label: '写作', key: 'writing' },
];

export function ReadingExitBar(): ReactElement {
  const handleAction = (key: string) => {
    console.log(`[ReadingExitBar] action: ${key}`);
  };

  return (
    <div className="flex items-center justify-center gap-2 px-4 py-2 border-t border-border bg-surface">
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
  );
}
