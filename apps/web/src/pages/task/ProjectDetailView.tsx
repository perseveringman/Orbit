import { useState, type ReactElement } from 'react';
import { Chip, Button, Separator } from '@heroui/react';
import {
  FolderOpen,
  ExternalLink,
  Link2,
  Plus,
  Check,
  X,
  Trash2,
} from 'lucide-react';
import {
  type Project,
  PROJECT_STATUS_LABELS,
  PROJECT_STATUS_COLORS,
} from './mock-data';
import { useTasksForProject, useMilestoneList, useTaskMutations } from '../../data';
import { MilestoneTimeline } from './MilestoneTimeline';
import { StatusTransitionDropdown } from './StatusTransitionDropdown';

interface ProjectDetailViewProps {
  project: Project;
  onBack: () => void;
}

export function ProjectDetailView({
  project,
  onBack,
}: ProjectDetailViewProps): ReactElement {
  const { milestones: allMilestones } = useMilestoneList();
  const milestones = allMilestones.filter(m => m.projectId === project.id);
  const allTasks = useTasksForProject(project.id);
  const { createTask, updateTaskStatus, deleteTask } = useTaskMutations();
  const doneTasks = allTasks.filter((t) => t.status === 'done').length;
  const doneMilestones = milestones.filter((m) => m.status === 'done').length;
  const taskPct =
    allTasks.length > 0 ? Math.round((doneTasks / allTasks.length) * 100) : 0;
  const msPct =
    milestones.length > 0
      ? Math.round((doneMilestones / milestones.length) * 100)
      : 0;
  const taskStatsByMilestone = Object.fromEntries(
    milestones.map((milestone) => {
      const milestoneTasks = allTasks.filter((task) => task.milestoneId === milestone.id);
      return [
        milestone.id,
        {
          total: milestoneTasks.length,
          done: milestoneTasks.filter((task) => task.status === 'done').length,
        },
      ];
    }),
  );

  const [showAddTask, setShowAddTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');

  const handleAddTask = async () => {
    const title = newTaskTitle.trim();
    if (!title) return;
    await createTask({ title, projectId: project.id });
    setNewTaskTitle('');
    setShowAddTask(false);
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Main content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Back button */}
        <Button variant="ghost" size="sm" onPress={onBack}>
          ← 返回项目列表
        </Button>

        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-2xl font-bold text-foreground">
              {project.title}
            </h2>
            <Chip
              variant="soft"
              color={PROJECT_STATUS_COLORS[project.status]}
            >
              {PROJECT_STATUS_LABELS[project.status]}
            </Chip>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Chip variant="soft" color="accent" size="sm">
              🎯 {project.alignment || '未设置目标'}
            </Chip>
            {project.visionLink && (
              <a
                href={project.visionLink}
                className="text-xs text-accent flex items-center gap-1 hover:underline"
              >
                <Link2 size={12} /> 愿景文档
              </a>
            )}
          </div>
        </div>

        <Separator />

        {/* Milestone timeline */}
        <div>
          <h3 className="text-base font-semibold text-foreground mb-4">
            里程碑
          </h3>
          <MilestoneTimeline
            milestones={milestones}
            taskStatsByMilestone={taskStatsByMilestone}
          />
        </div>

        <Separator />

        {/* Tasks grouped by milestone */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-foreground">任务</h3>
            <Button variant="secondary" size="sm" onPress={() => setShowAddTask(!showAddTask)}>
              <Plus size={14} /> 添加任务
            </Button>
          </div>

          {/* Inline add task form */}
          {showAddTask && (
            <div className="flex items-center gap-2 mb-4 p-3 bg-surface-secondary rounded-lg">
              <input
                className="flex-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent"
                placeholder="输入任务标题..."
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddTask(); if (e.key === 'Escape') setShowAddTask(false); }}
                autoFocus
              />
              <Button variant="primary" size="sm" onPress={handleAddTask} isDisabled={!newTaskTitle.trim()}>
                <Check size={14} />
              </Button>
              <Button variant="ghost" size="sm" onPress={() => { setShowAddTask(false); setNewTaskTitle(''); }}>
                <X size={14} />
              </Button>
            </div>
          )}

          {milestones.map((ms) => {
            const msTasks = allTasks.filter((t) => t.milestoneId === ms.id);
            return (
              <div key={ms.id} className="mb-4">
                <p className="text-sm font-medium text-muted mb-2">
                  {ms.title}
                </p>
                <div className="space-y-1.5">
                  {msTasks.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center gap-2 text-sm p-2 rounded-lg hover:bg-surface-secondary transition-colors group"
                    >
                      <StatusTransitionDropdown
                        currentStatus={t.status}
                        onTransition={(newStatus) => updateTaskStatus(t.id, newStatus)}
                      />
                      <span className="text-foreground truncate flex-1">
                        {t.title}
                      </span>
                      {t.dueDate && (
                        <span className="text-xs text-muted">
                          {t.dueDate}
                        </span>
                      )}
                      <button
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted hover:text-danger"
                        onClick={() => deleteTask(t.id)}
                        title="删除任务"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {/* Unassigned tasks */}
          {(() => {
            const unassigned = allTasks.filter((t) => !t.milestoneId);
            if (unassigned.length === 0) return null;
            return (
              <div className="mb-4">
                <p className="text-sm font-medium text-muted mb-2">
                  未分配里程碑
                </p>
                <div className="space-y-1.5">
                  {unassigned.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center gap-2 text-sm p-2 rounded-lg hover:bg-surface-secondary transition-colors group"
                    >
                      <StatusTransitionDropdown
                        currentStatus={t.status}
                        onTransition={(newStatus) => updateTaskStatus(t.id, newStatus)}
                      />
                      <span className="text-foreground truncate flex-1">
                        {t.title}
                      </span>
                      {t.dueDate && (
                        <span className="text-xs text-muted">
                          {t.dueDate}
                        </span>
                      )}
                      <button
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted hover:text-danger"
                        onClick={() => deleteTask(t.id)}
                        title="删除任务"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Right panel: project metadata */}
      <div className="w-72 border-l border-border bg-surface shrink-0 overflow-y-auto p-4 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">项目信息</h3>

        <div className="space-y-3">
          <div>
            <span className="text-xs text-muted">进度</span>
            <div className="mt-1">
              <div className="flex justify-between text-xs text-muted mb-1">
                <span>任务 {doneTasks}/{allTasks.length}</span>
                <span>{taskPct}%</span>
              </div>
              <div className="h-2 bg-surface-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent rounded-full transition-all"
                  style={{ width: `${taskPct}%` }}
                />
              </div>
            </div>
            <div className="mt-2">
              <div className="flex justify-between text-xs text-muted mb-1">
                <span>里程碑 {doneMilestones}/{milestones.length}</span>
                <span>{msPct}%</span>
              </div>
              <div className="h-2 bg-surface-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-success rounded-full transition-all"
                  style={{ width: `${msPct}%` }}
                />
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted">状态</span>
              <Chip
                variant="soft"
                color={PROJECT_STATUS_COLORS[project.status]}
                size="sm"
              >
                {PROJECT_STATUS_LABELS[project.status]}
              </Chip>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted">对齐</span>
              <span className="text-foreground text-right text-xs max-w-[150px] truncate">
                {project.alignment || '—'}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted">创建于</span>
              <span className="text-foreground text-xs">
                {new Date(project.createdAt).toLocaleDateString('zh-CN')}
              </span>
            </div>
            {project.lastReviewedAt && (
              <div className="flex justify-between text-sm">
                <span className="text-muted">上次回顾</span>
                <span className="text-foreground text-xs">
                  {new Date(project.lastReviewedAt).toLocaleDateString('zh-CN')}
                </span>
              </div>
            )}
          </div>

          {project.visionLink && (
            <>
              <Separator />
              <a
                href={project.visionLink}
                className="flex items-center gap-2 text-sm text-accent hover:underline"
              >
                <ExternalLink size={14} /> 查看愿景文档
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
