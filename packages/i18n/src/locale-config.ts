import type { LocaleCode } from './messages';

export type { LocaleCode };

/** The four locale dimensions per Orbit design */
export interface OrbitLocaleConfig {
  /** UI language for app chrome */
  readonly appLocale: LocaleCode;
  /** Content display locale (affects date formats in content) */
  readonly contentLocale: LocaleCode;
  /** Agent output language */
  readonly agentOutputLocale: LocaleCode;
  /** Search/indexing locale for stemming/tokenization */
  readonly searchLocale: LocaleCode;
}

export function createDefaultLocaleConfig(appLocale: LocaleCode): OrbitLocaleConfig {
  return { appLocale, contentLocale: appLocale, agentOutputLocale: appLocale, searchLocale: appLocale };
}

export function createLocaleConfig(overrides: Partial<OrbitLocaleConfig> & { appLocale: LocaleCode }): OrbitLocaleConfig {
  return { ...createDefaultLocaleConfig(overrides.appLocale), ...overrides };
}
