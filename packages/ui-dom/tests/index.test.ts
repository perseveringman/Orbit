import test from 'node:test';
import assert from 'node:assert/strict';
import { createDomThemeContract, createDomSlot } from '../src/index.ts';

test('ui-dom：把共享 token 映射为 DOM 主题契约', () => {
  const contract = createDomThemeContract();

  assert.equal(contract.cssVariables['--orbit-color-accent'], '#5B7CFA');
  assert.ok(contract.layout.listGap > 0);
});

test('ui-dom：提供面向 React DOM 的插槽描述', () => {
  const slot = createDomSlot('article-list', { empty: false });
  assert.equal(slot.name, 'article-list');
  assert.equal(slot.kind, 'dom-slot');
});
