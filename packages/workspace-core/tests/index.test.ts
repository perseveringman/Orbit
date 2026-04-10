import { describe, expect, it } from 'vitest';

import {
  // directory-layout
  SOURCES_DIRS,
  WIKI_DIRS,
  ORBIT_SYSTEM_DIRS,
  ALL_REQUIRED_DIRS,
  resolveObjectPath,
  resolveBundlePath,
  // workspace-init
  buildWorkspaceHandle,
  validateWorkspace,
  initWorkspace,
  requiredAbsolutePaths,
  // frontmatter
  parseFrontmatter,
  serializeFrontmatter,
  updateFrontmatter,
  // file-scanner
  computeContentHash,
  // compile-pipeline
  CompilePipelineStage,
  COMPILE_STAGE_ORDER,
  // write-boundary
  checkWritePermission,
  inferWriteTarget,
  AI_WRITE_RULES,
} from '../src/index.js';

// =========================================================================
// Directory layout
// =========================================================================

describe('directory-layout', () => {
  it('SOURCES_DIRS contains all required source directories', () => {
    expect(SOURCES_DIRS.root).toBe('sources');
    expect(SOURCES_DIRS.notes).toBe('sources/notes');
    expect(SOURCES_DIRS.documents).toBe('sources/documents');
    expect(SOURCES_DIRS.journal).toBe('sources/journal');
    expect(SOURCES_DIRS.library).toBe('sources/library');
    expect(SOURCES_DIRS.libraryArticles).toBe('sources/library/articles');
    expect(SOURCES_DIRS.libraryBooks).toBe('sources/library/books');
    expect(SOURCES_DIRS.libraryWebClips).toBe('sources/library/web-clips');
    expect(SOURCES_DIRS.assets).toBe('sources/assets');
    expect(SOURCES_DIRS.exports).toBe('sources/exports');
  });

  it('WIKI_DIRS contains all required wiki directories', () => {
    expect(WIKI_DIRS.root).toBe('wiki');
    expect(WIKI_DIRS.entities).toBe('wiki/entities');
    expect(WIKI_DIRS.concepts).toBe('wiki/concepts');
    expect(WIKI_DIRS.dossiers).toBe('wiki/dossiers');
    expect(WIKI_DIRS.syntheses).toBe('wiki/syntheses');
    expect(WIKI_DIRS.comparisons).toBe('wiki/comparisons');
    expect(WIKI_DIRS.briefs).toBe('wiki/briefs');
    expect(WIKI_DIRS.reports).toBe('wiki/reports');
  });

  it('ORBIT_SYSTEM_DIRS contains all required system directories', () => {
    expect(ORBIT_SYSTEM_DIRS.root).toBe('.orbit');
    expect(ORBIT_SYSTEM_DIRS.db).toBe('.orbit/db');
    expect(ORBIT_SYSTEM_DIRS.indexesVector).toBe('.orbit/indexes/vector');
    expect(ORBIT_SYSTEM_DIRS.indexesChunks).toBe('.orbit/indexes/chunks');
    expect(ORBIT_SYSTEM_DIRS.cacheExtraction).toBe('.orbit/cache/extraction');
    expect(ORBIT_SYSTEM_DIRS.cacheThumbnails).toBe('.orbit/cache/thumbnails');
    expect(ORBIT_SYSTEM_DIRS.cacheRenders).toBe('.orbit/cache/renders');
    expect(ORBIT_SYSTEM_DIRS.sync).toBe('.orbit/sync');
    expect(ORBIT_SYSTEM_DIRS.syncPending).toBe('.orbit/sync/pending');
    expect(ORBIT_SYSTEM_DIRS.crypto).toBe('.orbit/crypto');
    expect(ORBIT_SYSTEM_DIRS.cryptoEnvelopes).toBe('.orbit/crypto/envelopes');
    expect(ORBIT_SYSTEM_DIRS.schema).toBe('.orbit/schema');
    expect(ORBIT_SYSTEM_DIRS.state).toBe('.orbit/state');
    expect(ORBIT_SYSTEM_DIRS.stateCompileJobs).toBe('.orbit/state/compile-jobs');
  });

  it('ALL_REQUIRED_DIRS is the union of all three layers', () => {
    const sourceCount = Object.keys(SOURCES_DIRS).length;
    const wikiCount = Object.keys(WIKI_DIRS).length;
    const systemCount = Object.keys(ORBIT_SYSTEM_DIRS).length;
    expect(ALL_REQUIRED_DIRS.length).toBe(sourceCount + wikiCount + systemCount);
    expect(ALL_REQUIRED_DIRS).toContain('sources/notes');
    expect(ALL_REQUIRED_DIRS).toContain('wiki/entities');
    expect(ALL_REQUIRED_DIRS).toContain('.orbit/db');
  });
});

// =========================================================================
// Object path resolution
// =========================================================================

describe('resolveObjectPath', () => {
  it('resolves single-file source objects (note)', () => {
    expect(resolveObjectPath('source', 'note', 'note_01JZ')).toBe(
      'sources/notes/note_01JZ.md',
    );
  });

  it('resolves single-file source objects (document)', () => {
    expect(resolveObjectPath('source', 'document', 'doc_01JZ')).toBe(
      'sources/documents/doc_01JZ.md',
    );
  });

  it('resolves bundle-type source objects (article)', () => {
    expect(resolveObjectPath('source', 'article', 'art_01JZ')).toBe(
      'sources/library/articles/art_01JZ/content.md',
    );
  });

  it('resolves bundle-type source objects (book)', () => {
    expect(resolveObjectPath('source', 'book', 'bk_01JZ')).toBe(
      'sources/library/books/bk_01JZ/content.md',
    );
  });

  it('resolves date-subdir objects (journal with date)', () => {
    expect(resolveObjectPath('source', 'journal', 'j_01JZ', '2026/04')).toBe(
      'sources/journal/2026/04/j_01JZ.md',
    );
  });

  it('resolves date-subdir objects (journal without date)', () => {
    expect(resolveObjectPath('source', 'journal', 'j_01JZ')).toBe(
      'sources/journal/undated/j_01JZ.md',
    );
  });

  it('resolves wiki objects (entity)', () => {
    expect(resolveObjectPath('wiki', 'entity', 'ent_01JZ')).toBe(
      'wiki/entities/ent_01JZ.md',
    );
  });

  it('resolves wiki objects (brief with date)', () => {
    expect(resolveObjectPath('wiki', 'brief', 'br_01JZ', '2026')).toBe(
      'wiki/briefs/2026/br_01JZ.md',
    );
  });

  it('throws for system layer', () => {
    expect(() => resolveObjectPath('system', 'note', 'id')).toThrow();
  });

  it('throws for unknown type', () => {
    expect(() => resolveObjectPath('source', 'unknown_type', 'id')).toThrow();
  });
});

describe('resolveBundlePath', () => {
  it('returns bundle dir for bundle types', () => {
    expect(resolveBundlePath('source', 'article', 'art_01JZ')).toBe(
      'sources/library/articles/art_01JZ',
    );
    expect(resolveBundlePath('source', 'asset', 'ast_01JZ')).toBe(
      'sources/assets/ast_01JZ',
    );
  });

  it('returns null for non-bundle types', () => {
    expect(resolveBundlePath('source', 'note', 'note_01JZ')).toBeNull();
    expect(resolveBundlePath('wiki', 'entity', 'ent_01JZ')).toBeNull();
  });
});

// =========================================================================
// Workspace init / validation
// =========================================================================

describe('workspace-init', () => {
  it('buildWorkspaceHandle derives paths from root', () => {
    const h = buildWorkspaceHandle('/home/user/orbit');
    expect(h.rootPath).toBe('/home/user/orbit');
    expect(h.sourcesPath).toBe('/home/user/orbit/sources');
    expect(h.wikiPath).toBe('/home/user/orbit/wiki');
    expect(h.systemPath).toBe('/home/user/orbit/.orbit');
    expect(h.dbPath).toBe('/home/user/orbit/.orbit/db');
  });

  it('requiredAbsolutePaths returns absolute paths', () => {
    const paths = requiredAbsolutePaths('/root');
    expect(paths.every((p) => p.startsWith('/root/'))).toBe(true);
    expect(paths.length).toBe(ALL_REQUIRED_DIRS.length);
  });

  it('validateWorkspace reports missing dirs', async () => {
    const existing = new Set(['/root/sources', '/root/wiki']);
    const result = await validateWorkspace('/root', async (p) => existing.has(p));
    expect(result.valid).toBe(false);
    expect(result.missingDirs.length).toBeGreaterThan(0);
    expect(result.missingDirs).not.toContain('sources');
    expect(result.missingDirs).not.toContain('wiki');
  });

  it('validateWorkspace returns valid when all dirs exist', async () => {
    const allAbs = requiredAbsolutePaths('/root');
    const existing = new Set(allAbs);
    const result = await validateWorkspace('/root', async (p) => existing.has(p));
    expect(result.valid).toBe(true);
    expect(result.missingDirs).toHaveLength(0);
  });

  it('initWorkspace calls mkdirFn for all required dirs', async () => {
    const created: string[] = [];
    const handle = await initWorkspace('/ws', async (p) => { created.push(p); });
    expect(created.length).toBe(ALL_REQUIRED_DIRS.length);
    expect(created.every((p) => p.startsWith('/ws/'))).toBe(true);
    expect(handle.rootPath).toBe('/ws');
  });
});

// =========================================================================
// Frontmatter
// =========================================================================

describe('frontmatter', () => {
  const sampleContent = `---
orbit_id: note_01JZ123
orbit_type: note
title: My Note
tags: [tag1, tag2]
created_at: 2026-04-10T12:00:00Z
updated_at: 2026-04-10T12:00:00Z
---
Hello, world!`;

  it('parseFrontmatter extracts fields and body', () => {
    const result = parseFrontmatter(sampleContent);
    expect(result.frontmatter).not.toBeNull();
    expect(result.frontmatter!.orbit_id).toBe('note_01JZ123');
    expect(result.frontmatter!.orbit_type).toBe('note');
    expect(result.frontmatter!.title).toBe('My Note');
    expect(result.frontmatter!.tags).toEqual(['tag1', 'tag2']);
    expect(result.body).toBe('Hello, world!');
  });

  it('parseFrontmatter returns null for content without frontmatter', () => {
    const result = parseFrontmatter('Just some text');
    expect(result.frontmatter).toBeNull();
    expect(result.body).toBe('Just some text');
  });

  it('serializeFrontmatter produces valid YAML block', () => {
    const fm = {
      orbit_id: 'note_01JZ',
      orbit_type: 'note',
      title: 'Test',
      tags: ['a', 'b'],
    };
    const yaml = serializeFrontmatter(fm);
    expect(yaml).toContain('---');
    expect(yaml).toContain('orbit_id: note_01JZ');
    expect(yaml).toContain('orbit_type: note');
    expect(yaml).toContain('title: Test');
    expect(yaml).toContain('tags: ["a", "b"]');
  });

  it('round-trip: parse → serialize → parse preserves data', () => {
    const fm = {
      orbit_id: 'note_01JZ',
      orbit_type: 'note',
      title: 'Round Trip',
      tags: ['x'],
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };
    const serialized = serializeFrontmatter(fm);
    const parsed = parseFrontmatter(serialized + '\nBody text');
    expect(parsed.frontmatter!.orbit_id).toBe('note_01JZ');
    expect(parsed.frontmatter!.orbit_type).toBe('note');
    expect(parsed.frontmatter!.title).toBe('Round Trip');
    expect(parsed.frontmatter!.tags).toEqual(['x']);
    expect(parsed.body).toBe('Body text');
  });

  it('updateFrontmatter merges without losing existing fields', () => {
    const updated = updateFrontmatter(sampleContent, {
      title: 'Updated Note',
      updated_at: '2026-05-01T00:00:00Z',
    });
    const parsed = parseFrontmatter(updated);
    expect(parsed.frontmatter!.title).toBe('Updated Note');
    expect(parsed.frontmatter!.orbit_id).toBe('note_01JZ123');
    expect(parsed.frontmatter!.tags).toEqual(['tag1', 'tag2']);
    expect(parsed.body).toBe('Hello, world!');
  });
});

// =========================================================================
// File scanner
// =========================================================================

describe('computeContentHash', () => {
  it('delegates to the provided sha256 function', async () => {
    const hash = await computeContentHash('hello', async (d) => `sha256:${d}`);
    expect(hash).toBe('sha256:hello');
  });
});

// =========================================================================
// Compile pipeline
// =========================================================================

describe('compile-pipeline', () => {
  it('has exactly 7 stages in correct order', () => {
    expect(COMPILE_STAGE_ORDER).toHaveLength(7);
    expect(COMPILE_STAGE_ORDER[0]).toBe(CompilePipelineStage.Scan);
    expect(COMPILE_STAGE_ORDER[1]).toBe(CompilePipelineStage.Parse);
    expect(COMPILE_STAGE_ORDER[2]).toBe(CompilePipelineStage.Project);
    expect(COMPILE_STAGE_ORDER[3]).toBe(CompilePipelineStage.Index);
    expect(COMPILE_STAGE_ORDER[4]).toBe(CompilePipelineStage.Link);
    expect(COMPILE_STAGE_ORDER[5]).toBe(CompilePipelineStage.Compile);
    expect(COMPILE_STAGE_ORDER[6]).toBe(CompilePipelineStage.Audit);
  });

  it('stage enum values are lowercase strings', () => {
    expect(CompilePipelineStage.Scan).toBe('scan');
    expect(CompilePipelineStage.Compile).toBe('compile');
  });
});

// =========================================================================
// Write boundary
// =========================================================================

describe('write-boundary', () => {
  it('AI cannot write to sources/', () => {
    const result = checkWritePermission('sources', 'ai');
    expect(result.allowed).toBe(false);
    expect(result.permission).toBe('read_only');
  });

  it('AI can write to wiki/', () => {
    const result = checkWritePermission('wiki', 'ai');
    expect(result.allowed).toBe(true);
    expect(result.permission).toBe('ai_writable');
  });

  it('AI cannot write to .orbit/ system layer', () => {
    const result = checkWritePermission('orbit_system', 'ai');
    expect(result.allowed).toBe(false);
    expect(result.permission).toBe('system_only');
  });

  it('human can write to sources/', () => {
    const result = checkWritePermission('sources', 'human');
    expect(result.allowed).toBe(true);
  });

  it('system can write to .orbit/', () => {
    const result = checkWritePermission('orbit_system', 'system');
    expect(result.allowed).toBe(true);
  });

  it('system cannot write to sources/', () => {
    const result = checkWritePermission('sources', 'system');
    expect(result.allowed).toBe(false);
  });

  it('inferWriteTarget maps paths correctly', () => {
    expect(inferWriteTarget('sources/notes/foo.md')).toBe('sources');
    expect(inferWriteTarget('wiki/entities/bar.md')).toBe('wiki');
    expect(inferWriteTarget('.orbit/db/orbit.sqlite')).toBe('orbit_system');
  });

  it('AI_WRITE_RULES has entries for all three targets', () => {
    expect(AI_WRITE_RULES.sources.permission).toBe('read_only');
    expect(AI_WRITE_RULES.wiki.permission).toBe('ai_writable');
    expect(AI_WRITE_RULES.orbit_system.permission).toBe('system_only');
  });
});
