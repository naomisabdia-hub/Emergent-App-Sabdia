import { Tabs } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect } from "react";
import { useRouter } from "expo-router";
import { COLORS } from "../../src/theme";
import { useAuth } from "../../src/auth";

export default function TabsLayout() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user === null) router.replace("/login");
  }, [user]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopWidth: 2,
          borderTopColor: COLORS.borderHeavy,
          height: 76,
          paddingBottom: 12,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5, textTransform: "uppercase" },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="view-dashboard-variant" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="assets"
        options={{
          title: "Assets",
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="toolbox" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="out"
        options={{
          title: "Out",
          tabBarLabel: "OUT",
          tabBarIcon: ({ focused }) => (
            <MaterialCommunityIcons
              name="arrow-up-bold-box"
              size={36}
              color={COLORS.primary}
              style={{ marginTop: -6 }}
            />
          ),
          tabBarLabelStyle: { fontSize: 10, fontWeight: "900", letterSpacing: 1, color: COLORS.primary },
        }}
      />
      <Tabs.Screen
        name="in"
        options={{
          title: "In",
          tabBarLabel: "IN",
          tabBarIcon: ({ focused }) => (
            <MaterialCommunityIcons
              name="arrow-down-bold-box"
              size={36}
              color={COLORS.text}
              style={{ marginTop: -6 }}
            />
          ),
          tabBarLabelStyle: { fontSize: 10, fontWeight: "900", letterSpacing: 1, color: COLORS.text },
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: "More",
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="dots-horizontal-circle" size={size} color={color} />,
        }}
      />
      <Tabs.Screen name="activity" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
    </Tabs>
  );
}
