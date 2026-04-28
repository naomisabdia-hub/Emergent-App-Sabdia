import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, RefreshControl, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "../src/auth";
import { COLORS, SPACING, RADIUS, TYPE } from "../src/theme";

type Item = {
  id: string;
  asset_id: string;
  asset_name: string;
  user_name: string;
  property: string;
  expected_return_date: string;
  days_until_due: number | null;
  is_overdue: boolean;
  is_due_today: boolean;
  is_due_soon: boolean;
  asset?: { name: string; asset_id: string; image_url?: string; category: string };
};

export default function EquipmentToReturn() {
  const router = useRouter();
  const { api, user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api.get<Item[]>("/dashboard/equipment-to-return");
      setItems(r.data);
    } catch (e) { console.warn(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, [api]);

  useEffect(() => { load(); }, [load]);

  const overdue = items.filter((i) => i.is_overdue);
  const dueToday = items.filter((i) => i.is_due_today);
  const dueSoon = items.filter((i) => i.is_due_soon);
  const upcoming = items.filter((i) => !i.is_overdue && !i.is_due_today && !i.is_due_soon);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Equipment to Return</Text>
        <View style={{ width: 44 }} />
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: SPACING.md, gap: 8, paddingBottom: SPACING.xxl }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={COLORS.primary} />}
          ListHeaderComponent={
            <View style={{ marginBottom: 12, gap: 8 }}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Stat label="Overdue" value={overdue.length} tone="danger" />
                <Stat label="Due Today" value={dueToday.length} tone="warning" />
                <Stat label="Due Soon" value={dueSoon.length} tone="info" />
              </View>
              <Text style={styles.sectionLabel}>{user?.role === "admin" ? "ALL CHECKED OUT" : "MY CHECKED OUT"}</Text>
            </View>
          }
          renderItem={({ item }) => <ReturnCard item={item} onPress={() => router.push({ pathname: "/checkin", params: { assetId: item.id } } as any)} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialCommunityIcons name="check-circle" size={48} color={COLORS.successText} />
              <Text style={styles.emptyText}>All clear — nothing to return</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "danger" | "warning" | "info" }) {
  const m = {
    danger: { bg: COLORS.dangerBg, fg: COLORS.dangerText, icon: "alert-octagon" as const },
    warning: { bg: COLORS.warningBg, fg: COLORS.warningText, icon: "clock-alert" as const },
    info: { bg: COLORS.infoBg, fg: COLORS.infoText, icon: "calendar-clock" as const },
  }[tone];
  return (
    <View style={[styles.statCard, { backgroundColor: m.bg }]}>
      <MaterialCommunityIcons name={m.icon} size={20} color={m.fg} />
      <Text style={[styles.statValue, { color: m.fg }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: m.fg }]}>{label}</Text>
    </View>
  );
}

function ReturnCard({ item, onPress }: { item: Item; onPress: () => void }) {
  let badgeColor = COLORS.infoBg, badgeFg = COLORS.infoText, badgeText = "ON TIME";
  if (item.is_overdue) { badgeColor = COLORS.dangerBg; badgeFg = COLORS.dangerText; badgeText = `${Math.abs(item.days_until_due || 0)}D OVERDUE`; }
  else if (item.is_due_today) { badgeColor = COLORS.warningBg; badgeFg = COLORS.warningText; badgeText = "DUE TODAY"; }
  else if (item.is_due_soon) { badgeColor = COLORS.warningBg; badgeFg = COLORS.warningText; badgeText = `${item.days_until_due}D LEFT`; }
  else if (item.days_until_due != null) { badgeText = `${item.days_until_due}D LEFT`; }

  return (
    <TouchableOpacity onPress={onPress} style={[styles.card, item.is_overdue && { borderLeftColor: COLORS.danger, borderLeftWidth: 4 }]} activeOpacity={0.85}>
      <View style={styles.cardLeft}>
        {item.asset?.image_url ? (
          <Image source={{ uri: item.asset.image_url }} style={styles.thumb} />
        ) : (
          <View style={[styles.thumb, styles.thumbPh]}>
            <MaterialCommunityIcons name="toolbox" size={24} color={COLORS.textMuted} />
          </View>
        )}
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={styles.itemName} numberOfLines={2}>{item.asset_name}</Text>
        <Text style={styles.itemMeta}>{item.asset_id} · {item.asset?.category || ""}</Text>
        <View style={styles.metaRow}>
          <MaterialCommunityIcons name="account" size={13} color={COLORS.textSecondary} />
          <Text style={styles.metaText}>{item.user_name}</Text>
        </View>
        <View style={styles.metaRow}>
          <MaterialCommunityIcons name="map-marker" size={13} color={COLORS.textSecondary} />
          <Text style={styles.metaText}>{item.property}</Text>
        </View>
        <View style={styles.metaRow}>
          <MaterialCommunityIcons name="calendar" size={13} color={COLORS.textSecondary} />
          <Text style={styles.metaText}>Due {item.expected_return_date}</Text>
        </View>
      </View>
      <View style={[styles.badge, { backgroundColor: badgeColor }]}>
        <Text style={[styles.badgeText, { color: badgeFg }]}>{badgeText}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: SPACING.md, backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  topTitle: { fontSize: 18, fontWeight: "800", color: COLORS.text },
  iconBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  statCard: { flex: 1, padding: 12, borderRadius: 10, alignItems: "center", gap: 4 },
  statValue: { fontSize: 22, fontWeight: "900" },
  statLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  sectionLabel: { fontSize: 11, fontWeight: "800", color: COLORS.textSecondary, letterSpacing: 1, marginTop: 8 },
  card: { flexDirection: "row", gap: 10, alignItems: "flex-start", backgroundColor: COLORS.surface, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border },
  cardLeft: { width: 56 },
  thumb: { width: 56, height: 56, borderRadius: 8 },
  thumbPh: { backgroundColor: COLORS.bg, alignItems: "center", justifyContent: "center" },
  itemName: { fontSize: 14, fontWeight: "700", color: COLORS.text, lineHeight: 18 },
  itemMeta: { fontSize: 11, color: COLORS.textMuted, fontWeight: "600", marginBottom: 2 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  metaText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: "500" },
  badge: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 4, alignSelf: "flex-start" },
  badgeText: { fontSize: 9, fontWeight: "900", letterSpacing: 0.5 },
  empty: { alignItems: "center", padding: SPACING.xl, gap: 12 },
  emptyText: { fontSize: 15, fontWeight: "600", color: COLORS.textSecondary },
});
