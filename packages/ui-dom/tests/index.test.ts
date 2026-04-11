import test from 'node:test';
import assert from 'node:assert/strict';
import {
  setTheme,
  getCurrentTheme,
} from '../src/index.ts';

test('ui-dom: OrbitThemeMode type is "light" | "dark"', () => {
  // Compile-time check: getCurrentTheme returns OrbitThemeMode
  const mode = getCurrentTheme();
  assert.ok(mode === 'light' || mode === 'dark');
});

test('ui-dom: getCurrentTheme defaults to "light" without DOM', () => {
  // In Node there's no document or localStorage, so fallback is 'light'
  const theme = getCurrentTheme();
  assert.equal(theme, 'light');
});

test('ui-dom: setTheme is a callable function', () => {
  // In Node with no document, setTheme should return without throwing
  assert.equal(typeof setTheme, 'function');
  setTheme('dark'); // should not throw even without DOM
});
