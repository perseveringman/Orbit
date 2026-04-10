import {
  getSemanticColors, objectTypeColors, dayColors,
  fontWeights, type OrbitThemeMode, type SemanticColorTokens,
  type ObjectTypeColors, type DayColors
} from '@orbit/ui-tokens';

export interface NativeColorPalette {
  bg: {
    back: string;
    base: string;
    front: string;
    el: string;
    elHover: string;
    elActive: string;
    buttonPrimary: string;
    input: string;
  };
  text: {
    primary: string;
    secondary: string;
    subtle: string;
    buttonPrimary: string;
  };
  border: {
    base: string;
    el: string;
    elHover: string;
  };
  misc: {
    link: string;
    placeholder: string;
    scrollbarThumb: string;
  };
}

interface NativeShadow {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
}

export interface NativeThemeContract {
  mode: OrbitThemeMode;
  palette: NativeColorPalette;
  objectTypes: ObjectTypeColors;
  dayColors: DayColors;
  layout: {
    screenPadding: number;
    sectionGap: number;
    cardPadding: number;
    touchTarget: number;
    sidebarWidth: number;
  };
  typography: {
    fontFamily: { sans: string; mono: string; serif: string };
    fontSize: {
      xs: number; sm: number; base: number; md: number;
      lg: number; xl: number; '2xl': number; '4xl': number;
    };
    fontWeight: {
      normal: string; medium: string; semibold: string; bold: string;
    };
    lineHeight: { tight: number; base: number; relaxed: number };
  };
  radius: { sm: number; base: number; lg: number; xl: number; full: number };
  shadow: { sm: NativeShadow; md: NativeShadow; lg: NativeShadow };
  spacing: { xs: number; sm: number; md: number; lg: number; xl: number; '2xl': number };
  motion: { duration: number; easing: string };
  chrome: {
    statusBarStyle: 'light-content' | 'dark-content';
    blurEffect: string;
  };
}

export function getNativeColors(mode: OrbitThemeMode): NativeColorPalette {
  const sc: SemanticColorTokens = getSemanticColors(mode);
  return {
    bg: {
      back: sc.bg.back,
      base: sc.bg.base,
      front: sc.bg.front,
      el: sc.bg.el,
      elHover: sc.bg.elHover,
      elActive: sc.bg.elActive,
      buttonPrimary: sc.bg.buttonPrimary,
      input: sc.bg.input,
    },
    text: {
      primary: sc.text.primary,
      secondary: sc.text.secondary,
      subtle: sc.text.subtle,
      buttonPrimary: sc.text.buttonPrimary,
    },
    border: {
      base: sc.border.base,
      el: sc.border.el,
      elHover: sc.border.elHover,
    },
    misc: {
      link: sc.misc.link,
      placeholder: sc.misc.placeholder,
      scrollbarThumb: sc.misc.scrollbarThumb,
    },
  };
}

export function createNativeThemeContract(mode: OrbitThemeMode = 'light'): NativeThemeContract {
  const shadowColor = mode === 'dark' ? '#000000' : '#000000';

  return {
    mode,
    palette: getNativeColors(mode),
    objectTypes: objectTypeColors,
    dayColors,
    layout: {
      screenPadding: 20,
      sectionGap: 16,
      cardPadding: 16,
      touchTarget: 44,
      sidebarWidth: 288,
    },
    typography: {
      fontFamily: { sans: 'System', mono: 'Courier New', serif: 'Georgia' },
      fontSize: {
        xs: 12, sm: 13.5, base: 15, md: 16,
        lg: 18, xl: 20, '2xl': 24, '4xl': 36,
      },
      fontWeight: {
        normal: String(fontWeights.normal),
        medium: String(fontWeights.medium),
        semibold: String(fontWeights.semibold),
        bold: String(fontWeights.bold),
      },
      lineHeight: { tight: 1.2, base: 1.4, relaxed: 1.6 },
    },
    radius: { sm: 4, base: 8, lg: 12, xl: 16, full: 9999 },
    shadow: {
      sm: { shadowColor, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2, elevation: 1 },
      md: { shadowColor, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 4, elevation: 3 },
      lg: { shadowColor, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.16, shadowRadius: 8, elevation: 6 },
    },
    spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, '2xl': 48 },
    motion: { duration: 150, easing: 'cubic-bezier(.4,0,.2,1)' },
    chrome: {
      statusBarStyle: mode === 'dark' ? 'light-content' : 'dark-content',
      blurEffect: 'systemThinMaterial',
    },
  };
}
