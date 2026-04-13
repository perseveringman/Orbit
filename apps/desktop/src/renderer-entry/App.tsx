import { useState, useEffect, useCallback, type ReactElement } from 'react';
import { ChevronRight } from 'lucide-react';
import { Button } from '@heroui/react';

import { createElectronRuntimeAdapter } from '@orbit/platform-electron';

import { createFallbackDesktopBridge } from '../shared/contracts';
import { AgentDevTools } from './agent-devtools/AgentDevTools';
import { AgentHub } from './agent-hub/AgentHub';

import { IconRail, ContextSidebar, TopBar } from '../../../web/src/components/layout';
import { InboxPage } from '../../../web/src/pages/inbox';
import { VisionPage } from '../../../web/src/pages/vision';
import { ReaderPage } from '../../../web/src/pages/reader';
import { JournalPage } from '../../../web/src/pages/journal';
import { TodayPage, FocusPage, ReviewPage } from '../../../web/src/pages/task';
import { TasksPage, ProjectsPage } from '../../../web/src/pages/project';

import { OverviewPage as AgentOverviewPage } from './agent-hub/pages/OverviewPage';
import { ChatPage as AgentChatPage } from './agent-hub/pages/ChatPage';
import { ModelsPage as AgentModelsPage } from './agent-hub/pages/ModelsPage';
import { SkillsPage as AgentSkillsPage } from './agent-hub/pages/SkillsPage';
import { ToolsPage as AgentToolsPage } from './agent-hub/pages/ToolsPage';
import { McpPage as AgentMcpPage } from './agent-hub/pages/McpPage';
import { UsagePage as AgentUsagePage } from './agent-hub/pages/UsagePage';
import { TracesPage as AgentTracesPage } from './agent-hub/pages/TracesPage';
import { DevToolsPage as AgentDevToolsPage } from './agent-hub/pages/DevToolsPage';

/* Default sub-pages per section */
const DEFAULT_SUB_PAGE: Record<string, string> = {
  inbox: 'all',
  project: 'tasks',
  agent: 'hub',
  research: 'reader',
  journal: 'today',
  vision: 'editor',
};

function Placeholder({ name }: { name: string }): ReactElement {
  return (
    <div className="flex items-center justify-center h-full text-muted">
      <p className="text-lg">{name} — 即将推出</p>
    </div>
  );
}

function renderPage(section: string, subPage: string): ReactElement {
  if (section === 'inbox') {
    return <InboxPage subPage={subPage} />;
  }

  if (section === 'project') {
    switch (subPage) {
      case 'dashboard': return <Placeholder name="仪表盘" />;
      case 'tasks':
      case 'tasks-todo':
      case 'tasks-progress':
      case 'tasks-review':
      case 'tasks-done':
        return <TasksPage />;
      case 'projects': return <ProjectsPage />;
      case 'clients': return <Placeholder name="Clients" />;
      case 'templates': return <Placeholder name="Templates" />;
      case 'notes': return <Placeholder name="Notes" />;
      default: return <TasksPage />;
    }
  }

  if (section === 'agent') {
    switch (subPage) {
      case 'hub': return <AgentOverviewPage />;
      case 'conversations': return <AgentChatPage />;
      case 'models': return <AgentModelsPage />;
      case 'skills': return <AgentSkillsPage />;
      case 'tools': return <AgentToolsPage />;
      case 'mcp': return <AgentMcpPage />;
      case 'usage': return <AgentUsagePage />;
      case 'traces': return <AgentTracesPage />;
      case 'devtools': return <AgentDevToolsPage />;
      default: return <AgentOverviewPage />;
    }
  }

  if (section === 'research') {
    switch (subPage) {
      case 'reader': return <ReaderPage />;
      case 'subscriptions': return <Placeholder name="订阅管理" />;
      default: return <ReaderPage />;
    }
  }

  if (section === 'journal') {
    switch (subPage) {
      case 'today': return <JournalPage />;
      case 'list': return <Placeholder name="日志列表" />;
      default: return <JournalPage />;
    }
  }

  if (section === 'vision') {
    switch (subPage) {
      case 'editor': return <VisionPage />;
      case 'list': return <Placeholder name="愿景列表" />;
      default: return <VisionPage />;
    }
  }

  return <Placeholder name={section} />;
}

export function App() {
  const bridge = window.orbitDesktop ?? createFallbackDesktopBridge();
  const runtime = createElectronRuntimeAdapter();

  const [activeSection, setActiveSection] = useState('project');
  const [activeSubPage, setActiveSubPage] = useState('tasks');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showDevTools, setShowDevTools] = useState(false);
  const [showAgentHub, setShowAgentHub] = useState(false);

  const handleSectionChange = (section: string) => {
    setActiveSection(section);
    setActiveSubPage(DEFAULT_SUB_PAGE[section] ?? 'dashboard');
  };

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
  void bridge;

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

      {/* ===== ICON RAIL (1st column) ===== */}
      <IconRail activeSection={activeSection} onSectionChange={handleSectionChange} />

      {/* ===== CONTEXT SIDEBAR (2nd column) ===== */}
      {sidebarCollapsed ? (
        <div className="flex items-start pt-3 shrink-0">
          <Button
            variant="ghost"
            isIconOnly
            size="sm"
            onPress={() => setSidebarCollapsed(false)}
            className="text-muted"
          >
            <ChevronRight size={16} />
          </Button>
        </div>
      ) : (
        <ContextSidebar
          activeSection={activeSection}
          activeSubPage={activeSubPage}
          onSubPageChange={setActiveSubPage}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(true)}
        />
      )}

      {/* ===== MAIN CONTENT ===== */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <TopBar />
        <div className="flex-1 overflow-y-auto">
          {renderPage(activeSection, activeSubPage)}
        </div>
      </main>
    </div>
  );
}
