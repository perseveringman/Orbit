import {
  createWorkbenchShellViewModel,
  type ReaderArticleSummary,
  type WorkbenchShellViewModel,
  type WorkspaceSection
} from '@orbit/app-viewmodels';
import { createTranslator, type LocaleCode } from '@orbit/i18n';
import {
  createNativeScreenScaffold,
  createNativeThemeContract,
  type NativeScreenScaffold,
  type NativeThemeContract
} from '@orbit/ui-native';

export interface MobileHost {
  kind: 'ios';
  navigationStyle: 'stack' | 'split';
}

export interface MobileFeatureInput {
  host: MobileHost;
  locale: LocaleCode;
  activeSection: WorkspaceSection;
  searchQuery: string;
  articles: ReaderArticleSummary[];
}

export interface MobileFeatureModule {
  host: MobileHost;
  hostKind: 'ios';
  shell: WorkbenchShellViewModel;
  theme: NativeThemeContract;
  tabs: Array<{
    id: 'home' | 'library';
    label: string;
  }>;
  screens: {
    home: NativeScreenScaffold & { articleCount: number };
    library: NativeScreenScaffold & { totalCount: number };
    reader: {
      kind: 'native-reader';
      articleIds: string[];
      emptyState: string;
      navigationStyle: MobileHost['navigationStyle'];
    };
  };
}

export function createMobileFeatureModule(input: MobileFeatureInput): MobileFeatureModule {
  const translator = createTranslator(input.locale);
  const shell = createWorkbenchShellViewModel({
    locale: input.locale,
    activeSection: input.activeSection,
    searchQuery: input.searchQuery,
    articles: input.articles
  });

  return {
    host: input.host,
    hostKind: 'ios',
    shell,
    theme: createNativeThemeContract(),
    tabs: [
      {
        id: 'home',
        label: translator.t('mobile.tab.home')
      },
      {
        id: 'library',
        label: translator.t('mobile.tab.library')
      }
    ],
    screens: {
      home: {
        ...createNativeScreenScaffold(translator.t('mobile.tab.home'), shell.searchPlaceholder),
        articleCount: shell.filteredArticles.length
      },
      library: {
        ...createNativeScreenScaffold(translator.t('mobile.tab.library'), shell.title),
        totalCount: input.articles.length
      },
      reader: {
        kind: 'native-reader',
        articleIds: shell.filteredArticles.map((article) => article.id),
        emptyState: shell.emptyState,
        navigationStyle: input.host.navigationStyle
      }
    }
  };
}

export function mountMobileFeature(input: MobileFeatureInput): MobileFeatureModule {
  return createMobileFeatureModule(input);
}
