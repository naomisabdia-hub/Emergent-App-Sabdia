import { useEffect, useState, useCallback } from "react";
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Alert, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "../src/auth";
import { COLORS, SPACING, RADIUS, TOUCH, TYPE } from "../src/theme";

export default function Approvals() {
  const router = useRouter();
  const { api } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const r = await api.get("/bookings", { params: { status_filter: "Pending" } });
    setItems(r.data);
  }, [api]);

  useEffect(() => { load(); }, [load]);

  const decide = async (id: string, action: "approve" | "reject") => {
    try {
      if (action === "reject") {
        await api.post(`/bookings/${id}/reject`, { rejection_reason: "Not available" });
      } else {
        await api.post(`/bookings/${id}/approve`);
      }
      await load();
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Failed");
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} testID="approvals-back">
          <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>PENDING APPROVALS</Text>
        <View style={{ width: 44 }} />
      </View>
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: SPACING.md, gap: SPACING.sm }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
        renderItem={({ item }) => (
          <View testID={`approval-${item.id}`} style={styles.card}>
            <Text style={styles.assetName}>{item.asset_name}</Text>
            <Text style={styles.meta}>{item.user_name} · {item.property}</Text>
            <Text style={styles.meta}>{item.start_date} → {item.end_date}</Text>
            {item.purpose ? <Text style={styles.purpose}>{item.purpose}</Text> : null}
            <View style={styles.btnRow}>
              <TouchableOpacity testID={`approve-${item.id}`} style={[styles.btn, { backgroundColor: COLORS.success }]} onPress={() => decide(item.id, "approve")}>
                <MaterialCommunityIcons name="check-bold" size={20} color={COLORS.textInverse} />
                <Text style={styles.btnText}>APPROVE</Text>
              </TouchableOpacity>
              <TouchableOpacity testID={`reject-${item.id}`} style={[styles.btn, { backgroundColor: COLORS.danger }]} onPress={() => decide(item.id, "reject")}>
                <MaterialCommunityIcons name="close-thick" size={20} color={COLORS.textInverse} />
                <Text style={styles.btnText}>REJECT</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons name="check-all" size={48} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>No pending approvals</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: SPACING.md, backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  iconBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  topTitle: { ...TYPE.h3, letterSpacing: 1 },
  card: { backgroundColor: COLORS.surface, padding: SPACING.md, borderRadius: RADIUS.sm, borderLeftWidth: 5, borderLeftColor: COLORS.info, gap: 4, borderWidth: 1, borderColor: COLORS.border },
  assetName: { ...TYPE.body, fontWeight: "900" },
  meta: { ...TYPE.bodyMuted },
  purpose: { ...TYPE.body, marginTop: 4, fontStyle: "italic" },
  btnRow: { flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.sm },
  btn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, minHeight: TOUCH, borderRadius: RADIUS.sm },
  btnText: { color: COLORS.textInverse, fontWeight: "900", letterSpacing: 1, fontSize: 13 },
  empty: { alignItems: "center", padding: SPACING.xl, gap: SPACING.sm },
  emptyText: { ...TYPE.body, color: COLORS.textMuted },
});
