import { type ReactElement, useState, useMemo } from 'react';
import { Card, Chip, Button, Input } from '@heroui/react';
import { Search } from 'lucide-react';
import {
  CORE_TOOLSETS,
  APP_TOOLSETS,
  type BuiltinTool,
  type Toolset,
  type ToolSource,
} from '@orbit/agent-core';

// ---- Types ----

type SourceFilter = 'all' | 'system' | 'app' | 'mcp' | 'skill';

interface DisplayTool {
  tool: BuiltinTool;
  source: ToolSource;
  toolsetName: string;
}

// ---- Category metadata ----

const CATEGORY_META: Record<string, { label: string; icon: string; color: 'accent' | 'success' | 'warning' | 'danger' | 'default' }> = {
  terminal: { label: '终端', icon: '💻', color: 'danger' },
  filesystem: { label: '文件系统', icon: '📁', color: 'accent' },
  web: { label: '网络', icon: '🌐', color: 'success' },
  interaction: { label: '交互', icon: '💬', color: 'warning' },
  utility: { label: '工具', icon: '🔧', color: 'default' },
  code: { label: '代码', icon: '👨‍💻', color: 'default' },
  planning: { label: '规划', icon: '📋', color: 'accent' },
  workspace: { label: '工作区', icon: '🏢', color: 'success' },
};

function sourceLabel(source: ToolSource): string {
  switch (source) {
    case 'builtin': return 'System';
    case 'app': return 'App';
    case 'mcp': return 'MCP';
    case 'skill': return 'Skill';
  }
}

function sourceColor(source: ToolSource): 'default' | 'accent' | 'warning' | 'success' {
  switch (source) {
    case 'builtin': return 'default';
    case 'app': return 'accent';
    case 'mcp': return 'warning';
    case 'skill': return 'success';
  }
}

// ---- Mock MCP & Skill tools ----

const MOCK_MCP_TOOLS: DisplayTool[] = [
  {
    tool: { name: 'github_search', description: '搜索 GitHub 仓库和代码', category: 'web', parameters: {}, execute: async () => ({ success: true, output: '' }) },
    source: 'mcp',
    toolsetName: 'GitHub MCP',
  },
  {
    tool: { name: 'notion_search', description: '搜索 Notion 页面和数据库', category: 'web', parameters: {}, execute: async () => ({ success: true, output: '' }) },
    source: 'mcp',
    toolsetName: 'Notion MCP',
  },
];

const MOCK_SKILL_TOOLS: DisplayTool[] = [
  {
    tool: { name: 'plan_decompose', description: '将目标分解为子任务', category: 'planning', parameters: {}, execute: async () => ({ success: true, output: '' }) },
    source: 'skill',
    toolsetName: 'orbit:planning',
  },
];

// ---- Tool Card ----

function ToolCard({ item }: { item: DisplayTool }): ReactElement {
  const category = CATEGORY_META[item.tool.category] ?? { label: item.tool.category, icon: '🔧', color: 'default' as const };
  const hasParams = item.tool.parameters && Object.keys(item.tool.parameters).length > 0;

  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-xl">{category.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm font-semibold">{item.tool.name}</span>
            <Chip size="sm" color={category.color} variant="soft">{category.label}</Chip>
            <Chip size="sm" color={sourceColor(item.source)} variant="soft">{sourceLabel(item.source)}</Chip>
          </div>
          <p className="mt-1 text-sm text-muted">{item.tool.description}</p>
          {hasParams && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-muted">参数</summary>
              <pre className="mt-1 overflow-x-auto rounded bg-surface-secondary p-2 text-xs">
                {JSON.stringify(item.tool.parameters, null, 2)}
              </pre>
            </details>
          )}
        </div>
      </div>
    </Card>
  );
}

// ---- Main Page ----

export function ToolsPage(): ReactElement {
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const allTools = useMemo<DisplayTool[]>(() => {
    const result: DisplayTool[] = [];

    const addToolsets = (toolsets: readonly Toolset[], source: ToolSource) => {
      for (const ts of toolsets) {
        for (const tool of ts.tools) {
          result.push({ tool, source, toolsetName: ts.name });
        }
      }
    };

    addToolsets(CORE_TOOLSETS, 'builtin');
    addToolsets(APP_TOOLSETS, 'app');
    result.push(...MOCK_MCP_TOOLS);
    result.push(...MOCK_SKILL_TOOLS);

    return result;
  }, []);

  const counts = useMemo(() => {
    const c: Record<ToolSource, number> = { builtin: 0, app: 0, mcp: 0, skill: 0 };
    for (const item of allTools) c[item.source]++;
    return c;
  }, [allTools]);

  const filtered = useMemo(() => {
    let list = allTools;
    if (sourceFilter !== 'all') {
      const sourceMap: Record<SourceFilter, ToolSource | null> = {
        all: null, system: 'builtin', app: 'app', mcp: 'mcp', skill: 'skill',
      };
      const src = sourceMap[sourceFilter];
      if (src) list = list.filter((t) => t.source === src);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (t) => t.tool.name.toLowerCase().includes(q) || t.tool.description.toLowerCase().includes(q),
      );
    }
    return list;
  }, [allTools, sourceFilter, searchQuery]);

  const tabs: { key: SourceFilter; label: string }[] = [
    { key: 'all', label: `全部 (${allTools.length})` },
    { key: 'system', label: `System (${counts.builtin})` },
    { key: 'app', label: `App (${counts.app})` },
    { key: 'mcp', label: `MCP (${counts.mcp})` },
    { key: 'skill', label: `Skill (${counts.skill})` },
  ];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold">工具管理</h1>
        <p className="text-sm text-muted">{allTools.length} 个工具可用</p>
      </div>

      {/* Stats Row */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="px-4 py-3">
          <span className="orbit-meta text-xs text-muted">System</span>
          <p className="text-lg font-bold">{counts.builtin}</p>
        </Card>
        <Card className="px-4 py-3">
          <span className="orbit-meta text-xs text-muted">App</span>
          <p className="text-lg font-bold">{counts.app}</p>
        </Card>
        <Card className="px-4 py-3">
          <span className="orbit-meta text-xs text-muted">MCP</span>
          <p className="text-lg font-bold">{counts.mcp}</p>
        </Card>
        <Card className="px-4 py-3">
          <span className="orbit-meta text-xs text-muted">Skill</span>
          <p className="text-lg font-bold">{counts.skill}</p>
        </Card>
      </div>

      {/* Filter Bar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <Button
              key={tab.key}
              size="sm"
              variant={sourceFilter === tab.key ? 'primary' : 'ghost'}
              onPress={() => setSourceFilter(tab.key)}
            >
              {tab.label}
            </Button>
          ))}
        </div>
        <div className="flex-1 min-w-[200px]">
          <Input
            placeholder="搜索工具..."
            value={searchQuery}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Tool Grid */}
      {filtered.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <Search size={32} className="text-muted" />
          <p className="mt-3 text-sm font-medium text-muted">未找到匹配的工具</p>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-1 lg:grid-cols-2">
          {filtered.map((item) => (
            <ToolCard key={`${item.source}-${item.tool.name}`} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
