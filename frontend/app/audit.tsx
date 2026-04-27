import { useEffect, useState } from "react";
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "../src/auth";
import { COLORS, SPACING, RADIUS, TYPE } from "../src/theme";

export default function Audit() {
  const router = useRouter();
  const { api } = useAuth();
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get("/audit");
        setItems(r.data);
      } catch (e) {
        console.warn("audit", e);
      }
    })();
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} testID="audit-back">
          <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>AUDIT TRAIL</Text>
        <View style={{ width: 44 }} />
      </View>
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: SPACING.md, gap: SPACING.sm }}
        renderItem={({ item }) => (
          <View testID={`audit-${item.id}`} style={styles.card}>
            <View style={styles.head}>
              <Text style={styles.action}>{(item.action || "").toUpperCase().replace("_", " ")}</Text>
              <Text style={styles.time}>{fmt(item.timestamp)}</Text>
            </View>
            <Text style={styles.assetName} numberOfLines={1}>{item.asset_name || item.entity}</Text>
            <Text style={styles.meta}>{item.user_name} {item.details ? "· " + item.details : ""}</Text>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No audit entries</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

function fmt(d?: string) {
  if (!d) return "";
  try { return new Date(d).toLocaleString(); } catch { return d; }
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: SPACING.md, backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  iconBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  topTitle: { ...TYPE.h3, letterSpacing: 1 },
  card: { backgroundColor: COLORS.surface, padding: SPACING.md, borderRadius: RADIUS.sm, gap: 4, borderWidth: 1, borderColor: COLORS.border },
  head: { flexDirection: "row", justifyContent: "space-between" },
  action: { ...TYPE.label, color: COLORS.primary },
  time: { ...TYPE.label, color: COLORS.textMuted },
  assetName: { ...TYPE.body, fontWeight: "800" },
  meta: { ...TYPE.bodyMuted },
  empty: { padding: SPACING.xl, alignItems: "center" },
  emptyText: { ...TYPE.bodyMuted },
});
