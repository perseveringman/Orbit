import { enUSMessages } from './locales/en-US';
import { zhCNMessages } from './locales/zh-CN';
import { zhTWMessages } from './locales/zh-TW';

export type LocaleCode = 'zh-CN' | 'en-US' | 'zh-TW';
export type MessageKey = keyof typeof zhCNMessages;
export type MessageValues = Record<string, string | number>;

export interface OrbitTranslator {
  locale: LocaleCode;
  fallbackLocale: LocaleCode;
  t: (key: MessageKey, values?: MessageValues) => string;
}

const localeCatalogs: Record<LocaleCode, Record<MessageKey, string>> = {
  'zh-CN': zhCNMessages,
  'en-US': enUSMessages,
  'zh-TW': zhTWMessages
};

export function listSupportedLocales(): LocaleCode[] {
  return Object.keys(localeCatalogs) as LocaleCode[];
}

export function createLocaleCatalog(locale: LocaleCode): Record<MessageKey, string> {
  return localeCatalogs[locale];
}

function interpolate(template: string, values: MessageValues = {}): string {
  return Object.entries(values).reduce((result, [key, value]) => {
    return result.replaceAll(`{{${key}}}`, String(value));
  }, template);
}

export function createTranslator(locale: LocaleCode): OrbitTranslator {
  const fallbackLocale: LocaleCode = 'en-US';
  const localeCatalog = createLocaleCatalog(locale);
  const fallbackCatalog = createLocaleCatalog(fallbackLocale);

  return {
    locale,
    fallbackLocale,
    t(key, values) {
      const template = localeCatalog[key] ?? fallbackCatalog[key] ?? key;
      return interpolate(template, values);
    }
  };
}
