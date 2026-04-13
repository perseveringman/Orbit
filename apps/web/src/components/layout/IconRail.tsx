import type { ReactElement } from 'react';
import {
  FolderKanban,
  Bot,
  BookOpenText,
  NotebookPen,
  Compass,
  Settings,
  Plus,
  MoreHorizontal,
  User,
  Inbox,
} from 'lucide-react';
import { Button, Tooltip } from '@heroui/react';

// HeroUI v3 Tooltip uses compound components: Tooltip > Tooltip.Trigger + Tooltip.Content

export interface SectionDef {
  id: string;
  icon: typeof FolderKanban;
  label: string;
  color: string;
}

const SECTIONS: SectionDef[] = [
  { id: 'inbox', icon: Inbox, label: '收件箱', color: '#ef4444' },
  { id: 'project', icon: FolderKanban, label: '项目管理', color: '#3b82f6' },
  { id: 'agent', icon: Bot, label: 'Agent 管理', color: '#f97316' },
  { id: 'research', icon: BookOpenText, label: '研究工作台', color: '#22c55e' },
  { id: 'journal', icon: NotebookPen, label: '日志', color: '#a855f7' },
  { id: 'vision', icon: Compass, label: '愿景', color: '#14b8a6' },
];

export interface IconRailProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}

export function IconRail({ activeSection, onSectionChange }: IconRailProps): ReactElement {
  return (
    <aside className="flex flex-col items-center w-14 shrink-0 bg-surface border-r border-border py-2 gap-1">
      {/* Top actions */}
      <Button variant="ghost" isIconOnly size="sm" className="text-muted">
        <MoreHorizontal size={18} />
      </Button>
      <Button variant="primary" isIconOnly size="sm" className="mb-2">
        <Plus size={18} />
      </Button>

      {/* Section icons */}
      <div className="flex-1 flex flex-col items-center gap-1">
        {SECTIONS.map((section) => {
          const Icon = section.icon;
          const isActive = activeSection === section.id;
          return (
            <Tooltip key={section.id} delay={300}>
              <Tooltip.Trigger>
                <div className="relative flex items-center">
                  {/* Active indicator bar */}
                  {isActive && (
                    <span
                      className="absolute left-[-7px] w-[3px] h-6 rounded-r-full"
                      style={{ backgroundColor: section.color }}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => onSectionChange(section.id)}
                    className="flex items-center justify-center w-9 h-9 rounded-lg transition-colors"
                    style={
                      isActive
                        ? { backgroundColor: `${section.color}20`, color: section.color }
                        : undefined
                    }
                    aria-label={section.label}
                  >
                    <Icon
                      size={20}
                      className={isActive ? '' : 'text-muted hover:text-foreground transition-colors'}
                    />
                  </button>
                </div>
              </Tooltip.Trigger>
              <Tooltip.Content placement="right">{section.label}</Tooltip.Content>
            </Tooltip>
          );
        })}
      </div>

      {/* Bottom actions */}
      <div className="flex flex-col items-center gap-1 mt-auto">
        <Button variant="ghost" isIconOnly size="sm" className="text-muted">
          <Settings size={18} />
        </Button>
        <div className="w-8 h-8 rounded-full bg-accent-soft flex items-center justify-center">
          <User size={16} className="text-accent" />
        </div>
      </div>
    </aside>
  );
}
