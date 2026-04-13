import { useState, type ReactElement } from 'react';
import { Chip, Tabs, Separator, Button } from '@heroui/react';
import {
  Clock,
  FolderOpen,
  Milestone as MilestoneIcon,
  CalendarDays,
  FileText,
  List,
  Paperclip,
  History,
  Check,
  ArrowRight,
  BookOpen,
  FlaskConical,
  PenLine,
  Trash2,
  Edit3,
  X,
} from 'lucide-react';
import {
  type Task,
  STATUS_LABELS,
  STATUS_COLORS,
} from './mock-data';
import { useTask, useProject, useEventsForTask, useTaskMutations, useMilestoneList } from '../../data';
import { StatusTransitionDropdown } from './StatusTransitionDropdown';

interface TaskDetailPanelProps {
  taskId: string;
  onClose?: () => void;
}

const LINK_KIND_ICONS = {
  reading: <BookOpen size={14} />,
  research: <FlaskConical size={14} />,
  writing: <PenLine size={14} />,
};

const LINK_KIND_LABELS = {
  reading: '阅读材料',
  research: '研究资料',
  writing: '写作材料',
};

export function TaskDetailPanel({
  taskId,
  onClose,
}: TaskDetailPanelProps): ReactElement {
  const task = useTask(taskId);
  const project = useProject(task?.projectId ?? null);
  const { milestones } = useMilestoneList();
  const milestone = task?.milestoneId ? milestones.find(m => m.id === task.milestoneId) ?? null : null;
  const events = useEventsForTask(taskId);
  const { updateTaskStatus, updateTask, deleteTask } = useTaskMutations();

  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editDueDate, setEditDueDate] = useState('');

  if (!task) {
    return (
      <div className="p-6 text-center text-muted">
        未找到任务
      </div>
    );
  }

  const handleStatusTransition = (newStatus: Task['status']) => {
    updateTaskStatus(taskId, newStatus);
  };

  const startEditing = () => {
    setEditTitle(task.title);
    setEditBody(task.body ?? '');
    setEditDueDate(task.dueDate ?? '');
    setEditing(true);
  };

  const saveEditing = async () => {
    await updateTask(taskId, {
      title: editTitle.trim() || task.title,
      body: editBody.trim() || undefined,
      dueDate: editDueDate || null,
    });
    setEditing(false);
  };

  const handleDelete = async () => {
    await deleteTask(taskId);
    onClose?.();
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border space-y-2">
        {editing ? (
          <div className="space-y-2">
            <input
              className="w-full rounded-lg border border-border bg-surface px-2 py-1 text-sm font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') saveEditing(); if (e.key === 'Escape') setEditing(false); }}
              autoFocus
            />
            <textarea
              className="w-full rounded-lg border border-border bg-surface px-2 py-1 text-sm text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-accent"
              rows={2}
              placeholder="描述..."
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
            />
            <input
              type="date"
              className="rounded-lg border border-border bg-surface px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
              value={editDueDate}
              onChange={(e) => setEditDueDate(e.target.value)}
            />
            <div className="flex gap-1">
              <Button variant="primary" size="sm" onPress={saveEditing}>
                <Check size={12} /> 保存
              </Button>
              <Button variant="ghost" size="sm" onPress={() => setEditing(false)}>
                <X size={12} /> 取消
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between">
              <h2 className="text-base font-semibold text-foreground flex-1">
                {task.title}
              </h2>
              <div className="flex items-center gap-1 ml-2 shrink-0">
                <button
                  className="p-1 text-muted hover:text-foreground transition-colors rounded"
                  onClick={startEditing}
                  title="编辑任务"
                >
                  <Edit3 size={14} />
                </button>
                <button
                  className="p-1 text-muted hover:text-danger transition-colors rounded"
                  onClick={handleDelete}
                  title="删除任务"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            <StatusTransitionDropdown
              currentStatus={task.status}
              onTransition={handleStatusTransition}
            />
          </>
        )}
      </div>

      {/* Tabs */}
      <Tabs className="flex-1 flex flex-col overflow-hidden">
        <Tabs.List aria-label="任务详情标签">
          <Tabs.Tab id="detail">
            <FileText size={14} className="inline mr-1" />
            详情
          </Tabs.Tab>
          <Tabs.Tab id="subtasks">
            <List size={14} className="inline mr-1" />
            子任务
          </Tabs.Tab>
          <Tabs.Tab id="materials">
            <Paperclip size={14} className="inline mr-1" />
            材料
          </Tabs.Tab>
          <Tabs.Tab id="history">
            <History size={14} className="inline mr-1" />
            历史
          </Tabs.Tab>
        </Tabs.List>

        {/* 详情 */}
        <Tabs.Panel id="detail" className="flex-1 overflow-y-auto p-4 space-y-4">
          {task.body && (
            <div>
              <span className="text-xs font-medium text-muted">描述</span>
              <p className="text-sm text-foreground mt-1">{task.body}</p>
            </div>
          )}

          {task.completionDefinition && (
            <div>
              <span className="text-xs font-medium text-muted">完成定义</span>
              <p className="text-sm text-foreground mt-1">
                {task.completionDefinition}
              </p>
            </div>
          )}

          <Separator />

          <div className="space-y-2">
            {task.dueDate && (
              <div className="flex items-center gap-2 text-sm">
                <CalendarDays size={14} className="text-muted" />
                <span className="text-muted">截止日期</span>
                <span className="ml-auto text-foreground">{task.dueDate}</span>
              </div>
            )}
            {project && (
              <div className="flex items-center gap-2 text-sm">
                <FolderOpen size={14} className="text-muted" />
                <span className="text-muted">项目</span>
                <span className="ml-auto text-foreground">{project.title}</span>
              </div>
            )}
            {milestone && (
              <div className="flex items-center gap-2 text-sm">
                <MilestoneIcon size={14} className="text-muted" />
                <span className="text-muted">里程碑</span>
                <span className="ml-auto text-foreground">
                  {milestone.title}
                </span>
              </div>
            )}
            {task.focusRank != null && (
              <div className="flex items-center gap-2 text-sm">
                <Clock size={14} className="text-muted" />
                <span className="text-muted">专注排序</span>
                <span className="ml-auto text-foreground">
                  #{task.focusRank}
                </span>
              </div>
            )}
          </div>
        </Tabs.Panel>

        {/* 子任务 */}
        <Tabs.Panel id="subtasks" className="flex-1 overflow-y-auto p-4">
          {task.subtasks.length === 0 ? (
            <p className="text-sm text-muted text-center py-8">暂无子任务</p>
          ) : (
            <div className="space-y-2">
              {task.subtasks.map((st) => (
                <div
                  key={st.id}
                  className="flex items-center gap-2 text-sm p-2 rounded-lg hover:bg-surface-secondary transition-colors"
                >
                  <div
                    className={`w-4 h-4 rounded border flex items-center justify-center ${
                      st.done
                        ? 'bg-success border-success text-white'
                        : 'border-border'
                    }`}
                  >
                    {st.done && <Check size={12} />}
                  </div>
                  <span
                    className={
                      st.done ? 'line-through text-muted' : 'text-foreground'
                    }
                  >
                    {st.title}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Tabs.Panel>

        {/* 材料 */}
        <Tabs.Panel id="materials" className="flex-1 overflow-y-auto p-4">
          {task.supportLinks.length === 0 ? (
            <p className="text-sm text-muted text-center py-8">暂无关联材料</p>
          ) : (
            <div className="space-y-2">
              {task.supportLinks.map((link) => (
                <a
                  key={link.id}
                  href={link.url}
                  className="flex items-center gap-2 text-sm p-2 rounded-lg hover:bg-surface-secondary transition-colors"
                >
                  {LINK_KIND_ICONS[link.kind]}
                  <div className="flex-1">
                    <p className="text-foreground">{link.label}</p>
                    <p className="text-xs text-muted">
                      {LINK_KIND_LABELS[link.kind]}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          )}
        </Tabs.Panel>

        {/* 历史 */}
        <Tabs.Panel id="history" className="flex-1 overflow-y-auto p-4">
          {events.length === 0 ? (
            <p className="text-sm text-muted text-center py-8">暂无历史记录</p>
          ) : (
            <div className="relative pl-6 space-y-4">
              <div className="absolute left-[11px] top-1 bottom-1 w-0.5 bg-border" />
              {events.map((evt) => (
                <div key={evt.id} className="relative">
                  <div className="absolute -left-6 top-1 w-[22px] h-[22px] rounded-full border-2 border-background bg-surface-secondary flex items-center justify-center">
                    {evt.type === 'status_change' ? (
                      <ArrowRight size={12} className="text-muted" />
                    ) : (
                      <FileText size={12} className="text-muted" />
                    )}
                  </div>
                  <div className="ml-2">
                    {evt.type === 'status_change' && evt.from && evt.to && (
                      <div className="flex items-center gap-1 flex-wrap">
                        <Chip
                          variant="soft"
                          color={STATUS_COLORS[evt.from as keyof typeof STATUS_COLORS]}
                          size="sm"
                        >
                          {STATUS_LABELS[evt.from as keyof typeof STATUS_LABELS]}
                        </Chip>
                        <ArrowRight size={12} className="text-muted" />
                        <Chip
                          variant="soft"
                          color={STATUS_COLORS[evt.to as keyof typeof STATUS_COLORS]}
                          size="sm"
                        >
                          {STATUS_LABELS[evt.to as keyof typeof STATUS_LABELS]}
                        </Chip>
                      </div>
                    )}
                    {evt.note && (
                      <p className="text-sm text-muted mt-1">{evt.note}</p>
                    )}
                    <p className="text-xs text-muted mt-1">
                      {new Date(evt.timestamp).toLocaleString('zh-CN')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}
