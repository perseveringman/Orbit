import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDomThemeContract,
  createDomSlot,
  getDesignSystemCSS,
  createButtonDescriptor,
  createCardDescriptor,
  createModalDescriptor,
  createNavItemDescriptor,
  createBadgeDescriptor,
} from '../src/index.ts';

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

// ── Button descriptor ───────────────────────────────────────────────

test('ButtonDescriptor: defaults to primary/md', () => {
  const d = createButtonDescriptor({ label: 'Save' });
  assert.equal(d.kind, 'button');
  assert.ok(d.className.includes('orbit-button'));
  assert.ok(d.className.includes('orbit-button--primary'));
  assert.ok(d.className.includes('orbit-button--md'));
  assert.equal(d.ariaAttributes['aria-label'], 'Save');
});

test('ButtonDescriptor: disabled + loading sets aria attrs', () => {
  const d = createButtonDescriptor({ label: 'Go', disabled: true, loading: true });
  assert.equal(d.ariaAttributes['aria-disabled'], 'true');
  assert.equal(d.ariaAttributes['aria-busy'], 'true');
  assert.ok(d.className.includes('orbit-button--disabled'));
  assert.ok(d.className.includes('orbit-button--loading'));
});

test('ButtonDescriptor: respects variant and size', () => {
  const d = createButtonDescriptor({ label: 'X', variant: 'danger', size: 'lg' });
  assert.ok(d.className.includes('orbit-button--danger'));
  assert.ok(d.className.includes('orbit-button--lg'));
});

// ── Card descriptor ─────────────────────────────────────────────────

test('CardDescriptor: basic card', () => {
  const d = createCardDescriptor({ title: 'My Card' });
  assert.equal(d.kind, 'card');
  assert.ok(d.className.includes('orbit-card'));
  assert.equal(d.ariaAttributes['aria-label'], 'My Card');
});

test('CardDescriptor: interactive card has role button', () => {
  const d = createCardDescriptor({ title: 'Click me', interactive: true });
  assert.ok(d.className.includes('orbit-card--interactive'));
  assert.equal(d.ariaAttributes['role'], 'button');
});

test('CardDescriptor: objectType adds modifier class', () => {
  const d = createCardDescriptor({ title: 'Note', objectType: 'note' });
  assert.ok(d.className.includes('orbit-card--note'));
});

// ── Modal descriptor ────────────────────────────────────────────────

test('ModalDescriptor: defaults to md dialog', () => {
  const d = createModalDescriptor({ title: 'Confirm' });
  assert.equal(d.kind, 'modal');
  assert.ok(d.className.includes('orbit-modal--md'));
  assert.equal(d.ariaAttributes['role'], 'dialog');
  assert.equal(d.ariaAttributes['aria-modal'], 'true');
  assert.equal(d.ariaAttributes['aria-hidden'], 'true');
});

test('ModalDescriptor: open modal has no aria-hidden', () => {
  const d = createModalDescriptor({ title: 'Open', open: true });
  assert.ok(d.className.includes('orbit-modal--open'));
  assert.equal(d.ariaAttributes['aria-hidden'], undefined);
});

test('ModalDescriptor: fullscreen alertdialog', () => {
  const d = createModalDescriptor({ title: 'Alert', size: 'fullscreen', role: 'alertdialog' });
  assert.ok(d.className.includes('orbit-modal--fullscreen'));
  assert.equal(d.ariaAttributes['role'], 'alertdialog');
});

// ── NavItem descriptor ──────────────────────────────────────────────

test('NavItemDescriptor: basic nav item', () => {
  const d = createNavItemDescriptor({ label: 'Home' });
  assert.equal(d.kind, 'nav-item');
  assert.ok(d.className.includes('orbit-sidebar-nav-item'));
  assert.equal(d.ariaAttributes['aria-label'], 'Home');
});

test('NavItemDescriptor: active item sets aria-current', () => {
  const d = createNavItemDescriptor({ label: 'Inbox', active: true });
  assert.ok(d.className.includes('orbit-sidebar-nav-item--active'));
  assert.equal(d.ariaAttributes['aria-current'], 'page');
});

test('NavItemDescriptor: badge count in aria-label', () => {
  const d = createNavItemDescriptor({ label: 'Inbox', badge: 5 });
  assert.equal(d.ariaAttributes['aria-label'], 'Inbox (5)');
});

// ── Badge descriptor ────────────────────────────────────────────────

test('BadgeDescriptor: defaults to default/md', () => {
  const d = createBadgeDescriptor({ label: 'New' });
  assert.equal(d.kind, 'badge');
  assert.ok(d.className.includes('orbit-badge'));
  assert.ok(d.className.includes('orbit-badge--default'));
  assert.ok(d.className.includes('orbit-badge--md'));
  assert.equal(d.ariaAttributes['aria-label'], 'New');
});

test('BadgeDescriptor: respects variant and size', () => {
  const d = createBadgeDescriptor({ label: 'Err', variant: 'error', size: 'sm' });
  assert.ok(d.className.includes('orbit-badge--error'));
  assert.ok(d.className.includes('orbit-badge--sm'));
});
