import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "../../src/auth";
import { COLORS, SPACING, RADIUS, TOUCH, TYPE } from "../../src/theme";

export default function Profile() {
  const { user, logout } = useAuth();
  const router = useRouter();

  if (!user) return null;
  const isAdmin = user.role === "admin";
  const canApprove = user.role === "admin" || user.role === "supervisor";

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <MaterialCommunityIcons name="account" size={48} color={COLORS.textInverse} />
          </View>
          <Text style={styles.name}>{user.full_name}</Text>
          <Text style={styles.email}>{user.email}</Text>
          <View style={styles.rolePill}>
            <Text style={styles.roleText}>{user.role.toUpperCase()}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>INFO</Text>
          <Row label="Property" value={user.property_assignment || "—"} icon="map-marker" />
          <Row label="Phone" value={user.phone || "—"} icon="phone" />
          <Row label="Status" value={user.status || "Active"} icon="check-circle" />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ACTIONS</Text>
          {canApprove && (
            <ActionRow
              testID="profile-approvals"
              icon="clipboard-check"
              label="Pending Approvals"
              onPress={() => router.push("/approvals")}
            />
          )}
          {isAdmin && (
            <ActionRow
              testID="profile-audit"
              icon="history"
              label="Audit Trail"
              onPress={() => router.push("/audit")}
            />
          )}
          <ActionRow testID="profile-checkout" icon="arrow-up-box" label="Check Out Equipment" onPress={() => router.push("/checkout")} />
          <ActionRow testID="profile-checkin" icon="arrow-down-box" label="Check In Equipment" onPress={() => router.push("/checkin")} />
          <ActionRow testID="profile-booking" icon="calendar-plus" label="Schedule Equipment" onPress={() => router.push("/booking")} />
        </View>

        <TouchableOpacity testID="logout-button" style={styles.logout} onPress={logout} activeOpacity={0.85}>
          <MaterialCommunityIcons name="logout" size={22} color={COLORS.dangerText} />
          <Text style={styles.logoutText}>SIGN OUT</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value, icon }: any) {
  return (
    <View style={styles.row}>
      <MaterialCommunityIcons name={icon} size={20} color={COLORS.textSecondary} />
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function ActionRow({ icon, label, onPress, testID }: any) {
  return (
    <TouchableOpacity testID={testID} style={styles.actionRow} onPress={onPress} activeOpacity={0.85}>
      <MaterialCommunityIcons name={icon} size={22} color={COLORS.text} />
      <Text style={styles.actionLabel}>{label}</Text>
      <MaterialCommunityIcons name="chevron-right" size={22} color={COLORS.textMuted} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { padding: SPACING.md, gap: SPACING.lg, paddingBottom: SPACING.xxl },
  header: { alignItems: "center", padding: SPACING.lg, gap: 6 },
  avatar: { width: 88, height: 88, backgroundColor: COLORS.text, borderRadius: RADIUS.sm, alignItems: "center", justifyContent: "center", marginBottom: SPACING.sm },
  name: { ...TYPE.h2 },
  email: { ...TYPE.bodyMuted },
  rolePill: { backgroundColor: COLORS.primary, paddingHorizontal: 12, paddingVertical: 4, borderRadius: RADIUS.sm, marginTop: 6 },
  roleText: { color: COLORS.textInverse, fontWeight: "900", fontSize: 12, letterSpacing: 1 },
  section: { gap: SPACING.xs },
  sectionTitle: { ...TYPE.label, marginBottom: SPACING.xs },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: RADIUS.sm,
    gap: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: TOUCH,
  },
  rowLabel: { ...TYPE.bodyMuted, flex: 1 },
  rowValue: { ...TYPE.body, fontWeight: "700" },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: RADIUS.sm,
    gap: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: TOUCH,
  },
  actionLabel: { ...TYPE.body, fontWeight: "700", flex: 1 },
  logout: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    backgroundColor: COLORS.dangerBg,
    minHeight: TOUCH,
    borderRadius: RADIUS.sm,
    borderWidth: 2,
    borderColor: COLORS.danger,
  },
  logoutText: { color: COLORS.dangerText, fontWeight: "900", letterSpacing: 1, fontSize: 14 },
});
