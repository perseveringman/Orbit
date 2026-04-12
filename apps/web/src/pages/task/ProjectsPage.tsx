import { useState, type ReactElement } from 'react';
import { Card, Chip, Button } from '@heroui/react';
import { FolderOpen, Plus } from 'lucide-react';
import {
  MOCK_PROJECTS,
  PROJECT_STATUS_LABELS,
  PROJECT_STATUS_COLORS,
  getTasksForProject,
  type Project,
} from './mock-data';
import { ProjectDetailView } from './ProjectDetailView';

export function ProjectsPage(): ReactElement {
  const [selectedProject, setSelectedProject] = useState<string | null>(null);

  const project = selectedProject
    ? MOCK_PROJECTS.find((p) => p.id === selectedProject) ?? null
    : null;

  if (project) {
    return (
      <ProjectDetailView
        project={project}
        onBack={() => setSelectedProject(null)}
      />
    );
  }

  return (
    <div className="p-6 overflow-y-auto h-full space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-foreground">项目</h2>
        <Button variant="primary" size="sm">
          <Plus size={16} /> 新项目
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {MOCK_PROJECTS.map((p) => {
          const tasks = getTasksForProject(p.id);
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
              className="cursor-pointer hover:bg-surface-secondary transition-colors"
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
                </div>
              </Card.Header>
              <Card.Title>{p.title}</Card.Title>
              <Card.Description>
                <Chip variant="soft" color="accent" size="sm">
                  🎯 {p.alignment}
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
    </div>
  );
}
