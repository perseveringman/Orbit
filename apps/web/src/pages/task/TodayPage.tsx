import { useState, type ReactElement } from 'react';
import { Card, Chip, Button, Tabs, Separator } from '@heroui/react';
import {
  Sparkles,
  Clock,
  Battery,
  BatteryMedium,
  BatteryLow,
  AlertTriangle,
  CalendarDays,
  FolderOpen,
} from 'lucide-react';
import {
  type EnergyLevel,
  MOCK_TODAY_PLAN,
  MOCK_TASKS,
  STATUS_LABELS,
  STATUS_COLORS,
  getTask,
  getProject,
} from './mock-data';
import { NextThingCard } from './NextThingCard';

const ENERGY_OPTIONS: { level: EnergyLevel; label: string; icon: ReactElement }[] = [
  { level: 'high', label: '高', icon: <Battery size={16} /> },
  { level: 'medium', label: '中', icon: <BatteryMedium size={16} /> },
  { level: 'low', label: '低', icon: <BatteryLow size={16} /> },
];

export function TodayPage(): ReactElement {
  const [energy, setEnergy] = useState<EnergyLevel>('high');
  const plan = MOCK_TODAY_PLAN;

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-6 overflow-y-auto h-full">
      {/* Date header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">今日计划</h2>
          <p className="text-sm text-muted">2026-04-09 · 星期四</p>
        </div>
        {/* Energy selector */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted mr-2">能量：</span>
          {ENERGY_OPTIONS.map((opt) => (
            <Button
              key={opt.level}
              variant={energy === opt.level ? 'primary' : 'secondary'}
              size="sm"
              onPress={() => setEnergy(opt.level)}
            >
              {opt.icon} {opt.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Hero: Next Thing */}
      <NextThingCard recommendation={plan.primary} />

      {/* Scheduled time blocks */}
      <div>
        <h3 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
          <Clock size={18} /> 时间块
        </h3>
        <div className="space-y-2">
          {plan.scheduledBlocks.map((block) => {
            const task = getTask(block.taskId);
            const project = task?.projectId
              ? getProject(task.projectId)
              : null;
            return (
              <Card key={block.id}>
                <Card.Content>
                  <div className="flex items-center gap-3">
                    <div className="text-sm font-mono text-accent whitespace-nowrap">
                      {block.startTime} – {block.endTime}
                    </div>
                    <Separator orientation="vertical" className="h-5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {task?.title ?? block.taskId}
                      </p>
                      {project && (
                        <p className="text-xs text-muted flex items-center gap-1 mt-0.5">
                          <FolderOpen size={12} /> {project.title}
                        </p>
                      )}
                    </div>
                    {task && (
                      <Chip
                        variant="soft"
                        color={STATUS_COLORS[task.status]}
                        size="sm"
                      >
                        {STATUS_LABELS[task.status]}
                      </Chip>
                    )}
                  </div>
                </Card.Content>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Carry-forward */}
      {plan.carryForward.length > 0 && (
        <div>
          <h3 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
            <AlertTriangle size={18} className="text-warning" /> 昨日遗留
          </h3>
          <div className="space-y-2">
            {plan.carryForward.map((taskId) => {
              const task = getTask(taskId);
              return (
                <Card key={taskId}>
                  <Card.Content>
                    <div className="flex items-center gap-2">
                      <Chip variant="soft" color="warning" size="sm">
                        ⚠️ 遗留
                      </Chip>
                      <span className="text-sm text-foreground">
                        {task?.title ?? taskId}
                      </span>
                    </div>
                  </Card.Content>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Alternatives */}
      <div>
        <h3 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
          <Sparkles size={18} className="text-accent" /> 备选任务
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {plan.alternatives.map((alt) => {
            const task = getTask(alt.taskId);
            const project = task?.projectId
              ? getProject(task.projectId)
              : null;
            return (
              <Card key={alt.taskId}>
                <Card.Header>
                  {project && (
                    <Chip variant="soft" size="sm">
                      <FolderOpen size={12} className="inline mr-1" />
                      {project.title}
                    </Chip>
                  )}
                </Card.Header>
                <Card.Title>{task?.title ?? alt.taskId}</Card.Title>
                <Card.Content>
                  <p className="text-xs text-muted">{alt.reasoning}</p>
                </Card.Content>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
