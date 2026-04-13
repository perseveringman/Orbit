import { type ReactElement, useState, useCallback, useEffect } from 'react';
import { Card, Chip, Button, Input } from '@heroui/react';
import { Plus, Trash2, Download, ChevronDown, ChevronUp, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import type { McpServerStatus } from '@orbit/agent-core';
import type { McpServerInfo } from '../../../shared/contracts';

// ---- Bridge helper ----

function getBridge(): any | undefined {
  return (window as any).orbitDesktop;
}

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
  loading,
}: {
  server: McpServerInfo;
  onToggleConnection: () => void;
  onDelete: () => void;
  loading: boolean;
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
            isDisabled={loading || server.status === 'connecting'}
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
                  <Chip key={tool.name} size="sm" variant="soft" color="accent">
                    {tool.name}
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

// ---- Add Server Form ----

type TransportType = 'stdio' | 'sse' | 'streamable-http';

function AddServerForm({ onInstall, installing }: {
  onInstall: (name: string, desc: string, type: TransportType, cmdOrUrl: string) => void;
  installing: boolean;
}): ReactElement {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [transportType, setTransportType] = useState<TransportType>('stdio');
  const [cmdOrUrl, setCmdOrUrl] = useState('');
  const [showForm, setShowForm] = useState(false);

  if (!showForm) {
    return (
      <Button variant="primary" onPress={() => setShowForm(true)}>
        <Plus size={16} /> 添加 MCP 服务
      </Button>
    );
  }

  const canSubmit = name.trim() && cmdOrUrl.trim() && !installing;

  return (
    <Card className="p-4">
      <h3 className="mb-3 text-sm font-semibold">添加 MCP 服务</h3>
      <div className="flex flex-col gap-3">
        <div className="flex gap-3">
          <Input
            placeholder="服务名称"
            value={name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
            className="flex-1"
          />
          <Input
            placeholder="描述（可选）"
            value={desc}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDesc(e.target.value)}
            className="flex-1"
          />
        </div>

        <div className="flex gap-2">
          {(['stdio', 'sse', 'streamable-http'] as const).map((t) => (
            <button
              key={t}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                transportType === t
                  ? 'bg-primary/20 text-primary'
                  : 'bg-default-100 text-muted hover:bg-default-200'
              }`}
              onClick={() => setTransportType(t)}
            >
              {t}
            </button>
          ))}
        </div>

        <Input
          placeholder={transportType === 'stdio' ? '命令 (如: npx -y @modelcontextprotocol/server-github)' : 'URL (如: http://localhost:3000/mcp)'}
          value={cmdOrUrl}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCmdOrUrl(e.target.value)}
        />

        <div className="flex gap-2">
          <Button
            variant="primary"
            isDisabled={!canSubmit}
            onPress={() => {
              onInstall(name.trim(), desc.trim(), transportType, cmdOrUrl.trim());
              setName('');
              setDesc('');
              setCmdOrUrl('');
              setShowForm(false);
            }}
          >
            <Download size={16} /> {installing ? '安装中...' : '安装'}
          </Button>
          <Button variant="ghost" onPress={() => setShowForm(false)}>取消</Button>
        </div>
      </div>
    </Card>
  );
}

// ---- Main Page ----

export function McpPage(): ReactElement {
  const [servers, setServers] = useState<McpServerInfo[]>([]);
  const [installing, setInstalling] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connectedCount = servers.filter((s) => s.status === 'connected').length;
  const totalTools = servers.reduce((sum, s) => sum + s.tools.length, 0);

  // Fetch servers from main process
  const refreshServers = useCallback(async () => {
    const bridge = getBridge();
    if (!bridge?.mcpListServers) return;
    try {
      const list = await bridge.mcpListServers();
      setServers(list);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to list servers');
    }
  }, []);

  useEffect(() => { void refreshServers(); }, [refreshServers]);

  const handleToggleConnection = useCallback(async (id: string) => {
    const bridge = getBridge();
    if (!bridge) return;
    setLoading(true);
    try {
      const server = servers.find((s) => s.id === id);
      if (server?.status === 'connected') {
        await bridge.mcpDisconnect(id);
      } else {
        await bridge.mcpConnect(id);
      }
      await refreshServers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Connection error');
    } finally {
      setLoading(false);
    }
  }, [servers, refreshServers]);

  const handleDelete = useCallback(async (id: string) => {
    const bridge = getBridge();
    if (!bridge) return;
    try {
      await bridge.mcpUninstall(id);
      await refreshServers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Delete error');
    }
  }, [refreshServers]);

  const handleInstall = useCallback(async (
    name: string,
    description: string,
    transportType: TransportType,
    cmdOrUrl: string,
  ) => {
    const bridge = getBridge();
    if (!bridge) return;
    setInstalling(true);
    try {
      const transport = transportType === 'stdio'
        ? { type: 'stdio' as const, command: cmdOrUrl }
        : { type: transportType, url: cmdOrUrl };
      await bridge.mcpInstall({ name, description: description || `MCP server: ${name}`, transport });
      await refreshServers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Install error');
    } finally {
      setInstalling(false);
    }
  }, [refreshServers]);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">MCP 服务管理</h1>
          <p className="text-sm text-muted">{servers.length} 个服务已注册</p>
        </div>
        <Button variant="ghost" size="sm" onPress={() => void refreshServers()}>
          <RefreshCw size={14} /> 刷新
        </Button>
      </div>

      {error && (
        <div className="mb-4 rounded bg-red-500/10 px-3 py-2 text-xs text-red-400">
          ⚠️ {error}
          <button className="ml-2 underline" onClick={() => setError(null)}>dismiss</button>
        </div>
      )}

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

      {/* Add Server */}
      <div className="mb-6">
        <AddServerForm onInstall={handleInstall} installing={installing} />
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
              loading={loading}
              onToggleConnection={() => void handleToggleConnection(server.id)}
              onDelete={() => void handleDelete(server.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
