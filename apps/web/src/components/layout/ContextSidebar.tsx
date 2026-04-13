import { useState, type ReactElement, type ReactNode } from 'react';
import {
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Moon,
  Sun,
  Settings,
  HelpCircle,
  User,
  LayoutDashboard,
  ListChecks,
  FolderOpen,

  BotMessageSquare,
  MessageSquare,
  Cpu,
  Puzzle,
  Wrench,
  UserCog,
  Users,
  BookOpen,
  BookOpen as BookOpenIcon,
  StickyNote as StickyNoteIcon,
  CheckCircle2,
  Bot as BotIcon,
  Inbox,
  Rss,
  CalendarDays,
  List,
  PenLine,
  Library,
} from 'lucide-react';
import { Button, Switch, Separator } from '@heroui/react';
import { setTheme, getCurrentTheme, type OrbitThemeMode } from '@orbit/ui-dom';

import { SectionHeader, NavItem } from '../shared';

/* ------------------------------------------------------------------ */
/*  Expandable nav group                                              */
/* ------------------------------------------------------------------ */
interface ExpandableGroupProps {
  icon: ReactNode;
  label: string;
  badge?: number | string;
  isActive: boolean;
  onClick: () => void;
  defaultOpen?: boolean;
  children?: ReactNode;
}

function ExpandableGroup({
  icon,
  label,
  badge,
  isActive,
  onClick,
  defaultOpen = false,
  children,
}: ExpandableGroupProps): ReactElement {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          onClick();
          setOpen((o) => !o);
        }}
        className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
          isActive
            ? 'border-l-2 border-accent bg-accent-soft text-accent font-medium'
            : 'text-muted hover:bg-surface-secondary'
        }`}
      >
        <span className="shrink-0">{icon}</span>
        <span className="flex-1 truncate text-left">{label}</span>
        {badge != null && (
          <span className="text-xs text-muted mr-1">{badge}</span>
        )}
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {open && <div className="pl-6">{children}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Section nav definitions                                           */
/* ------------------------------------------------------------------ */

function InboxNav({
  activeSubPage,
  onSubPageChange,
}: {
  activeSubPage: string;
  onSubPageChange: (s: string) => void;
}): ReactElement {
  return (
    <>
      <SectionHeader label="收件箱" />
      <NavItem
        icon={<Inbox size={16} />}
        label="全部"
        isActive={activeSubPage === 'all'}
        onClick={() => onSubPageChange('all')}
      />
      <NavItem
        icon={<BookOpenIcon size={16} />}
        label="阅读"
        isActive={activeSubPage === 'reading'}
        onClick={() => onSubPageChange('reading')}
      />
      <NavItem
        icon={<StickyNoteIcon size={16} />}
        label="笔记"
        isActive={activeSubPage === 'notes'}
        onClick={() => onSubPageChange('notes')}
      />
      <NavItem
        icon={<CheckCircle2 size={16} />}
        label="待办"
        isActive={activeSubPage === 'todos'}
        onClick={() => onSubPageChange('todos')}
      />
      <NavItem
        icon={<BotIcon size={16} />}
        label="Agent 待审核"
        isActive={activeSubPage === 'agent-review'}
        onClick={() => onSubPageChange('agent-review')}
      />
    </>
  );
}

function ProjectNav({
  activeSubPage,
  onSubPageChange,
}: {
  activeSubPage: string;
  onSubPageChange: (s: string) => void;
}): ReactElement {
  return (
    <>
      <SectionHeader label="MAIN MENU" />
      <NavItem
        icon={<LayoutDashboard size={16} />}
        label="Dashboard"
        isActive={activeSubPage === 'dashboard'}
        onClick={() => onSubPageChange('dashboard')}
      />
      <NavItem
        icon={<ListChecks size={16} />}
        label="Tasks"
        isActive={activeSubPage === 'tasks'}
        onClick={() => onSubPageChange('tasks')}
      />
      <ExpandableGroup
        icon={<FolderOpen size={16} />}
        label="Projects"
        badge={14}
        isActive={activeSubPage === 'projects'}
        onClick={() => onSubPageChange('projects')}
      >
        {/* project items would go here */}
      </ExpandableGroup>
    </>
  );
}

function AgentNav({
  activeSubPage,
  onSubPageChange,
}: {
  activeSubPage: string;
  onSubPageChange: (s: string) => void;
}): ReactElement {
  return (
    <>
      <SectionHeader label="MAIN MENU" />
      <NavItem
        icon={<BotMessageSquare size={16} />}
        label="Agent Hub"
        isActive={activeSubPage === 'hub'}
        onClick={() => onSubPageChange('hub')}
      />
      <NavItem
        icon={<MessageSquare size={16} />}
        label="Conversations"
        isActive={activeSubPage === 'conversations'}
        onClick={() => onSubPageChange('conversations')}
      />
      <NavItem
        icon={<Cpu size={16} />}
        label="Models"
        isActive={activeSubPage === 'models'}
        onClick={() => onSubPageChange('models')}
      />
      <NavItem
        icon={<Puzzle size={16} />}
        label="Skills"
        isActive={activeSubPage === 'skills'}
        onClick={() => onSubPageChange('skills')}
      />
      <NavItem
        icon={<Wrench size={16} />}
        label="Tools"
        isActive={activeSubPage === 'tools'}
        onClick={() => onSubPageChange('tools')}
      />
      <NavItem
        icon={<UserCog size={16} />}
        label="Roles"
        isActive={activeSubPage === 'roles'}
        onClick={() => onSubPageChange('roles')}
      />
      <NavItem
        icon={<Users size={16} />}
        label="Teams"
        isActive={activeSubPage === 'teams'}
        onClick={() => onSubPageChange('teams')}
      />
    </>
  );
}

function ResearchNav({
  activeSubPage,
  onSubPageChange,
}: {
  activeSubPage: string;
  onSubPageChange: (s: string) => void;
}): ReactElement {
  return (
    <>
      <SectionHeader label="MAIN MENU" />
      <NavItem
        icon={<BookOpen size={16} />}
        label="阅读"
        isActive={activeSubPage === 'reader'}
        onClick={() => onSubPageChange('reader')}
      />
      <NavItem
        icon={<Rss size={16} />}
        label="订阅管理"
        isActive={activeSubPage === 'subscriptions'}
        onClick={() => onSubPageChange('subscriptions')}
      />
    </>
  );
}

function JournalNav({
  activeSubPage,
  onSubPageChange,
}: {
  activeSubPage: string;
  onSubPageChange: (s: string) => void;
}): ReactElement {
  return (
    <>
      <SectionHeader label="MAIN MENU" />
      <NavItem
        icon={<CalendarDays size={16} />}
        label="今日日志"
        isActive={activeSubPage === 'today'}
        onClick={() => onSubPageChange('today')}
      />
      <NavItem
        icon={<List size={16} />}
        label="日志列表"
        isActive={activeSubPage === 'list'}
        onClick={() => onSubPageChange('list')}
      />
    </>
  );
}

function VisionNav({
  activeSubPage,
  onSubPageChange,
}: {
  activeSubPage: string;
  onSubPageChange: (s: string) => void;
}): ReactElement {
  return (
    <>
      <SectionHeader label="MAIN MENU" />
      <NavItem
        icon={<PenLine size={16} />}
        label="愿景编辑"
        isActive={activeSubPage === 'editor'}
        onClick={() => onSubPageChange('editor')}
      />
      <NavItem
        icon={<Library size={16} />}
        label="愿景列表"
        isActive={activeSubPage === 'list'}
        onClick={() => onSubPageChange('list')}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  ContextSidebar                                                     */
/* ------------------------------------------------------------------ */

export interface ContextSidebarProps {
  activeSection: string;
  activeSubPage: string;
  onSubPageChange: (subPage: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function ContextSidebar({
  activeSection,
  activeSubPage,
  onSubPageChange,
  onToggleCollapse,
}: ContextSidebarProps): ReactElement {
  const [themeMode, setThemeMode] = useState<OrbitThemeMode>(getCurrentTheme());

  const toggleTheme = () => {
    const next: OrbitThemeMode = themeMode === 'light' ? 'dark' : 'light';
    setTheme(next);
    setThemeMode(next);
  };

  const renderSectionNav = (): ReactNode => {
    switch (activeSection) {
      case 'inbox':
        return <InboxNav activeSubPage={activeSubPage} onSubPageChange={onSubPageChange} />;
      case 'project':
        return <ProjectNav activeSubPage={activeSubPage} onSubPageChange={onSubPageChange} />;
      case 'agent':
        return <AgentNav activeSubPage={activeSubPage} onSubPageChange={onSubPageChange} />;
      case 'research':
        return <ResearchNav activeSubPage={activeSubPage} onSubPageChange={onSubPageChange} />;
      case 'journal':
        return <JournalNav activeSubPage={activeSubPage} onSubPageChange={onSubPageChange} />;
      case 'vision':
        return <VisionNav activeSubPage={activeSubPage} onSubPageChange={onSubPageChange} />;
      default:
        return null;
    }
  };

  return (
    <aside className="flex flex-col w-60 shrink-0 border-r border-border bg-surface">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20">
            <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
            <circle cx="10" cy="10" r="3" />
          </svg>
          Orbit
        </div>
        <Button variant="ghost" isIconOnly size="sm" onPress={onToggleCollapse} className="text-muted">
          <ChevronLeft size={16} />
        </Button>
      </div>

      {/* Section navigation */}
      <div className="flex-1 overflow-y-auto px-2">
        {renderSectionNav()}
      </div>

      {/* System section */}
      <div className="px-2 pb-1">
        <Separator className="my-1" />
        <SectionHeader label="SYSTEM" />
        <div className="flex items-center justify-between px-3 py-2 text-sm text-muted">
          <span className="flex items-center gap-3">
            {themeMode === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            Dark Mode
          </span>
          <Switch
            size="sm"
            isSelected={themeMode === 'dark'}
            onChange={toggleTheme}
          >
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
          </Switch>
        </div>
        <NavItem
          icon={<Settings size={16} />}
          label="Settings"
          isActive={false}
          onClick={() => onSubPageChange('settings')}
        />
        <NavItem
          icon={<HelpCircle size={16} />}
          label="Help & Support"
          isActive={false}
          onClick={() => onSubPageChange('help')}
        />
      </div>

      {/* User profile */}
      <div className="flex items-center gap-3 px-4 py-3 border-t border-border">
        <div className="w-8 h-8 rounded-full bg-accent-soft flex items-center justify-center">
          <User size={14} className="text-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">User</div>
          <div className="text-xs text-muted truncate">user@orbit.app</div>
        </div>
        <ChevronDown size={14} className="text-muted shrink-0" />
      </div>
    </aside>
  );
}
