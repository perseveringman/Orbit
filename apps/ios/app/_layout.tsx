import { Stack } from 'expo-router';
import type { TextStyle } from 'react-native';
import { createNativeThemeContract } from '@orbit/ui-native';

const theme = createNativeThemeContract('light');

export default function RootLayout(): JSX.Element {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.palette.bg.back,
        },
        headerTintColor: theme.palette.text.primary,
        headerTitleStyle: {
          fontWeight: theme.typography.fontWeight.semibold as TextStyle['fontWeight'],
          fontSize: theme.typography.fontSize.md,
        },
        contentStyle: {
          backgroundColor: theme.palette.bg.back,
        },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: 'Orbit',
        }}
      />
    </Stack>
  );
}
