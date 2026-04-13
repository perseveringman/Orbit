import { type ReactElement, useState, useCallback } from 'react';
import { Card, Chip, Button, Input, Switch } from '@heroui/react';
import { Plus, Trash2, Download } from 'lucide-react';
import type { SkillDefinition, SkillSource } from '@orbit/agent-core';

// ---- Mock data ----

const NOW = new Date().toISOString();

const INITIAL_SKILLS: SkillDefinition[] = [
  {
    id: 'builtin:planning',
    name: 'orbit:planning',
    description: '项目规划与任务分解 — 将复杂目标拆分为可执行的任务',
    version: '1.0.0',
    author: 'Orbit',
    source: { type: 'builtin' },
    instructions: '',
    tools: ['project.create', 'task.create', 'task.list', 'milestone.create'],
    tags: ['planning', 'tasks'],
    installedAt: NOW,
    status: 'active',
  },
  {
    id: 'builtin:research',
    name: 'orbit:research',
    description: '多源研究与信息综合 — 搜索、交叉验证并提炼信息',
    version: '1.0.0',
    author: 'Orbit',
    source: { type: 'builtin' },
    instructions: '',
    tools: ['web_fetch', 'web_search', 'workspace.search'],
    tags: ['research', 'search'],
    installedAt: NOW,
    status: 'active',
  },
  {
    id: 'builtin:reading',
    name: 'orbit:reading',
    description: '长文阅读与摘要 — 分析文章和播客，提取关键信息',
    version: '1.0.0',
    author: 'Orbit',
    source: { type: 'builtin' },
    instructions: '',
    tools: ['web_fetch', 'file_read'],
    tags: ['reading', 'summarization'],
    installedAt: NOW,
    status: 'active',
  },
  {
    id: 'builtin:writing',
    name: 'orbit:writing',
    description: '内容创作与编辑 — 起草、编辑和改进文本内容',
    version: '1.0.0',
    author: 'Orbit',
    source: { type: 'builtin' },
    instructions: '',
    tools: ['file_read', 'file_write'],
    tags: ['writing', 'editing'],
    installedAt: NOW,
    status: 'disabled',
  },
];

// ---- Helpers ----

type FilterTab = 'all' | 'active' | 'builtin' | 'custom';

function sourceLabel(source: SkillSource): string {
  switch (source.type) {
    case 'builtin': return 'Builtin';
    case 'url': return 'URL';
    case 'local': return 'Local';
    case 'registry': return 'Registry';
  }
}

function sourceColor(source: SkillSource): 'default' | 'accent' | 'success' | 'warning' {
  switch (source.type) {
    case 'builtin': return 'default';
    case 'url': return 'accent';
    case 'local': return 'warning';
    case 'registry': return 'success';
  }
}

function sourceIcon(source: SkillSource): string {
  switch (source.type) {
    case 'builtin': return '⚙️';
    case 'url': return '🌐';
    case 'local': return '📁';
    case 'registry': return '📦';
  }
}

function statusColor(status: string): 'success' | 'default' | 'danger' {
  switch (status) {
    case 'active': return 'success';
    case 'disabled': return 'default';
    case 'error': return 'danger';
    default: return 'default';
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'active': return '已启用';
    case 'disabled': return '已禁用';
    case 'error': return '错误';
    default: return status;
  }
}

// ---- Skill Card ----

function SkillCard({
  skill,
  onToggle,
  onUninstall,
}: {
  skill: SkillDefinition;
  onToggle: () => void;
  onUninstall: () => void;
}): ReactElement {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isBuiltin = skill.source.type === 'builtin';

  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-2xl">{sourceIcon(skill.source)}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm font-semibold truncate">{skill.name}</span>
            <Chip size="sm" color={statusColor(skill.status)} variant="soft">
              {statusLabel(skill.status)}
            </Chip>
            <Chip size="sm" color={sourceColor(skill.source)} variant="soft">
              {sourceLabel(skill.source)}
            </Chip>
          </div>
          <p className="mt-1 text-sm text-muted">{skill.description}</p>

          <div className="mt-2 flex flex-wrap items-center gap-3">
            {skill.tools && skill.tools.length > 0 && (
              <span className="text-xs text-muted">🔧 {skill.tools.length} 个工具</span>
            )}
            {skill.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {skill.tags.map((tag) => (
                  <span key={tag} className="orbit-tag text-xs">{tag}</span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Switch
            size="sm"
            isSelected={skill.status === 'active'}
            onChange={onToggle}
          >
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
          </Switch>

          {!isBuiltin && (
            confirmDelete ? (
              <div className="flex gap-1">
                <Button size="sm" variant="danger" onPress={onUninstall}>
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

// ---- Main Page ----

export function SkillsPage(): ReactElement {
  const [skills, setSkills] = useState<SkillDefinition[]>(INITIAL_SKILLS);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [installUrl, setInstallUrl] = useState('');
  const [installing, setInstalling] = useState(false);

  const handleToggle = useCallback((id: string) => {
    setSkills((prev) =>
      prev.map((s) =>
        s.id === id
          ? { ...s, status: s.status === 'active' ? 'disabled' as const : 'active' as const }
          : s,
      ),
    );
  }, []);

  const handleUninstall = useCallback((id: string) => {
    setSkills((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const handleInstallUrl = useCallback(() => {
    if (!installUrl.trim()) return;
    setInstalling(true);
    setTimeout(() => {
      const newSkill: SkillDefinition = {
        id: `url-${Date.now()}`,
        name: installUrl.split('/').pop() ?? 'custom-skill',
        description: `从 ${installUrl} 安装的技能`,
        version: '0.1.0',
        source: { type: 'url', url: installUrl, fetchedAt: new Date().toISOString() },
        instructions: '',
        tools: [],
        tags: ['custom'],
        installedAt: new Date().toISOString(),
        status: 'active',
      };
      setSkills((prev) => [...prev, newSkill]);
      setInstallUrl('');
      setInstalling(false);
    }, 800);
  }, [installUrl]);

  const filtered = skills.filter((s) => {
    switch (filter) {
      case 'active': return s.status === 'active';
      case 'builtin': return s.source.type === 'builtin';
      case 'custom': return s.source.type !== 'builtin';
      default: return true;
    }
  });

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: `全部 (${skills.length})` },
    { key: 'active', label: `活跃 (${skills.filter((s) => s.status === 'active').length})` },
    { key: 'builtin', label: `内置 (${skills.filter((s) => s.source.type === 'builtin').length})` },
    { key: 'custom', label: `自定义 (${skills.filter((s) => s.source.type !== 'builtin').length})` },
  ];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">技能管理</h1>
          <p className="text-sm text-muted">{skills.length} 个技能已安装</p>
        </div>
        <Button variant="primary" onPress={() => document.getElementById('skill-url-input')?.focus()}>
          <Plus size={16} />
          安装技能
        </Button>
      </div>

      {/* URL Install */}
      <div className="mb-6 flex gap-2">
        <Input
          id="skill-url-input"
          placeholder="输入技能 URL 以安装..."
          value={installUrl}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInstallUrl(e.target.value)}
          className="flex-1"
        />
        <Button variant="primary" isDisabled={!installUrl.trim() || installing} onPress={handleInstallUrl}>
          <Download size={16} />
          {installing ? '安装中...' : '安装'}
        </Button>
      </div>

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

      {/* Skills Grid */}
      {filtered.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <span className="text-4xl">🧩</span>
          <p className="mt-3 text-sm font-medium text-muted">暂无匹配的技能</p>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-1 lg:grid-cols-2">
          {filtered.map((skill) => (
            <SkillCard
              key={skill.id}
              skill={skill}
              onToggle={() => handleToggle(skill.id)}
              onUninstall={() => handleUninstall(skill.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
