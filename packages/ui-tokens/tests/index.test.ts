import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlatformTheme, getSpacing, orbitTokens } from '../src/index.ts';

test('ui-tokens：提供 DOM 与 Native 共用的语义化 token', () => {
  assert.equal(orbitTokens.color.accent, '#5B7CFA');
  assert.equal(createPlatformTheme('dom').platform, 'dom');
  assert.ok(createPlatformTheme('native').density.touchTarget > 40);
});

test('ui-tokens：可以按阶梯解析间距', () => {
  assert.equal(getSpacing(0), 4);
  assert.equal(getSpacing(3), 16);
  assert.equal(getSpacing(99), 32);
});
