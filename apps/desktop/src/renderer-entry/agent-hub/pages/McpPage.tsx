import { type ReactElement, useState, useCallback } from 'react';
import { Card, Chip, Button, Input } from '@heroui/react';
import { Plus, Trash2, Download, ChevronDown, ChevronUp, Wifi, WifiOff } from 'lucide-react';
import type { McpServerStatus } from '@orbit/agent-core';

// ---- Mock data ----

interface MockMcpServer {
  id: string;
  name: string;
  description: string;
  transportType: 'stdio' | 'sse' | 'streamable-http';
  status: McpServerStatus;
  tools: string[];
  installedAt: string;
  error?: string;
}

const INITIAL_SERVERS: MockMcpServer[] = [
  {
    id: 'mcp-github',
    name: 'GitHub MCP',
    description: 'GitHub API 访问 — 仓库、Issue、PR 管理',
    transportType: 'stdio',
    status: 'connected',
    tools: ['github_search', 'github_create_issue', 'github_list_prs', 'github_read_file'],
    installedAt: new Date().toISOString(),
  },
  {
    id: 'mcp-notion',
    name: 'Notion MCP',
    description: 'Notion 数据库和页面访问',
    transportType: 'sse',
    status: 'disconnected',
    tools: ['notion_search', 'notion_create_page', 'notion_update_page'],
    installedAt: new Date().toISOString(),
  },
  {
    id: 'mcp-postgres',
    name: 'PostgreSQL MCP',
    description: '数据库查询与管理',
    transportType: 'streamable-http',
    status: 'error',
    tools: ['sql_query', 'sql_schema'],
    installedAt: new Date().toISOString(),
    error: 'Connection refused: localhost:5432',
  },
];

// ---- Helpers ----

function statusDot(status: McpServerStatus): string {
  switch (status) {
    case 'connected': return 'bg-green-500';
    case 'disconnected': return 'bg-gray-400';
    case 'connecting': return 'bg-yellow-400 animate-pulse';
    case 'error': return 'bg-red-500';
  }
}

function statusLabel(status: McpServerStatus): string {
  switch (status) {
    case 'connected': return '已连接';
    case 'disconnected': return '未连接';
    case 'connecting': return '连接中...';
    case 'error': return '连接错误';
  }
}

function transportColor(type: string): 'default' | 'accent' | 'warning' {
  switch (type) {
    case 'stdio': return 'default';
    case 'sse': return 'accent';
    default: return 'warning';
  }
}

// ---- Server Card ----

function ServerCard({
  server,
  onToggleConnection,
  onDelete,
}: {
  server: MockMcpServer;
  onToggleConnection: () => void;
  onDelete: () => void;
}): ReactElement {
  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isConnected = server.status === 'connected';

  return (
    <Card className="overflow-hidden">
      <div
        className="flex cursor-pointer items-center gap-3 px-4 py-3"
        onClick={() => setExpanded((v) => !v)}
      >
        <span className={`orbit-dot h-2.5 w-2.5 shrink-0 rounded-full ${statusDot(server.status)}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold truncate">{server.name}</span>
            <Chip size="sm" color={transportColor(server.transportType)} variant="soft">
              {server.transportType}
            </Chip>
          </div>
          <p className="text-xs text-muted truncate">{server.description}</p>
        </div>

        <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
          <Button
            size="sm"
            variant={isConnected ? 'outline' : 'primary'}
            onPress={onToggleConnection}
          >
            {isConnected ? <><WifiOff size={14} /> 断开</> : <><Wifi size={14} /> 连接</>}
          </Button>
        </div>

        {expanded ? <ChevronUp size={14} className="text-muted shrink-0" /> : <ChevronDown size={14} className="text-muted shrink-0" />}
      </div>

      {expanded && (
        <div className="border-t border-border px-4 py-3">
          {server.error && (
            <div className="mb-3 rounded bg-red-500/10 px-3 py-2 text-xs text-red-400">
              ⚠️ {server.error}
            </div>
          )}

          <div className="mb-3">
            <span className="orbit-meta text-xs font-medium text-muted">状态</span>
            <p className="mt-1 text-sm">{statusLabel(server.status)}</p>
          </div>

          {server.tools.length > 0 && (
            <div className="mb-3">
              <span className="orbit-meta text-xs font-medium text-muted">工具 ({server.tools.length})</span>
              <div className="mt-1 flex flex-wrap gap-1">
                {server.tools.map((tool) => (
                  <Chip key={tool} size="sm" variant="soft" color="accent">
                    {tool}
                  </Chip>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            {confirmDelete ? (
              <>
                <Button size="sm" variant="danger" onPress={onDelete}>
                  确认删除
                </Button>
                <Button size="sm" variant="ghost" onPress={() => setConfirmDelete(false)}>
                  取消
                </Button>
              </>
            ) : (
              <Button size="sm" variant="danger-soft" onPress={() => setConfirmDelete(true)}>
                <Trash2 size={14} /> 卸载
              </Button>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

// ---- Main Page ----

export function McpPage(): ReactElement {
  const [servers, setServers] = useState<MockMcpServer[]>(INITIAL_SERVERS);
  const [installUrl, setInstallUrl] = useState('');
  const [installing, setInstalling] = useState(false);

  const connectedCount = servers.filter((s) => s.status === 'connected').length;
  const totalTools = servers.reduce((sum, s) => sum + s.tools.length, 0);

  const handleToggleConnection = useCallback((id: string) => {
    setServers((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        if (s.status === 'connected') return { ...s, status: 'disconnected' as const };
        return { ...s, status: 'connected' as const, error: undefined };
      }),
    );
  }, []);

  const handleDelete = useCallback((id: string) => {
    setServers((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const handleInstallUrl = useCallback(() => {
    if (!installUrl.trim()) return;
    setInstalling(true);
    setTimeout(() => {
      const newServer: MockMcpServer = {
        id: `mcp-${Date.now()}`,
        name: installUrl.split('/').pop() ?? 'Custom Server',
        description: `从 ${installUrl} 安装`,
        transportType: 'sse',
        status: 'disconnected',
        tools: [],
        installedAt: new Date().toISOString(),
      };
      setServers((prev) => [...prev, newServer]);
      setInstallUrl('');
      setInstalling(false);
    }, 800);
  }, [installUrl]);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">MCP 服务管理</h1>
          <p className="text-sm text-muted">{servers.length} 个服务已注册</p>
        </div>
        <Button variant="primary" onPress={() => document.getElementById('mcp-url-input')?.focus()}>
          <Plus size={16} />
          添加服务
        </Button>
      </div>

      {/* Stats Bar */}
      <div className="mb-6 flex gap-4">
        <Card className="flex-1 px-4 py-3">
          <span className="orbit-meta text-xs text-muted">已连接服务</span>
          <p className="text-lg font-bold text-green-500">{connectedCount}</p>
        </Card>
        <Card className="flex-1 px-4 py-3">
          <span className="orbit-meta text-xs text-muted">总计工具</span>
          <p className="text-lg font-bold">{totalTools}</p>
        </Card>
      </div>

      {/* URL Install */}
      <div className="mb-6 flex gap-2">
        <Input
          id="mcp-url-input"
          placeholder="输入 MCP 服务 URL..."
          value={installUrl}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInstallUrl(e.target.value)}
          className="flex-1"
        />
        <Button variant="primary" isDisabled={!installUrl.trim() || installing} onPress={handleInstallUrl}>
          <Download size={16} />
          {installing ? '安装中...' : '安装'}
        </Button>
      </div>

      {/* Server List */}
      {servers.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <span className="text-4xl">🔌</span>
          <p className="mt-3 text-sm font-medium text-muted">暂无 MCP 服务</p>
          <p className="mt-1 text-xs text-muted">添加 MCP Server 来扩展 Agent 能力</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {servers.map((server) => (
            <ServerCard
              key={server.id}
              server={server}
              onToggleConnection={() => handleToggleConnection(server.id)}
              onDelete={() => handleDelete(server.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
