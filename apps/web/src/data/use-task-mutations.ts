import { useCallback } from 'react';
import type { DatabasePort } from '@orbit/platform-contracts';
import { useOrbitData } from './orbit-data-context';
import type { TaskStatus } from '../pages/task/mock-data';

type ReviewKind = 'daily' | 'project';

function generateId(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function upsertSearchIndex(
  db: DatabasePort,
  objectUid: string,
  title: string,
  summary: string | null,
  keywords: string,
): void {
  db.run(
    `INSERT OR REPLACE INTO object_search_fts (object_uid, title, summary, keywords)
     VALUES (?, ?, ?, ?)`,
    [objectUid, title, summary ?? '', keywords],
  );
}

function deleteSearchIndex(db: DatabasePort, objectUid: string): void {
  db.run('DELETE FROM object_search_fts WHERE object_uid = ?', [objectUid]);
}

function buildReviewTitle(kind: ReviewKind, scopeLabel: string): string {
  return kind === 'daily' ? `日回顾 · ${scopeLabel}` : `项目复盘 · ${scopeLabel}`;
}

export function useTaskMutations() {
  const { db, repos, invalidate, ready } = useOrbitData();

  const createTask = useCallback(
    async (input: {
      title: string;
      body?: string;
      projectId?: string;
      milestoneId?: string;
      dueDate?: string;
    }) => {
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
        payloadJson: JSON.stringify({
          title: input.title,
          projectId: input.projectId ?? null,
          milestoneId: input.milestoneId ?? null,
        }),
      });

      invalidate();
      return result;
    },
    [db, repos, invalidate, ready],
  );

  const updateTaskStatus = useCallback(
    async (taskId: string, newStatus: TaskStatus) => {
      if (!ready || !db || !repos) return;

      const currentRows = db.query<{ status: string | null }>(
        'SELECT status FROM tasks WHERE id = ? AND deleted_flg = 0 LIMIT 1',
        [taskId],
      );
      if (currentRows.length === 0) return;

      const previousStatus = (currentRows[0].status ?? 'captured') as TaskStatus;
      if (previousStatus === newStatus) return;

      const now = new Date().toISOString();

      db.transaction(() => {
        db.run(
          'UPDATE tasks SET status = ?, completed_at = ?, updated_at = ? WHERE id = ?',
          [newStatus, newStatus === 'done' ? now : null, now, taskId],
        );
        db.run(
          'UPDATE object_index SET status = ?, version_token = ?, updated_at = ? WHERE object_id = ? AND object_type = ?',
          [newStatus, `task-${taskId}-${now}`, now, taskId, 'task'],
        );
      });

      await repos.events.append({
        streamUid: `task:${taskId}`,
        eventType: 'task.status_changed',
        actorType: 'user',
        payloadJson: JSON.stringify({ from: previousStatus, to: newStatus }),
      });

      invalidate();
    },
    [db, repos, invalidate, ready],
  );

  const updateTask = useCallback(
    async (taskId: string, fields: {
      title?: string;
      body?: string;
      dueDate?: string | null;
      projectId?: string | null;
      milestoneId?: string | null;
    }) => {
      if (!ready || !db) return;

      const existingRows = db.query<{ title: string; description: string | null }>(
        'SELECT title, description FROM tasks WHERE id = ? AND deleted_flg = 0 LIMIT 1',
        [taskId],
      );
      if (existingRows.length === 0) return;

      const now = new Date().toISOString();
      const taskSets: string[] = ['updated_at = ?'];
      const taskParams: unknown[] = [now];

      if (fields.title !== undefined) {
        taskSets.push('title = ?');
        taskParams.push(fields.title);
      }
      if (fields.body !== undefined) {
        taskSets.push('description = ?');
        taskParams.push(fields.body);
      }
      if (fields.dueDate !== undefined) {
        taskSets.push('due_date = ?');
        taskParams.push(fields.dueDate);
      }
      if (fields.projectId !== undefined) {
        taskSets.push('project_id = ?');
        taskParams.push(fields.projectId);
      }
      if (fields.milestoneId !== undefined) {
        taskSets.push('milestone_id = ?');
        taskParams.push(fields.milestoneId);
      }

      taskParams.push(taskId);

      db.transaction(() => {
        db.run(`UPDATE tasks SET ${taskSets.join(', ')} WHERE id = ?`, taskParams);

        const objectSets: string[] = ['updated_at = ?', 'version_token = ?'];
        const objectParams: unknown[] = [now, `task-${taskId}-${now}`];

        if (fields.title !== undefined) {
          objectSets.push('title = ?');
          objectParams.push(fields.title);
        }
        if (fields.body !== undefined) {
          objectSets.push('summary = ?');
          objectParams.push(fields.body);
        }

        objectParams.push(taskId, 'task');
        db.run(
          `UPDATE object_index SET ${objectSets.join(', ')} WHERE object_id = ? AND object_type = ?`,
          objectParams,
        );

        const nextRows = db.query<{ title: string; description: string | null }>(
          'SELECT title, description FROM tasks WHERE id = ? LIMIT 1',
          [taskId],
        );
        if (nextRows.length > 0) {
          upsertSearchIndex(
            db,
            `task:${taskId}`,
            nextRows[0].title,
            nextRows[0].description ?? null,
            'task',
          );
        }
      });

      invalidate();
    },
    [db, invalidate, ready],
  );

  const deleteTask = useCallback(
    async (taskId: string) => {
      if (!ready || !db) return;

      const now = new Date().toISOString();
      const taskUid = `task:${taskId}`;

      db.transaction(() => {
        db.run('UPDATE tasks SET deleted_flg = 1, updated_at = ? WHERE id = ?', [now, taskId]);
        db.run(
          'UPDATE object_index SET deleted_flg = 1, version_token = ?, updated_at = ? WHERE object_id = ? AND object_type = ?',
          [`task-${taskId}-${now}`, now, taskId, 'task'],
        );
        db.run(
          'UPDATE links SET deleted_flg = 1, updated_at = ? WHERE source_uid = ? OR target_uid = ?',
          [now, taskUid, taskUid],
        );
        deleteSearchIndex(db, taskUid);
      });

      invalidate();
    },
    [db, invalidate, ready],
  );

  const createProject = useCallback(
    async (input: { title: string; description?: string }) => {
      if (!ready || !db) return null;

      const id = generateId();
      const now = new Date().toISOString();
      const projectUid = `project:${id}`;

      db.transaction(() => {
        db.run(
          `INSERT INTO projects (id, title, description, status, created_at, updated_at, deleted_flg)
           VALUES (?, ?, ?, 'active', ?, ?, 0)`,
          [id, input.title, input.description ?? null, now, now],
        );
        db.run(
          `INSERT INTO object_index (object_uid, object_type, object_id, canonical_table, layer, title, summary, status, origin, visibility, version_token, created_at, updated_at, deleted_flg)
           VALUES (?, 'project', ?, 'projects', 'wiki', ?, ?, 'active', 'human', 'private', ?, ?, ?, 0)`,
          [projectUid, id, input.title, input.description ?? null, `project-${id}-${now}`, now, now],
        );
        upsertSearchIndex(db, projectUid, input.title, input.description ?? null, 'project');
      });

      if (repos) {
        await repos.events.append({
          streamUid: projectUid,
          eventType: 'project.created',
          actorType: 'user',
          payloadJson: JSON.stringify({ title: input.title }),
        });
      }

      invalidate();
      return { id };
    },
    [db, repos, invalidate, ready],
  );

  const updateProject = useCallback(
    async (projectId: string, fields: { title?: string; description?: string; status?: string }) => {
      if (!ready || !db) return;

      const existingRows = db.query<{ title: string; description: string | null; status: string | null }>(
        'SELECT title, description, status FROM projects WHERE id = ? AND deleted_flg = 0 LIMIT 1',
        [projectId],
      );
      if (existingRows.length === 0) return;

      const now = new Date().toISOString();
      const projectSets: string[] = ['updated_at = ?'];
      const projectParams: unknown[] = [now];

      if (fields.title !== undefined) {
        projectSets.push('title = ?');
        projectParams.push(fields.title);
      }
      if (fields.description !== undefined) {
        projectSets.push('description = ?');
        projectParams.push(fields.description);
      }
      if (fields.status !== undefined) {
        projectSets.push('status = ?', 'completed_at = ?');
        projectParams.push(fields.status, fields.status === 'done' ? now : null);
      }

      projectParams.push(projectId);

      db.transaction(() => {
        db.run(`UPDATE projects SET ${projectSets.join(', ')} WHERE id = ?`, projectParams);

        const nextRows = db.query<{ title: string; description: string | null; status: string | null }>(
          'SELECT title, description, status FROM projects WHERE id = ? LIMIT 1',
          [projectId],
        );
        if (nextRows.length === 0) return;

        const next = nextRows[0];
        db.run(
          'UPDATE object_index SET title = ?, summary = ?, status = ?, version_token = ?, updated_at = ? WHERE object_id = ? AND object_type = ?',
          [
            next.title,
            next.description ?? null,
            next.status ?? 'active',
            `project-${projectId}-${now}`,
            now,
            projectId,
            'project',
          ],
        );
        upsertSearchIndex(db, `project:${projectId}`, next.title, next.description ?? null, 'project');
      });

      invalidate();
    },
    [db, invalidate, ready],
  );

  const deleteProject = useCallback(
    async (projectId: string) => {
      if (!ready || !db) return;

      const now = new Date().toISOString();
      const projectUid = `project:${projectId}`;
      const milestoneRows = db.query<{ id: string }>(
        'SELECT id FROM milestones WHERE project_id = ? AND deleted_flg = 0',
        [projectId],
      );

      db.transaction(() => {
        db.run('UPDATE projects SET deleted_flg = 1, updated_at = ? WHERE id = ?', [now, projectId]);
        db.run(
          'UPDATE object_index SET deleted_flg = 1, version_token = ?, updated_at = ? WHERE object_id = ? AND object_type = ?',
          [`project-${projectId}-${now}`, now, projectId, 'project'],
        );
        db.run('UPDATE tasks SET project_id = NULL, updated_at = ? WHERE project_id = ?', [now, projectId]);
        db.run(
          'UPDATE links SET deleted_flg = 1, updated_at = ? WHERE source_uid = ? OR target_uid = ?',
          [now, projectUid, projectUid],
        );
        deleteSearchIndex(db, projectUid);

        for (const milestone of milestoneRows) {
          const milestoneUid = `milestone:${milestone.id}`;
          db.run('UPDATE milestones SET deleted_flg = 1, updated_at = ? WHERE id = ?', [now, milestone.id]);
          db.run(
            'UPDATE object_index SET deleted_flg = 1, version_token = ?, updated_at = ? WHERE object_id = ? AND object_type = ?',
            [`milestone-${milestone.id}-${now}`, now, milestone.id, 'milestone'],
          );
          db.run('UPDATE tasks SET milestone_id = NULL, updated_at = ? WHERE milestone_id = ?', [
            now,
            milestone.id,
          ]);
          db.run(
            'UPDATE links SET deleted_flg = 1, updated_at = ? WHERE source_uid = ? OR target_uid = ?',
            [now, milestoneUid, milestoneUid],
          );
          deleteSearchIndex(db, milestoneUid);
        }
      });

      invalidate();
    },
    [db, invalidate, ready],
  );

  const saveDailyReview = useCallback(
    async (input: { date: string; body: string }) => {
      if (!ready || !db) return null;

      const now = new Date().toISOString();
      const title = buildReviewTitle('daily', input.date);
      const existingRows = db.query<{ id: string }>(
        `SELECT id
         FROM reviews
         WHERE review_type = 'daily' AND period_start = ? AND deleted_flg = 0
         ORDER BY updated_at DESC
         LIMIT 1`,
        [input.date],
      );
      const reviewId = existingRows[0]?.id ?? generateId();
      const reviewUid = `review:${reviewId}`;

      db.transaction(() => {
        if (existingRows.length > 0) {
          db.run(
            `UPDATE reviews
             SET title = ?, period_end = ?, body = ?, status = 'published', updated_at = ?
             WHERE id = ?`,
            [title, input.date, input.body, now, reviewId],
          );
          db.run(
            `UPDATE object_index
             SET title = ?, summary = ?, status = 'published', version_token = ?, updated_at = ?
             WHERE object_id = ? AND object_type = ?`,
            [title, input.body, `review-${reviewId}-${now}`, now, reviewId, 'review'],
          );
        } else {
          db.run(
            `INSERT INTO reviews (id, title, review_type, period_start, period_end, body, status, created_at, updated_at, deleted_flg)
             VALUES (?, ?, 'daily', ?, ?, ?, 'published', ?, ?, 0)`,
            [reviewId, title, input.date, input.date, input.body, now, now],
          );
          db.run(
            `INSERT INTO object_index (object_uid, object_type, object_id, canonical_table, layer, title, summary, status, origin, visibility, version_token, created_at, updated_at, deleted_flg)
             VALUES (?, 'review', ?, 'reviews', 'journal', ?, ?, 'published', 'human', 'private', ?, ?, ?, 0)`,
            [reviewUid, reviewId, title, input.body, `review-${reviewId}-${now}`, now, now],
          );
        }

        upsertSearchIndex(db, reviewUid, title, input.body, 'review daily');
      });

      if (repos) {
        await repos.events.append({
          streamUid: reviewUid,
          eventType: 'review.saved',
          actorType: 'user',
          payloadJson: JSON.stringify({ reviewType: 'daily', periodStart: input.date }),
        });
      }

      invalidate();
      return reviewId;
    },
    [db, repos, invalidate, ready],
  );

  const saveProjectReview = useCallback(
    async (input: { projectId: string; projectTitle: string; date: string; body: string }) => {
      if (!ready || !db) return null;

      const now = new Date().toISOString();
      const title = buildReviewTitle('project', input.projectTitle);
      const projectUid = `project:${input.projectId}`;
      const existingRows = db.query<{ id: string }>(
        `SELECT r.id
         FROM reviews r
         JOIN links l ON l.source_uid = ('review:' || r.id)
         WHERE r.review_type = 'project'
           AND r.deleted_flg = 0
           AND l.target_uid = ?
           AND l.relation_type = 'reviews'
           AND l.deleted_flg = 0
         ORDER BY r.updated_at DESC
         LIMIT 1`,
        [projectUid],
      );
      const reviewId = existingRows[0]?.id ?? generateId();
      const reviewUid = `review:${reviewId}`;

      db.transaction(() => {
        if (existingRows.length > 0) {
          db.run(
            `UPDATE reviews
             SET title = ?, period_start = ?, period_end = ?, body = ?, status = 'published', updated_at = ?
             WHERE id = ?`,
            [title, input.date, input.date, input.body, now, reviewId],
          );
          db.run(
            `UPDATE object_index
             SET title = ?, summary = ?, status = 'published', version_token = ?, updated_at = ?
             WHERE object_id = ? AND object_type = ?`,
            [title, input.body, `review-${reviewId}-${now}`, now, reviewId, 'review'],
          );
        } else {
          db.run(
            `INSERT INTO reviews (id, title, review_type, period_start, period_end, body, status, created_at, updated_at, deleted_flg)
             VALUES (?, ?, 'project', ?, ?, ?, 'published', ?, ?, 0)`,
            [reviewId, title, input.date, input.date, input.body, now, now],
          );
          db.run(
            `INSERT INTO object_index (object_uid, object_type, object_id, canonical_table, layer, title, summary, status, origin, visibility, version_token, created_at, updated_at, deleted_flg)
             VALUES (?, 'review', ?, 'reviews', 'journal', ?, ?, 'published', 'human', 'private', ?, ?, ?, 0)`,
            [reviewUid, reviewId, title, input.body, `review-${reviewId}-${now}`, now, now],
          );
          db.run(
            `INSERT OR IGNORE INTO links (link_id, source_uid, target_uid, relation_type, origin, status, created_at, updated_at, deleted_flg)
             VALUES (?, ?, ?, 'reviews', 'human', 'active', ?, ?, 0)`,
            [`link-review-project-${reviewId}`, reviewUid, projectUid, now, now],
          );
        }

        upsertSearchIndex(db, reviewUid, title, input.body, `review project ${input.projectTitle}`);
      });

      if (repos) {
        await repos.events.append({
          streamUid: reviewUid,
          eventType: 'review.saved',
          actorType: 'user',
          payloadJson: JSON.stringify({
            reviewType: 'project',
            projectId: input.projectId,
            periodStart: input.date,
          }),
        });
      }

      invalidate();
      return reviewId;
    },
    [db, repos, invalidate, ready],
  );

  return {
    createTask,
    updateTaskStatus,
    updateTask,
    deleteTask,
    createProject,
    updateProject,
    deleteProject,
    saveDailyReview,
    saveProjectReview,
  };
}
