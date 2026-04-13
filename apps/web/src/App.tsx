import { useState, type ReactElement } from 'react';
import { ChevronRight } from 'lucide-react';
import { Button } from '@heroui/react';

import { IconRail, ContextSidebar, TopBar } from './components/layout';
import { InboxPage } from './pages/inbox';
import { VisionPage } from './pages/vision';
import { ReaderPage } from './pages/reader';
import { JournalPage } from './pages/journal';
import { TasksPage, ProjectsPage } from './pages/project';
import { TodayPage, FocusPage, ReviewPage } from './pages/task';

import { OverviewPage as AgentOverviewPage } from '../../desktop/src/renderer-entry/agent-hub/pages/OverviewPage';
import { ChatPage as AgentChatPage } from '../../desktop/src/renderer-entry/agent-hub/pages/ChatPage';
import { ModelsPage as AgentModelsPage } from '../../desktop/src/renderer-entry/agent-hub/pages/ModelsPage';
import { SkillsPage as AgentSkillsPage } from '../../desktop/src/renderer-entry/agent-hub/pages/SkillsPage';

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
  // Inbox section
  if (section === 'inbox') {
    return <InboxPage subPage={subPage} />;
  }

  // Project section
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

  // Agent section
  if (section === 'agent') {
    switch (subPage) {
      case 'hub': return <AgentOverviewPage />;
      case 'conversations': return <AgentChatPage />;
      case 'models': return <AgentModelsPage />;
      case 'skills': return <AgentSkillsPage />;
      default: return <AgentOverviewPage />;
    }
  }

  // Research section
  if (section === 'research') {
    switch (subPage) {
      case 'reader': return <ReaderPage />;
      case 'subscriptions': return <Placeholder name="订阅管理" />;
      default: return <ReaderPage />;
    }
  }

  // Journal section
  if (section === 'journal') {
    switch (subPage) {
      case 'today': return <JournalPage />;
      case 'list': return <Placeholder name="日志列表" />;
      default: return <JournalPage />;
    }
  }

  // Vision section
  if (section === 'vision') {
    switch (subPage) {
      case 'editor': return <VisionPage />;
      case 'list': return <Placeholder name="愿景列表" />;
      default: return <VisionPage />;
    }
  }

  return <Placeholder name={section} />;
}

export default function App(): ReactElement {
  const [activeSection, setActiveSection] = useState('project');
  const [activeSubPage, setActiveSubPage] = useState('tasks');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const handleSectionChange = (section: string) => {
    setActiveSection(section);
    setActiveSubPage(DEFAULT_SUB_PAGE[section] ?? 'dashboard');
  };

  return (
    <div className="flex h-screen bg-background text-foreground">
      <IconRail activeSection={activeSection} onSectionChange={handleSectionChange} />

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

      <main className="flex-1 flex flex-col overflow-hidden">
        <TopBar />
        <div className="flex-1 overflow-y-auto">
          {renderPage(activeSection, activeSubPage)}
        </div>
      </main>
    </div>
  );
}
