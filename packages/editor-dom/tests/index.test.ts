import test from 'node:test';
        import assert from 'node:assert/strict';
        import { createEditorDocumentState, createEditorDomModule } from '../src/index.ts';

test('editor-dom：将草稿文本整理为适合 DOM 编辑器的文档状态', () => {
  const state = createEditorDocumentState('# 标题\n\n正文段落');

          assert.equal(state.blocks.length, 2);
          assert.deepEqual(state.blocks[0], {
            id: 'block-1',
            kind: 'heading',
            text: '标题'
          });
        });

test('editor-dom：暴露 DOM 编辑器模块描述', () => {
  const module = createEditorDomModule({
    draft: '# 标题\n\n正文段落',
    selectionMode: 'single'
  });

          assert.equal(module.kind, 'dom-editor');
          assert.equal(module.rootRole, 'textbox');
          assert.ok(module.commands.includes('insertHeading'));
        });
