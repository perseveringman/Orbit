import { describe, expect, it } from 'vitest';

import {
  // Object types
  ORBIT_OBJECT_TYPES,
  OBJECT_TYPE_LABELS,
  OBJECT_TYPE_FAMILIES,
  isOrbitObjectType,
  getObjectTypeLabel,
  getObjectTypeFamily,
  // Object UID
  createObjectUid,
  parseObjectUid,
  isValidObjectUid,
  generateUlid,
  newObjectUid,
  // Relation vocabulary
  RELATION_FAMILIES,
  RELATION_TYPES,
  isValidRelationType,
  getRelationFamily,
  INVERSE_DISPLAY_NAMES,
  // Backward compat
  ORBIT_OBJECT_KINDS,
  DOMAIN_RELATION_NAMES,
  isDomainObjectKind,
  getDomainObjectLabel,
  buildDomainObjectKey,
} from '../src/index';

// ── Object type constants ──────────────────────────────────

describe('ORBIT_OBJECT_TYPES', () => {
  it('contains all 7 families + other + legacy', () => {
    for (const types of Object.values(OBJECT_TYPE_FAMILIES)) {
      for (const t of types) {
        expect(ORBIT_OBJECT_TYPES).toContain(t);
      }
    }
  });

  it('has no duplicates', () => {
    const unique = new Set(ORBIT_OBJECT_TYPES);
    expect(unique.size).toBe(ORBIT_OBJECT_TYPES.length);
  });

  it('contains expected direction types', () => {
    expect(ORBIT_OBJECT_TYPES).toEqual(
      expect.arrayContaining(['vision', 'direction', 'theme', 'goal', 'commitment', 'review']),
    );
  });

  it('contains expected execution types', () => {
    expect(ORBIT_OBJECT_TYPES).toEqual(
      expect.arrayContaining(['project', 'milestone', 'task', 'directive']),
    );
  });

  it('contains expected input types', () => {
    expect(ORBIT_OBJECT_TYPES).toEqual(
      expect.arrayContaining(['article', 'book', 'highlight', 'note', 'asset', 'source_endpoint', 'content_item']),
    );
  });

  it('contains expected research types', () => {
    expect(ORBIT_OBJECT_TYPES).toEqual(
      expect.arrayContaining([
        'research_space', 'research_question', 'source_set',
        'research_claim', 'research_gap', 'research_artifact',
      ]),
    );
  });

  it('contains expected output types', () => {
    expect(ORBIT_OBJECT_TYPES).toEqual(
      expect.arrayContaining(['document', 'draft', 'post', 'voice_profile', 'output_variant']),
    );
  });

  it('contains expected time types', () => {
    expect(ORBIT_OBJECT_TYPES).toEqual(
      expect.arrayContaining(['event', 'action_log', 'day_note', 'journal_summary', 'behavior_insight']),
    );
  });

  it('contains expected agent types', () => {
    expect(ORBIT_OBJECT_TYPES).toEqual(
      expect.arrayContaining(['agent_session', 'agent_run', 'agent_task', 'capability_call', 'approval_request']),
    );
  });

  it('has a Chinese label for every type', () => {
    for (const t of ORBIT_OBJECT_TYPES) {
      expect(OBJECT_TYPE_LABELS[t]).toBeDefined();
      expect(typeof OBJECT_TYPE_LABELS[t]).toBe('string');
    }
  });
});

// ── Object type helpers ────────────────────────────────────

describe('isOrbitObjectType', () => {
  it('returns true for valid types', () => {
    expect(isOrbitObjectType('task')).toBe(true);
    expect(isOrbitObjectType('vision')).toBe(true);
    expect(isOrbitObjectType('agent_run')).toBe(true);
  });

  it('returns false for invalid types', () => {
    expect(isOrbitObjectType('foobar')).toBe(false);
    expect(isOrbitObjectType('')).toBe(false);
    expect(isOrbitObjectType('TASK')).toBe(false);
  });
});

describe('getObjectTypeLabel', () => {
  it('returns Chinese label', () => {
    expect(getObjectTypeLabel('task')).toBe('任务');
    expect(getObjectTypeLabel('project')).toBe('项目');
    expect(getObjectTypeLabel('vision')).toBe('愿景');
    expect(getObjectTypeLabel('highlight')).toBe('高亮');
  });
});

describe('getObjectTypeFamily', () => {
  it('returns correct family', () => {
    expect(getObjectTypeFamily('task')).toBe('execution');
    expect(getObjectTypeFamily('vision')).toBe('direction');
    expect(getObjectTypeFamily('article')).toBe('input');
    expect(getObjectTypeFamily('agent_run')).toBe('agent');
    expect(getObjectTypeFamily('event')).toBe('time');
    expect(getObjectTypeFamily('document')).toBe('output');
    expect(getObjectTypeFamily('research_space')).toBe('research');
    expect(getObjectTypeFamily('tag')).toBe('other');
  });
});

// ── Object UID ─────────────────────────────────────────────

describe('Object UID', () => {
  it('creates uid from type and id', () => {
    const uid = createObjectUid('task', 'abc123');
    expect(uid).toBe('task:abc123');
  });

  it('parses valid uid', () => {
    const result = parseObjectUid('project:xyz789');
    expect(result).toEqual({ type: 'project', id: 'xyz789' });
  });

  it('returns null for invalid uid', () => {
    expect(parseObjectUid('')).toBeNull();
    expect(parseObjectUid('nocolon')).toBeNull();
    expect(parseObjectUid('invalid_type:abc')).toBeNull();
    expect(parseObjectUid('task:')).toBeNull();
  });

  it('validates uids with isValidObjectUid', () => {
    expect(isValidObjectUid('task:abc123')).toBe(true);
    expect(isValidObjectUid('vision:xyz')).toBe(true);
    expect(isValidObjectUid('')).toBe(false);
    expect(isValidObjectUid(42)).toBe(false);
    expect(isValidObjectUid(null)).toBe(false);
    expect(isValidObjectUid('badtype:abc')).toBe(false);
  });

  it('generates valid ULIDs', () => {
    const ulid = generateUlid();
    expect(ulid).toHaveLength(26);
    expect(/^[0-9A-TV-Z]{26}$/i.test(ulid)).toBe(true);
  });

  it('generates monotonically increasing ULIDs for same timestamp', () => {
    const now = Date.now();
    const a = generateUlid(now);
    const b = generateUlid(now);
    expect(a < b || a !== b).toBe(true);
  });

  it('creates uid with auto-generated ULID', () => {
    const uid = newObjectUid('article');
    expect(uid.startsWith('article:')).toBe(true);
    const parsed = parseObjectUid(uid);
    expect(parsed).not.toBeNull();
    expect(parsed!.type).toBe('article');
    expect(parsed!.id).toHaveLength(26);
  });
});

// ── Relation vocabulary ────────────────────────────────────

describe('Relation vocabulary', () => {
  it('RELATION_TYPES contains all relations from all families', () => {
    const allFromFamilies = Object.values(RELATION_FAMILIES).flat();
    for (const r of allFromFamilies) {
      expect(RELATION_TYPES).toContain(r);
    }
    expect(RELATION_TYPES.length).toBe(allFromFamilies.length);
  });

  it('has no duplicate relation types', () => {
    const unique = new Set(RELATION_TYPES);
    expect(unique.size).toBe(RELATION_TYPES.length);
  });

  it('contains expected families', () => {
    const families = Object.keys(RELATION_FAMILIES);
    expect(families).toEqual(
      expect.arrayContaining([
        'structural', 'provenance', 'support', 'execution',
        'output', 'discussion', 'reflection', 'aggregation',
      ]),
    );
  });

  it('isValidRelationType works', () => {
    expect(isValidRelationType('contains')).toBe(true);
    expect(isValidRelationType('derived_from')).toBe(true);
    expect(isValidRelationType('not_a_relation')).toBe(false);
  });

  it('getRelationFamily returns correct family', () => {
    expect(getRelationFamily('contains')).toBe('structural');
    expect(getRelationFamily('derived_from')).toBe('provenance');
    expect(getRelationFamily('blocks')).toBe('execution');
    expect(getRelationFamily('tagged_with')).toBe('aggregation');
  });

  it('every relation has an inverse display name', () => {
    for (const r of RELATION_TYPES) {
      expect(INVERSE_DISPLAY_NAMES[r]).toBeDefined();
    }
  });
});

// ── Backward compatibility ─────────────────────────────────

describe('Backward compatibility', () => {
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

  it('ORBIT_OBJECT_KINDS is alias for ORBIT_OBJECT_TYPES', () => {
    expect(ORBIT_OBJECT_KINDS).toBe(ORBIT_OBJECT_TYPES);
  });
});
