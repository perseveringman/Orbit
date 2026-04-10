import { describe, expect, it } from 'vitest';

import {
  DOMAIN_RELATION_NAMES,
  ORBIT_OBJECT_KINDS,
  buildDomainObjectKey,
  getDomainObjectLabel,
  isDomainObjectKind,
} from '../src/index';

describe('domain', () => {
  it('暴露 P0 项目与任务对象种类和标签', () => {
    expect(ORBIT_OBJECT_KINDS).toEqual(expect.arrayContaining(['article', 'project', 'task']));
    expect(isDomainObjectKind('feed')).toBe(true);
    expect(isDomainObjectKind('project')).toBe(true);
    expect(isDomainObjectKind('task')).toBe(true);
    expect(getDomainObjectLabel('highlight')).toBe('高亮');
    expect(getDomainObjectLabel('project')).toBe('项目');
    expect(getDomainObjectLabel('task')).toBe('任务');
  });

  it('为 P0 循环提供稳定键和显式关系名', () => {
    expect(buildDomainObjectKey('article', 'art_1')).toBe('article:art_1');
    expect(buildDomainObjectKey('project', 'proj_1')).toBe('project:proj_1');
    expect(buildDomainObjectKey('task', 'task_1')).toBe('task:task_1');
    expect(DOMAIN_RELATION_NAMES.articleToHighlight).toBe('article/highlight');
    expect(DOMAIN_RELATION_NAMES.workspaceToProject).toBe('workspace/project');
    expect(DOMAIN_RELATION_NAMES.workspaceToTask).toBe('workspace/task');
    expect(DOMAIN_RELATION_NAMES.projectToTask).toBe('project/task');
    expect(DOMAIN_RELATION_NAMES.taskToToday).toBe('task/today');
    expect(DOMAIN_RELATION_NAMES.taskToFocus).toBe('task/focus');
    expect(DOMAIN_RELATION_NAMES.taskToReview).toBe('task/review');
  });
});
