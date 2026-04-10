import { createNativeThemeContract, type NativeThemeContract } from './native-theme';
import type { OrbitThemeMode } from '@orbit/ui-tokens';

export interface NativeScreenScaffold {
  kind: 'native-screen';
  header: {
    title: string;
    subtitle?: string;
  };
  theme: NativeThemeContract;
  components: {
    container: 'ScrollView';
    card: 'Pressable';
    text: 'Text';
  };
}

export function createNativeScreenScaffold(
  title: string,
  subtitle?: string,
  mode?: OrbitThemeMode
): NativeScreenScaffold {
  return {
    kind: 'native-screen',
    header: {
      title,
      subtitle
    },
    theme: createNativeThemeContract(mode),
    components: {
      container: 'ScrollView',
      card: 'Pressable',
      text: 'Text'
    }
  };
}
