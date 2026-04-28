import { useEffect, useState, useCallback } from "react";
import { View, Text, FlatList, TextInput, TouchableOpacity, Image, StyleSheet, RefreshControl, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "../../src/auth";
import { COLORS, SPACING, RADIUS, TOUCH, TYPE, statusColor } from "../../src/theme";

type Asset = {
  id: string;
  asset_id: string;
  name: string;
  brand?: string;
  model?: string;
  category: string;
  status: string;
  image_url?: string;
  location?: string;
  current_holder?: string | null;
  current_property?: string | null;
  expected_return_date?: string | null;
};

type Cat = { id: string; name: string };

export default function Assets() {
  const { api } = useAuth();
  const router = useRouter();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [q, setQ] = useState("");
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const params: any = {};
    if (activeCat) params.category = activeCat;
    if (q) params.q = q;
    if (statusFilter) params.status_filter = statusFilter;
    const [aRes, cRes] = await Promise.all([
      api.get<Asset[]>("/assets", { params }),
      cats.length ? Promise.resolve({ data: cats }) : api.get<Cat[]>("/categories"),
    ]);
    setAssets(aRes.data);
    if (!cats.length) setCats((cRes as any).data);
  }, [api, activeCat, q, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const counts = {
    total: assets.length,
    out: assets.filter((a) => a.status === "Checked Out").length,
    avail: assets.filter((a) => a.status === "Available").length,
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Asset Register</Text>
        <Text style={styles.subtitle}>{counts.total} items · {counts.avail} available · {counts.out} out</Text>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <MaterialCommunityIcons name="magnify" size={20} color={COLORS.textMuted} />
          <TextInput
            testID="assets-search-input"
            value={q}
            onChangeText={setQ}
            placeholder="Search by name, ID, or brand…"
            placeholderTextColor={COLORS.textMuted}
            style={styles.searchInput}
            returnKeyType="search"
          />
          {q ? (
            <TouchableOpacity onPress={() => setQ("")}>
              <MaterialCommunityIcons name="close-circle" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersRow}>
        <Chip label="All" active={!statusFilter && !activeCat} onPress={() => { setStatusFilter(null); setActiveCat(null); }} testID="filter-all" />
        <Chip label="Available" tone="success" active={statusFilter === "Available"} onPress={() => setStatusFilter(statusFilter === "Available" ? null : "Available")} testID="filter-available" />
        <Chip label="Checked Out" tone="danger" active={statusFilter === "Checked Out"} onPress={() => setStatusFilter(statusFilter === "Checked Out" ? null : "Checked Out")} testID="filter-out" />
        <Chip label="Maintenance" tone="muted" active={statusFilter === "Maintenance"} onPress={() => setStatusFilter(statusFilter === "Maintenance" ? null : "Maintenance")} testID="filter-maintenance" />
        <View style={{ width: 12 }} />
        {cats.map((c) => (
          <Chip key={c.id} label={c.name} active={activeCat === c.name} onPress={() => setActiveCat(activeCat === c.name ? null : c.name)} testID={`cat-${c.name.replace(/\s+/g, "-").toLowerCase()}`} />
        ))}
      </ScrollView>

      <FlatList
        data={assets}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: SPACING.md, gap: 10, paddingBottom: SPACING.xxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        renderItem={({ item }) => <AssetCard item={item} onPress={() => router.push(`/asset/${item.id}`)} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons name="toolbox-outline" size={48} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>No assets found</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

function AssetCard({ item, onPress }: { item: Asset; onPress: () => void }) {
  const sc = statusColor(item.status);
  const isOut = item.status === "Checked Out";
  return (
    <TouchableOpacity
      testID={`asset-item-${item.asset_id}`}
      style={[styles.card, isOut && { borderLeftColor: COLORS.danger, borderLeftWidth: 4 }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.cardTopRow}>
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} style={styles.thumb} />
        ) : (
          <View style={[styles.thumb, styles.thumbPlaceholder]}>
            <MaterialCommunityIcons name="toolbox" size={28} color={COLORS.textMuted} />
          </View>
        )}
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <Text style={styles.itemId}>{item.asset_id}</Text>
            <Text style={styles.dot}>·</Text>
            <Text style={styles.itemMeta}>{item.category}</Text>
          </View>
        </View>
        <View style={[styles.badge, { backgroundColor: sc.bg }]}>
          <Text style={[styles.badgeText, { color: sc.fg }]}>{item.status.toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <MaterialCommunityIcons name="map-marker" size={14} color={COLORS.textSecondary} />
          <Text style={styles.metaText} numberOfLines={1}>{item.current_property || item.location || "—"}</Text>
        </View>
        {isOut && item.current_holder ? (
          <View style={styles.metaItem}>
            <MaterialCommunityIcons name="account" size={14} color={COLORS.dangerText} />
            <Text style={[styles.metaText, { color: COLORS.dangerText, fontWeight: "700" }]} numberOfLines={1}>
              {item.current_holder}
            </Text>
          </View>
        ) : null}
        {isOut && item.expected_return_date ? (
          <View style={styles.metaItem}>
            <MaterialCommunityIcons name="calendar-clock" size={14} color={COLORS.warningText} />
            <Text style={[styles.metaText, { color: COLORS.warningText }]}>Due {item.expected_return_date}</Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

function Chip({ label, active, onPress, testID, tone }: { label: string; active?: boolean; onPress: () => void; testID?: string; tone?: "success" | "danger" | "muted" }) {
  let activeBg = COLORS.text, activeFg = COLORS.textInverse;
  if (tone === "success") { activeBg = COLORS.success; activeFg = "#FFFFFF"; }
  if (tone === "danger") { activeBg = COLORS.danger; activeFg = "#FFFFFF"; }
  if (tone === "muted") { activeBg = "#374151"; activeFg = "#FFFFFF"; }
  return (
    <TouchableOpacity testID={testID} onPress={onPress} style={[styles.chip, active && { backgroundColor: activeBg, borderColor: activeBg }]} activeOpacity={0.85}>
      <Text style={[styles.chipText, active && { color: activeFg }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: { paddingHorizontal: SPACING.md, paddingTop: SPACING.md },
  title: { fontSize: 28, fontWeight: "800", color: COLORS.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4, fontWeight: "600" },
  searchRow: { paddingHorizontal: SPACING.md, paddingTop: SPACING.sm },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 48,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 15, color: COLORS.text },
  filtersRow: { paddingHorizontal: SPACING.md, gap: 8, paddingVertical: SPACING.sm },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipText: { fontSize: 12, fontWeight: "700", color: COLORS.text },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  cardTopRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  thumb: { width: 56, height: 56, borderRadius: 8 },
  thumbPlaceholder: { backgroundColor: COLORS.bg, alignItems: "center", justifyContent: "center" },
  itemName: { fontSize: 15, fontWeight: "700", color: COLORS.text, lineHeight: 20 },
  itemMeta: { fontSize: 12, color: COLORS.textSecondary, fontWeight: "500" },
  itemId: { fontSize: 11, color: COLORS.textMuted, fontWeight: "700", letterSpacing: 0.3 },
  dot: { fontSize: 12, color: COLORS.textMuted },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  badgeText: { fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.border },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: "500", maxWidth: 160 },
  empty: { alignItems: "center", padding: SPACING.xl, gap: SPACING.sm },
  emptyText: { ...TYPE.body, color: COLORS.textMuted },
});
