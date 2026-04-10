/* ═══════════════════════════════════════════════════════════
 * Orbit Design System Tokens
 * Based on Capacities design specification (OKLCH color space)
 * ═══════════════════════════════════════════════════════════ */

export type OrbitThemeMode = 'light' | 'dark';
export type OrbitStyleVariant = 'default' | 'notion' | 'spaceship' | 'library';
export type OrbitPlatformFamily = 'dom' | 'native';

// ── Semantic color tokens ────────────────────────────────

export interface SemanticBackgroundColors {
  back: string;
  base: string;
  baseHover: string;
  front: string;
  frontHover: string;
  el: string;
  elHover: string;
  elSubtle: string;
  elSubtleHover: string;
  elActive: string;
  elStrong: string;
  buttonPrimary: string;
  buttonPrimaryHover: string;
  input: string;
  inputHover: string;
  state: string;
  stateHover: string;
  stateActive: string;
}

export interface SemanticTextColors {
  primary: string;
  secondary: string;
  subtle: string;
  stateActive: string;
  buttonPrimary: string;
  buttonPrimaryHover: string;
}

export interface SemanticBorderColors {
  base: string;
  baseStrong: string;
  front: string;
  frontStrong: string;
  el: string;
  elHover: string;
  elSubtle: string;
  state: string;
  stateActive: string;
  buttonPrimary: string;
}

export interface MiscColors {
  placeholder: string;
  link: string;
  linkHover: string;
  internalLink: string;
  quoteLine: string;
  horizontalLine: string;
  codeBg: string;
  codeText: string;
  codeBorder: string;
  ringActive: string;
  scrollbarThumb: string;
  scrollbarTrack: string;
}

export interface ObjectTypeColor {
  bg: string;
  text: string;
  border: string;
}

export interface ObjectTypeColors {
  project: ObjectTypeColor;
  quote: ObjectTypeColor;
  atomic: ObjectTypeColor;
  daily: ObjectTypeColor;
  page: ObjectTypeColor;
  tag: ObjectTypeColor;
}

export interface DayColors {
  today: string;
  monday: string;
  tuesday: string;
  wednesday: string;
  thursday: string;
  friday: string;
  saturday: string;
  sunday: string;
}

export interface SemanticColorTokens {
  bg: SemanticBackgroundColors;
  text: SemanticTextColors;
  border: SemanticBorderColors;
  misc: MiscColors;
}

// ── Typography tokens ────────────────────────────────────

export interface FontFamilies {
  sans: string;
  mono: string;
  code: string;
  serif: string;
}

export interface TypeScale {
  xxs: string;
  xs: string;
  sm: string;
  smPlus: string;
  base: string;
  md: string;
  lg: string;
  xl: string;
  '2xl': string;
  '25xl': string;
  '3xl': string;
  '35xl': string;
  '4xl': string;
  '5xl': string;
}

export interface FontWeights {
  extralight: number;
  light: number;
  normal: number;
  medium: number;
  semibold: number;
  bold: number;
}

export interface LineHeights {
  xxs: string;
  xs: string;
  sm: string;
  smPlus: string;
  base: string;
  md: string;
  lg: string;
  xl: string;
}

export interface LetterSpacing {
  tighter: string;
  tight: string;
  wide: string;
  wider: string;
}

export interface TypographyTokens {
  fontFamily: FontFamilies;
  typeScale: TypeScale;
  fontWeight: FontWeights;
  lineHeight: LineHeights;
  letterSpacing: LetterSpacing;
}

// ── Spacing / Radius / Shadow / Motion ───────────────────

export interface SpacingScale {
  '0': string;
  px: string;
  '0-5': string;
  '1': string;
  '1-5': string;
  '2': string;
  '2-5': string;
  '3': string;
  '3-5': string;
  '4': string;
  '5': string;
  '6': string;
  '8': string;
  '10': string;
  '12': string;
  '16': string;
}

export interface RadiusScale {
  sm: string;
  small: string;
  md: string;
  base: string;
  lg: string;
  xl: string;
  '2xl': string;
  '3xl': string;
  full: string;
}

export interface ShadowScale {
  xs: string;
  sm: string;
  default: string;
  md: string;
  lg: string;
  xl: string;
  '2xl': string;
  '3xl': string;
}

export interface BlurScale {
  sm: string;
  md: string;
  lg: string;
  xl: string;
}

export interface MotionTokens {
  duration: string;
  ease: string;
  easeIn: string;
  easeOut: string;
}

export interface ElementHeights {
  xs: string;
  sm: string;
  base: string;
  md: string;
  lg: string;
}

export interface LayoutTokens {
  sidebarWidth: string;
  rightPanelWidth: string;
}

// ── Density (platform-specific) ──────────────────────────

export interface OrbitDensityTokens {
  compact: number;
  regular: number;
  comfortable: number;
  touchTarget: number;
}

// ── Top-level theme ──────────────────────────────────────

export interface OrbitDesignTokens {
  semantic: SemanticColorTokens;
  objectTypes: ObjectTypeColors;
  dayColors: DayColors;
  typography: TypographyTokens;
  spacing: SpacingScale;
  radius: RadiusScale;
  shadow: ShadowScale;
  blur: BlurScale;
  motion: MotionTokens;
  elementHeights: ElementHeights;
  layout: LayoutTokens;
}

// ═══════════════════════════════════════════════════════════
// CONSTANT TOKENS (same in all themes)
// ═══════════════════════════════════════════════════════════

export const objectTypeColors: ObjectTypeColors = {
  project: {
    bg: 'oklch(0.9732 0.0311 157.36)',
    text: 'oklch(0.5327 0.1221 151.70)',
    border: 'oklch(0.8712 0.1363 154.48)'
  },
  quote: {
    bg: 'oklch(0.9530 0.0218 17.35)',
    text: 'oklch(0.5060 0.1552 24.58)',
    border: 'oklch(0.8077 0.1035 19.54)'
  },
  atomic: {
    bg: 'oklch(0.9810 0.0480 103.47)',
    text: 'oklch(0.5532 0.1050 76.42)',
    border: 'oklch(0.9053 0.1656 98.12)'
  },
  daily: {
    bg: 'oklch(0.9513 0.0235 256.13)',
    text: 'oklch(0.5035 0.1579 264.41)',
    border: 'oklch(0.8091 0.0957 251.83)'
  },
  page: {
    bg: 'oklch(0.9856 0.0016 67.00)',
    text: 'oklch(0.3887 0.0052 301.05)',
    border: 'oklch(0.8643 0.0017 67.13)'
  },
  tag: {
    bg: 'oklch(0.9619 0.0180 272.28)',
    text: 'oklch(0.4788 0.1814 280.04)',
    border: 'oklch(0.7853 0.1042 274.71)'
  }
};

export const dayColors: DayColors = {
  today: 'oklch(0.6272 0.1917 24.54)',
  monday: 'oklch(0.7463 0.1550 72.02)',
  tuesday: 'oklch(0.6345 0.2004 15.44)',
  wednesday: 'oklch(0.6981 0.1758 150.49)',
  thursday: 'oklch(0.6129 0.1750 259.87)',
  friday: 'oklch(0.6212 0.2186 304.36)',
  saturday: 'oklch(0.6867 0.1727 49.09)',
  sunday: 'oklch(0.6464 0.1975 353.62)'
};

export const fontFamilies: FontFamilies = {
  sans: "'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif",
  mono: "'Courier New', monospace",
  code: "'Overpass Mono', 'SF Mono', 'JetBrains Mono NF', monospace",
  serif: 'Georgia, serif'
};

export const typeScale: TypeScale = {
  xxs: '0.6875rem',
  xs: '0.75rem',
  sm: '0.84375rem',
  smPlus: '0.875rem',
  base: '0.9375rem',
  md: '1rem',
  lg: '1.125rem',
  xl: '1.25rem',
  '2xl': '1.5rem',
  '25xl': '1.65rem',
  '3xl': '1.875rem',
  '35xl': '2rem',
  '4xl': '2.25rem',
  '5xl': '3rem'
};

export const fontWeights: FontWeights = {
  extralight: 200,
  light: 300,
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700
};

export const lineHeights: LineHeights = {
  xxs: '0.875rem',
  xs: '1rem',
  sm: '1.2rem',
  smPlus: '1.25rem',
  base: '1.325rem',
  md: '1.5rem',
  lg: '1.625rem',
  xl: '1.75rem'
};

export const letterSpacing: LetterSpacing = {
  tighter: '-0.05em',
  tight: '-0.025em',
  wide: '0.025em',
  wider: '0.05em'
};

export const spacingScale: SpacingScale = {
  '0': '0',
  px: '1px',
  '0-5': '0.125rem',
  '1': '0.25rem',
  '1-5': '0.375rem',
  '2': '0.5rem',
  '2-5': '0.625rem',
  '3': '0.75rem',
  '3-5': '0.875rem',
  '4': '1rem',
  '5': '1.25rem',
  '6': '1.5rem',
  '8': '2rem',
  '10': '2.5rem',
  '12': '3rem',
  '16': '4rem'
};

export const radiusScale: RadiusScale = {
  sm: '0.25rem',
  small: '0.3rem',
  md: '0.375rem',
  base: '0.5rem',
  lg: '0.5rem',
  xl: '0.75rem',
  '2xl': '1rem',
  '3xl': '1.5rem',
  full: '9999px'
};

export const shadowScale: ShadowScale = {
  xs: '0 1px 2px #00000001, 0 2px 4px #00000003, 0 3px 6px #00000001',
  sm: '0 2px 3px #00000002, 0 3px 6px #00000004, 0 5px 9px #00000002',
  default: '0 3px 5px #00000003, 0 5px 10px #00000005, 0 10px 14px #00000003',
  md: '0 4px 7px #00000003, 0 7px 14px #00000006, 0 14px 20px #00000003',
  lg: '0 6px 10px #00000004, 0 10px 20px #00000008, 0 20px 28px #00000004',
  xl: '0 8px 14px #00000005, 0 14px 28px #0000000a, 0 28px 40px #00000005',
  '2xl': '0 12px 20px #00000006, 0 20px 40px #0000000d, 0 40px 56px #00000006',
  '3xl': '0 16px 28px #00000008, 0 28px 56px #0000000f, 0 56px 80px #00000008'
};

export const blurScale: BlurScale = {
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '24px'
};

export const motionTokens: MotionTokens = {
  duration: '0.15s',
  ease: 'cubic-bezier(.4,0,.2,1)',
  easeIn: 'cubic-bezier(.4,0,1,1)',
  easeOut: 'cubic-bezier(0,0,.2,1)'
};

export const elementHeights: ElementHeights = {
  xs: '1.375rem',
  sm: '1.75rem',
  base: '2rem',
  md: '1.5rem',
  lg: '2.25rem'
};

export const layoutTokens: LayoutTokens = {
  sidebarWidth: '288px',
  rightPanelWidth: '431px'
};

// ═══════════════════════════════════════════════════════════
// LIGHT THEME
// ═══════════════════════════════════════════════════════════

export const lightSemanticColors: SemanticColorTokens = {
  bg: {
    back: 'oklch(0.9856 0.0016 67.00)',
    base: 'oklch(1.0000 0.0001 263.28)',
    baseHover: 'oklch(0.9856 0.0016 67.00)',
    front: 'oklch(1.0000 0.0001 263.28)',
    frontHover: 'oklch(0.9856 0.0016 67.00)',
    el: 'oklch(0.9676 0.0016 67.02)',
    elHover: 'oklch(0.9406 0.0016 67.05)',
    elSubtle: 'oklch(1.0000 0.0001 263.28)',
    elSubtleHover: 'oklch(0.9676 0.0016 67.02)',
    elActive: 'oklch(0.9163 0.0017 67.07)',
    elStrong: 'oklch(0.9163 0.0017 67.07)',
    buttonPrimary: 'oklch(0.3887 0.0052 301.05)',
    buttonPrimaryHover: 'oklch(0.4668 0.0039 16.75)',
    input: 'oklch(1.0000 0.0001 263.28)',
    inputHover: 'oklch(0.9856 0.0016 67.00)',
    state: 'oklch(1.0000 0.0001 263.28)',
    stateHover: 'oklch(0.9856 0.0016 67.00)',
    stateActive: 'oklch(0.4668 0.0039 16.75)'
  },
  text: {
    primary: 'oklch(0.2191 0.0058 285.84)',
    secondary: 'oklch(0.3887 0.0052 301.05)',
    subtle: 'oklch(0.5725 0.0051 33.89)',
    stateActive: 'oklch(0.2191 0.0058 285.84)',
    buttonPrimary: 'oklch(0.9676 0.0016 67.02)',
    buttonPrimaryHover: 'oklch(1.0000 0.0001 263.28)'
  },
  border: {
    base: 'oklch(0.9163 0.0017 67.07)',
    baseStrong: 'oklch(0.8643 0.0017 67.13)',
    front: 'oklch(0.9163 0.0017 67.07)',
    frontStrong: 'oklch(0.8643 0.0017 67.13)',
    el: 'oklch(0.8643 0.0017 67.13)',
    elHover: 'oklch(0.7161 0.0060 30.59)',
    elSubtle: 'oklch(0.9163 0.0017 67.07)',
    state: 'oklch(0.8643 0.0017 67.13)',
    stateActive: 'oklch(0.7161 0.0060 30.59)',
    buttonPrimary: 'oklch(0.2987 0.0072 285.88)'
  },
  misc: {
    placeholder: 'oklch(0.5725 0.0051 33.89)',
    link: 'oklch(0.6129 0.1750 259.87)',
    linkHover: 'oklch(0.7137 0.1435 254.63)',
    internalLink: 'oklch(0.3887 0.0052 301.05)',
    quoteLine: 'oklch(0.7161 0.0060 30.59)',
    horizontalLine: 'oklch(0.8643 0.0017 67.13)',
    codeBg: 'oklch(0.9916 0.0016 67.00)',
    codeText: 'oklch(0.2191 0.0058 285.84)',
    codeBorder: 'oklch(0.9163 0.0017 67.07)',
    ringActive: 'oklch(0.7161 0.0060 30.59)',
    scrollbarThumb: 'oklch(0.8643 0.0017 67.13)',
    scrollbarTrack: 'transparent'
  }
};

// ═══════════════════════════════════════════════════════════
// DARK THEME
// ═══════════════════════════════════════════════════════════

export const darkSemanticColors: SemanticColorTokens = {
  bg: {
    back: '#1a1a1e',
    base: '#242428',
    baseHover: '#2a2a2e',
    front: '#2a2a2e',
    frontHover: '#333338',
    el: '#3c3c42',
    elHover: '#424248',
    elSubtle: '#2a2a2e',
    elSubtleHover: '#333338',
    elActive: '#4d4d52',
    elStrong: '#4d4d52',
    buttonPrimary: '#e5e5e3',
    buttonPrimaryHover: '#ffffff',
    input: '#2a2a2e',
    inputHover: '#333338',
    state: '#2a2a2e',
    stateHover: '#333338',
    stateActive: '#e5e5e3'
  },
  text: {
    primary: '#ffffff',
    secondary: '#a8a8a2',
    subtle: '#6e6e68',
    stateActive: '#1a1a1e',
    buttonPrimary: '#1a1a1e',
    buttonPrimaryHover: '#000000'
  },
  border: {
    base: '#3c3c42',
    baseStrong: '#525258',
    front: '#3c3c42',
    frontStrong: '#525258',
    el: '#525258',
    elHover: '#6e6e68',
    elSubtle: '#3c3c42',
    state: '#525258',
    stateActive: '#a8a8a2',
    buttonPrimary: '#e5e5e3'
  },
  misc: {
    placeholder: '#6e6e68',
    link: '#8ab4f8',
    linkHover: '#afc9f8',
    internalLink: '#e5e5e3',
    quoteLine: '#6e6e68',
    horizontalLine: '#3c3c42',
    codeBg: '#1a1a1e',
    codeText: '#e5e5e3',
    codeBorder: '#3c3c42',
    ringActive: '#6e6e68',
    scrollbarThumb: '#3c3c42',
    scrollbarTrack: 'transparent'
  }
};

// ═══════════════════════════════════════════════════════════
// THEME ASSEMBLY
// ═══════════════════════════════════════════════════════════

export function getSemanticColors(mode: OrbitThemeMode): SemanticColorTokens {
  return mode === 'light' ? lightSemanticColors : darkSemanticColors;
}

export function getDesignTokens(mode: OrbitThemeMode): OrbitDesignTokens {
  return {
    semantic: getSemanticColors(mode),
    objectTypes: objectTypeColors,
    dayColors,
    typography: {
      fontFamily: fontFamilies,
      typeScale,
      fontWeight: fontWeights,
      lineHeight: lineHeights,
      letterSpacing
    },
    spacing: spacingScale,
    radius: radiusScale,
    shadow: shadowScale,
    blur: blurScale,
    motion: motionTokens,
    elementHeights,
    layout: layoutTokens
  };
}

// ═══════════════════════════════════════════════════════════
// CSS VARIABLE GENERATION
// ═══════════════════════════════════════════════════════════

function semanticColorsToCSSVars(colors: SemanticColorTokens): Record<string, string> {
  return {
    '--bg-back': colors.bg.back,
    '--bg-base': colors.bg.base,
    '--bg-base-hover': colors.bg.baseHover,
    '--bg-front': colors.bg.front,
    '--bg-front-hover': colors.bg.frontHover,
    '--bg-el': colors.bg.el,
    '--bg-el-hover': colors.bg.elHover,
    '--bg-el-subtle': colors.bg.elSubtle,
    '--bg-el-subtle-hover': colors.bg.elSubtleHover,
    '--bg-el-active': colors.bg.elActive,
    '--bg-el-strong': colors.bg.elStrong,
    '--bg-button-primary': colors.bg.buttonPrimary,
    '--bg-button-primary-hover': colors.bg.buttonPrimaryHover,
    '--bg-input': colors.bg.input,
    '--bg-input-hover': colors.bg.inputHover,
    '--bg-state': colors.bg.state,
    '--bg-state-hover': colors.bg.stateHover,
    '--bg-state-active': colors.bg.stateActive,
    '--text-primary': colors.text.primary,
    '--text-secondary': colors.text.secondary,
    '--text-subtle': colors.text.subtle,
    '--text-state-active': colors.text.stateActive,
    '--text-button-primary': colors.text.buttonPrimary,
    '--text-button-primary-hover': colors.text.buttonPrimaryHover,
    '--border-base': colors.border.base,
    '--border-base-strong': colors.border.baseStrong,
    '--border-front': colors.border.front,
    '--border-front-strong': colors.border.frontStrong,
    '--border-el': colors.border.el,
    '--border-el-hover': colors.border.elHover,
    '--border-el-subtle': colors.border.elSubtle,
    '--border-state': colors.border.state,
    '--border-state-active': colors.border.stateActive,
    '--border-button-primary': colors.border.buttonPrimary,
    '--color-placeholder': colors.misc.placeholder,
    '--color-link': colors.misc.link,
    '--color-link-hover': colors.misc.linkHover,
    '--color-internal-link': colors.misc.internalLink,
    '--color-quote-line': colors.misc.quoteLine,
    '--color-horizontal-line': colors.misc.horizontalLine,
    '--code-bg': colors.misc.codeBg,
    '--code-text': colors.misc.codeText,
    '--code-border': colors.misc.codeBorder,
    '--ring-active': colors.misc.ringActive,
    '--scrollbar-thumb': colors.misc.scrollbarThumb,
    '--scrollbar-track': colors.misc.scrollbarTrack
  };
}

function constantColorsToCSSVars(): Record<string, string> {
  return {
    '--type-project-bg': objectTypeColors.project.bg,
    '--type-project-text': objectTypeColors.project.text,
    '--type-project-border': objectTypeColors.project.border,
    '--type-quote-bg': objectTypeColors.quote.bg,
    '--type-quote-text': objectTypeColors.quote.text,
    '--type-quote-border': objectTypeColors.quote.border,
    '--type-atomic-bg': objectTypeColors.atomic.bg,
    '--type-atomic-text': objectTypeColors.atomic.text,
    '--type-atomic-border': objectTypeColors.atomic.border,
    '--type-daily-bg': objectTypeColors.daily.bg,
    '--type-daily-text': objectTypeColors.daily.text,
    '--type-daily-border': objectTypeColors.daily.border,
    '--type-page-bg': objectTypeColors.page.bg,
    '--type-page-text': objectTypeColors.page.text,
    '--type-page-border': objectTypeColors.page.border,
    '--type-tag-bg': objectTypeColors.tag.bg,
    '--type-tag-text': objectTypeColors.tag.text,
    '--type-tag-border': objectTypeColors.tag.border,
    '--color-today': dayColors.today,
    '--color-monday': dayColors.monday,
    '--color-tuesday': dayColors.tuesday,
    '--color-wednesday': dayColors.wednesday,
    '--color-thursday': dayColors.thursday,
    '--color-friday': dayColors.friday,
    '--color-saturday': dayColors.saturday,
    '--color-sunday': dayColors.sunday
  };
}

function foundationToCSSVars(): Record<string, string> {
  return {
    // Font families
    '--font-sans': fontFamilies.sans,
    '--font-mono': fontFamilies.mono,
    '--font-code': fontFamilies.code,
    '--font-serif': fontFamilies.serif,
    // Type scale
    '--text-xxs': typeScale.xxs,
    '--text-xs': typeScale.xs,
    '--text-sm': typeScale.sm,
    '--text-sm-plus': typeScale.smPlus,
    '--text-base': typeScale.base,
    '--text-md': typeScale.md,
    '--text-lg': typeScale.lg,
    '--text-xl': typeScale.xl,
    '--text-2xl': typeScale['2xl'],
    '--text-25xl': typeScale['25xl'],
    '--text-3xl': typeScale['3xl'],
    '--text-35xl': typeScale['35xl'],
    '--text-4xl': typeScale['4xl'],
    '--text-5xl': typeScale['5xl'],
    // Font weights
    '--fw-extralight': String(fontWeights.extralight),
    '--fw-light': String(fontWeights.light),
    '--fw-normal': String(fontWeights.normal),
    '--fw-medium': String(fontWeights.medium),
    '--fw-semibold': String(fontWeights.semibold),
    '--fw-bold': String(fontWeights.bold),
    // Line heights
    '--lh-xxs': lineHeights.xxs,
    '--lh-xs': lineHeights.xs,
    '--lh-sm': lineHeights.sm,
    '--lh-sm-plus': lineHeights.smPlus,
    '--lh-base': lineHeights.base,
    '--lh-md': lineHeights.md,
    '--lh-lg': lineHeights.lg,
    '--lh-xl': lineHeights.xl,
    // Letter spacing
    '--tracking-tighter': letterSpacing.tighter,
    '--tracking-tight': letterSpacing.tight,
    '--tracking-wide': letterSpacing.wide,
    '--tracking-wider': letterSpacing.wider,
    // Spacing
    '--sp-0': spacingScale['0'],
    '--sp-px': spacingScale.px,
    '--sp-0-5': spacingScale['0-5'],
    '--sp-1': spacingScale['1'],
    '--sp-1-5': spacingScale['1-5'],
    '--sp-2': spacingScale['2'],
    '--sp-2-5': spacingScale['2-5'],
    '--sp-3': spacingScale['3'],
    '--sp-3-5': spacingScale['3-5'],
    '--sp-4': spacingScale['4'],
    '--sp-5': spacingScale['5'],
    '--sp-6': spacingScale['6'],
    '--sp-8': spacingScale['8'],
    '--sp-10': spacingScale['10'],
    '--sp-12': spacingScale['12'],
    '--sp-16': spacingScale['16'],
    // Radius
    '--r-sm': radiusScale.sm,
    '--r-small': radiusScale.small,
    '--r-md': radiusScale.md,
    '--r-base': radiusScale.base,
    '--r-lg': radiusScale.lg,
    '--r-xl': radiusScale.xl,
    '--r-2xl': radiusScale['2xl'],
    '--r-3xl': radiusScale['3xl'],
    '--r-full': radiusScale.full,
    // Shadows
    '--shadow-xs': shadowScale.xs,
    '--shadow-sm': shadowScale.sm,
    '--shadow': shadowScale.default,
    '--shadow-md': shadowScale.md,
    '--shadow-lg': shadowScale.lg,
    '--shadow-xl': shadowScale.xl,
    '--shadow-2xl': shadowScale['2xl'],
    '--shadow-3xl': shadowScale['3xl'],
    // Blur
    '--blur-sm': blurScale.sm,
    '--blur-md': blurScale.md,
    '--blur-lg': blurScale.lg,
    '--blur-xl': blurScale.xl,
    // Motion
    '--duration': motionTokens.duration,
    '--ease': motionTokens.ease,
    '--ease-in': motionTokens.easeIn,
    '--ease-out': motionTokens.easeOut,
    // Element heights
    '--h-xs': elementHeights.xs,
    '--h-sm': elementHeights.sm,
    '--h-base': elementHeights.base,
    '--h-md': elementHeights.md,
    '--h-lg': elementHeights.lg,
    // Layout
    '--sidebar-w': layoutTokens.sidebarWidth,
    '--right-panel-w': layoutTokens.rightPanelWidth
  };
}

/** Generate all CSS custom properties for a given theme mode. */
export function generateCSSVariables(mode: OrbitThemeMode): Record<string, string> {
  return {
    ...foundationToCSSVars(),
    ...constantColorsToCSSVars(),
    ...semanticColorsToCSSVars(getSemanticColors(mode))
  };
}

/** Generate a complete CSS stylesheet string with :root, [data-theme] selectors. */
export function generateStylesheet(): string {
  const rootVars = foundationToCSSVars();
  const constantVars = constantColorsToCSSVars();
  const lightVars = semanticColorsToCSSVars(lightSemanticColors);
  const darkVars = semanticColorsToCSSVars(darkSemanticColors);

  const toCSS = (vars: Record<string, string>, indent = '  ') =>
    Object.entries(vars).map(([k, v]) => `${indent}${k}: ${v};`).join('\n');

  return `/* Orbit Design System — auto-generated tokens */
:root {
${toCSS(rootVars)}
${toCSS(constantVars)}
}

[data-theme="light"] {
${toCSS(lightVars)}
}

[data-theme="dark"] {
${toCSS(darkVars)}
}
`;
}

// ═══════════════════════════════════════════════════════════
// BACKWARD-COMPATIBLE EXPORTS (legacy API)
// ═══════════════════════════════════════════════════════════

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

export interface OrbitThemeTokens {
  color: OrbitColorTokens;
  spacing: number[];
  radius: { sm: number; md: number; lg: number };
  shadow: { sm: string; md: string };
  typography: OrbitTypographyTokens;
  platforms: Record<
    OrbitPlatformFamily,
    { density: OrbitDensityTokens; listGap: number; cardPadding: number }
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
  radius: { sm: 8, md: 12, lg: 18 },
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
      density: { compact: 28, regular: 36, comfortable: 44, touchTarget: 44 },
      listGap: 12,
      cardPadding: 16
    },
    native: {
      density: { compact: 32, regular: 40, comfortable: 48, touchTarget: 48 },
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
