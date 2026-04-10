import test from 'node:test';
import assert from 'node:assert/strict';
import { createNativeScreenScaffold, createNativeThemeContract } from '../src/index.ts';

test('ui-native：把共享 token 映射为 Native 主题契约', () => {
  const contract = createNativeThemeContract();
  assert.equal(contract.chrome.statusBarStyle, 'dark-content');
  assert.ok(contract.layout.cardPadding > 0);
});

test('ui-native: dark mode has light-content status bar', () => {
  const contract = createNativeThemeContract('dark');
  assert.equal(contract.chrome.statusBarStyle, 'light-content');
  assert.equal(contract.palette.bg.back, '#1a1a1e');
});

test('ui-native: light mode has OKLCH colors', () => {
  const contract = createNativeThemeContract('light');
  assert.ok(contract.palette.bg.back.includes('oklch'));
});

test('ui-native: includes object type colors', () => {
  const contract = createNativeThemeContract();
  assert.ok(contract.objectTypes.project.bg.includes('oklch'));
});

test('ui-native：提供适合 React Native 的屏幕脚手架描述', () => {
  const screen = createNativeScreenScaffold('首页', '继续阅读');
  assert.equal(screen.kind, 'native-screen');
  assert.equal(screen.header.title, '首页');
});
