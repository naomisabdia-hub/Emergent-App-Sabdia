import { useEffect, useState, useCallback } from "react";
import { View, Text, FlatList, StyleSheet, RefreshControl, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "../../src/auth";
import { COLORS, SPACING, RADIUS, TYPE } from "../../src/theme";

type Checkout = {
  id: string;
  asset_name: string;
  asset_id: string;
  user_name: string;
  property: string;
  status: string;
  expected_return_date: string;
  timestamp_created: string;
  days_out?: number;
  overdue?: boolean;
  days_overdue?: number;
};

export default function Activity() {
  const { api, user } = useAuth();
  const [tab, setTab] = useState<"open" | "history">("open");
  const [items, setItems] = useState<Checkout[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const r = await api.get<Checkout[]>("/checkouts", { params: tab === "open" ? { open_only: true } : {} });
    setItems(r.data);
  }, [api, tab]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>ACTIVITY</Text>
        <Text style={styles.subtitle}>
          {user?.role === "trade" ? "Your equipment activity" : user?.role === "supervisor" ? "Activity at your property" : "All activity, all properties"}
        </Text>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity testID="tab-open" style={[styles.tab, tab === "open" && styles.tabActive]} onPress={() => setTab("open")}>
          <Text style={[styles.tabText, tab === "open" && styles.tabTextActive]}>OPEN</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="tab-history" style={[styles.tab, tab === "history" && styles.tabActive]} onPress={() => setTab("history")}>
          <Text style={[styles.tabText, tab === "history" && styles.tabTextActive]}>HISTORY</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: SPACING.md, gap: SPACING.sm, paddingBottom: SPACING.xxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        renderItem={({ item }) => {
          const overdue = item.overdue;
          const tone = item.status === "Closed" ? COLORS.success : overdue ? COLORS.danger : COLORS.info;
          return (
            <View testID={`activity-${item.id}`} style={[styles.item, { borderLeftColor: tone }]}>
              <View style={styles.itemHead}>
                <Text style={styles.itemName} numberOfLines={2}>{item.asset_name}</Text>
                <View style={[styles.statusPill, { backgroundColor: item.status === "Closed" ? COLORS.successBg : overdue ? COLORS.dangerBg : COLORS.infoBg }]}>
                  <Text style={[styles.statusPillText, { color: item.status === "Closed" ? COLORS.successText : overdue ? COLORS.dangerText : COLORS.infoText }]}>
                    {item.status === "Closed" ? "RETURNED" : overdue ? `${item.days_overdue}d OVERDUE` : "OPEN"}
                  </Text>
                </View>
              </View>
              <View style={styles.row}>
                <MaterialCommunityIcons name="account" size={16} color={COLORS.textSecondary} />
                <Text style={styles.metaText}>{item.user_name}</Text>
              </View>
              <View style={styles.row}>
                <MaterialCommunityIcons name="map-marker" size={16} color={COLORS.textSecondary} />
                <Text style={styles.metaText}>{item.property}</Text>
              </View>
              <View style={styles.row}>
                <MaterialCommunityIcons name="calendar-arrow-right" size={16} color={COLORS.textSecondary} />
                <Text style={styles.metaText}>Due {fmt(item.expected_return_date)}</Text>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons name="check-circle-outline" size={48} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>{tab === "open" ? "Nothing currently checked out" : "No history yet"}</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

function fmt(d?: string) {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString(); } catch { return d; }
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: { padding: SPACING.md },
  title: { ...TYPE.h2 },
  subtitle: { ...TYPE.bodyMuted, marginTop: 2 },
  tabs: { flexDirection: "row", paddingHorizontal: SPACING.md, gap: SPACING.sm, marginBottom: SPACING.sm },
  tab: { flex: 1, padding: 14, alignItems: "center", borderRadius: RADIUS.sm, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  tabActive: { backgroundColor: COLORS.text, borderColor: COLORS.text },
  tabText: { fontSize: 12, fontWeight: "800", letterSpacing: 1, color: COLORS.text },
  tabTextActive: { color: COLORS.textInverse },
  item: { backgroundColor: COLORS.surface, padding: SPACING.md, borderRadius: RADIUS.sm, borderLeftWidth: 5, gap: 6, borderWidth: 1, borderColor: COLORS.border },
  itemHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: SPACING.sm },
  itemName: { ...TYPE.body, fontWeight: "800", flex: 1 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 2 },
  statusPillText: { fontSize: 10, fontWeight: "900", letterSpacing: 0.5 },
  row: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  metaText: { ...TYPE.bodyMuted, color: COLORS.textSecondary },
  empty: { alignItems: "center", padding: SPACING.xl, gap: SPACING.sm },
  emptyText: { ...TYPE.body, color: COLORS.textMuted },
});
