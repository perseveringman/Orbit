import { Stack } from "expo-router";

export default function RootLayout(): JSX.Element {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: "#0f172a"
        },
        headerTintColor: "#f8fafc",
        contentStyle: {
          backgroundColor: "#020617"
        }
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: "Orbit iOS 宿主"
        }}
      />
    </Stack>
  );
}
