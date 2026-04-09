import { describe, expect, it } from 'vitest';

import {
  DOMAIN_RELATION_NAMES,
  ORBIT_OBJECT_KINDS,
  buildDomainObjectKey,
  getDomainObjectLabel,
  isDomainObjectKind,
} from '../src/index';

describe('domain', () => {
  it('暴露 Orbit 领域对象种类与标签', () => {
    expect(ORBIT_OBJECT_KINDS).toContain('article');
    expect(isDomainObjectKind('feed')).toBe(true);
    expect(getDomainObjectLabel('highlight')).toBe('高亮');
  });

  it('生成稳定的领域对象键', () => {
    expect(buildDomainObjectKey('article', 'art_1')).toBe('article:art_1');
    expect(DOMAIN_RELATION_NAMES.articleToHighlight).toBe('article/highlight');
  });
});
