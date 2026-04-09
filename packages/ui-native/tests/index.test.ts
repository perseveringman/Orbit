import test from 'node:test';
import assert from 'node:assert/strict';
import { createNativeScreenScaffold, createNativeThemeContract } from '../src/index.ts';

test('ui-native：把共享 token 映射为 Native 主题契约', () => {
  const contract = createNativeThemeContract();

  assert.equal(contract.chrome.statusBarStyle, 'light-content');
  assert.ok(contract.layout.cardPadding > 0);
});

test('ui-native：提供适合 React Native 的屏幕脚手架描述', () => {
  const screen = createNativeScreenScaffold('首页', '继续阅读');

  assert.equal(screen.kind, 'native-screen');
  assert.equal(screen.header.title, '首页');
});
