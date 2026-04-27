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
};

type Cat = { id: string; name: string };

export default function Assets() {
  const { api } = useAuth();
  const router = useRouter();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [q, setQ] = useState("");
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const params: any = {};
    if (activeCat) params.category = activeCat;
    if (q) params.q = q;
    const [aRes, cRes] = await Promise.all([
      api.get<Asset[]>("/assets", { params }),
      cats.length ? Promise.resolve({ data: cats }) : api.get<Cat[]>("/categories"),
    ]);
    setAssets(aRes.data);
    if (!cats.length) setCats((cRes as any).data);
  }, [api, activeCat, q]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>ASSET REGISTER</Text>
        <Text style={styles.subtitle}>{assets.length} items</Text>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <MaterialCommunityIcons name="magnify" size={22} color={COLORS.textMuted} />
          <TextInput
            testID="assets-search-input"
            value={q}
            onChangeText={setQ}
            placeholder="Search assets…"
            placeholderTextColor={COLORS.textMuted}
            style={styles.searchInput}
            returnKeyType="search"
          />
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catRow}>
        <CatChip label="ALL" active={!activeCat} onPress={() => setActiveCat(null)} testID="cat-all" />
        {cats.map((c) => (
          <CatChip key={c.id} label={c.name} active={activeCat === c.name} onPress={() => setActiveCat(c.name)} testID={`cat-${c.name.replace(/\s+/g, "-").toLowerCase()}`} />
        ))}
      </ScrollView>

      <FlatList
        data={assets}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: SPACING.md, gap: SPACING.sm, paddingBottom: SPACING.xxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        renderItem={({ item }) => {
          const sc = statusColor(item.status);
          return (
            <TouchableOpacity
              testID={`asset-item-${item.asset_id}`}
              style={styles.item}
              onPress={() => router.push(`/asset/${item.id}`)}
              activeOpacity={0.85}
            >
              {item.image_url ? (
                <Image source={{ uri: item.image_url }} style={styles.thumb} />
              ) : (
                <View style={[styles.thumb, { backgroundColor: COLORS.bg, alignItems: "center", justifyContent: "center" }]}>
                  <MaterialCommunityIcons name="toolbox" size={28} color={COLORS.textMuted} />
                </View>
              )}
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.itemMeta} numberOfLines={1}>
                  {item.brand || "—"} {item.model ? `· ${item.model}` : ""}
                </Text>
                <Text style={styles.itemId}>{item.asset_id} · {item.category}</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: sc.bg }]}>
                <Text style={[styles.badgeText, { color: sc.fg }]}>{item.status.toUpperCase()}</Text>
              </View>
            </TouchableOpacity>
          );
        }}
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

function CatChip({ label, active, onPress, testID }: any) {
  return (
    <TouchableOpacity testID={testID} onPress={onPress} style={[styles.chip, active && styles.chipActive]} activeOpacity={0.85}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: { paddingHorizontal: SPACING.md, paddingTop: SPACING.md },
  title: { ...TYPE.h2 },
  subtitle: { ...TYPE.label, color: COLORS.primary, marginTop: 2 },
  searchRow: { padding: SPACING.md },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.md,
    minHeight: TOUCH,
    gap: SPACING.sm,
  },
  searchInput: { flex: 1, fontSize: 16, color: COLORS.text },
  catRow: { paddingHorizontal: SPACING.md, gap: SPACING.sm, paddingBottom: SPACING.sm },
  chip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipActive: { backgroundColor: COLORS.text, borderColor: COLORS.text },
  chipText: { fontSize: 12, fontWeight: "800", color: COLORS.text, letterSpacing: 0.5 },
  chipTextActive: { color: COLORS.textInverse },
  item: {
    flexDirection: "row",
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    gap: SPACING.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: 88,
  },
  thumb: { width: 72, height: 72, borderRadius: RADIUS.sm },
  itemName: { fontSize: 15, fontWeight: "800", color: COLORS.text },
  itemMeta: { fontSize: 13, color: COLORS.textSecondary },
  itemId: { fontSize: 11, color: COLORS.textMuted, fontWeight: "700" },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 2 },
  badgeText: { fontSize: 10, fontWeight: "900", letterSpacing: 0.5 },
  empty: { alignItems: "center", padding: SPACING.xl, gap: SPACING.sm },
  emptyText: { ...TYPE.body, color: COLORS.textMuted },
});
