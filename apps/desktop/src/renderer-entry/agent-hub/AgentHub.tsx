import { type ReactElement, useState, useCallback, useMemo } from 'react';
import { Tabs, Tab, Chip } from '@heroui/react';

import { OverviewPage } from './pages/OverviewPage';
import { ChatPage } from './pages/ChatPage';
import { ModelsPage } from './pages/ModelsPage';
import { ToolsPage } from './pages/ToolsPage';
import { SkillsPage } from './pages/SkillsPage';
import { McpPage } from './pages/McpPage';
import { UsagePage } from './pages/UsagePage';
import { TracesPage } from './pages/TracesPage';
import { DevToolsPage } from './pages/DevToolsPage';

export type AgentHubTab =
  | 'overview'
  | 'chat'
  | 'models'
  | 'tools'
  | 'skills'
  | 'mcp'
  | 'usage'
  | 'traces'
  | 'devtools';

interface TabMeta {
  readonly id: AgentHubTab;
  readonly label: string;
  readonly icon: string;
  readonly description: string;
}

const TABS: readonly TabMeta[] = [
  { id: 'overview', label: '概览', icon: '📊', description: 'Agent 系统总览' },
  { id: 'chat', label: '对话', icon: '💬', description: 'Agent 对话' },
  { id: 'models', label: '模型', icon: '🤖', description: 'LLM 模型配置' },
  { id: 'tools', label: '工具', icon: '🔧', description: '内置工具能力' },
  { id: 'skills', label: '技能', icon: '🎯', description: 'Domain Agent 配置' },
  { id: 'mcp', label: 'MCP', icon: '🔌', description: '外部 MCP 服务' },
  { id: 'usage', label: '用量', icon: '📈', description: 'Token 用量与费用' },
  { id: 'traces', label: '追踪', icon: '🔍', description: '执行链路追踪' },
  { id: 'devtools', label: '调试', icon: '🔬', description: '事件流与可观测' },
] as const;

interface AgentHubProps {
  onClose: () => void;
}

export function AgentHub({ onClose }: AgentHubProps): ReactElement {
  const [activeTab, setActiveTab] = useState<AgentHubTab>('overview');

  const handleTabChange = useCallback((key: React.Key) => {
    setActiveTab(key as AgentHubTab);
  }, []);

  const pageContent = useMemo(() => {
    switch (activeTab) {
      case 'overview': return <OverviewPage />;
      case 'chat': return <ChatPage />;
      case 'models': return <ModelsPage />;
      case 'tools': return <ToolsPage />;
      case 'skills': return <SkillsPage />;
      case 'mcp': return <McpPage />;
      case 'usage': return <UsagePage />;
      case 'traces': return <TracesPage />;
      case 'devtools': return <DevToolsPage />;
    }
  }, [activeTab]);

  return (
    <div className="flex h-screen w-full bg-background text-foreground">
      {/* Left sidebar navigation */}
      <aside className="flex w-56 flex-col border-r border-border bg-surface">
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <span className="text-lg">🤖</span>
          <span className="text-sm font-semibold">Agent Hub</span>
          <button
            onClick={onClose}
            className="ml-auto rounded-md p-1 text-muted transition-colors hover:bg-surface-tertiary hover:text-muted"
            title="返回工作台"
          >
            ✕
          </button>
        </div>

        {/* Tab navigation */}
        <nav className="flex-1 overflow-y-auto px-2 py-2">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`mb-0.5 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                activeTab === tab.id
                  ? 'bg-accent-soft font-medium text-accent'
                  : 'text-muted hover:bg-surface-secondary hover:text-foreground'
              }`}
            >
              <span className="text-base">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-border px-3 py-2">
          <div className="flex items-center gap-2 text-xs text-muted">
            <Chip size="sm" variant="soft" color="success">v0.1</Chip>
            <span>Orbit Agent Core</span>
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <main className="flex-1 overflow-y-auto">
        {pageContent}
      </main>
    </div>
  );
}
