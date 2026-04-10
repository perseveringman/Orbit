import {
  generateCSSVariables,
  generateStylesheet,
  createPlatformTheme,
  getSpacing,
  type OrbitThemeMode,
  type OrbitStyleVariant
} from '@orbit/ui-tokens';

export type { OrbitThemeMode, OrbitStyleVariant };

export interface DomThemeContract {
  cssVariables: Record<string, string>;
  classNames: {
    shell: string;
    sidebar: string;
    list: string;
    detail: string;
    button: string;
  };
  layout: {
    listGap: number;
    panelPadding: number;
    cardPadding: number;
  };
}

/** Creates the theme contract for a given mode. Backward compatible. */
export function createDomThemeContract(mode?: OrbitThemeMode): DomThemeContract {
  const resolvedMode = mode ?? 'light';
  const theme = createPlatformTheme('dom');
  const cssVariables = generateCSSVariables(resolvedMode);

  return {
    cssVariables,
    classNames: {
      shell: 'orbit-shell orbit-shell--dom',
      sidebar: 'orbit-sidebar orbit-sidebar--nav',
      list: 'orbit-list orbit-list--cards',
      detail: 'orbit-detail orbit-detail--reader',
      button: 'orbit-button orbit-button--primary'
    },
    layout: {
      listGap: theme.listGap,
      panelPadding: getSpacing(5),
      cardPadding: theme.cardPadding
    }
  };
}

/** Injects design system CSS variables into a DOM element (default: document.documentElement). */
export function injectTheme(mode: OrbitThemeMode, target?: HTMLElement): void {
  if (typeof document === 'undefined') return;
  const el = target ?? document.documentElement;
  const vars = generateCSSVariables(mode);
  for (const [key, value] of Object.entries(vars)) {
    el.style.setProperty(key, value);
  }
}

/** Switches theme by updating data-theme attribute and CSS variables. Also persists to localStorage. */
export function setTheme(mode: OrbitThemeMode): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = mode;
  injectTheme(mode);
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('orbit-theme', mode);
  }
}

/** Gets the current theme from document or localStorage, falling back to 'light'. */
export function getCurrentTheme(): OrbitThemeMode {
  if (typeof document !== 'undefined' && document.documentElement.dataset.theme) {
    return document.documentElement.dataset.theme as OrbitThemeMode;
  }
  if (typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem('orbit-theme');
    if (stored === 'light' || stored === 'dark') return stored;
  }
  return 'light';
}

/** Sets the style variant (data-style attribute). Also persists to localStorage. */
export function setStyleVariant(variant: OrbitStyleVariant): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.style = variant;
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('orbit-style', variant);
  }
}

/** Gets the full design system CSS as a string (for SSR or injection). */
export function getDesignSystemCSS(): string {
  return generateStylesheet();
}
