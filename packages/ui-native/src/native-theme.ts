import { createPlatformTheme, getSpacing } from '@orbit/ui-tokens';

export interface NativeThemeContract {
  palette: {
    canvas: string;
    panel: string;
    accent: string;
    textStrong: string;
    textMuted: string;
  };
  layout: {
    screenPadding: number;
    sectionGap: number;
    cardPadding: number;
    touchTarget: number;
  };
  typography: {
    title: number;
    body: number;
    caption: number;
  };
  chrome: {
    statusBarStyle: 'light-content';
    blurEffect: 'systemThinMaterial';
  };
}

export function createNativeThemeContract(): NativeThemeContract {
  const theme = createPlatformTheme('native');

  return {
    palette: {
      canvas: theme.color.canvas,
      panel: theme.color.panel,
      accent: theme.color.accent,
      textStrong: theme.color.textStrong,
      textMuted: theme.color.textMuted
    },
    layout: {
      screenPadding: getSpacing(5),
      sectionGap: theme.listGap,
      cardPadding: theme.cardPadding,
      touchTarget: theme.density.touchTarget
    },
    typography: {
      title: theme.typography.title,
      body: theme.typography.body,
      caption: theme.typography.caption
    },
    chrome: {
      statusBarStyle: 'light-content',
      blurEffect: 'systemThinMaterial'
    }
  };
}
