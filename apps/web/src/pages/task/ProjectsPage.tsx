import { useState, type ReactElement } from 'react';
import { Card, Chip, Button } from '@heroui/react';
import { FolderOpen, Plus, X, Check } from 'lucide-react';
import {
  PROJECT_STATUS_LABELS,
  PROJECT_STATUS_COLORS,
  type Project,
} from './mock-data';
import { useProjectList, useTaskList, useTaskMutations } from '../../data';
import { ProjectDetailView } from './ProjectDetailView';

export function ProjectsPage(): ReactElement {
  const { projects } = useProjectList();
  const { tasks: allTasks } = useTaskList();
  const { createProject, deleteProject } = useTaskMutations();
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const project = selectedProject
    ? projects.find((p) => p.id === selectedProject) ?? null
    : null;

  if (project) {
    return (
      <ProjectDetailView
        project={project}
        onBack={() => setSelectedProject(null)}
      />
    );
  }

  const handleCreate = async () => {
    const title = newTitle.trim();
    if (!title) return;
    await createProject({ title, description: newDesc.trim() || undefined });
    setNewTitle('');
    setNewDesc('');
    setShowCreateForm(false);
  };

  const handleDeleteProject = async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    await deleteProject(projectId);
  };

  return (
    <div className="p-6 overflow-y-auto h-full space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-foreground">项目</h2>
        <Button variant="primary" size="sm" onPress={() => setShowCreateForm(!showCreateForm)}>
          <Plus size={16} /> 新项目
        </Button>
      </div>

      {/* Inline create form */}
      {showCreateForm && (
        <Card className="border border-accent/30">
          <Card.Content>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted mb-1 block">项目名称</label>
                <input
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent"
                  placeholder="输入项目名称..."
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs text-muted mb-1 block">描述（可选）</label>
                <input
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent"
                  placeholder="简要描述项目目标..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
                />
              </div>
              <div className="flex items-center gap-2">
                <Button variant="primary" size="sm" onPress={handleCreate} isDisabled={!newTitle.trim()}>
                  <Check size={14} /> 创建
                </Button>
                <Button variant="ghost" size="sm" onPress={() => { setShowCreateForm(false); setNewTitle(''); setNewDesc(''); }}>
                  <X size={14} /> 取消
                </Button>
              </div>
            </div>
          </Card.Content>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map((p) => {
          const tasks = allTasks.filter((t) => t.projectId === p.id);
          const done = tasks.filter((t) => t.status === 'done').length;
          const pct =
            tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0;

          return (
            <button
              key={p.id}
              className="w-full text-left"
              onClick={() => setSelectedProject(p.id)}
            >
            <Card
              className="cursor-pointer hover:bg-surface-secondary transition-colors group"
            >
              <Card.Header>
                <div className="flex items-center gap-2">
                  <FolderOpen size={16} className="text-accent" />
                  <Chip
                    variant="soft"
                    color={PROJECT_STATUS_COLORS[p.status]}
                    size="sm"
                  >
                    {PROJECT_STATUS_LABELS[p.status]}
                  </Chip>
                  <button
                    className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-muted hover:text-danger"
                    onClick={(e) => handleDeleteProject(e, p.id)}
                    title="删除项目"
                  >
                    <X size={14} />
                  </button>
                </div>
              </Card.Header>
              <Card.Title>{p.title}</Card.Title>
              <Card.Description>
                <Chip variant="soft" color="accent" size="sm">
                  🎯 {p.alignment || '未设置目标'}
                </Chip>
              </Card.Description>
              <Card.Content>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-muted">
                    <span>
                      {done}/{tasks.length} 任务完成
                    </span>
                    <span>{pct}%</span>
                  </div>
                  <div className="h-2 bg-surface-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </Card.Content>
            </Card>
            </button>
          );
        })}
      </div>

      {projects.length === 0 && !showCreateForm && (
        <div className="text-center py-16">
          <FolderOpen size={48} className="mx-auto text-muted mb-4" />
          <p className="text-muted mb-4">暂无项目</p>
          <Button variant="primary" size="sm" onPress={() => setShowCreateForm(true)}>
            <Plus size={16} /> 创建第一个项目
          </Button>
        </div>
      )}
    </div>
  );
}
