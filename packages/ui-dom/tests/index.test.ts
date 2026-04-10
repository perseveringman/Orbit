import test from 'node:test';
import assert from 'node:assert/strict';
import { createDomThemeContract, createDomSlot, getDesignSystemCSS } from '../src/index.ts';

test('ui-dom：把共享 token 映射为 DOM 主题契约', () => {
  const contract = createDomThemeContract();
  // backward compat: still has cssVariables
  assert.ok(Object.keys(contract.cssVariables).length > 50);
  assert.ok(contract.layout.listGap > 0);
});

test('ui-dom: light theme has OKLCH bg-back', () => {
  const contract = createDomThemeContract('light');
  assert.ok(contract.cssVariables['--bg-back'].includes('oklch'));
});

test('ui-dom: dark theme has hex bg-back', () => {
  const contract = createDomThemeContract('dark');
  assert.equal(contract.cssVariables['--bg-back'], '#1a1a1e');
});

test('ui-dom：提供面向 React DOM 的插槽描述', () => {
  const slot = createDomSlot('article-list', { empty: false });
  assert.equal(slot.name, 'article-list');
  assert.equal(slot.kind, 'dom-slot');
});

test('ui-dom: generates complete CSS stylesheet', () => {
  const css = getDesignSystemCSS();
  assert.ok(css.includes(':root'));
  assert.ok(css.includes('[data-theme="light"]'));
  assert.ok(css.includes('[data-theme="dark"]'));
  assert.ok(css.includes('--bg-back'));
});
