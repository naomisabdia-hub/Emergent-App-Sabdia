import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "../../src/auth";
import { COLORS, SPACING, RADIUS, TOUCH, TYPE } from "../../src/theme";

export default function More() {
  const router = useRouter();
  const { user, logout } = useAuth();
  if (!user) return null;
  const isAdmin = user.role === "admin";
  const canApprove = isAdmin || user.role === "supervisor";

  const items: any[] = [
    { icon: "history", label: "Activity & History", onPress: () => router.push("/(tabs)/activity"), testID: "more-activity" },
    { icon: "calendar-month", label: "Bookings", onPress: () => router.push("/bookings"), testID: "more-bookings" },
    { icon: "calendar-plus", label: "Schedule Equipment", onPress: () => router.push("/booking"), testID: "more-schedule" },
  ];
  if (canApprove) items.push({ icon: "clipboard-check", label: "Pending Approvals", onPress: () => router.push("/approvals"), testID: "more-approvals" });
  if (isAdmin) {
    items.push({ icon: "history", label: "Audit Trail", onPress: () => router.push("/audit"), testID: "more-audit" });
    items.push({ icon: "cog", label: "Settings", onPress: () => router.push("/settings"), testID: "more-settings" });
  }
  items.push({ icon: "account-circle", label: "My Profile", onPress: () => router.push("/(tabs)/profile"), testID: "more-profile" });

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: SPACING.md, paddingBottom: SPACING.xxl, gap: SPACING.sm }}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user.full_name.charAt(0)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{user.full_name}</Text>
            <Text style={styles.email}>{user.email}</Text>
            <View style={styles.rolePill}>
              <Text style={styles.roleText}>{user.role.toUpperCase()}</Text>
              {user.property_assignment ? <Text style={styles.propText}> · {user.property_assignment}</Text> : null}
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>MENU</Text>
        {items.map((it) => (
          <TouchableOpacity key={it.testID} testID={it.testID} style={styles.row} onPress={it.onPress} activeOpacity={0.85}>
            <MaterialCommunityIcons name={it.icon} size={22} color={COLORS.text} />
            <Text style={styles.rowLabel}>{it.label}</Text>
            <MaterialCommunityIcons name="chevron-right" size={22} color={COLORS.textMuted} />
          </TouchableOpacity>
        ))}

        <TouchableOpacity testID="logout-button" style={styles.logout} onPress={logout} activeOpacity={0.85}>
          <MaterialCommunityIcons name="logout" size={22} color={COLORS.dangerText} />
          <Text style={styles.logoutText}>SIGN OUT</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: "row", alignItems: "center", gap: SPACING.md, padding: SPACING.lg, backgroundColor: COLORS.surface, borderRadius: RADIUS.sm, borderWidth: 2, borderColor: COLORS.borderHeavy },
  avatar: { width: 64, height: 64, backgroundColor: COLORS.primary, borderRadius: RADIUS.sm, alignItems: "center", justifyContent: "center" },
  avatarText: { color: COLORS.textInverse, fontSize: 28, fontWeight: "900" },
  name: { ...TYPE.h3 },
  email: { ...TYPE.bodyMuted },
  rolePill: { flexDirection: "row", marginTop: 4 },
  roleText: { color: COLORS.primary, fontWeight: "900", fontSize: 11, letterSpacing: 1 },
  propText: { color: COLORS.textSecondary, fontSize: 11, fontWeight: "700" },
  sectionTitle: { ...TYPE.label, marginTop: SPACING.md, marginBottom: SPACING.xs },
  row: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.surface, padding: SPACING.md, borderRadius: RADIUS.sm, gap: SPACING.md, borderWidth: 1, borderColor: COLORS.border, minHeight: TOUCH },
  rowLabel: { ...TYPE.body, fontWeight: "700", flex: 1 },
  logout: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACING.sm, backgroundColor: COLORS.dangerBg, minHeight: TOUCH, borderRadius: RADIUS.sm, borderWidth: 2, borderColor: COLORS.danger, marginTop: SPACING.md },
  logoutText: { color: COLORS.dangerText, fontWeight: "900", letterSpacing: 1, fontSize: 14 },
});
