import { type ReactElement, useState, useCallback } from 'react';
import { Card, Chip, Button, Input } from '@heroui/react';
import { Plus, Trash2, Play, X } from 'lucide-react';
import type { TeamStrategy, TeamStatus, AgentTeamMember } from '@orbit/agent-core';

// ---- Local types ----

interface MockTeam {
  id: string;
  name: string;
  description: string;
  strategy: TeamStrategy;
  status: TeamStatus;
  members: AgentTeamMember[];
  createdAt: string;
}

interface TaskExecution {
  teamId: string;
  task: string;
  memberProgress: { agentId: string; roleName: string; subtask: string; status: 'pending' | 'running' | 'done' | 'error' }[];
}

// ---- Mock data ----

const INITIAL_TEAMS: MockTeam[] = [
  {
    id: 'team-research',
    name: '研究团队',
    description: '多Agent协作完成深度研究任务',
    strategy: { type: 'sequential' },
    status: 'idle',
    members: [
      { agentId: 'a1', roleId: 'builtin:researcher', roleName: '研究助手', responsibility: '信息搜集与初步分析', priority: 1 },
      { agentId: 'a2', roleId: 'builtin:reader', roleName: '阅读助手', responsibility: '深度阅读和摘要', priority: 2 },
      { agentId: 'a3', roleId: 'builtin:writer', roleName: '写作助手', responsibility: '汇总报告撰写', priority: 3 },
    ],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'team-dev',
    name: '开发团队',
    description: '代码编写、审查和任务管理',
    strategy: { type: 'parallel' },
    status: 'idle',
    members: [
      { agentId: 'a4', roleId: 'builtin:planner', roleName: '规划助手', responsibility: '任务分解和排期', priority: 1 },
      { agentId: 'a5', roleId: 'builtin:coder', roleName: '编程助手', responsibility: '代码编写和调试', priority: 1 },
      { agentId: 'a6', roleId: 'builtin:reviewer', roleName: '审查助手', responsibility: '代码审查和质量检查', priority: 2 },
    ],
    createdAt: new Date().toISOString(),
  },
];

// ---- Helpers ----

function strategyLabel(strategy: TeamStrategy): string {
  switch (strategy.type) {
    case 'sequential': return '顺序执行';
    case 'parallel': return '并行执行';
    case 'pipeline': return '流水线';
    case 'orchestrated': return '协调执行';
  }
}

function strategyColor(type: string): 'default' | 'accent' | 'warning' | 'success' {
  switch (type) {
    case 'sequential': return 'default';
    case 'parallel': return 'accent';
    case 'pipeline': return 'warning';
    case 'orchestrated': return 'success';
    default: return 'default';
  }
}

function statusLabel(status: TeamStatus): string {
  switch (status) {
    case 'idle': return '空闲';
    case 'planning': return '规划中';
    case 'executing': return '执行中';
    case 'reviewing': return '审查中';
    case 'completed': return '已完成';
    case 'failed': return '失败';
  }
}

function statusColor(status: TeamStatus): 'default' | 'warning' | 'accent' | 'success' | 'danger' {
  switch (status) {
    case 'idle': return 'default';
    case 'planning': return 'warning';
    case 'executing': return 'accent';
    case 'reviewing': return 'warning';
    case 'completed': return 'success';
    case 'failed': return 'danger';
  }
}

// ---- Execution Log ----

function ExecutionLog({ execution }: { execution: TaskExecution }): ReactElement {
  return (
    <Card className="mt-3 p-4">
      <h3 className="mb-2 text-sm font-semibold">执行日志</h3>
      <p className="mb-3 text-xs text-muted">任务: {execution.task}</p>
      <div className="flex flex-col gap-2">
        {execution.memberProgress.map((mp) => (
          <div key={mp.agentId} className="flex items-center gap-2 rounded bg-surface-secondary px-3 py-2">
            <span className={`h-2 w-2 rounded-full ${
              mp.status === 'done' ? 'bg-green-500' :
              mp.status === 'running' ? 'bg-blue-500 animate-pulse' :
              mp.status === 'error' ? 'bg-red-500' :
              'bg-gray-400'
            }`} />
            <span className="text-xs font-medium">{mp.roleName}</span>
            <span className="flex-1 text-xs text-muted truncate">{mp.subtask}</span>
            <Chip size="sm" variant="soft" color={
              mp.status === 'done' ? 'success' :
              mp.status === 'running' ? 'accent' :
              mp.status === 'error' ? 'danger' : 'default'
            }>
              {mp.status === 'done' ? '完成' : mp.status === 'running' ? '运行中' : mp.status === 'error' ? '错误' : '等待'}
            </Chip>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ---- Team Card ----

function TeamCard({
  team,
  execution,
  onExecute,
  onDelete,
}: {
  team: MockTeam;
  execution?: TaskExecution;
  onExecute: (task: string) => void;
  onDelete: () => void;
}): ReactElement {
  const [taskInput, setTaskInput] = useState('');
  const [showTaskInput, setShowTaskInput] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-2xl">👥</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold">{team.name}</span>
            <Chip size="sm" variant="soft" color={strategyColor(team.strategy.type)}>
              {strategyLabel(team.strategy)}
            </Chip>
            <Chip size="sm" variant="soft" color={statusColor(team.status)}>
              {statusLabel(team.status)}
            </Chip>
          </div>
          <p className="mt-1 text-sm text-muted">{team.description}</p>

          {/* Members */}
          <div className="mt-3">
            <span className="orbit-meta text-xs text-muted">成员 ({team.members.length})</span>
            <div className="mt-1 flex flex-col gap-1">
              {team.members.map((m) => (
                <div key={m.agentId} className="flex items-center gap-2 text-xs">
                  <span className="font-medium">{m.roleName}</span>
                  <span className="text-muted">— {m.responsibility}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Task Execution */}
          {showTaskInput && (
            <div className="mt-3 flex gap-2">
              <Input
                placeholder="输入任务描述..."
                value={taskInput}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTaskInput(e.target.value)}
                className="flex-1"
              />
              <Button
                size="sm"
                variant="primary"
                isDisabled={!taskInput.trim()}
                onPress={() => {
                  onExecute(taskInput);
                  setTaskInput('');
                  setShowTaskInput(false);
                }}
              >
                执行
              </Button>
              <Button size="sm" variant="ghost" onPress={() => setShowTaskInput(false)}>
                取消
              </Button>
            </div>
          )}

          {execution && <ExecutionLog execution={execution} />}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-1 shrink-0">
          <Button size="sm" variant="primary" onPress={() => setShowTaskInput(true)}>
            <Play size={14} />
          </Button>
          {confirmDelete ? (
            <div className="flex flex-col gap-1">
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
          )}
        </div>
      </div>
    </Card>
  );
}

// ---- Create Team Section ----

const STRATEGY_OPTIONS: { type: TeamStrategy['type']; label: string }[] = [
  { type: 'sequential', label: '顺序执行' },
  { type: 'parallel', label: '并行执行' },
  { type: 'pipeline', label: '流水线' },
  { type: 'orchestrated', label: '协调执行' },
];

const ROLE_OPTIONS = [
  { id: 'builtin:planner', name: '规划助手' },
  { id: 'builtin:researcher', name: '研究助手' },
  { id: 'builtin:reader', name: '阅读助手' },
  { id: 'builtin:writer', name: '写作助手' },
  { id: 'builtin:coder', name: '编程助手' },
  { id: 'builtin:reviewer', name: '审查助手' },
  { id: 'builtin:task-manager', name: '任务管理助手' },
  { id: 'builtin:assistant', name: '通用助手' },
];

interface NewMember {
  roleId: string;
  roleName: string;
  responsibility: string;
}

function CreateTeamSection({
  onSave,
  onCancel,
}: {
  onSave: (team: { name: string; description: string; strategy: TeamStrategy; members: NewMember[] }) => void;
  onCancel: () => void;
}): ReactElement {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [strategyType, setStrategyType] = useState<TeamStrategy['type']>('sequential');
  const [members, setMembers] = useState<NewMember[]>([]);
  const [selectedRole, setSelectedRole] = useState(ROLE_OPTIONS[0].id);
  const [responsibility, setResponsibility] = useState('');

  const addMember = () => {
    const role = ROLE_OPTIONS.find((r) => r.id === selectedRole);
    if (!role || !responsibility.trim()) return;
    setMembers((prev) => [...prev, { roleId: role.id, roleName: role.name, responsibility }]);
    setResponsibility('');
  };

  const removeMember = (idx: number) => {
    setMembers((prev) => prev.filter((_, i) => i !== idx));
  };

  const buildStrategy = (): TeamStrategy => {
    if (strategyType === 'pipeline') {
      return { type: 'pipeline', order: members.map((m) => m.roleId) };
    }
    return { type: strategyType } as TeamStrategy;
  };

  return (
    <Card className="mb-6 p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold">创建新团队</h2>
        <Button size="sm" variant="ghost" isIconOnly onPress={onCancel}>
          <X size={16} />
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">团队名称</label>
          <Input
            placeholder="研究团队"
            value={name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">描述</label>
          <Input
            placeholder="团队描述..."
            value={description}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDescription(e.target.value)}
          />
        </div>
      </div>

      {/* Strategy Selector */}
      <div className="mt-4">
        <label className="mb-2 block text-xs font-medium text-muted">执行策略</label>
        <div className="flex flex-wrap gap-2">
          {STRATEGY_OPTIONS.map((opt) => (
            <Button
              key={opt.type}
              size="sm"
              variant={strategyType === opt.type ? 'primary' : 'ghost'}
              onPress={() => setStrategyType(opt.type)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Add Member */}
      <div className="mt-4">
        <label className="mb-2 block text-xs font-medium text-muted">添加成员</label>
        <div className="flex gap-2">
          <select
            className="rounded border border-border bg-surface px-2 py-1 text-sm text-foreground"
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
          <Input
            placeholder="职责描述..."
            value={responsibility}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setResponsibility(e.target.value)}
            className="flex-1"
          />
          <Button size="sm" variant="primary" isDisabled={!responsibility.trim()} onPress={addMember}>
            <Plus size={14} />
          </Button>
        </div>
      </div>

      {/* Members Preview */}
      {members.length > 0 && (
        <div className="mt-3">
          <span className="text-xs font-medium text-muted">成员列表 ({members.length})</span>
          <div className="mt-1 flex flex-col gap-1">
            {members.map((m, i) => (
              <div key={i} className="flex items-center gap-2 rounded bg-surface-secondary px-3 py-1.5 text-xs">
                <span className="font-medium">{m.roleName}</span>
                <span className="flex-1 text-muted truncate">{m.responsibility}</span>
                <Button size="sm" variant="ghost" isIconOnly onPress={() => removeMember(i)}>
                  <X size={12} />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <Button
          variant="primary"
          isDisabled={!name.trim() || members.length === 0}
          onPress={() => onSave({ name, description, strategy: buildStrategy(), members })}
        >
          创建团队
        </Button>
        <Button variant="ghost" onPress={onCancel}>
          取消
        </Button>
      </div>
    </Card>
  );
}

// ---- Main Page ----

export function TeamsPage(): ReactElement {
  const [teams, setTeams] = useState<MockTeam[]>(INITIAL_TEAMS);
  const [showCreate, setShowCreate] = useState(false);
  const [executions, setExecutions] = useState<Map<string, TaskExecution>>(new Map());

  const handleCreateTeam = useCallback((input: { name: string; description: string; strategy: TeamStrategy; members: NewMember[] }) => {
    const newTeam: MockTeam = {
      id: `team-${Date.now()}`,
      name: input.name,
      description: input.description,
      strategy: input.strategy,
      status: 'idle',
      members: input.members.map((m, i) => ({
        agentId: `agent-${Date.now()}-${i}`,
        roleId: m.roleId,
        roleName: m.roleName,
        responsibility: m.responsibility,
        priority: i + 1,
      })),
      createdAt: new Date().toISOString(),
    };
    setTeams((prev) => [...prev, newTeam]);
    setShowCreate(false);
  }, []);

  const handleExecute = useCallback((teamId: string, task: string) => {
    const team = teams.find((t) => t.id === teamId);
    if (!team) return;

    setTeams((prev) => prev.map((t) => t.id === teamId ? { ...t, status: 'executing' as const } : t));

    const progress: TaskExecution['memberProgress'] = team.members.map((m) => ({
      agentId: m.agentId,
      roleName: m.roleName,
      subtask: `${m.responsibility}: ${task}`,
      status: 'pending' as const,
    }));

    const execution: TaskExecution = { teamId, task, memberProgress: progress };
    setExecutions((prev) => new Map(prev).set(teamId, execution));

    // Simulate progressive execution
    team.members.forEach((m, i) => {
      setTimeout(() => {
        setExecutions((prev) => {
          const next = new Map(prev);
          const ex = next.get(teamId);
          if (ex) {
            const updated = { ...ex, memberProgress: ex.memberProgress.map((mp, j) =>
              j === i ? { ...mp, status: 'running' as const } : mp,
            )};
            next.set(teamId, updated);
          }
          return next;
        });
      }, (i + 1) * 1000);

      setTimeout(() => {
        setExecutions((prev) => {
          const next = new Map(prev);
          const ex = next.get(teamId);
          if (ex) {
            const updated = { ...ex, memberProgress: ex.memberProgress.map((mp, j) =>
              j === i ? { ...mp, status: 'done' as const } : mp,
            )};
            next.set(teamId, updated);
          }
          return next;
        });

        // Complete team when all done
        if (i === team.members.length - 1) {
          setTimeout(() => {
            setTeams((prev) => prev.map((t) => t.id === teamId ? { ...t, status: 'completed' as const } : t));
          }, 500);
        }
      }, (i + 1) * 2000);
    });
  }, [teams]);

  const handleDelete = useCallback((id: string) => {
    setTeams((prev) => prev.filter((t) => t.id !== id));
    setExecutions((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Agent 团队</h1>
          <p className="text-sm text-muted">{teams.length} 个团队</p>
        </div>
        <Button variant="primary" onPress={() => setShowCreate(true)}>
          <Plus size={16} />
          创建团队
        </Button>
      </div>

      {/* Create Team Section */}
      {showCreate && (
        <CreateTeamSection
          onSave={handleCreateTeam}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {/* Team Cards */}
      {teams.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <span className="text-4xl">👥</span>
          <p className="mt-3 text-sm font-medium text-muted">暂无团队</p>
          <p className="mt-1 text-xs text-muted">创建团队来协调多个 Agent 完成复杂任务</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {teams.map((team) => (
            <TeamCard
              key={team.id}
              team={team}
              execution={executions.get(team.id)}
              onExecute={(task) => handleExecute(team.id, task)}
              onDelete={() => handleDelete(team.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
