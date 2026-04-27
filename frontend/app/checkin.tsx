import { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Alert, FlatList, Image, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "../src/auth";
import { COLORS, SPACING, RADIUS, TOUCH, TYPE } from "../src/theme";
import QRScanner from "../src/QRScanner";
import PhotoCapture from "../src/PhotoCapture";

type Asset = { id: string; asset_id: string; name: string; status: string; image_url?: string; brand?: string; model?: string };
type Checkout = { id: string; asset_uid: string; asset_id: string; asset_name: string; user_name: string; expected_return_date?: string; asset?: Asset };

const CONDITIONS = [
  { key: "Good", label: "GOOD", icon: "check-circle", bg: COLORS.successBg, fg: COLORS.successText, border: COLORS.success },
  { key: "Minor Damage", label: "MINOR DAMAGE", icon: "alert-circle", bg: COLORS.warningBg, fg: COLORS.warningText, border: COLORS.warning },
  { key: "Major Damage", label: "MAJOR DAMAGE", icon: "close-circle", bg: COLORS.dangerBg, fg: COLORS.dangerText, border: COLORS.danger },
  { key: "Missing Parts", label: "MISSING PARTS", icon: "alert-octagon", bg: COLORS.dangerBg, fg: COLORS.dangerText, border: COLORS.danger },
];

export default function CheckIn() {
  const router = useRouter();
  const { api } = useAuth();
  const params = useLocalSearchParams<{ assetId?: string }>();

  const [assets, setAssets] = useState<Asset[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Asset | null>(null);
  const [condition, setCondition] = useState<string>("Good");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  const handleScan = (val: string) => {
    setShowScanner(false);
    const code = (val.split("|")[0] || "").trim();
    const found = assets.find((a) => a.asset_id === code || a.id === code);
    if (found) setSelected(found);
    else Alert.alert("Asset not found", `No checked-out asset matches QR code: ${code}`);
  };

  useEffect(() => {
    (async () => {
      // Use /checkouts?open_only=true&mine=true so we only see assets the current user holds.
      // Admins see ALL open checkouts (server enforces). For non-admin, server filters to user_id.
      try {
        const r = await api.get<Checkout[]>("/checkouts", { params: { open_only: true } });
        const co = r.data;
        // Build pseudo-asset list from checkouts
        const enrichedAssets: Asset[] = co.map((c) => ({
          id: c.asset_uid,
          asset_id: c.asset_id,
          name: c.asset_name + (c.user_name ? ` · ${c.user_name}` : ""),
          status: "Checked Out",
          image_url: c.asset?.image_url,
          brand: undefined,
          model: undefined,
        }));
        setAssets(enrichedAssets);
        if (params.assetId) {
          const found = enrichedAssets.find((a) => a.id === params.assetId);
          if (found) setSelected(found);
        }
      } catch (e: any) {
        Alert.alert("Error", e?.response?.data?.detail || "Could not load your checkouts");
      }
    })();
  }, []);

  const filtered = assets.filter((a) =>
    !search ? true : (a.name + a.asset_id + (a.brand || "")).toLowerCase().includes(search.toLowerCase())
  );

  const submit = async () => {
    if (!selected) return Alert.alert("Select an asset");
    if (!condition) return Alert.alert("Select condition");
    if (condition !== "Good" && !photoUri) {
      return Alert.alert("Photo required", "Please take a photo to document the damage or issue.");
    }
    if (condition !== "Good" && !notes.trim()) {
      return Alert.alert("Notes required", "Please describe the condition issue.");
    }
    setSubmitting(true);
    try {
      await api.post("/checkins", {
        asset_id: selected.id,
        condition,
        notes: notes || null,
        condition_photo_url: photoUri,
      });
      Alert.alert("Returned", `${selected.name}\nCondition: ${condition}`, [{ text: "OK", onPress: () => router.back() }]);
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Check-in failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} testID="form-back">
            <MaterialCommunityIcons name="close" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.topTitle}>CHECK IN</Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: SPACING.md, paddingBottom: 120, gap: SPACING.md }} keyboardShouldPersistTaps="handled">
          <Text style={styles.stepLabel}>STEP 1 · SELECT ASSET</Text>

          <TouchableOpacity testID="scan-qr-button" style={styles.scanBtn}
            onPress={() => setShowScanner(true)}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="qrcode-scan" size={26} color={COLORS.textInverse} />
            <Text style={styles.scanBtnText}>TAP TO SCAN QR CODE</Text>
          </TouchableOpacity>

          {!selected ? (
            <>
              <View style={styles.searchBox}>
                <MaterialCommunityIcons name="magnify" size={22} color={COLORS.textMuted} />
                <TextInput
                  testID="checkin-search"
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search checked-out assets…"
                  placeholderTextColor={COLORS.textMuted}
                  style={styles.searchInput}
                />
              </View>
              <FlatList
                scrollEnabled={false}
                data={filtered}
                keyExtractor={(i) => i.id}
                ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
                ListEmptyComponent={<Text style={{ ...TYPE.bodyMuted, textAlign: "center", padding: SPACING.lg }}>No checked-out assets</Text>}
                renderItem={({ item }) => (
                  <TouchableOpacity testID={`pick-${item.asset_id}`} style={styles.assetRow} onPress={() => setSelected(item)} activeOpacity={0.85}>
                    {item.image_url ? <Image source={{ uri: item.image_url }} style={styles.thumb} /> : <View style={styles.thumb} />}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.assetName} numberOfLines={1}>{item.name}</Text>
                      <Text style={styles.assetMeta}>{item.asset_id}</Text>
                    </View>
                    <MaterialCommunityIcons name="chevron-right" size={22} color={COLORS.textMuted} />
                  </TouchableOpacity>
                )}
              />
            </>
          ) : (
            <View style={styles.selectedCard}>
              {selected.image_url ? <Image source={{ uri: selected.image_url }} style={styles.selectedImg} /> : null}
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.selectedName}>{selected.name}</Text>
                <Text style={styles.selectedMeta}>{selected.asset_id}</Text>
              </View>
              <TouchableOpacity testID="change-asset" onPress={() => setSelected(null)} style={styles.changeBtn}>
                <Text style={styles.changeBtnText}>CHANGE</Text>
              </TouchableOpacity>
            </View>
          )}

          <Text style={[styles.stepLabel, { marginTop: SPACING.md }]}>STEP 2 · CONDITION</Text>
          <View style={styles.condGrid}>
            {CONDITIONS.map((c) => (
              <TouchableOpacity
                key={c.key}
                testID={`condition-${c.key.replace(/\s+/g, "-")}`}
                style={[styles.condBtn, { backgroundColor: c.bg, borderColor: condition === c.key ? c.border : COLORS.border, borderWidth: condition === c.key ? 3 : 1 }]}
                onPress={() => setCondition(c.key)}
                activeOpacity={0.85}
              >
                <MaterialCommunityIcons name={c.icon as any} size={28} color={c.fg} />
                <Text style={[styles.condText, { color: c.fg }]}>{c.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {condition !== "Good" ? (
            <View style={styles.warnBox}>
              <MaterialCommunityIcons name="camera" size={22} color={COLORS.warningText} />
              <Text style={styles.warnText}>Photo evidence required for damage / missing parts.</Text>
            </View>
          ) : null}

          <Text style={styles.fieldLabel}>PHOTO {condition !== "Good" ? "(REQUIRED)" : "(OPTIONAL)"}</Text>
          <PhotoCapture testID="checkin-photo" onPhoto={setPhotoUri} label="Take photo of asset condition" required={condition !== "Good"} />

          <Text style={styles.fieldLabel}>NOTES {condition !== "Good" ? "(REQUIRED)" : "(OPTIONAL)"}</Text>
          <TextInput
            testID="condition-notes"
            value={notes}
            onChangeText={setNotes}
            placeholder="Describe condition or issues…"
            placeholderTextColor={COLORS.textMuted}
            style={[styles.input, { minHeight: 88, textAlignVertical: "top" }]}
            multiline
          />
        </ScrollView>
        <QRScanner visible={showScanner} onClose={() => setShowScanner(false)} onScan={handleScan} />

        <View style={styles.footer}>
          <TouchableOpacity testID="submit-checkin" style={styles.submit} onPress={submit} disabled={submitting} activeOpacity={0.85}>
            {submitting ? <ActivityIndicator color={COLORS.textInverse} /> : (
              <>
                <MaterialCommunityIcons name="check-bold" size={22} color={COLORS.textInverse} />
                <Text style={styles.submitText}>RETURN EQUIPMENT</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: COLORS.surface },
  iconBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  topTitle: { ...TYPE.h3, letterSpacing: 1 },
  stepLabel: { ...TYPE.label, color: COLORS.primary },
  scanBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACING.sm, backgroundColor: COLORS.text, minHeight: 64, borderRadius: RADIUS.sm },
  scanBtnText: { color: COLORS.textInverse, fontWeight: "900", letterSpacing: 1 },
  searchBox: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.sm, paddingHorizontal: SPACING.md, minHeight: TOUCH, gap: SPACING.sm },
  searchInput: { flex: 1, fontSize: 16 },
  assetRow: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.surface, padding: SPACING.sm, borderRadius: RADIUS.sm, gap: SPACING.md, minHeight: 72, borderWidth: 1, borderColor: COLORS.border },
  thumb: { width: 56, height: 56, borderRadius: RADIUS.sm, backgroundColor: COLORS.bg },
  assetName: { fontSize: 15, fontWeight: "800" },
  assetMeta: { fontSize: 12, color: COLORS.textSecondary },
  selectedCard: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.surface, padding: SPACING.md, borderRadius: RADIUS.sm, gap: SPACING.md, borderWidth: 2, borderColor: COLORS.primary },
  selectedImg: { width: 80, height: 80, borderRadius: RADIUS.sm },
  selectedName: { fontSize: 16, fontWeight: "900" },
  selectedMeta: { ...TYPE.bodyMuted },
  changeBtn: { paddingHorizontal: SPACING.md, paddingVertical: 8, borderWidth: 2, borderColor: COLORS.text, borderRadius: RADIUS.sm },
  changeBtnText: { fontWeight: "900", fontSize: 11, letterSpacing: 1 },
  condGrid: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  condBtn: { flexBasis: "47%", flexGrow: 1, alignItems: "center", justifyContent: "center", paddingVertical: SPACING.lg, borderRadius: RADIUS.sm, gap: 6, minHeight: 96 },
  condText: { fontWeight: "900", fontSize: 12, letterSpacing: 1 },
  warnBox: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, backgroundColor: COLORS.warningBg, padding: SPACING.md, borderRadius: RADIUS.sm },
  warnText: { ...TYPE.body, color: COLORS.warningText, flex: 1 },
  fieldLabel: { ...TYPE.label },
  input: { minHeight: TOUCH, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.sm, paddingHorizontal: SPACING.md, fontSize: 16, color: COLORS.text },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, padding: SPACING.md, backgroundColor: COLORS.surface, borderTopWidth: 2, borderTopColor: COLORS.borderHeavy },
  submit: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACING.sm, backgroundColor: COLORS.primary, minHeight: TOUCH + 4, borderRadius: RADIUS.sm },
  submitText: { color: COLORS.textInverse, fontWeight: "900", letterSpacing: 1, fontSize: 15 },
});
