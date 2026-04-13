import { useCallback } from 'react';
import { useOrbitData } from './orbit-data-context';
import type { TaskStatus } from '../pages/task/mock-data';

function generateId(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function useTaskMutations() {
  const { db, repos, invalidate, ready } = useOrbitData();

  const createTask = useCallback(
    async (input: { title: string; body?: string; projectId?: string; milestoneId?: string; dueDate?: string }) => {
      if (!ready || !db || !repos) return null;

      const result = await repos.objects.write('task', {
        title: input.title,
        description: input.body,
        status: 'captured',
        projectId: input.projectId ?? null,
        milestoneId: input.milestoneId ?? null,
        dueDate: input.dueDate ?? null,
        layer: 'wiki',
      });

      if (input.projectId) {
        await repos.links.write({
          sourceUid: result.objectUid,
          targetUid: `project:${input.projectId}`,
          relationType: 'belongs_to',
          origin: 'human',
        });
      }

      await repos.events.append({
        streamUid: result.objectUid,
        eventType: 'task.created',
        actorType: 'user',
        payloadJson: JSON.stringify({ title: input.title }),
      });

      invalidate();
      return result;
    },
    [db, repos, invalidate, ready],
  );

  const updateTaskStatus = useCallback(
    async (taskId: string, newStatus: TaskStatus) => {
      if (!ready || !db || !repos) return;

      const now = new Date().toISOString();
      db.run('UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?', [newStatus, now, taskId]);
      db.run('UPDATE object_index SET status = ?, updated_at = ? WHERE object_id = ? AND object_type = ?', [
        newStatus,
        now,
        taskId,
        'task',
      ]);

      if (newStatus === 'done') {
        db.run('UPDATE tasks SET completed_at = ? WHERE id = ?', [now, taskId]);
      }

      await repos.events.append({
        streamUid: `task:${taskId}`,
        eventType: 'task.status_changed',
        actorType: 'user',
        payloadJson: JSON.stringify({ status: newStatus }),
      });

      invalidate();
    },
    [db, repos, invalidate, ready],
  );

  const updateTask = useCallback(
    async (taskId: string, fields: { title?: string; body?: string; dueDate?: string | null; projectId?: string | null; milestoneId?: string | null }) => {
      if (!ready || !db) return;

      const now = new Date().toISOString();
      const sets: string[] = ['updated_at = ?'];
      const params: unknown[] = [now];

      if (fields.title !== undefined) {
        sets.push('title = ?');
        params.push(fields.title);
      }
      if (fields.body !== undefined) {
        sets.push('description = ?');
        params.push(fields.body);
      }
      if (fields.dueDate !== undefined) {
        sets.push('due_date = ?');
        params.push(fields.dueDate);
      }
      if (fields.projectId !== undefined) {
        sets.push('project_id = ?');
        params.push(fields.projectId);
      }
      if (fields.milestoneId !== undefined) {
        sets.push('milestone_id = ?');
        params.push(fields.milestoneId);
      }

      params.push(taskId);
      db.run(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`, params);
      invalidate();
    },
    [db, invalidate, ready],
  );

  const deleteTask = useCallback(
    async (taskId: string) => {
      if (!ready || !db) return;
      const now = new Date().toISOString();
      db.run('UPDATE tasks SET deleted_flg = 1, updated_at = ? WHERE id = ?', [now, taskId]);
      db.run('UPDATE object_index SET deleted_flg = 1, updated_at = ? WHERE object_id = ? AND object_type = ?', [now, taskId, 'task']);
      invalidate();
    },
    [db, invalidate, ready],
  );

  const createProject = useCallback(
    async (input: { title: string; description?: string }) => {
      if (!ready || !db || !repos) return null;

      const id = generateId();
      const now = new Date().toISOString();
      db.run(
        `INSERT INTO projects (id, title, description, status, priority, created_at, updated_at, deleted_flg)
         VALUES (?, ?, ?, 'active', 'medium', ?, ?, 0)`,
        [id, input.title, input.description ?? '', now, now],
      );
      db.run(
        `INSERT INTO object_index (object_id, object_type, title, status, created_at, updated_at, deleted_flg)
         VALUES (?, 'project', ?, 'active', ?, ?, 0)`,
        [id, input.title, now, now],
      );

      invalidate();
      return { id };
    },
    [db, repos, invalidate, ready],
  );

  const updateProject = useCallback(
    async (projectId: string, fields: { title?: string; description?: string; status?: string }) => {
      if (!ready || !db) return;

      const now = new Date().toISOString();
      const sets: string[] = ['updated_at = ?'];
      const params: unknown[] = [now];

      if (fields.title !== undefined) {
        sets.push('title = ?');
        params.push(fields.title);
      }
      if (fields.description !== undefined) {
        sets.push('description = ?');
        params.push(fields.description);
      }
      if (fields.status !== undefined) {
        sets.push('status = ?');
        params.push(fields.status);
      }

      params.push(projectId);
      db.run(`UPDATE projects SET ${sets.join(', ')} WHERE id = ?`, params);
      invalidate();
    },
    [db, invalidate, ready],
  );

  const deleteProject = useCallback(
    async (projectId: string) => {
      if (!ready || !db) return;
      const now = new Date().toISOString();
      db.run('UPDATE projects SET deleted_flg = 1, updated_at = ? WHERE id = ?', [now, projectId]);
      db.run('UPDATE object_index SET deleted_flg = 1, updated_at = ? WHERE object_id = ? AND object_type = ?', [now, projectId, 'project']);
      invalidate();
    },
    [db, invalidate, ready],
  );

  return { createTask, updateTaskStatus, updateTask, deleteTask, createProject, updateProject, deleteProject };
}
