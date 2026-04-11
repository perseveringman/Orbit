import React, { type ReactElement, useState, useCallback } from 'react';
import { Card, Button, Chip, Input, Switch } from '@heroui/react';

const MCP_STORAGE_KEY = 'orbit:mcp-servers';

interface McpServer {
  id: string;
  name: string;
  url: string;
  authToken: string;
  enabled: boolean;
  status: 'unknown' | 'connected' | 'error';
  lastTested?: number;
  discoveredTools?: string[];
  discoveredResources?: string[];
}

function loadServers(): McpServer[] {
  try {
    const raw = localStorage.getItem(MCP_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as McpServer[]) : [];
  } catch { return []; }
}

function saveServers(servers: McpServer[]): void {
  localStorage.setItem(MCP_STORAGE_KEY, JSON.stringify(servers));
}

function ServerCard({ server, onUpdate, onDelete, onTest }: {
  server: McpServer;
  onUpdate: (updates: Partial<McpServer>) => void;
  onDelete: () => void;
  onTest: () => void;
}): ReactElement {
  const [expanded, setExpanded] = useState(false);
  const [showToken, setShowToken] = useState(false);

  return (
    <Card className={`transition-all ${server.enabled ? 'border-2 border-success' : 'border border-border'}`}>
      <div className="flex cursor-pointer items-center gap-3 px-4 py-3" onClick={() => setExpanded((v) => !v)}>
        <span className="text-xl">🔌</span>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{server.name || 'Unnamed Server'}</span>
            {server.status === 'connected' && <Chip size="sm" color="success" variant="soft">已连接</Chip>}
            {server.status === 'error' && <Chip size="sm" color="danger" variant="soft">错误</Chip>}
            {server.status === 'unknown' && <Chip size="sm" color="default" variant="soft">未测试</Chip>}
          </div>
          <p className="text-xs text-muted">{server.url || '未配置 URL'}</p>
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <Switch
            size="sm"
            isSelected={server.enabled}
            onChange={(v) => onUpdate({ enabled: v })}
          />
        </div>
        <span className="text-muted">{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div className="border-t border-border px-4 py-3">
          <div className="flex flex-col gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">名称</label>
              <Input
                placeholder="My MCP Server"
                value={server.name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUpdate({ name: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Server URL</label>
              <Input
                placeholder="https://mcp.example.com"
                value={server.url}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUpdate({ url: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Auth Token</label>
              <div className="flex gap-2">
                <Input
                  type={showToken ? 'text' : 'password'}
                  placeholder="Bearer token..."
                  value={server.authToken}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUpdate({ authToken: e.target.value })}
                  className="flex-1"
                />
                <Button size="sm" variant="ghost" onPress={() => setShowToken((v) => !v)}>
                  {showToken ? '🙈' : '👁️'}
                </Button>
              </div>
            </div>

            <div className="flex gap-2">
              <Button size="sm" variant="primary" onPress={onTest}>
                测试连接
              </Button>
              <Button size="sm" variant="danger" onPress={onDelete}>
                删除
              </Button>
            </div>

            {/* Discovered capabilities */}
            {(server.discoveredTools?.length ?? 0) > 0 && (
              <div>
                <span className="text-xs font-medium text-muted">发现的工具</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {server.discoveredTools!.map((t) => (
                    <Chip key={t} size="sm" variant="soft" color="accent">{t}</Chip>
                  ))}
                </div>
              </div>
            )}
            {(server.discoveredResources?.length ?? 0) > 0 && (
              <div>
                <span className="text-xs font-medium text-muted">发现的资源</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {server.discoveredResources!.map((r) => (
                    <Chip key={r} size="sm" variant="soft" color="success">{r}</Chip>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

export function McpPage(): ReactElement {
  const [servers, setServers] = useState<McpServer[]>(loadServers);

  const updateAndSave = useCallback((updated: McpServer[]) => {
    setServers(updated);
    saveServers(updated);
  }, []);

  const handleAdd = useCallback(() => {
    const newServer: McpServer = {
      id: `mcp-${Date.now()}`,
      name: '',
      url: '',
      authToken: '',
      enabled: false,
      status: 'unknown',
    };
    updateAndSave([...servers, newServer]);
  }, [servers, updateAndSave]);

  const handleUpdate = useCallback((id: string, updates: Partial<McpServer>) => {
    updateAndSave(servers.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  }, [servers, updateAndSave]);

  const handleDelete = useCallback((id: string) => {
    updateAndSave(servers.filter((s) => s.id !== id));
  }, [servers, updateAndSave]);

  const handleTest = useCallback(async (id: string) => {
    const server = servers.find((s) => s.id === id);
    if (!server?.url) return;

    handleUpdate(id, { status: 'unknown', lastTested: Date.now() });

    try {
      // TODO: Implement actual MCP protocol connection test via IPC proxy
      // For now, just do a basic HTTP HEAD to check reachability
      const bridge = (window as any).orbitDesktop;
      if (bridge?.llmProxy) {
        const result = await bridge.llmProxy({
          url: server.url,
          method: 'GET',
          headers: server.authToken
            ? { Authorization: `Bearer ${server.authToken}` }
            : {},
          body: undefined,
          timeoutMs: 10_000,
        });
        handleUpdate(id, {
          status: result.status < 500 ? 'connected' : 'error',
          lastTested: Date.now(),
        });
      } else {
        handleUpdate(id, { status: 'error' });
      }
    } catch {
      handleUpdate(id, { status: 'error', lastTested: Date.now() });
    }
  }, [servers, handleUpdate]);

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">MCP 服务</h1>
          <p className="text-sm text-muted">
            管理外部 MCP (Model Context Protocol) 服务连接 · 接入其他应用的能力
          </p>
        </div>
        <Button variant="primary" onPress={handleAdd}>
          + 添加 MCP Server
        </Button>
      </div>

      {servers.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <span className="text-4xl">🔌</span>
          <p className="mt-3 text-sm font-medium text-muted">暂无 MCP 服务</p>
          <p className="mt-1 text-xs text-muted">添加外部 MCP Server 来扩展 Agent 的能力</p>
          <Button variant="primary" className="mt-4" onPress={handleAdd}>
            添加第一个 Server
          </Button>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {servers.map((server) => (
            <ServerCard
              key={server.id}
              server={server}
              onUpdate={(updates) => handleUpdate(server.id, updates)}
              onDelete={() => handleDelete(server.id)}
              onTest={() => handleTest(server.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
