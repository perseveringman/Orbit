import { type ReactElement, useState, useCallback } from 'react';
import { Card, Chip, Button, Input } from '@heroui/react';
import { Plus, Copy, Pencil, Trash2, X } from 'lucide-react';
import { BUILTIN_ROLES, type AgentRoleDefinition } from '@orbit/agent-core';

// ---- Local types ----

type FilterTab = 'all' | 'builtin' | 'custom';

// ---- Create Role Form ----

interface RoleFormData {
  name: string;
  displayName: string;
  description: string;
  systemPrompt: string;
  model: string;
  temperature: number;
  icon: string;
}

const EMPTY_FORM: RoleFormData = {
  name: '',
  displayName: '',
  description: '',
  systemPrompt: '',
  model: 'gpt-4o',
  temperature: 0.5,
  icon: '🤖',
};

// ---- Role Card ----

function RoleCard({
  role,
  onClone,
  onEdit,
  onDelete,
}: {
  role: AgentRoleDefinition;
  onClone: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}): ReactElement {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-2xl">{role.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold">{role.displayName}</span>
            <Chip size="sm" variant="soft" color={role.isBuiltin ? 'default' : 'accent'}>
              {role.isBuiltin ? 'Builtin' : 'Custom'}
            </Chip>
          </div>
          <p className="mt-1 text-sm text-muted">{role.description}</p>

          {/* Model & Temperature */}
          <div className="mt-2 flex flex-wrap gap-2">
            <Chip size="sm" variant="soft">{role.model}</Chip>
            <Chip size="sm" variant="soft">温度 {role.temperature}</Chip>
            <Chip size="sm" variant="soft">{role.outputFormat}</Chip>
          </div>

          {/* Tools summary */}
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted">
            {role.tools.allowed.length > 0 && (
              <span>✅ {role.tools.allowed.length} 允许工具</span>
            )}
            {role.tools.blocked.length > 0 && (
              <span>🚫 {role.tools.blocked.length} 禁止工具</span>
            )}
            {role.mcpServers.length > 0 && (
              <span>🔌 {role.mcpServers.length} MCP 服务</span>
            )}
            {role.skills.length > 0 && (
              <span>🧩 {role.skills.length} 技能</span>
            )}
          </div>

          {/* Specializations */}
          {role.specializations.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {role.specializations.map((s) => (
                <span key={s} className="orbit-tag text-xs">{s}</span>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-1 shrink-0">
          <Button size="sm" variant="ghost" isIconOnly onPress={onClone}>
            <Copy size={14} />
          </Button>
          {!role.isBuiltin && onEdit && (
            <Button size="sm" variant="ghost" isIconOnly onPress={onEdit}>
              <Pencil size={14} />
            </Button>
          )}
          {!role.isBuiltin && onDelete && (
            confirmDelete ? (
              <div className="flex gap-1">
                <Button size="sm" variant="danger" onPress={onDelete}>
                  确认
                </Button>
                <Button size="sm" variant="ghost" onPress={() => setConfirmDelete(false)}>
                  取消
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="ghost" isIconOnly onPress={() => setConfirmDelete(true)}>
                <Trash2 size={14} />
              </Button>
            )
          )}
        </div>
      </div>
    </Card>
  );
}

// ---- Create Role Section ----

function CreateRoleSection({
  form,
  onChange,
  onSave,
  onCancel,
}: {
  form: RoleFormData;
  onChange: (patch: Partial<RoleFormData>) => void;
  onSave: () => void;
  onCancel: () => void;
}): ReactElement {
  return (
    <Card className="mb-6 p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold">创建新角色</h2>
        <Button size="sm" variant="ghost" isIconOnly onPress={onCancel}>
          <X size={16} />
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">名称 (ID)</label>
          <Input
            placeholder="my-custom-role"
            value={form.name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange({ name: e.target.value })}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">显示名称</label>
          <Input
            placeholder="自定义角色"
            value={form.displayName}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange({ displayName: e.target.value })}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-muted">描述</label>
          <Input
            placeholder="角色描述..."
            value={form.description}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange({ description: e.target.value })}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-muted">系统提示词</label>
          <textarea
            className="w-full rounded border border-border bg-surface p-2 text-sm text-foreground"
            rows={4}
            placeholder="You are a specialized agent..."
            value={form.systemPrompt}
            onChange={(e) => onChange({ systemPrompt: e.target.value })}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">模型</label>
          <Input
            placeholder="gpt-4o"
            value={form.model}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange({ model: e.target.value })}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">温度 ({form.temperature})</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={form.temperature}
            onChange={(e) => onChange({ temperature: parseFloat(e.target.value) })}
            className="w-full"
          />
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <Button variant="primary" isDisabled={!form.name.trim() || !form.displayName.trim()} onPress={onSave}>
          保存角色
        </Button>
        <Button variant="ghost" onPress={onCancel}>
          取消
        </Button>
      </div>
    </Card>
  );
}

// ---- Main Page ----

export function RolesPage(): ReactElement {
  const [roles, setRoles] = useState<AgentRoleDefinition[]>([...BUILTIN_ROLES]);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<RoleFormData>(EMPTY_FORM);

  const handleFormChange = useCallback((patch: Partial<RoleFormData>) => {
    setForm((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleSave = useCallback(() => {
    const now = new Date().toISOString();
    const newRole: AgentRoleDefinition = {
      id: `custom:${form.name}`,
      name: form.name,
      displayName: form.displayName,
      description: form.description,
      icon: form.icon,
      systemPrompt: form.systemPrompt,
      model: form.model,
      temperature: form.temperature,
      maxIterations: 10,
      tools: { allowed: [], blocked: [] },
      mcpServers: [],
      skills: [],
      specializations: [],
      outputFormat: 'text',
      isBuiltin: false,
      createdAt: now,
      updatedAt: now,
    };
    setRoles((prev) => [...prev, newRole]);
    setForm(EMPTY_FORM);
    setShowCreate(false);
  }, [form]);

  const handleClone = useCallback((roleId: string) => {
    const source = roles.find((r) => r.id === roleId);
    if (!source) return;
    const now = new Date().toISOString();
    const cloned: AgentRoleDefinition = {
      ...source,
      id: `custom:${source.name}-copy-${Date.now()}`,
      name: `${source.name}-copy`,
      displayName: `${source.displayName} (副本)`,
      isBuiltin: false,
      createdAt: now,
      updatedAt: now,
    };
    setRoles((prev) => [...prev, cloned]);
  }, [roles]);

  const handleDelete = useCallback((id: string) => {
    setRoles((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const filtered = roles.filter((r) => {
    switch (filter) {
      case 'builtin': return r.isBuiltin;
      case 'custom': return !r.isBuiltin;
      default: return true;
    }
  });

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: `全部 (${roles.length})` },
    { key: 'builtin', label: `内置 (${roles.filter((r) => r.isBuiltin).length})` },
    { key: 'custom', label: `自定义 (${roles.filter((r) => !r.isBuiltin).length})` },
  ];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Agent 角色</h1>
          <p className="text-sm text-muted">{roles.length} 个角色</p>
        </div>
        <Button variant="primary" onPress={() => setShowCreate(true)}>
          <Plus size={16} />
          创建角色
        </Button>
      </div>

      {/* Create Role Section */}
      {showCreate && (
        <CreateRoleSection
          form={form}
          onChange={handleFormChange}
          onSave={handleSave}
          onCancel={() => {
            setShowCreate(false);
            setForm(EMPTY_FORM);
          }}
        />
      )}

      {/* Filter Tabs */}
      <div className="mb-4 flex gap-1">
        {tabs.map((tab) => (
          <Button
            key={tab.key}
            size="sm"
            variant={filter === tab.key ? 'primary' : 'ghost'}
            onPress={() => setFilter(tab.key)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Roles Grid */}
      {filtered.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <span className="text-4xl">👤</span>
          <p className="mt-3 text-sm font-medium text-muted">暂无匹配的角色</p>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-1 lg:grid-cols-2">
          {filtered.map((role) => (
            <RoleCard
              key={role.id}
              role={role}
              onClone={() => handleClone(role.id)}
              onEdit={!role.isBuiltin ? () => { /* TODO */ } : undefined}
              onDelete={!role.isBuiltin ? () => handleDelete(role.id) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
