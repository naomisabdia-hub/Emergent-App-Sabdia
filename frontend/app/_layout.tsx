import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "../src/auth";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#F3F4F6" } }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="login" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="asset/[id]" options={{ presentation: "card" }} />
            <Stack.Screen name="checkout" options={{ presentation: "modal" }} />
            <Stack.Screen name="checkin" options={{ presentation: "modal" }} />
            <Stack.Screen name="booking" options={{ presentation: "modal" }} />
            <Stack.Screen name="approvals" />
            <Stack.Screen name="audit" />
          </Stack>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
