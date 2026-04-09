import test from 'node:test';
import assert from 'node:assert/strict';
import { createTranslator, listSupportedLocales } from '../src/index.ts';

test('i18n：提供中英繁三套 locale', () => {
  assert.deepEqual(listSupportedLocales(), ['zh-CN', 'en-US', 'zh-TW']);
});

test('i18n：可以根据 locale 输出对应文案', () => {
  const zhTw = createTranslator('zh-TW');
  const enUs = createTranslator('en-US');

  assert.equal(zhTw.t('workbench.title'), 'Orbit 工作台');
  assert.equal(enUs.t('mobile.tab.library'), 'Library');
});
