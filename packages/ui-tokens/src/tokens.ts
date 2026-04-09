export type OrbitPlatformFamily = 'dom' | 'native';

export interface OrbitColorTokens {
  canvas: string;
  panel: string;
  panelMuted: string;
  accent: string;
  accentSoft: string;
  textStrong: string;
  textMuted: string;
  border: string;
  success: string;
  warning: string;
}

export interface OrbitTypographyTokens {
  fontFamily: string;
  title: number;
  body: number;
  caption: number;
  lineHeight: number;
}

export interface OrbitDensityTokens {
  compact: number;
  regular: number;
  comfortable: number;
  touchTarget: number;
}

export interface OrbitThemeTokens {
  color: OrbitColorTokens;
  spacing: number[];
  radius: {
    sm: number;
    md: number;
    lg: number;
  };
  shadow: {
    sm: string;
    md: string;
  };
  typography: OrbitTypographyTokens;
  platforms: Record<
    OrbitPlatformFamily,
    {
      density: OrbitDensityTokens;
      listGap: number;
      cardPadding: number;
    }
  >;
}

export const orbitTokens: OrbitThemeTokens = {
  color: {
    canvas: '#0E1320',
    panel: '#161D2F',
    panelMuted: '#202943',
    accent: '#5B7CFA',
    accentSoft: '#32428A',
    textStrong: '#F3F6FF',
    textMuted: '#A7B2D1',
    border: '#2D3858',
    success: '#4CC38A',
    warning: '#FFB454'
  },
  spacing: [4, 8, 12, 16, 20, 24, 32],
  radius: {
    sm: 8,
    md: 12,
    lg: 18
  },
  shadow: {
    sm: '0 8px 24px rgba(8, 12, 24, 0.12)',
    md: '0 16px 40px rgba(8, 12, 24, 0.2)'
  },
  typography: {
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    title: 20,
    body: 15,
    caption: 13,
    lineHeight: 1.5
  },
  platforms: {
    dom: {
      density: {
        compact: 28,
        regular: 36,
        comfortable: 44,
        touchTarget: 44
      },
      listGap: 12,
      cardPadding: 16
    },
    native: {
      density: {
        compact: 32,
        regular: 40,
        comfortable: 48,
        touchTarget: 48
      },
      listGap: 16,
      cardPadding: 20
    }
  }
};

export interface OrbitPlatformTheme {
  platform: OrbitPlatformFamily;
  color: OrbitColorTokens;
  radius: OrbitThemeTokens['radius'];
  typography: OrbitTypographyTokens;
  density: OrbitDensityTokens;
  listGap: number;
  cardPadding: number;
}

export function getSpacing(step: number): number {
  const index = Math.max(0, Math.min(step, orbitTokens.spacing.length - 1));
  return orbitTokens.spacing[index] ?? orbitTokens.spacing[orbitTokens.spacing.length - 1] ?? 0;
}

export function createPlatformTheme(platform: OrbitPlatformFamily): OrbitPlatformTheme {
  const platformTheme = orbitTokens.platforms[platform];

  return {
    platform,
    color: orbitTokens.color,
    radius: orbitTokens.radius,
    typography: orbitTokens.typography,
    density: platformTheme.density,
    listGap: platformTheme.listGap,
    cardPadding: platformTheme.cardPadding
  };
}
