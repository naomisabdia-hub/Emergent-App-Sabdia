import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, Image, StyleSheet, TouchableOpacity, ActivityIndicator, TextInput, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "../../src/auth";
import { COLORS, SPACING, RADIUS, TOUCH, TYPE, statusColor } from "../../src/theme";

type CustomField = { id: string; key: string; label: string; field_type: string; options: string[]; required: boolean; placeholder?: string };

export default function AssetDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api, user } = useAuth();
  const router = useRouter();
  const [asset, setAsset] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [fields, setFields] = useState<CustomField[]>([]);
  const [values, setValues] = useState<Record<string, any>>({});
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const isAdmin = user?.role === "admin";

  const load = useCallback(async () => {
    try {
      const [a, f] = await Promise.all([
        api.get(`/assets/${id}`),
        api.get<CustomField[]>("/custom-fields", { params: { applies_to: "asset" } }),
      ]);
      setAsset(a.data);
      setFields(f.data);
      setValues(a.data.custom_fields || {});
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const saveCustom = async () => {
    setSaving(true);
    try {
      await api.put(`/assets/${id}/custom-fields`, { values });
      setEditing(false);
      await load();
    } catch (e: any) { Alert.alert("Error", e?.response?.data?.detail || "Save failed"); }
    finally { setSaving(false); }
  };

  if (loading) {
    return <View style={styles.loading}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  }
  if (!asset) return <SafeAreaView style={styles.safe}><Text style={{ padding: SPACING.lg }}>Asset not found</Text></SafeAreaView>;

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
            <Spec label="Location" value={asset.current_property || asset.location || "—"} />
          </View>

          {asset.current_holder ? (
            <View style={styles.lastBox}>
              <MaterialCommunityIcons name="account-clock" size={20} color={COLORS.dangerText} />
              <Text style={[styles.lastText, { color: COLORS.dangerText }]}>
                Currently with: <Text style={{ fontWeight: "800" }}>{asset.current_holder}</Text>
                {asset.expected_return_date ? ` · due ${asset.expected_return_date}` : ""}
              </Text>
            </View>
          ) : null}

          {fields.length > 0 ? (
            <View style={styles.cfSection}>
              <View style={styles.cfHeader}>
                <Text style={styles.cfTitle}>ADDITIONAL INFO</Text>
                {isAdmin ? (
                  editing ? (
                    <View style={{ flexDirection: "row", gap: 6 }}>
                      <TouchableOpacity onPress={() => { setEditing(false); setValues(asset.custom_fields || {}); }} style={styles.cfBtnGhost}>
                        <Text style={styles.cfBtnGhostText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={saveCustom} disabled={saving} style={styles.cfBtn}>
                        {saving ? <ActivityIndicator size="small" color={COLORS.textInverse} /> : <Text style={styles.cfBtnText}>Save</Text>}
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity onPress={() => setEditing(true)} style={styles.cfBtnGhost}>
                      <MaterialCommunityIcons name="pencil" size={14} color={COLORS.text} />
                      <Text style={styles.cfBtnGhostText}>Edit</Text>
                    </TouchableOpacity>
                  )
                ) : null}
              </View>
              <View style={{ gap: 10 }}>
                {fields.map((f) => (
                  <CustomFieldRow
                    key={f.id}
                    field={f}
                    value={values[f.key]}
                    editing={editing}
                    onChange={(v) => setValues((s) => ({ ...s, [f.key]: v }))}
                  />
                ))}
              </View>
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

function CustomFieldRow({ field, value, editing, onChange }: any) {
  const renderValue = () => {
    if (value == null || value === "") return <Text style={styles.cfEmpty}>—</Text>;
    if (field.field_type === "boolean") return <Text style={styles.cfValue}>{value ? "Yes" : "No"}</Text>;
    return <Text style={styles.cfValue}>{String(value)}</Text>;
  };
  return (
    <View style={styles.cfRow}>
      <Text style={styles.cfLabel}>{field.label}{field.required ? " *" : ""}</Text>
      {!editing ? (
        renderValue()
      ) : field.field_type === "select" ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {field.options?.map((opt: string) => (
            <TouchableOpacity key={opt} onPress={() => onChange(opt)} style={[styles.optChip, value === opt && { backgroundColor: COLORS.primary, borderColor: COLORS.primary }]}>
              <Text style={[styles.optChipText, value === opt && { color: COLORS.textInverse }]}>{opt}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : field.field_type === "boolean" ? (
        <TouchableOpacity onPress={() => onChange(!value)} style={styles.boolRow}>
          <View style={[styles.boolBox, value && { backgroundColor: COLORS.primary, borderColor: COLORS.primary }]}>
            {value ? <MaterialCommunityIcons name="check" size={14} color={COLORS.textInverse} /> : null}
          </View>
          <Text style={styles.boolText}>{value ? "Yes" : "No"}</Text>
        </TouchableOpacity>
      ) : field.field_type === "textarea" ? (
        <TextInput
          value={value ?? ""}
          onChangeText={onChange}
          placeholder={field.placeholder || ""}
          placeholderTextColor={COLORS.textMuted}
          style={[styles.input, { height: 80, paddingTop: 10, textAlignVertical: "top" }]}
          multiline
        />
      ) : (
        <TextInput
          value={value == null ? "" : String(value)}
          onChangeText={(t) => onChange(field.field_type === "number" ? (t.replace(/[^0-9.\-]/g, "")) : t)}
          placeholder={field.placeholder || (field.field_type === "date" ? "YYYY-MM-DD" : "")}
          placeholderTextColor={COLORS.textMuted}
          keyboardType={field.field_type === "number" ? "numeric" : "default"}
          style={styles.input}
        />
      )}
    </View>
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
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  iconBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  topBarTitle: { ...TYPE.label },
  hero: { width: "100%", height: 280 },
  body: { padding: SPACING.lg, gap: SPACING.md },
  statusPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 4 },
  statusPillText: { fontSize: 11, fontWeight: "900", letterSpacing: 1 },
  name: { ...TYPE.h2 },
  assetId: { ...TYPE.bodyMuted },
  specs: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.md, marginTop: SPACING.sm },
  spec: { flexBasis: "47%", flexGrow: 1, backgroundColor: COLORS.surface, padding: SPACING.md, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.border, gap: 4 },
  specLabel: { ...TYPE.label, color: COLORS.textMuted },
  specValue: { ...TYPE.body, fontWeight: "700" },
  lastBox: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, padding: SPACING.md, backgroundColor: COLORS.dangerBg, borderRadius: RADIUS.sm },
  lastText: { ...TYPE.body, flex: 1 },
  cfSection: { backgroundColor: COLORS.surface, padding: SPACING.md, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, gap: 12 },
  cfHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cfTitle: { fontSize: 11, fontWeight: "900", color: COLORS.textSecondary, letterSpacing: 1 },
  cfBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 12, height: 30, borderRadius: 6, alignItems: "center", justifyContent: "center" },
  cfBtnText: { color: COLORS.textInverse, fontWeight: "800", fontSize: 12 },
  cfBtnGhost: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, height: 30, borderRadius: 6, borderWidth: 1, borderColor: COLORS.border },
  cfBtnGhostText: { color: COLORS.text, fontWeight: "700", fontSize: 12 },
  cfRow: { gap: 4 },
  cfLabel: { fontSize: 11, fontWeight: "700", color: COLORS.textMuted, letterSpacing: 0.4, textTransform: "uppercase" },
  cfValue: { fontSize: 14, color: COLORS.text, fontWeight: "600" },
  cfEmpty: { fontSize: 14, color: COLORS.textMuted, fontStyle: "italic" },
  input: { backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 12, height: 44, fontSize: 14, color: COLORS.text },
  optChip: { paddingHorizontal: 12, height: 32, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, alignItems: "center", justifyContent: "center" },
  optChipText: { fontSize: 12, fontWeight: "700", color: COLORS.text },
  boolRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  boolBox: { width: 22, height: 22, borderRadius: 4, borderWidth: 2, borderColor: COLORS.border, alignItems: "center", justifyContent: "center" },
  boolText: { fontSize: 14, color: COLORS.text, fontWeight: "600" },
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
