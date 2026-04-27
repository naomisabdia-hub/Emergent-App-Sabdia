import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "../../src/auth";
import { COLORS, SPACING, RADIUS, TOUCH, TYPE } from "../../src/theme";

type Summary = {
  total_assets: number;
  available: number;
  checked_out: number;
  maintenance: number;
  booked: number;
  open_checkouts: number;
  overdue: number;
  due_today: number;
  pending_bookings: number;
  my_open_checkouts: number;
};

export default function Dashboard() {
  const { user, api } = useAuth();
  const router = useRouter();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api.get<Summary>("/dashboard/summary");
      setSummary(r.data);
    } catch (e) {
      console.warn("dashboard load", e);
    }
  }, [api]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (!user) return null;

  const isAdminOrSup = user.role === "admin" || user.role === "supervisor";

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        testID="dashboard-screen"
      >
        <View style={styles.header}>
          <Text style={styles.greet}>{greet()}, </Text>
          <Text style={styles.name}>{user.full_name.split(" ")[0]}</Text>
          <Text style={styles.role}>{user.role.toUpperCase()} · {user.property_assignment || "—"}</Text>
        </View>

        <View style={styles.actionsRow}>
          <ActionTile
            testID="quick-checkout"
            icon="arrow-up-box"
            label="CHECK OUT"
            onPress={() => router.push("/checkout")}
            color={COLORS.primary}
          />
          <ActionTile
            testID="quick-checkin"
            icon="arrow-down-box"
            label="CHECK IN"
            onPress={() => router.push("/checkin")}
            color={COLORS.text}
          />
        </View>
        <View style={styles.actionsRow}>
          <ActionTile
            testID="quick-booking"
            icon="calendar-plus"
            label="SCHEDULE"
            onPress={() => router.push("/booking")}
            color={COLORS.info}
            small
          />
          <ActionTile
            testID="quick-scan"
            icon="qrcode-scan"
            label="SCAN QR"
            onPress={() => router.push("/checkout")}
            color={COLORS.text}
            small
            outline
          />
        </View>

        {summary && (
          <>
            <Text style={styles.sectionTitle}>OVERVIEW</Text>
            <View style={styles.grid}>
              <StatCard testID="stat-total" label="Total Assets" value={summary.total_assets} icon="toolbox" tone="default" />
              <StatCard testID="stat-available" label="Available" value={summary.available} icon="check-circle" tone="success" />
              <StatCard testID="stat-out" label="Checked Out" value={summary.checked_out} icon="arrow-up-box" tone="danger" />
              <StatCard testID="stat-maintenance" label="Maintenance" value={summary.maintenance} icon="wrench" tone="default" />
            </View>

            <Text style={styles.sectionTitle}>ALERTS</Text>
            <AlertCard
              testID="alert-overdue"
              icon="alert-octagon"
              count={summary.overdue}
              label="Overdue Items"
              tone="danger"
              onPress={() => router.push("/(tabs)/activity")}
            />
            <AlertCard
              testID="alert-due-today"
              icon="clock-alert"
              count={summary.due_today}
              label="Due Today"
              tone="warning"
              onPress={() => router.push("/(tabs)/activity")}
            />
            {isAdminOrSup && (
              <AlertCard
                testID="alert-pending"
                icon="clipboard-clock"
                count={summary.pending_bookings}
                label="Pending Approvals"
                tone="info"
                onPress={() => router.push("/approvals")}
              />
            )}
            {user.role === "trade" && (
              <AlertCard
                testID="alert-my-open"
                icon="account-clock"
                count={summary.my_open_checkouts}
                label="My Open Checkouts"
                tone="info"
                onPress={() => router.push("/(tabs)/activity")}
              />
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function greet() {
  const h = new Date().getHours();
  if (h < 12) return "Morning";
  if (h < 17) return "Afternoon";
  return "Evening";
}

function ActionTile({ icon, label, onPress, color, small, outline, testID }: any) {
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      style={[
        styles.action,
        small && { minHeight: 72 },
        outline ? { backgroundColor: COLORS.surface, borderWidth: 2, borderColor: color } : { backgroundColor: color },
      ]}
      activeOpacity={0.85}
    >
      <MaterialCommunityIcons name={icon} size={small ? 22 : 28} color={outline ? color : COLORS.textInverse} />
      <Text style={[styles.actionText, outline && { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function StatCard({ label, value, icon, tone, testID }: any) {
  const tones: any = {
    success: { bg: COLORS.successBg, fg: COLORS.successText, border: COLORS.success },
    danger: { bg: COLORS.dangerBg, fg: COLORS.dangerText, border: COLORS.danger },
    warning: { bg: COLORS.warningBg, fg: COLORS.warningText, border: COLORS.warning },
    info: { bg: COLORS.infoBg, fg: COLORS.infoText, border: COLORS.info },
    default: { bg: COLORS.surface, fg: COLORS.text, border: COLORS.borderHeavy },
  };
  const t = tones[tone] || tones.default;
  return (
    <View testID={testID} style={[styles.stat, { backgroundColor: t.bg, borderLeftColor: t.border }]}>
      <MaterialCommunityIcons name={icon} size={22} color={t.fg} />
      <Text style={[styles.statValue, { color: t.fg }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

function AlertCard({ icon, count, label, tone, onPress, testID }: any) {
  const tones: any = {
    danger: { bg: COLORS.dangerBg, fg: COLORS.dangerText, accent: COLORS.danger },
    warning: { bg: COLORS.warningBg, fg: COLORS.warningText, accent: COLORS.warning },
    info: { bg: COLORS.infoBg, fg: COLORS.infoText, accent: COLORS.info },
  };
  const t = tones[tone];
  return (
    <TouchableOpacity testID={testID} onPress={onPress} style={[styles.alert, { backgroundColor: t.bg, borderLeftColor: t.accent }]} activeOpacity={0.85}>
      <View style={[styles.alertIconBox, { backgroundColor: t.accent }]}>
        <MaterialCommunityIcons name={icon} size={24} color={COLORS.textInverse} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.alertCount, { color: t.fg }]}>{count}</Text>
        <Text style={[styles.alertLabel, { color: t.fg }]}>{label}</Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={28} color={t.fg} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { padding: SPACING.md, paddingBottom: SPACING.xxl, gap: SPACING.md },
  header: { paddingVertical: SPACING.md },
  greet: { ...TYPE.body, color: COLORS.textSecondary },
  name: { ...TYPE.h1 },
  role: { ...TYPE.label, color: COLORS.primary, marginTop: 4 },
  actionsRow: { flexDirection: "row", gap: SPACING.md },
  action: {
    flex: 1,
    minHeight: 88,
    borderRadius: RADIUS.sm,
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.xs,
  },
  actionText: { ...TYPE.label, color: COLORS.textInverse, fontSize: 13 },
  sectionTitle: { ...TYPE.label, marginTop: SPACING.md, marginBottom: SPACING.xs },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.md },
  stat: {
    flexBasis: "47%",
    flexGrow: 1,
    padding: SPACING.md,
    borderRadius: RADIUS.sm,
    borderLeftWidth: 4,
    gap: 4,
  },
  statValue: { fontSize: 28, fontWeight: "900" },
  statLabel: { fontSize: 12, fontWeight: "700", textTransform: "uppercase" },
  alert: {
    flexDirection: "row",
    alignItems: "center",
    padding: SPACING.md,
    borderRadius: RADIUS.sm,
    borderLeftWidth: 6,
    gap: SPACING.md,
    minHeight: TOUCH + 8,
  },
  alertIconBox: { width: 48, height: 48, borderRadius: RADIUS.sm, alignItems: "center", justifyContent: "center" },
  alertCount: { fontSize: 24, fontWeight: "900" },
  alertLabel: { ...TYPE.label, marginTop: 2 },
});
