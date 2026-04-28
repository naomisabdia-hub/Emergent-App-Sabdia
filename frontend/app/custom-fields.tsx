import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Alert, Modal, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "../src/auth";
import { COLORS, SPACING, TYPE } from "../src/theme";

type FieldType = "text" | "textarea" | "number" | "date" | "select" | "boolean";
type CustomField = {
  id: string;
  key: string;
  label: string;
  field_type: FieldType;
  options: string[];
  required: boolean;
  applies_to: string;
  order: number;
  placeholder?: string | null;
  status: "Active" | "Disabled";
  created_by?: string;
};

export default function CustomFieldsAdmin() {
  const router = useRouter();
  const { api, user } = useAuth();
  const [fields, setFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<CustomField | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get<CustomField[]>("/custom-fields", { params: { applies_to: "asset" } });
      setFields(r.data);
    } catch (e: any) { console.warn(e); }
    finally { setLoading(false); }
  }, [api]);

  useEffect(() => { load(); }, [load]);

  if (user?.role !== "admin") {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Custom Fields</Text>
          <View style={{ width: 44 }} />
        </View>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: SPACING.lg }}>
          <MaterialCommunityIcons name="shield-lock" size={48} color={COLORS.textMuted} />
          <Text style={{ ...TYPE.h3, marginTop: 12 }}>Admin only</Text>
        </View>
      </SafeAreaView>
    );
  }

  const handleDelete = (f: CustomField) => {
    Alert.alert("Disable field?", `"${f.label}" will be hidden but existing data is preserved.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Disable", style: "destructive", onPress: async () => {
        try { await api.delete(`/custom-fields/${f.id}`); load(); }
        catch (e: any) { Alert.alert("Error", e?.response?.data?.detail || "Failed"); }
      } },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Custom Fields</Text>
        <TouchableOpacity onPress={() => setShowAdd(true)} style={styles.addBtn} testID="cf-add">
          <MaterialCommunityIcons name="plus" size={16} color={COLORS.textInverse} />
          <Text style={styles.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      ) : fields.length === 0 ? (
        <View style={styles.empty}>
          <MaterialCommunityIcons name="form-textbox" size={56} color={COLORS.textMuted} />
          <Text style={styles.emptyTitle}>No custom fields yet</Text>
          <Text style={styles.emptySub}>Add fields like "Compliance Expiry", "Service Status", or "Owner" to capture extra info on your assets without rebuilding the app.</Text>
          <TouchableOpacity style={styles.bigBtn} onPress={() => setShowAdd(true)}>
            <Text style={styles.bigBtnText}>Add your first field</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: SPACING.md, gap: 8 }}>
          <Text style={styles.sectionLabel}>{fields.length} ASSET FIELD{fields.length === 1 ? "" : "S"}</Text>
          {fields.map((f) => (
            <View key={f.id} style={styles.card}>
              <View style={[styles.iconBubble, { backgroundColor: typeColor(f.field_type) + "22" }]}>
                <MaterialCommunityIcons name={typeIcon(f.field_type)} size={20} color={typeColor(f.field_type)} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={styles.fLabel}>{f.label}</Text>
                  {f.required ? <View style={styles.requiredPill}><Text style={styles.requiredText}>REQUIRED</Text></View> : null}
                </View>
                <Text style={styles.fMeta}>{f.field_type.toUpperCase()} · key: {f.key}</Text>
                {f.field_type === "select" && f.options?.length ? (
                  <Text style={styles.fOpts}>Options: {f.options.join(" · ")}</Text>
                ) : null}
              </View>
              <View style={{ flexDirection: "row", gap: 4 }}>
                <TouchableOpacity onPress={() => setEditing(f)} style={styles.actBtn}>
                  <MaterialCommunityIcons name="pencil" size={18} color={COLORS.text} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(f)} style={[styles.actBtn, { backgroundColor: COLORS.dangerBg }]}>
                  <MaterialCommunityIcons name="trash-can" size={18} color={COLORS.dangerText} />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      <FieldEditor
        visible={showAdd || !!editing}
        existing={editing}
        onClose={() => { setShowAdd(false); setEditing(null); }}
        onSaved={() => { setShowAdd(false); setEditing(null); load(); }}
        api={api}
      />
    </SafeAreaView>
  );
}

function typeIcon(t: FieldType): any {
  return ({
    text: "format-text" as const,
    textarea: "text-long" as const,
    number: "numeric" as const,
    date: "calendar" as const,
    select: "form-dropdown" as const,
    boolean: "toggle-switch" as const,
  } as any)[t] || "form-textbox";
}
function typeColor(t: FieldType): string {
  return ({
    text: COLORS.primary,
    textarea: COLORS.primary,
    number: COLORS.info,
    date: COLORS.warning,
    select: COLORS.success,
    boolean: COLORS.text,
  } as any)[t] || COLORS.text;
}

function FieldEditor({ visible, existing, onClose, onSaved, api }: any) {
  const [label, setLabel] = useState("");
  const [type, setType] = useState<FieldType>("text");
  const [options, setOptions] = useState<string>(""); // comma-separated
  const [required, setRequired] = useState(false);
  const [placeholder, setPlaceholder] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (existing) {
      setLabel(existing.label);
      setType(existing.field_type);
      setOptions((existing.options || []).join(", "));
      setRequired(existing.required);
      setPlaceholder(existing.placeholder || "");
    } else {
      setLabel(""); setType("text"); setOptions(""); setRequired(false); setPlaceholder("");
    }
  }, [existing, visible]);

  const submit = async () => {
    if (!label.trim()) return Alert.alert("Required", "Enter a field label.");
    if (type === "select" && !options.trim()) return Alert.alert("Required", "Add at least one option (comma separated).");
    setSaving(true);
    try {
      const body: any = {
        label: label.trim(),
        field_type: type,
        required,
        placeholder: placeholder || null,
        applies_to: "asset",
        options: type === "select" ? options.split(",").map((o) => o.trim()).filter(Boolean) : [],
      };
      if (existing) {
        await api.patch(`/custom-fields/${existing.id}`, body);
      } else {
        await api.post("/custom-fields", body);
      }
      onSaved();
    } catch (e: any) { Alert.alert("Error", e?.response?.data?.detail || "Failed"); }
    finally { setSaving(false); }
  };

  const types: { key: FieldType; label: string; desc: string }[] = [
    { key: "text", label: "TEXT", desc: "Single line" },
    { key: "textarea", label: "TEXT (LONG)", desc: "Multi-line notes" },
    { key: "number", label: "NUMBER", desc: "Numeric" },
    { key: "date", label: "DATE", desc: "Date picker" },
    { key: "select", label: "DROPDOWN", desc: "Pick one option" },
    { key: "boolean", label: "YES / NO", desc: "Toggle" },
  ];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View style={styles.topBar}>
            <TouchableOpacity onPress={onClose} style={styles.iconBtn}><MaterialCommunityIcons name="close" size={24} color={COLORS.text} /></TouchableOpacity>
            <Text style={styles.topTitle}>{existing ? "Edit Field" : "New Custom Field"}</Text>
            <View style={{ width: 44 }} />
          </View>
          <ScrollView contentContainerStyle={{ padding: SPACING.md, gap: 14 }}>
            <View>
              <Text style={styles.fieldLabel}>Field Label</Text>
              <TextInput value={label} onChangeText={setLabel} placeholder="e.g. Compliance Expiry" placeholderTextColor={COLORS.textMuted} style={styles.input} />
            </View>
            <View>
              <Text style={styles.fieldLabel}>Field Type</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {types.map((t) => (
                  <TouchableOpacity key={t.key} onPress={() => setType(t.key)} style={[styles.typeCard, type === t.key && { borderColor: COLORS.primary, backgroundColor: COLORS.primary + "11" }]}>
                    <MaterialCommunityIcons name={typeIcon(t.key)} size={18} color={type === t.key ? COLORS.primary : COLORS.text} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.typeLabel, type === t.key && { color: COLORS.primary }]}>{t.label}</Text>
                      <Text style={styles.typeDesc}>{t.desc}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            {type === "select" ? (
              <View>
                <Text style={styles.fieldLabel}>Options (comma separated)</Text>
                <TextInput value={options} onChangeText={setOptions} placeholder="Up to date, Service due, Out of service" placeholderTextColor={COLORS.textMuted} style={[styles.input, { height: 80, textAlignVertical: "top", paddingTop: 12 }]} multiline />
              </View>
            ) : null}
            <View>
              <Text style={styles.fieldLabel}>Placeholder (optional)</Text>
              <TextInput value={placeholder} onChangeText={setPlaceholder} placeholder="Helper text shown inside the input" placeholderTextColor={COLORS.textMuted} style={styles.input} />
            </View>
            <TouchableOpacity onPress={() => setRequired(!required)} style={styles.toggleRow}>
              <View style={[styles.toggleBox, required && { backgroundColor: COLORS.primary, borderColor: COLORS.primary }]}>
                {required ? <MaterialCommunityIcons name="check" size={14} color={COLORS.textInverse} /> : null}
              </View>
              <Text style={styles.toggleText}>Required field</Text>
            </TouchableOpacity>
          </ScrollView>
          <View style={styles.footer}>
            <TouchableOpacity onPress={submit} disabled={saving} style={styles.submit}>
              {saving ? <ActivityIndicator color={COLORS.textInverse} /> : <Text style={styles.submitText}>{existing ? "Save Changes" : "Create Field"}</Text>}
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
  addBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: COLORS.primary, paddingHorizontal: 12, height: 36, borderRadius: 8 },
  addBtnText: { color: COLORS.textInverse, fontWeight: "800", fontSize: 12 },
  sectionLabel: { fontSize: 11, fontWeight: "800", color: COLORS.textSecondary, letterSpacing: 1, marginBottom: 4 },
  card: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: COLORS.surface, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border },
  iconBubble: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  fLabel: { fontSize: 14, fontWeight: "700", color: COLORS.text },
  fMeta: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  fOpts: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2, fontStyle: "italic" },
  actBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 8, backgroundColor: COLORS.bg },
  requiredPill: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 3, backgroundColor: COLORS.warningBg },
  requiredText: { fontSize: 8, fontWeight: "900", color: COLORS.warningText, letterSpacing: 0.5 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: SPACING.lg, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "800", color: COLORS.text },
  emptySub: { fontSize: 13, color: COLORS.textSecondary, textAlign: "center", lineHeight: 18, maxWidth: 320 },
  bigBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 24, height: 48, borderRadius: 10, alignItems: "center", justifyContent: "center", marginTop: 8 },
  bigBtnText: { color: COLORS.textInverse, fontWeight: "800", fontSize: 14 },
  fieldLabel: { fontSize: 12, fontWeight: "700", color: COLORS.textSecondary, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  input: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 14, height: 48, fontSize: 15, color: COLORS.text },
  typeCard: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 10, borderWidth: 2, borderColor: COLORS.border, backgroundColor: COLORS.surface, width: "48%" },
  typeLabel: { fontSize: 11, fontWeight: "900", color: COLORS.text, letterSpacing: 0.4 },
  typeDesc: { fontSize: 10, color: COLORS.textSecondary, marginTop: 1 },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 10, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  toggleBox: { width: 22, height: 22, borderRadius: 4, borderWidth: 2, borderColor: COLORS.border, alignItems: "center", justifyContent: "center" },
  toggleText: { fontSize: 14, fontWeight: "600", color: COLORS.text },
  footer: { padding: SPACING.md, backgroundColor: COLORS.surface, borderTopWidth: 1, borderTopColor: COLORS.border },
  submit: { backgroundColor: COLORS.primary, height: 52, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  submitText: { color: COLORS.textInverse, fontWeight: "800", fontSize: 15, letterSpacing: 0.3 },
});
