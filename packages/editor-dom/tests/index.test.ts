import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createEditorDocumentState,
  createEditorDomModule,
  parseMarkdown,
  serializeBlocks,
  parseFrontmatter,
  serializeFrontmatter,
  generateBlockId,
  ensureBlockId,
  stripBlockIds,
  createBlock,
  createProvenance,
  updateProvenance,
  getEditorModeConfig,
  getSlashMenuItems,
  injectBlockComments,
  extractBlockComments,
  reconcileAfterExternalEdit,
  createAssemblyBlock,
  reconcileExternalEdit,
} from '../src/index.ts';

// ── Block Schema ──

test('createBlock builds a block with defaults', () => {
  const b = createBlock('paragraph', 'hello');
  assert.equal(b.kind, 'paragraph');
  assert.equal(b.text, 'hello');
  assert.deepEqual(b.attrs, {});
  assert.equal(b.children, undefined);
});

test('createBlock with children', () => {
  const child = createBlock('list-item', 'item');
  const list = createBlock('list', '', { ordered: false }, [child]);
  assert.equal(list.children?.length, 1);
  assert.equal(list.children?.[0].text, 'item');
});

// ── Block IDs ──

test('generateBlockId returns unique IDs', () => {
  const a = generateBlockId();
  const b = generateBlockId();
  assert.notEqual(a, b);
  assert.ok(a.startsWith('blk-'));
});

test('ensureBlockId assigns ID to block without one', () => {
  const block = createBlock('paragraph', 'test');
  assert.equal(block.id, '');
  const assigned = ensureBlockId(block);
  assert.ok(assigned.id.startsWith('blk-'));
  assert.equal(assigned.text, 'test');
});

test('ensureBlockId preserves existing ID', () => {
  const block = { ...createBlock('paragraph', 'test'), id: 'existing-id' };
  const result = ensureBlockId(block);
  assert.equal(result.id, 'existing-id');
});

test('stripBlockIds removes all IDs', () => {
  const blocks = [
    { ...createBlock('heading', 'Title', { level: 1 }), id: 'h1' },
    { ...createBlock('paragraph', 'Body'), id: 'p1' },
  ];
  const stripped = stripBlockIds(blocks);
  assert.equal(stripped[0].id, '');
  assert.equal(stripped[1].id, '');
  assert.equal(stripped[0].text, 'Title');
});

// ── Frontmatter ──

test('parseFrontmatter extracts YAML frontmatter', () => {
  const input = '---\norbit_id: abc\norbit_type: note\n---\n# Hello';
  const { frontmatter, body } = parseFrontmatter(input);
  assert.equal(frontmatter.orbit_id, 'abc');
  assert.equal(frontmatter.orbit_type, 'note');
  assert.equal(body, '# Hello');
});

test('parseFrontmatter handles no frontmatter', () => {
  const input = '# Just a heading';
  const { frontmatter, body } = parseFrontmatter(input);
  assert.deepEqual(frontmatter, {});
  assert.equal(body, '# Just a heading');
});

test('serializeFrontmatter produces valid output', () => {
  const fm = { orbit_id: 'abc', orbit_type: 'note' };
  const result = serializeFrontmatter(fm, '# Hello');
  assert.ok(result.startsWith('---\n'));
  assert.ok(result.includes('orbit_id: abc'));
  assert.ok(result.endsWith('# Hello'));
});

test('frontmatter round-trip', () => {
  const fm = { orbit_id: 'x', orbit_type: 'research' };
  const body = '# Test\n\nParagraph';
  const serialized = serializeFrontmatter(fm, body);
  const { frontmatter, body: parsedBody } = parseFrontmatter(serialized);
  assert.equal(frontmatter.orbit_id, 'x');
  assert.equal(frontmatter.orbit_type, 'research');
  assert.equal(parsedBody, body);
});

// ── Markdown Parser ──

test('parseMarkdown: headings', () => {
  const blocks = parseMarkdown('# H1\n\n## H2\n\n### H3');
  assert.equal(blocks.length, 3);
  assert.equal(blocks[0].kind, 'heading');
  assert.equal(blocks[0].text, 'H1');
  assert.equal(blocks[0].attrs.level, 1);
  assert.equal(blocks[1].attrs.level, 2);
  assert.equal(blocks[2].attrs.level, 3);
});

test('parseMarkdown: paragraphs', () => {
  const blocks = parseMarkdown('Hello world\n\nSecond paragraph');
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0].kind, 'paragraph');
  assert.equal(blocks[0].text, 'Hello world');
  assert.equal(blocks[1].text, 'Second paragraph');
});

test('parseMarkdown: unordered list', () => {
  const blocks = parseMarkdown('- item 1\n- item 2\n- item 3');
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].kind, 'list');
  assert.equal(blocks[0].attrs.ordered, false);
  assert.equal(blocks[0].children?.length, 3);
  assert.equal(blocks[0].children?.[0].text, 'item 1');
});

test('parseMarkdown: ordered list', () => {
  const blocks = parseMarkdown('1. first\n2. second');
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].kind, 'list');
  assert.equal(blocks[0].attrs.ordered, true);
  assert.equal(blocks[0].children?.length, 2);
});

test('parseMarkdown: code block', () => {
  const blocks = parseMarkdown('```typescript\nconst x = 1;\n```');
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].kind, 'code');
  assert.equal(blocks[0].text, 'const x = 1;');
  assert.equal(blocks[0].attrs.language, 'typescript');
});

test('parseMarkdown: blockquote', () => {
  const blocks = parseMarkdown('> This is a quote\n> with two lines');
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].kind, 'quote');
  assert.equal(blocks[0].text, 'This is a quote\nwith two lines');
});

test('parseMarkdown: callout', () => {
  const blocks = parseMarkdown('> [!warning]\n> Be careful here');
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].kind, 'callout');
  assert.equal(blocks[0].attrs.type, 'warning');
  assert.equal(blocks[0].text, 'Be careful here');
});

test('parseMarkdown: image', () => {
  const blocks = parseMarkdown('![alt text](https://example.com/img.png)');
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].kind, 'image');
  assert.equal(blocks[0].attrs.alt, 'alt text');
  assert.equal(blocks[0].attrs.src, 'https://example.com/img.png');
});

test('parseMarkdown: divider', () => {
  const blocks = parseMarkdown('Text above\n\n---\n\nText below');
  assert.equal(blocks.length, 3);
  assert.equal(blocks[1].kind, 'divider');
});

test('parseMarkdown: table', () => {
  const md = '| Name | Age |\n| --- | --- |\n| Alice | 30 |\n| Bob | 25 |';
  const blocks = parseMarkdown(md);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].kind, 'table');
  assert.equal(blocks[0].children?.length, 3);
  assert.equal(blocks[0].children?.[0].attrs.header, true);
  assert.equal(blocks[0].children?.[0].children?.[0].text, 'Name');
  assert.equal(blocks[0].children?.[1].children?.[0].text, 'Alice');
});

test('parseMarkdown: mixed content', () => {
  const md = `# Title

Intro paragraph

- item a
- item b

> A quote

---

\`\`\`js
console.log('hi');
\`\`\``;
  const blocks = parseMarkdown(md);
  assert.equal(blocks[0].kind, 'heading');
  assert.equal(blocks[1].kind, 'paragraph');
  assert.equal(blocks[2].kind, 'list');
  assert.equal(blocks[3].kind, 'quote');
  assert.equal(blocks[4].kind, 'divider');
  assert.equal(blocks[5].kind, 'code');
});

// ── Markdown Serializer ──

test('serializeBlocks round-trip for basic content', () => {
  const md = '# Title\n\nA paragraph\n\n- one\n- two\n\n> quote\n\n---\n\n```js\ncode\n```';
  const blocks = parseMarkdown(md);
  const serialized = serializeBlocks(blocks);
  const reparsed = parseMarkdown(serialized);
  assert.equal(reparsed.length, blocks.length);
  for (let i = 0; i < blocks.length; i++) {
    assert.equal(reparsed[i].kind, blocks[i].kind);
    assert.equal(reparsed[i].text, blocks[i].text);
  }
});

test('serializeBlocks: heading with level', () => {
  const blocks = [createBlock('heading', 'Title', { level: 2 })];
  assert.equal(serializeBlocks(blocks), '## Title');
});

test('serializeBlocks: callout', () => {
  const blocks = [createBlock('callout', 'Watch out', { type: 'warning' })];
  const result = serializeBlocks(blocks);
  assert.ok(result.includes('[!warning]'));
  assert.ok(result.includes('Watch out'));
});

test('serializeBlocks: image', () => {
  const blocks = [createBlock('image', '', { alt: 'photo', src: 'a.png' })];
  assert.equal(serializeBlocks(blocks), '![photo](a.png)');
});

test('serializeBlocks: table', () => {
  const table = createBlock('table', '', {}, [
    createBlock('table-row', '', { header: true }, [
      createBlock('table-cell', 'A', {}),
      createBlock('table-cell', 'B', {}),
    ]),
    createBlock('table-row', '', {}, [
      createBlock('table-cell', '1', {}),
      createBlock('table-cell', '2', {}),
    ]),
  ]);
  const result = serializeBlocks([table]);
  assert.ok(result.includes('| A | B |'));
  assert.ok(result.includes('| 1 | 2 |'));
  assert.ok(result.includes('---'));
});

// ── Block Provenance ──

test('createProvenance creates with timestamp', () => {
  const prov = createProvenance('blk-1', 'verbatim', ['src-1']);
  assert.equal(prov.blockId, 'blk-1');
  assert.equal(prov.kind, 'verbatim');
  assert.deepEqual(prov.sourceIds, ['src-1']);
  assert.ok(prov.createdAt);
});

test('updateProvenance updates kind and editedAt', () => {
  const prov = createProvenance('blk-1', 'verbatim');
  const updated = updateProvenance(prov, 'edited');
  assert.equal(updated.kind, 'edited');
  assert.ok(updated.editedAt);
  assert.equal(updated.createdAt, prov.createdAt);
});

// ── Editor Modes ──

test('getEditorModeConfig returns correct configs', () => {
  const note = getEditorModeConfig('note');
  assert.equal(note.blockIdPolicy, 'lazy');
  assert.equal(note.provenanceRequired, false);
  assert.ok(note.allowedBlockKinds.includes('paragraph'));

  const research = getEditorModeConfig('research');
  assert.equal(research.blockIdPolicy, 'required');
  assert.ok(research.allowedBlockKinds.includes('reference'));

  const writing = getEditorModeConfig('writing');
  assert.equal(writing.blockIdPolicy, 'required-with-provenance');
  assert.equal(writing.provenanceRequired, true);
  assert.ok(writing.allowedBlockKinds.includes('embed'));
});

// ── Slash Menu ──

test('getSlashMenuItems returns items for each mode', () => {
  const noteItems = getSlashMenuItems('note');
  assert.ok(noteItems.length > 0);
  assert.ok(noteItems.every((i) => i.group === 'basic'));

  const researchItems = getSlashMenuItems('research');
  assert.ok(researchItems.length > noteItems.length);

  const writingItems = getSlashMenuItems('writing');
  assert.ok(writingItems.length > researchItems.length);
  assert.ok(writingItems.some((i) => i.group === 'writing'));
});

// ── Block Comments ──

test('injectBlockComments adds orbit comments', () => {
  const blocks = [
    { ...createBlock('heading', 'Title', { level: 1 }), id: 'h1' },
    { ...createBlock('paragraph', 'Body'), id: 'p1' },
  ];
  const md = '# Title\n\nBody';
  const result = injectBlockComments(md, blocks);
  assert.ok(result.includes('<!-- orbit:block id=h1 -->'));
  assert.ok(result.includes('<!-- orbit:block id=p1 -->'));
});

test('extractBlockComments parses comments from markdown', () => {
  const md = '<!-- orbit:block id=h1 -->\n# Title\n\n<!-- orbit:block id=p1 -->\nBody';
  const map = extractBlockComments(md);
  assert.ok(map.size >= 2);
  const ids = [...map.values()];
  assert.ok(ids.includes('h1'));
  assert.ok(ids.includes('p1'));
});

// ── Drag Assembly ──

test('createAssemblyBlock creates reference/snapshot/embed blocks', () => {
  const source = createBlock('paragraph', 'Source text', {});
  const op = { kind: 'snapshot' as const, sourceBlockId: 'src-1', targetPosition: 0 };
  const result = createAssemblyBlock(op, source);
  assert.equal(result.kind, 'snapshot');
  assert.equal(result.text, 'Source text');
  assert.equal(result.attrs.sourceId, 'src-1');
  assert.equal(result.attrs.sourceType, 'paragraph');
});

// ── External Edit ──

test('reconcileExternalEdit preserves IDs for unchanged blocks', () => {
  const oldBlocks = [
    { ...createBlock('heading', 'Title', { level: 1 }), id: 'h1' },
    { ...createBlock('paragraph', 'Body'), id: 'p1' },
  ];
  const oldMd = '# Title\n\nBody';
  const newMd = '# Title\n\nBody\n\nNew paragraph';
  const result = reconcileExternalEdit(oldBlocks, oldMd, newMd);
  assert.equal(result.blocks.length, 3);
  assert.equal(result.blocks[0].id, 'h1');
  assert.equal(result.blocks[1].id, 'p1');
  assert.ok(result.blocks[2].id); // new block gets an ID
  assert.equal(result.detachedIds.length, 0);
});

test('reconcileExternalEdit detects removed blocks', () => {
  const oldBlocks = [
    { ...createBlock('heading', 'Title', { level: 1 }), id: 'h1' },
    { ...createBlock('paragraph', 'Body'), id: 'p1' },
  ];
  const oldMd = '# Title\n\nBody';
  const newMd = '# Title';
  const result = reconcileExternalEdit(oldBlocks, oldMd, newMd);
  assert.equal(result.blocks.length, 1);
  assert.ok(result.detachedIds.includes('p1'));
});

// ── Editor State (updated) ──

test('createEditorDocumentState parses markdown into blocks', () => {
  const state = createEditorDocumentState('# 标题\n\n正文段落');
  assert.equal(state.blocks.length, 2);
  assert.equal(state.blocks[0].kind, 'heading');
  assert.equal(state.blocks[0].text, '标题');
  assert.ok(state.blocks[0].id); // IDs are assigned
  assert.equal(state.blocks[1].kind, 'paragraph');
  assert.equal(state.blocks[1].text, '正文段落');
});

test('createEditorDocumentState parses frontmatter', () => {
  const state = createEditorDocumentState('---\norbit_id: test\n---\n# Hello');
  assert.equal(state.frontmatter.orbit_id, 'test');
  assert.equal(state.blocks.length, 1);
  assert.equal(state.blocks[0].kind, 'heading');
});

// ── Editor Module (updated) ──

test('createEditorDomModule exposes module descriptor', () => {
  const module = createEditorDomModule({
    draft: '# 标题\n\n正文段落',
    selectionMode: 'single',
  });
  assert.equal(module.kind, 'dom-editor');
  assert.equal(module.rootRole, 'textbox');
  assert.ok(module.commands.includes('insertHeading'));
  assert.ok(module.modeConfig);
  assert.ok(module.slashMenuItems.length > 0);
});

test('createEditorDomModule respects mode parameter', () => {
  const module = createEditorDomModule({
    draft: '',
    selectionMode: 'single',
    mode: 'writing',
  });
  assert.equal(module.modeConfig.mode, 'writing');
  assert.equal(module.modeConfig.provenanceRequired, true);
  assert.ok(module.slashMenuItems.some((i) => i.group === 'writing'));
});
