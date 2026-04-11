import { type ReactElement } from 'react';
import { Card, Chip } from '@heroui/react';
import {
  CORE_TOOLSETS,
  type BuiltinTool,
} from '@orbit/agent-core';

const CATEGORY_META: Record<string, { label: string; icon: string; color: 'accent' | 'success' | 'warning' | 'danger' | 'default' }> = {
  terminal: { label: '终端', icon: '💻', color: 'danger' },
  filesystem: { label: '文件系统', icon: '📁', color: 'accent' },
  web: { label: '网络', icon: '🌐', color: 'success' },
  interaction: { label: '交互', icon: '💬', color: 'warning' },
  utility: { label: '工具', icon: '🔧', color: 'accent' },
  code: { label: '代码', icon: '👨‍💻', color: 'default' },
};

function ToolCard({ tool }: { tool: BuiltinTool }): ReactElement {
  const category = CATEGORY_META[tool.category] ?? CATEGORY_META.utility;

  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-2xl">{category.icon}</span>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-semibold">{tool.name}</span>
            <Chip size="sm" color={category.color} variant="soft">{category.label}</Chip>
          </div>
          <p className="mt-1 text-sm text-muted">{tool.description}</p>
          {tool.parameters && Object.keys(tool.parameters).length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-muted">参数 Schema</summary>
              <pre className="mt-1 overflow-x-auto rounded bg-surface-secondary p-2 text-xs">
                {JSON.stringify(tool.parameters, null, 2)}
              </pre>
            </details>
          )}
        </div>
      </div>
    </Card>
  );
}

export function ToolsPage(): ReactElement {
  // Collect all tools from CORE_TOOLSETS
  const allTools: BuiltinTool[] = [];
  for (const toolset of CORE_TOOLSETS) {
    allTools.push(...toolset.tools);
  }

  // Group by category
  const grouped = new Map<string, BuiltinTool[]>();
  for (const tool of allTools) {
    const list = grouped.get(tool.category) ?? [];
    list.push(tool);
    grouped.set(tool.category, list);
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold">工具</h1>
        <p className="text-sm text-muted">
          {allTools.length} 个内置工具 · {CORE_TOOLSETS.length} 个工具集
        </p>
      </div>

      {/* Summary chips */}
      <div className="mb-6 flex flex-wrap gap-2">
        {Array.from(grouped.entries()).map(([cat, tools]) => {
          const meta = CATEGORY_META[cat] ?? CATEGORY_META.utility;
          return (
            <Chip key={cat} color={meta.color} variant="soft">
              {meta.icon} {meta.label} ({tools.length})
            </Chip>
          );
        })}
      </div>

      {/* Tool cards grouped by category */}
      {Array.from(grouped.entries()).map(([cat, tools]) => {
        const meta = CATEGORY_META[cat] ?? CATEGORY_META.utility;
        return (
          <div key={cat} className="mb-6">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
              <span>{meta.icon}</span>
              {meta.label}
              <Chip size="sm" variant="soft">{tools.length}</Chip>
            </h2>
            <div className="flex flex-col gap-3">
              {tools.map((tool) => (
                <ToolCard key={tool.name} tool={tool} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
