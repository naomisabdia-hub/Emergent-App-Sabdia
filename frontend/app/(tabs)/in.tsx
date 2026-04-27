import { useEffect } from "react";
import { useRouter } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { COLORS } from "../../src/theme";

export default function InTab() {
  const router = useRouter();
  useEffect(() => {
    const t = setTimeout(() => router.replace("/checkin"), 0);
    return () => clearTimeout(t);
  }, []);
  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator color={COLORS.primary} size="large" />
    </View>
  );
}
