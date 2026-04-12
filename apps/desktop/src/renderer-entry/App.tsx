import { useState, useEffect, useCallback, type ReactElement } from 'react';
import {
  FolderOpen, ClipboardList, Calendar, Crosshair, BarChart3,
  Settings, Moon, Sun, User, Compass, BookOpen, BookText,
  Trash2, Bot, Microscope
} from 'lucide-react';
import { Button, Separator } from '@heroui/react';

import { createElectronRuntimeAdapter } from '@orbit/platform-electron';
import { setTheme, getCurrentTheme, type OrbitThemeMode } from '@orbit/ui-dom';

import { createFallbackDesktopBridge } from '../shared/contracts';
import { AgentDevTools } from './agent-devtools/AgentDevTools';
import { AgentHub } from './agent-hub/AgentHub';

import { SectionHeader, NavItem } from '../../../web/src/components/shared';
import { VisionPage } from '../../../web/src/pages/vision';
import { ReaderPage } from '../../../web/src/pages/reader';
import { JournalPage } from '../../../web/src/pages/journal';
import { TodayPage, FocusPage, ReviewPage, ProjectsPage, TasksPage } from '../../../web/src/pages/task';

type NavId = 'vision' | 'reader' | 'journal' | 'today' | 'focus' | 'review' | 'projects' | 'tasks';

const NAV_GROUPS: { label: string; items: { id: NavId; label: string; icon: ReactElement }[] }[] = [
  {
    label: '方向',
    items: [
      { id: 'vision', label: '愿景', icon: <Compass size={16} /> },
    ],
  },
  {
    label: '输入',
    items: [
      { id: 'reader', label: '阅读', icon: <BookOpen size={16} /> },
      { id: 'journal', label: '日志', icon: <BookText size={16} /> },
    ],
  },
  {
    label: '执行',
    items: [
      { id: 'today', label: '今天', icon: <Calendar size={16} /> },
      { id: 'focus', label: '专注', icon: <Crosshair size={16} /> },
      { id: 'review', label: '复盘', icon: <BarChart3 size={16} /> },
      { id: 'projects', label: '项目', icon: <FolderOpen size={16} /> },
      { id: 'tasks', label: '任务', icon: <ClipboardList size={16} /> },
    ],
  },
];

function renderPage(navId: NavId): ReactElement {
  switch (navId) {
    case 'vision': return <VisionPage />;
    case 'reader': return <ReaderPage />;
    case 'journal': return <JournalPage />;
    case 'today': return <TodayPage />;
    case 'focus': return <FocusPage />;
    case 'review': return <ReviewPage />;
    case 'projects': return <ProjectsPage />;
    case 'tasks': return <TasksPage />;
  }
}

export function App() {
  const bridge = window.orbitDesktop ?? createFallbackDesktopBridge();
  const runtime = createElectronRuntimeAdapter();

  const [themeMode, setThemeMode] = useState<OrbitThemeMode>(getCurrentTheme());
  const [activeNav, setActiveNav] = useState<NavId>('today');
  const [showDevTools, setShowDevTools] = useState(false);
  const [showAgentHub, setShowAgentHub] = useState(false);

  // Keyboard shortcut: Cmd/Ctrl + Shift + A to toggle Agent Hub
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'a') {
        e.preventDefault();
        setShowAgentHub((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleCloseDevTools = useCallback(() => setShowDevTools(false), []);
  const handleCloseAgentHub = useCallback(() => setShowAgentHub(false), []);

  // Keep runtime reference alive
  void runtime;

  const toggleTheme = () => {
    const next: OrbitThemeMode = themeMode === 'light' ? 'dark' : 'light';
    setTheme(next);
    setThemeMode(next);
  };

  // If Agent Hub is active, render it full-screen
  if (showAgentHub) {
    return <AgentHub onClose={handleCloseAgentHub} />;
  }

  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* ===== AGENT DEVTOOLS PANEL ===== */}
      {showDevTools && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            right: 0,
            width: 520,
            height: '100vh',
            zIndex: 9999,
            boxShadow: '-4px 0 24px rgba(0,0,0,0.4)',
          }}
        >
          <AgentDevTools onClose={handleCloseDevTools} />
        </div>
      )}

      {/* ===== SIDEBAR ===== */}
      <aside className="flex flex-col w-60 border-r border-border bg-surface shrink-0">
        <div data-titlebar className="flex items-center gap-2 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20">
              <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
              <circle cx="10" cy="10" r="3" />
            </svg>
            Orbit Desktop
          </div>
        </div>

        <div className="px-2 pb-2">
          <Button variant="primary" fullWidth>+ 新对象</Button>
        </div>

        <div className="flex-1 overflow-y-auto px-2">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <SectionHeader label={group.label} />
              {group.items.map((item) => (
                <NavItem
                  key={item.id}
                  icon={item.icon}
                  label={item.label}
                  isActive={activeNav === item.id}
                  onClick={() => setActiveNav(item.id)}
                />
              ))}
            </div>
          ))}
        </div>

        <div className="px-2 pb-2">
          <Separator />
          <button className="flex items-center gap-2 w-full rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface-secondary transition-colors">
            <Trash2 size={14} /> 回收站
          </button>
        </div>

        <div className="flex items-center justify-center gap-1 px-2 py-2 border-t border-border">
          <Button variant="ghost" isIconOnly size="sm"><Settings size={16} /></Button>
          <Button variant="ghost" isIconOnly size="sm" onPress={toggleTheme}>
            {themeMode === 'light' ? <Moon size={16} /> : <Sun size={16} />}
          </Button>
          <Button
            variant="ghost"
            isIconOnly
            size="sm"
            onPress={() => setShowAgentHub(true)}
            aria-label="Agent Hub (⌘⇧A)"
          >
            <Bot size={16} />
          </Button>
          <Button
            variant="ghost"
            isIconOnly
            size="sm"
            onPress={() => setShowDevTools((v) => !v)}
            aria-label="Agent DevTools"
            className={showDevTools ? 'bg-accent rounded-md' : undefined}
          >
            <Microscope size={16} />
          </Button>
          <Button variant="ghost" isIconOnly size="sm"><User size={16} /></Button>
        </div>
      </aside>

      {/* ===== MAIN CONTENT ===== */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {renderPage(activeNav)}
      </main>
    </div>
  );
}
