import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createLocaleCatalog,
  createTranslator,
  listSupportedLocales,
  createDefaultLocaleConfig,
  createLocaleConfig,
  createTermbase,
  orbitSeedEntries,
  formatDate,
  formatNumber,
  formatRelativeTime,
  formatPercent,
  formatCompactNumber,
  formatDateRange,
  zhCNMessages,
  enUSMessages,
  zhTWMessages
} from '../src/index.ts';
import type { LocaleCode, OrbitLocaleConfig } from '../src/index.ts';

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

// ─── OrbitLocaleConfig ───────────────────────────────────────────
test('locale-config：createDefaultLocaleConfig sets all dimensions to appLocale', () => {
  const cfg = createDefaultLocaleConfig('zh-TW');
  assert.equal(cfg.appLocale, 'zh-TW');
  assert.equal(cfg.contentLocale, 'zh-TW');
  assert.equal(cfg.agentOutputLocale, 'zh-TW');
  assert.equal(cfg.searchLocale, 'zh-TW');
});

test('locale-config：createLocaleConfig applies overrides', () => {
  const cfg = createLocaleConfig({
    appLocale: 'en-US',
    agentOutputLocale: 'zh-CN',
    searchLocale: 'zh-TW'
  });
  assert.equal(cfg.appLocale, 'en-US');
  assert.equal(cfg.contentLocale, 'en-US');
  assert.equal(cfg.agentOutputLocale, 'zh-CN');
  assert.equal(cfg.searchLocale, 'zh-TW');
});

// ─── Termbase ────────────────────────────────────────────────────
test('termbase：lookup returns entry by conceptId', () => {
  const tb = createTermbase(orbitSeedEntries);
  const entry = tb.lookup('project');
  assert.ok(entry);
  assert.equal(entry.conceptId, 'project');
  assert.equal(entry.preferredTerms['en-US'], 'Project');
});

test('termbase：lookup returns undefined for unknown conceptId', () => {
  const tb = createTermbase(orbitSeedEntries);
  assert.equal(tb.lookup('nonexistent'), undefined);
});

test('termbase：preferred returns localized term', () => {
  const tb = createTermbase(orbitSeedEntries);
  assert.equal(tb.preferred('task', 'zh-CN'), '任务');
  assert.equal(tb.preferred('task', 'zh-TW'), '任務');
  assert.equal(tb.preferred('task', 'en-US'), 'Task');
});

test('termbase：preferred returns undefined for unknown concept', () => {
  const tb = createTermbase(orbitSeedEntries);
  assert.equal(tb.preferred('unknown', 'en-US'), undefined);
});

test('termbase：search matches conceptId, terms, aliases, and description', () => {
  const tb = createTermbase(orbitSeedEntries);
  assert.ok(tb.search('project').length >= 1);
  assert.ok(tb.search('todo').length >= 1);
  assert.ok(tb.search('AI-powered').length >= 1);
  assert.equal(tb.search('xyznonexistent').length, 0);
});

test('termbase：seed entries cover all 10 core concepts', () => {
  const tb = createTermbase(orbitSeedEntries);
  const ids = ['project', 'task', 'vision', 'note', 'highlight', 'article', 'workspace', 'agent', 'direction', 'review'];
  for (const id of ids) {
    assert.ok(tb.lookup(id), `missing seed entry: ${id}`);
  }
});

// ─── Formatters ──────────────────────────────────────────────────
test('formatters：formatDate produces locale-appropriate output', () => {
  const d = new Date('2024-06-15T12:00:00Z');
  const en = formatDate(d, 'en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  assert.ok(en.includes('Jun') || en.includes('2024'));
  const zh = formatDate(d, 'zh-CN', { year: 'numeric', month: 'short', day: 'numeric' });
  assert.ok(zh.includes('2024'));
});

test('formatters：formatNumber formats with locale separators', () => {
  const en = formatNumber(1234567.89, 'en-US');
  assert.ok(en.includes('1,234,567'));
});

test('formatters：formatCompactNumber produces compact notation', () => {
  const en = formatCompactNumber(1200, 'en-US');
  assert.ok(en.includes('1.2K') || en.includes('1K'));
});

test('formatters：formatPercent formats as percentage', () => {
  const en = formatPercent(0.45, 'en-US');
  assert.ok(en.includes('45%'));
});

test('formatters：formatRelativeTime returns relative string', () => {
  const pastDate = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const result = formatRelativeTime(pastDate, 'en-US');
  assert.ok(result.includes('hour'), `expected "hour" in "${result}"`);
});

test('formatters：formatDateRange formats a range', () => {
  const start = new Date('2024-01-15');
  const end = new Date('2024-03-20');
  const result = formatDateRange(start, end, 'en-US');
  assert.ok(result.includes('Jan') || result.includes('2024'));
  assert.ok(result.includes('Mar') || result.includes('20'));
});

// ─── Namespace key parity across locales ─────────────────────────
test('i18n：all three locale files have identical key sets', () => {
  const zhCNKeys = Object.keys(zhCNMessages).sort();
  const enUSKeys = Object.keys(enUSMessages).sort();
  const zhTWKeys = Object.keys(zhTWMessages).sort();
  assert.deepEqual(zhCNKeys, enUSKeys, 'zh-CN and en-US key mismatch');
  assert.deepEqual(zhCNKeys, zhTWKeys, 'zh-CN and zh-TW key mismatch');
});

test('i18n：new namespace keys exist in all locales', () => {
  const namespaces = ['common.', 'reader.', 'search.', 'agent.', 'settings.'];
  for (const ns of namespaces) {
    const keysInZhCN = Object.keys(zhCNMessages).filter(k => k.startsWith(ns));
    assert.ok(keysInZhCN.length >= 5, `expected >=5 keys for ${ns} in zh-CN, got ${keysInZhCN.length}`);
    for (const key of keysInZhCN) {
      assert.ok(key in enUSMessages, `missing ${key} in en-US`);
      assert.ok(key in zhTWMessages, `missing ${key} in zh-TW`);
    }
  }
});
