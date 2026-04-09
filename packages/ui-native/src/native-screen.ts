import { createNativeThemeContract, type NativeThemeContract } from './native-theme';

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

export function createNativeScreenScaffold(title: string, subtitle?: string): NativeScreenScaffold {
  return {
    kind: 'native-screen',
    header: {
      title,
      subtitle
    },
    theme: createNativeThemeContract(),
    components: {
      container: 'ScrollView',
      card: 'Pressable',
      text: 'Text'
    }
  };
}
