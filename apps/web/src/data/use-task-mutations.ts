import { useCallback } from 'react';
import { useOrbitData } from './orbit-data-context';
import type { TaskStatus } from '../pages/task/mock-data';

export function useTaskMutations() {
  const { db, repos, invalidate } = useOrbitData();

  const createTask = useCallback(
    async (input: { title: string; body?: string; projectId?: string; dueDate?: string }) => {
      const result = await repos.objects.write('task', {
        title: input.title,
        description: input.body,
        status: 'captured',
        projectId: input.projectId ?? null,
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
    [repos, invalidate],
  );

  const updateTaskStatus = useCallback(
    async (taskId: string, newStatus: TaskStatus) => {
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
    [db, repos, invalidate],
  );

  const deleteTask = useCallback(
    async (taskId: string) => {
      await repos.objects.delete(`task:${taskId}` as never);
      invalidate();
    },
    [repos, invalidate],
  );

  return { createTask, updateTaskStatus, deleteTask };
}
