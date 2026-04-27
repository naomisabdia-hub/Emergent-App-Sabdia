import { Stack, useRouter, useSegments } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";
import { useEffect } from "react";
import { AuthProvider, useAuth } from "../src/auth";
import { COLORS } from "../src/theme";

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (user === undefined) return; // still loading
    const inAuthGroup = segments[0] === "login" || segments[0] === "index" || (segments as any).length === 0;
    if (!user && !inAuthGroup) {
      router.replace("/login");
    }
  }, [user, segments]);

  if (user === undefined) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.bg }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }
  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="dark" />
          <AuthGuard>
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
              <Stack.Screen name="users" />
            </Stack>
          </AuthGuard>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
