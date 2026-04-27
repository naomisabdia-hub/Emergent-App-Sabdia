import { useEffect, useState } from "react";
import { View, Text, ScrollView, Image, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "../../src/auth";
import { COLORS, SPACING, RADIUS, TOUCH, TYPE, statusColor } from "../../src/theme";

export default function AssetDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api } = useAuth();
  const router = useRouter();
  const [asset, setAsset] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get(`/assets/${id}`);
        setAsset(r.data);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }
  if (!asset) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={{ padding: SPACING.lg }}>Asset not found</Text>
      </SafeAreaView>
    );
  }

  const sc = statusColor(asset.status);
  const canCheckout = asset.status === "Available";
  const canCheckin = asset.status === "Checked Out";

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.topBar}>
        <TouchableOpacity testID="back-btn" onPress={() => router.back()} style={styles.iconBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>ASSET DETAIL</Text>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: SPACING.xxl + 80 }}>
        {asset.image_url ? (
          <Image source={{ uri: asset.image_url }} style={styles.hero} resizeMode="cover" />
        ) : (
          <View style={[styles.hero, { backgroundColor: COLORS.bg, alignItems: "center", justifyContent: "center" }]}>
            <MaterialCommunityIcons name="toolbox" size={64} color={COLORS.textMuted} />
          </View>
        )}

        <View style={styles.body}>
          <View style={[styles.statusPill, { backgroundColor: sc.bg, alignSelf: "flex-start" }]}>
            <Text style={[styles.statusPillText, { color: sc.fg }]}>{asset.status.toUpperCase()}</Text>
          </View>
          <Text style={styles.name}>{asset.name}</Text>
          <Text style={styles.assetId}>{asset.asset_id} · {asset.category}</Text>

          <View style={styles.specs}>
            <Spec label="Brand" value={asset.brand || "—"} />
            <Spec label="Model" value={asset.model || "—"} />
            <Spec label="Serial" value={asset.serial_no || "—"} />
            <Spec label="Location" value={asset.location || "—"} />
          </View>

          {asset.description ? (
            <View style={styles.descBox}>
              <Text style={styles.descLabel}>DESCRIPTION</Text>
              <Text style={styles.descText}>{asset.description}</Text>
            </View>
          ) : null}

          {asset.last_checked_out_by ? (
            <View style={styles.lastBox}>
              <MaterialCommunityIcons name="account-clock" size={20} color={COLORS.textSecondary} />
              <Text style={styles.lastText}>
                Last checkout: <Text style={{ fontWeight: "800" }}>{asset.last_checked_out_by}</Text>
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {canCheckout && (
          <TouchableOpacity
            testID="detail-checkout-btn"
            style={styles.primaryBtn}
            onPress={() => router.push({ pathname: "/checkout", params: { assetId: asset.id } })}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="arrow-up-box" size={22} color={COLORS.textInverse} />
            <Text style={styles.primaryBtnText}>CHECK OUT</Text>
          </TouchableOpacity>
        )}
        {canCheckin && (
          <TouchableOpacity
            testID="detail-checkin-btn"
            style={[styles.primaryBtn, { backgroundColor: COLORS.text }]}
            onPress={() => router.push({ pathname: "/checkin", params: { assetId: asset.id } })}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="arrow-down-box" size={22} color={COLORS.textInverse} />
            <Text style={styles.primaryBtnText}>CHECK IN</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          testID="detail-book-btn"
          style={[styles.primaryBtn, { backgroundColor: COLORS.surface, borderWidth: 2, borderColor: COLORS.text }]}
          onPress={() => router.push({ pathname: "/booking", params: { assetId: asset.id } })}
          activeOpacity={0.85}
        >
          <MaterialCommunityIcons name="calendar-plus" size={22} color={COLORS.text} />
          <Text style={[styles.primaryBtnText, { color: COLORS.text }]}>BOOK</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function Spec({ label, value }: any) {
  return (
    <View style={styles.spec}>
      <Text style={styles.specLabel}>{label.toUpperCase()}</Text>
      <Text style={styles.specValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.bg },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  iconBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  topBarTitle: { ...TYPE.label },
  hero: { width: "100%", height: 280 },
  body: { padding: SPACING.lg, gap: SPACING.md },
  statusPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 2 },
  statusPillText: { fontSize: 11, fontWeight: "900", letterSpacing: 1 },
  name: { ...TYPE.h2 },
  assetId: { ...TYPE.bodyMuted },
  specs: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.md, marginTop: SPACING.sm },
  spec: { flexBasis: "47%", flexGrow: 1, backgroundColor: COLORS.surface, padding: SPACING.md, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.border, gap: 4 },
  specLabel: { ...TYPE.label, color: COLORS.textMuted },
  specValue: { ...TYPE.body, fontWeight: "700" },
  descBox: { backgroundColor: COLORS.surface, padding: SPACING.md, borderRadius: RADIUS.sm, gap: 6, borderWidth: 1, borderColor: COLORS.border },
  descLabel: { ...TYPE.label },
  descText: { ...TYPE.body },
  lastBox: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, padding: SPACING.md, backgroundColor: COLORS.warningBg, borderRadius: RADIUS.sm },
  lastText: { ...TYPE.body, color: COLORS.warningText, flex: 1 },
  footer: {
    position: "absolute", left: 0, right: 0, bottom: 0,
    flexDirection: "row", padding: SPACING.md, gap: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderTopWidth: 2, borderTopColor: COLORS.borderHeavy,
  },
  primaryBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: COLORS.primary, minHeight: TOUCH, borderRadius: RADIUS.sm,
  },
  primaryBtnText: { color: COLORS.textInverse, fontWeight: "900", letterSpacing: 1, fontSize: 14 },
});
