import test from 'node:test';
import assert from 'node:assert/strict';
import { createLocaleCatalog, createTranslator, listSupportedLocales } from '../src/index.ts';

test('i18n：提供中英繁三套 locale', () => {
  assert.deepEqual(listSupportedLocales(), ['zh-CN', 'en-US', 'zh-TW']);
});

test('i18n：可以根据 locale 输出对应文案', () => {
  const zhCn = createTranslator('zh-CN');
  const zhTw = createTranslator('zh-TW');
  const enUs = createTranslator('en-US');

  assert.equal(zhTw.t('workbench.title'), 'Orbit 工作台');
  assert.equal(enUs.t('mobile.tab.library'), 'Library');
  assert.equal(zhTw.t('workbench.section.review'), '回顧');
  assert.equal(
    zhCn.t('workbench.planner.summary', {
      projectCount: 2,
      taskCount: 3,
      todayCount: 1,
      reviewCount: 4
    }),
    '2 个活跃项目 · 3 个开放任务 · 1 个今日候选 · 4 个回顾信号'
  );
  assert.equal(
    enUs.t('workbench.planner.summary', {
      projectCount: 2,
      taskCount: 3,
      todayCount: 1,
      reviewCount: 4
    }),
    '2 active projects · 3 open tasks · 1 for today · 4 review signals'
  );
});

test('i18n：workbench locale 不再暴露 legacy section keys', () => {
  for (const locale of listSupportedLocales()) {
    const catalog = createLocaleCatalog(locale);

    assert.equal(Object.hasOwn(catalog, 'workbench.section.inbox'), false);
    assert.equal(Object.hasOwn(catalog, 'workbench.section.library'), false);
    assert.equal(Object.hasOwn(catalog, 'workbench.section.today'), true);
    assert.equal(Object.hasOwn(catalog, 'workbench.section.tasks'), true);
  }
});
