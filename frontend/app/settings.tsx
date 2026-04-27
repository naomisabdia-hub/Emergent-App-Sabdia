import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Alert, Modal, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "../src/auth";
import { COLORS, SPACING, RADIUS, TYPE } from "../src/theme";

type Item = { id: string; name: string; address?: string; description?: string; status: string };

export default function Settings() {
  const router = useRouter();
  const { api, user } = useAuth();
  const [tab, setTab] = useState<"properties" | "categories" | "system">("properties");
  const [properties, setProperties] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState<null | "properties" | "categories">(null);
  const [reseedingNow, setReseedingNow] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, c] = await Promise.all([
        api.get<Item[]>("/properties"),
        api.get<Item[]>("/categories"),
      ]);
      setProperties(p.data);
      setCategories(c.data);
    } catch (e: any) {
      console.warn(e);
    } finally { setLoading(false); }
  }, [api]);

  useEffect(() => { load(); }, [load]);

  if (user?.role !== "admin") {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Settings</Text>
          <View style={{ width: 44 }} />
        </View>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: SPACING.lg }}>
          <MaterialCommunityIcons name="shield-lock" size={48} color={COLORS.textMuted} />
          <Text style={{ ...TYPE.h3, marginTop: 12 }}>Admin only</Text>
          <Text style={{ ...TYPE.bodyMuted, textAlign: "center", marginTop: 6 }}>This area is for administrators only.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const reseed = () => {
    Alert.alert(
      "Re-seed assets?",
      "This will WIPE all assets, checkouts, check-ins, and bookings, and load the asset register from the original spreadsheet. Users are NOT affected.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Re-seed", style: "destructive", onPress: async () => {
            setReseedingNow(true);
            try {
              const r = await api.post<{ ok: boolean; inserted: number }>("/admin/reseed-assets");
              Alert.alert("Done", `Re-seeded ${r.data.inserted} assets.`);
            } catch (e: any) { Alert.alert("Error", e?.response?.data?.detail || "Failed"); }
            finally { setReseedingNow(false); }
          }
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Settings</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.tabRow}>
        <Tab label="Properties" active={tab === "properties"} onPress={() => setTab("properties")} count={properties.length} />
        <Tab label="Categories" active={tab === "categories"} onPress={() => setTab("categories")} count={categories.length} />
        <Tab label="System" active={tab === "system"} onPress={() => setTab("system")} />
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      ) : tab === "system" ? (
        <ScrollView contentContainerStyle={{ padding: SPACING.md, gap: 12 }}>
          <Text style={styles.sectionLabel}>SYSTEM ACTIONS</Text>
          <TouchableOpacity onPress={reseed} disabled={reseedingNow} style={styles.actionRow}>
            <View style={[styles.actionIcon, { backgroundColor: COLORS.warningBg }]}>
              <MaterialCommunityIcons name="database-refresh" size={22} color={COLORS.warningText} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>Re-seed Assets from Spreadsheet</Text>
              <Text style={styles.actionSub}>Wipe and reload all 81 assets from the original Excel register</Text>
            </View>
            {reseedingNow ? <ActivityIndicator color={COLORS.warningText} /> : <MaterialCommunityIcons name="chevron-right" size={20} color={COLORS.textMuted} />}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push("/audit")} style={styles.actionRow}>
            <View style={[styles.actionIcon, { backgroundColor: COLORS.infoBg }]}>
              <MaterialCommunityIcons name="history" size={22} color={COLORS.infoText} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>Audit Trail</Text>
              <Text style={styles.actionSub}>View every action performed on the system</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={COLORS.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push("/users")} style={styles.actionRow}>
            <View style={[styles.actionIcon, { backgroundColor: COLORS.primary + "22" }]}>
              <MaterialCommunityIcons name="account-multiple" size={22} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>Manage Users</Text>
              <Text style={styles.actionSub}>Invite, edit, deactivate users</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={COLORS.textMuted} />
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={{ padding: SPACING.md, gap: 8 }}>
          <View style={styles.listHeader}>
            <Text style={styles.sectionLabel}>{tab === "properties" ? "5 PROPERTIES / SITES" : "CATEGORIES"}</Text>
            <TouchableOpacity onPress={() => setShowAdd(tab)} style={styles.addBtn}>
              <MaterialCommunityIcons name="plus" size={16} color={COLORS.textInverse} />
              <Text style={styles.addBtnText}>Add</Text>
            </TouchableOpacity>
          </View>
          {(tab === "properties" ? properties : categories).map((it) => (
            <View key={it.id} style={styles.itemRow}>
              <View style={[styles.itemIcon, { backgroundColor: tab === "properties" ? COLORS.primary + "22" : COLORS.infoBg }]}>
                <MaterialCommunityIcons name={tab === "properties" ? "home" : "shape"} size={18} color={tab === "properties" ? COLORS.primary : COLORS.infoText} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>{it.name}</Text>
                {it.address ? <Text style={styles.itemSub}>{it.address}</Text> : null}
                {it.description ? <Text style={styles.itemSub}>{it.description}</Text> : null}
              </View>
              <View style={styles.activePill}>
                <Text style={styles.activePillText}>{it.status?.toUpperCase() || "ACTIVE"}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      <AddModal
        kind={showAdd}
        onClose={() => setShowAdd(null)}
        onSaved={() => { setShowAdd(null); load(); }}
        api={api}
      />
    </SafeAreaView>
  );
}

function Tab({ label, active, onPress, count }: any) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.tab, active && styles.tabActive]} activeOpacity={0.85}>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}{count !== undefined ? ` (${count})` : ""}</Text>
    </TouchableOpacity>
  );
}

function AddModal({ kind, onClose, onSaved, api }: any) {
  const [name, setName] = useState("");
  const [extra, setExtra] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (!kind) { setName(""); setExtra(""); } }, [kind]);
  if (!kind) return null;

  const submit = async () => {
    if (!name.trim()) return Alert.alert("Required", "Enter a name");
    setSaving(true);
    try {
      const path = kind === "properties" ? "/properties" : "/categories";
      const body: any = { name: name.trim() };
      if (kind === "properties") body.address = extra || null;
      else body.description = extra || null;
      await api.post(path, body);
      onSaved();
    } catch (e: any) { Alert.alert("Error", e?.response?.data?.detail || "Failed"); }
    finally { setSaving(false); }
  };

  return (
    <Modal visible={!!kind} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View style={styles.topBar}>
            <TouchableOpacity onPress={onClose} style={styles.iconBtn}><MaterialCommunityIcons name="close" size={24} color={COLORS.text} /></TouchableOpacity>
            <Text style={styles.topTitle}>Add {kind === "properties" ? "Property" : "Category"}</Text>
            <View style={{ width: 44 }} />
          </View>
          <ScrollView contentContainerStyle={{ padding: SPACING.md, gap: 12 }}>
            <View>
              <Text style={styles.fieldLabel}>Name</Text>
              <TextInput value={name} onChangeText={setName} placeholder={kind === "properties" ? "e.g. 96 Newman Avenue" : "e.g. Power Tools"} placeholderTextColor={COLORS.textMuted} style={styles.input} />
            </View>
            <View>
              <Text style={styles.fieldLabel}>{kind === "properties" ? "Address (optional)" : "Description (optional)"}</Text>
              <TextInput value={extra} onChangeText={setExtra} placeholder="" placeholderTextColor={COLORS.textMuted} style={styles.input} />
            </View>
          </ScrollView>
          <View style={{ padding: SPACING.md, backgroundColor: COLORS.surface, borderTopWidth: 1, borderTopColor: COLORS.border }}>
            <TouchableOpacity onPress={submit} disabled={saving} style={styles.submit}>
              {saving ? <ActivityIndicator color={COLORS.textInverse} /> : <Text style={styles.submitText}>Save</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: SPACING.md, backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  topTitle: { fontSize: 18, fontWeight: "800", color: COLORS.text },
  iconBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  tabRow: { flexDirection: "row", backgroundColor: COLORS.surface, paddingHorizontal: SPACING.md, gap: 4, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  tab: { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabActive: { borderBottomColor: COLORS.primary },
  tabText: { fontSize: 13, fontWeight: "700", color: COLORS.textSecondary, letterSpacing: 0.3 },
  tabTextActive: { color: COLORS.primary },
  sectionLabel: { fontSize: 11, fontWeight: "800", color: COLORS.textSecondary, letterSpacing: 1 },
  listHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: COLORS.primary, paddingHorizontal: 10, height: 32, borderRadius: 6 },
  addBtnText: { color: COLORS.textInverse, fontWeight: "800", fontSize: 12 },
  itemRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: COLORS.surface, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border },
  itemIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  itemTitle: { fontSize: 14, fontWeight: "700", color: COLORS.text },
  itemSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  activePill: { backgroundColor: COLORS.successBg, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 3 },
  activePillText: { fontSize: 9, fontWeight: "900", color: COLORS.successText, letterSpacing: 0.5 },
  fieldLabel: { fontSize: 12, fontWeight: "700", color: COLORS.textSecondary, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  input: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 14, height: 48, fontSize: 15, color: COLORS.text },
  submit: { backgroundColor: COLORS.primary, height: 52, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  submitText: { color: COLORS.textInverse, fontWeight: "800", fontSize: 15, letterSpacing: 0.3 },
  actionRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: COLORS.surface, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border },
  actionIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  actionTitle: { fontSize: 14, fontWeight: "700", color: COLORS.text },
  actionSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
});
