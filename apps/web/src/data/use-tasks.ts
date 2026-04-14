import { useMemo } from 'react';
import type { DatabasePort } from '@orbit/platform-contracts';
import { useOrbitData } from './orbit-data-context';
import type {
  Task,
  Project,
  Milestone,
  TaskEvent,
  TodayPlan,
  TaskStatus,
} from '../pages/task/mock-data';

// ── Helpers ────────────────────────────────────────────────────────────────

const TASK_STATUS_SET = new Set<TaskStatus>([
  'captured',
  'clarifying',
  'ready',
  'scheduled',
  'focused',
  'done',
  'blocked',
  'dropped',
]);

function normalizeTaskStatus(value: unknown): TaskStatus {
  const raw = typeof value === 'string' ? value : '';
  if (TASK_STATUS_SET.has(raw as TaskStatus)) return raw as TaskStatus;

  switch (raw) {
    case 'todo':
      return 'captured';
    case 'in_progress':
      return 'focused';
    case 'in_review':
      return 'clarifying';
    case 'completed':
      return 'done';
    default:
      return 'captured';
  }
}

function normalizeMilestoneStatus(value: unknown): Milestone['status'] {
  const raw = typeof value === 'string' ? value : '';
  switch (raw) {
    case 'done':
    case 'active':
    case 'planned':
    case 'dropped':
      return raw;
    case 'pending':
      return 'planned';
    default:
      return 'planned';
  }
}

function rowToTask(db: DatabasePort, row: Record<string, unknown>): Task {
  return {
    id: row.id as string,
    title: row.title as string,
    body: (row.description as string) || undefined,
    status: normalizeTaskStatus(row.status),
    projectId: (row.project_id as string) ?? null,
    milestoneId: (row.milestone_id as string) ?? null,
    dueDate: (row.due_date as string) || null,
    focusRank: (row.focus_rank as number) || null,
    completionDefinition: undefined,
    subtasks: [],
    supportLinks: [],
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    completedAt: (row.completed_at as string) || null,
  };
}

export interface ReviewEntry {
  id: string;
  title: string;
  reviewType: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  body: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

function rowToReview(row: Record<string, unknown>): ReviewEntry {
  return {
    id: row.id as string,
    title: row.title as string,
    reviewType: (row.review_type as string) ?? null,
    periodStart: (row.period_start as string) ?? null,
    periodEnd: (row.period_end as string) ?? null,
    body: (row.body as string) ?? null,
    status: (row.status as string) || 'draft',
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// ── Task hooks ─────────────────────────────────────────────────────────────

export function useTaskList(): { tasks: Task[]; loading: boolean } {
  const { db, version, ready } = useOrbitData();

  return useMemo(() => {
    if (!ready || !db) return { tasks: [], loading: !ready };
    try {
      const rows = db.query<Record<string, unknown>>(
        `SELECT * FROM tasks WHERE deleted_flg = 0 ORDER BY updated_at DESC`,
      );
      return { tasks: rows.map((r) => rowToTask(db, r)), loading: false };
    } catch {
      return { tasks: [], loading: false };
    }
  }, [db, version, ready]);
}

export function useTask(id: string | null): Task | null {
  const { db, version, ready } = useOrbitData();

  return useMemo(() => {
    if (!ready || !db || !id) return null;
    try {
      const rows = db.query<Record<string, unknown>>(
        'SELECT * FROM tasks WHERE id = ? AND deleted_flg = 0',
        [id],
      );
      return rows.length > 0 ? rowToTask(db, rows[0]) : null;
    } catch {
      return null;
    }
  }, [db, id, version, ready]);
}

export function useTasksForProject(projectId: string): Task[] {
  const { db, version, ready } = useOrbitData();

  return useMemo(() => {
    if (!ready || !db) return [];
    try {
      const rows = db.query<Record<string, unknown>>(
        `SELECT * FROM tasks WHERE project_id = ? AND deleted_flg = 0 ORDER BY updated_at DESC`,
        [projectId],
      );
      return rows.map((r) => rowToTask(db, r));
    } catch {
      return [];
    }
  }, [db, projectId, version, ready]);
}

// ── Project hooks ──────────────────────────────────────────────────────────

export function useProjectList(): { projects: Project[]; loading: boolean } {
  const { db, version, ready } = useOrbitData();

  return useMemo(() => {
    if (!ready || !db) return { projects: [], loading: !ready };
    try {
      const rows = db.query<Record<string, unknown>>(
        'SELECT * FROM projects WHERE deleted_flg = 0 ORDER BY created_at DESC',
      );

      const projects: Project[] = rows.map((row) => {
        const msRows = db.query<{ id: string }>(
          `SELECT id FROM milestones WHERE project_id = ? AND deleted_flg = 0`,
          [row.id],
        );

        return {
          id: row.id as string,
          title: row.title as string,
          status: (row.status as string) || 'active',
          alignment: (row.description as string) || '',
          visionLink: null,
          milestoneIds: msRows.map((m) => m.id),
          lastReviewedAt: null,
          createdAt: row.created_at as string,
        } as Project;
      });

      return { projects, loading: false };
    } catch {
      return { projects: [], loading: false };
    }
  }, [db, version, ready]);
}

export function useProject(id: string | null): Project | null {
  const { db, version, ready } = useOrbitData();

  return useMemo(() => {
    if (!ready || !db || !id) return null;
    try {
      const rows = db.query<Record<string, unknown>>(
        'SELECT * FROM projects WHERE id = ? AND deleted_flg = 0',
        [id],
      );
      if (rows.length === 0) return null;
      const row = rows[0];

      const msRows = db.query<{ id: string }>(
        'SELECT id FROM milestones WHERE project_id = ? AND deleted_flg = 0',
        [id],
      );

      return {
        id: row.id as string,
        title: row.title as string,
        status: (row.status as string) || 'active',
        alignment: (row.description as string) || '',
        visionLink: null,
        milestoneIds: msRows.map((m) => m.id),
        lastReviewedAt: null,
        createdAt: row.created_at as string,
      } as Project;
    } catch {
      return null;
    }
  }, [db, id, version, ready]);
}

// ── Milestone hooks ────────────────────────────────────────────────────────

export function useMilestoneList(): { milestones: Milestone[]; loading: boolean } {
  const { db, version, ready } = useOrbitData();

  return useMemo(() => {
    if (!ready || !db) return { milestones: [], loading: !ready };
    try {
      const rows = db.query<Record<string, unknown>>(
        'SELECT * FROM milestones WHERE deleted_flg = 0 ORDER BY created_at DESC',
      );

      const milestones: Milestone[] = rows.map((row) => {
        const taskRows = db.query<{ id: string }>(
          'SELECT id FROM tasks WHERE milestone_id = ? AND deleted_flg = 0',
          [row.id],
        );

        return {
          id: row.id as string,
          projectId: row.project_id as string,
          title: row.title as string,
          status: normalizeMilestoneStatus(row.status),
          dueDate: (row.target_date as string) || null,
          completionDefinition: (row.description as string) || '',
          taskIds: taskRows.map((t) => t.id),
        } as Milestone;
      });

      return { milestones, loading: false };
    } catch {
      return { milestones: [], loading: false };
    }
  }, [db, version, ready]);
}

// ── Event hooks ────────────────────────────────────────────────────────────

export function useEventsForTask(taskId: string): TaskEvent[] {
  const { db, version, ready } = useOrbitData();

  return useMemo(() => {
    if (!ready || !db) return [];
    try {
      const rows = db.query<Record<string, unknown>>(
        `SELECT * FROM events WHERE stream_uid = ? ORDER BY occurred_at DESC`,
        [`task:${taskId}`],
      );

      return rows.map((row) => {
        const payload = row.payload_json ? JSON.parse(row.payload_json as string) : {};
        const eventType = (row.event_type as string) ?? '';

        let type: TaskEvent['type'] = 'comment';
        if (eventType.includes('status')) type = 'status_change';
        else if (eventType.includes('assignment')) type = 'assignment';

        return {
          id: row.event_id as string,
          taskId,
          type,
          from: payload.from,
          to: payload.to,
          note: payload.note,
          timestamp: row.occurred_at as string,
        } as TaskEvent;
      });
    } catch {
      return [];
    }
  }, [db, taskId, version, ready]);
}

export function useDailyReview(dayKey: string): ReviewEntry | null {
  const { db, version, ready } = useOrbitData();

  return useMemo(() => {
    if (!ready || !db || !dayKey) return null;
    try {
      const rows = db.query<Record<string, unknown>>(
        `SELECT *
         FROM reviews
         WHERE review_type = 'daily' AND period_start = ? AND deleted_flg = 0
         ORDER BY updated_at DESC
         LIMIT 1`,
        [dayKey],
      );
      return rows.length > 0 ? rowToReview(rows[0]) : null;
    } catch {
      return null;
    }
  }, [db, dayKey, version, ready]);
}

export function useProjectReview(projectId: string | null): ReviewEntry | null {
  const { db, version, ready } = useOrbitData();

  return useMemo(() => {
    if (!ready || !db || !projectId) return null;
    try {
      const rows = db.query<Record<string, unknown>>(
        `SELECT r.*
         FROM reviews r
         JOIN links l ON l.source_uid = ('review:' || r.id)
         WHERE r.review_type = 'project'
           AND r.deleted_flg = 0
           AND l.target_uid = ?
           AND l.relation_type = 'reviews'
           AND l.deleted_flg = 0
         ORDER BY r.updated_at DESC
         LIMIT 1`,
        [`project:${projectId}`],
      );
      return rows.length > 0 ? rowToReview(rows[0]) : null;
    } catch {
      return null;
    }
  }, [db, projectId, version, ready]);
}

// ── Today plan hook ────────────────────────────────────────────────────────

const EMPTY_PLAN: TodayPlan = {
  primary: { taskId: '', reasoning: '', urgency: 0, importance: 0, contextFit: 0 },
  alternatives: [],
  scheduledBlocks: [],
  carryForward: [],
};

export function useTodayPlan(): TodayPlan {
  const { db, version, ready } = useOrbitData();

  return useMemo(() => {
    if (!ready || !db) return EMPTY_PLAN;
    try {
      const focused = db.query<Record<string, unknown>>(
        `SELECT id, title, focus_rank FROM tasks
         WHERE status = 'focused' AND deleted_flg = 0
         ORDER BY focus_rank ASC NULLS LAST`,
      );
      const upcoming = db.query<Record<string, unknown>>(
        `SELECT id, title, focus_rank FROM tasks
         WHERE status IN ('ready', 'scheduled') AND deleted_flg = 0
         ORDER BY focus_rank ASC NULLS LAST
         LIMIT 5`,
      );

      const primary = focused[0]
        ? {
            taskId: focused[0].id as string,
            reasoning: '当前专注中的最高优先级任务',
            urgency: 0.9,
            importance: 0.95,
            contextFit: 0.85,
          }
        : {
            taskId: (upcoming[0]?.id as string) ?? '',
            reasoning: '下一个就绪的任务',
            urgency: 0.7,
            importance: 0.7,
            contextFit: 0.7,
          };

      const alternatives = [...focused.slice(1), ...upcoming.slice(0, 2)].map((r) => ({
        taskId: r.id as string,
        reasoning: '备选任务',
        urgency: 0.6,
        importance: 0.7,
        contextFit: 0.6,
      }));

      const scheduled = db.query<Record<string, unknown>>(
        `SELECT id FROM tasks
         WHERE status IN ('focused', 'scheduled') AND deleted_flg = 0
         ORDER BY focus_rank ASC NULLS LAST
         LIMIT 4`,
      );
      const startHours = [9, 11, 14, 16];
      const scheduledBlocks = scheduled.map((r, i) => ({
        id: `sb-${i + 1}`,
        taskId: r.id as string,
        startTime: `${String(startHours[i] ?? 17).padStart(2, '0')}:00`,
        endTime: `${String((startHours[i] ?? 17) + 1).padStart(2, '0')}:30`,
      }));

      const carry = db.query<{ id: string }>(
        `SELECT id FROM tasks
         WHERE status IN ('clarifying', 'blocked') AND deleted_flg = 0
         LIMIT 5`,
      );

      return {
        primary,
        alternatives,
        scheduledBlocks,
        carryForward: carry.map((r) => r.id),
      };
    } catch {
      return EMPTY_PLAN;
    }
  }, [db, version, ready]);
}
