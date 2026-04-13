import { useState, useEffect, type ReactElement } from 'react';
import { Card, Chip, Button, Separator } from '@heroui/react';
import {
  Crosshair,
  Clock,
  FolderOpen,
  Milestone as MsIcon,
  Check,
  Pause,
  AlertTriangle,
  XCircle,
  BookOpen,
  FlaskConical,
  PenLine,
} from 'lucide-react';
import { useTaskList, useProjectList, useMilestoneList, useTaskMutations } from '../../data';

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

const LINK_KIND_ICONS = {
  reading: <BookOpen size={14} />,
  research: <FlaskConical size={14} />,
  writing: <PenLine size={14} />,
};

export function FocusPage(): ReactElement {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(true);

  const { tasks } = useTaskList();
  const { projects } = useProjectList();
  const { milestones } = useMilestoneList();
  const { updateTaskStatus } = useTaskMutations();

  // Pick the first focused task
  const task = tasks.find((t) => t.status === 'focused') ?? tasks[0];
  const project = task?.projectId ? projects.find(p => p.id === task.projectId) ?? null : null;
  const milestone = task?.milestoneId ? milestones.find(m => m.id === task.milestoneId) ?? null : null;

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setElapsed((prev) => prev + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  if (!task) {
    return (
      <div className="flex items-center justify-center h-full text-muted">
        暂无任务
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Center content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 overflow-y-auto">
        {/* Task title */}
        <div className="text-center space-y-3 mb-8">
          <div className="flex items-center gap-2 justify-center">
            <Crosshair size={20} className="text-accent" />
            <span className="text-sm font-medium text-accent">专注模式</span>
          </div>
          <h1 className="text-3xl font-bold text-foreground max-w-xl">
            {task.title}
          </h1>
          {task.body && (
            <p className="text-base text-muted max-w-lg">{task.body}</p>
          )}
          {task.completionDefinition && (
            <div className="inline-block bg-surface-secondary rounded-lg px-4 py-2 mt-2">
              <span className="text-xs text-muted">完成定义：</span>
              <span className="text-sm text-foreground">
                {task.completionDefinition}
              </span>
            </div>
          )}
        </div>

        {/* Timer */}
        <div className="mb-8 text-center">
          <div className="text-5xl font-mono font-bold text-foreground tracking-wider">
            {formatTime(elapsed)}
          </div>
          <button
            className="mt-2 text-sm text-muted hover:text-foreground transition-colors"
            onClick={() => setRunning(!running)}
          >
            {running ? '暂停计时' : '继续计时'}
          </button>
        </div>

        {/* Goal context */}
        <div className="flex items-center gap-3 flex-wrap justify-center mb-8">
          {project && (
            <Chip variant="soft" size="sm">
              <FolderOpen size={12} className="inline mr-1" />
              {project.title}
            </Chip>
          )}
          {milestone && (
            <Chip variant="soft" size="sm">
              <MsIcon size={12} className="inline mr-1" />
              {milestone.title}
            </Chip>
          )}
        </div>

        {/* Materials panel */}
        {task.supportLinks.length > 0 && (
          <Card className="w-full max-w-lg">
            <Card.Header>
              <span className="text-sm font-medium text-foreground">
                相关材料
              </span>
            </Card.Header>
            <Card.Content>
              <div className="space-y-2">
                {task.supportLinks.map((link) => (
                  <a
                    key={link.id}
                    href={link.url}
                    className="flex items-center gap-2 text-sm p-2 rounded-lg hover:bg-surface-secondary transition-colors"
                  >
                    {LINK_KIND_ICONS[link.kind]}
                    <span className="text-foreground">{link.label}</span>
                  </a>
                ))}
              </div>
            </Card.Content>
          </Card>
        )}
      </div>

      {/* Bottom action bar */}
      <div className="border-t border-border bg-surface px-6 py-4">
        <div className="flex items-center justify-center gap-3">
          <Button variant="primary" onPress={() => updateTaskStatus(task.id, 'done')}>
            <Check size={16} /> 完成
          </Button>
          <Button
            variant="secondary"
            onPress={() => setRunning(!running)}
          >
            <Pause size={16} /> 暂停
          </Button>
          <Button variant="secondary" onPress={() => updateTaskStatus(task.id, 'blocked')}>
            <AlertTriangle size={16} /> 受阻
          </Button>
          <Button variant="danger" onPress={() => updateTaskStatus(task.id, 'dropped')}>
            <XCircle size={16} /> 放弃
          </Button>
        </div>
      </div>
    </div>
  );
}
