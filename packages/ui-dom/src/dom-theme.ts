import { createPlatformTheme, getSpacing } from '@orbit/ui-tokens';

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

export function createDomThemeContract(): DomThemeContract {
  const theme = createPlatformTheme('dom');

  return {
    cssVariables: {
      '--orbit-color-canvas': theme.color.canvas,
      '--orbit-color-panel': theme.color.panel,
      '--orbit-color-accent': theme.color.accent,
      '--orbit-color-text-strong': theme.color.textStrong,
      '--orbit-color-border': theme.color.border,
      '--orbit-radius-md': `${theme.radius.md}px`
    },
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
