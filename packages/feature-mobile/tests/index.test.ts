import test from 'node:test';
import assert from 'node:assert/strict';
import { createMobileFeatureModule, mountMobileFeature } from '../src/index.ts';

test('feature-mobile：组合 iOS 可挂载的移动特性模块', () => {
  const module = createMobileFeatureModule({
    host: { kind: 'ios', navigationStyle: 'stack' },
    locale: 'zh-TW',
    activeSection: 'inbox',
    searchQuery: '',
    articles: [
      {
        id: 'a-1',
        title: 'iOS 首屏',
        excerpt: '共用業務內核，獨立移動表達。',
        isRead: false,
        updatedAt: '2026-02-10T10:00:00.000Z'
      }
    ]
  });

  assert.equal(module.host.kind, 'ios');
  assert.equal(module.tabs[0]?.label, '首頁');
  assert.equal(module.screens.home.kind, 'native-screen');
});

test('feature-mobile：提供 iOS 宿主可调用的挂载结果', () => {
  const mounted = mountMobileFeature({
    host: { kind: 'ios', navigationStyle: 'split' },
    locale: 'en-US',
    activeSection: 'library',
    searchQuery: '',
    articles: []
  });

  assert.equal(mounted.hostKind, 'ios');
  assert.equal(mounted.tabs[1]?.label, 'Library');
});
