import { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Alert, FlatList, Image, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "../src/auth";
import { COLORS, SPACING, RADIUS, TOUCH, TYPE } from "../src/theme";

type Asset = { id: string; asset_id: string; name: string; image_url?: string; category: string; brand?: string };

export default function Booking() {
  const router = useRouter();
  const { api, user } = useAuth();
  const params = useLocalSearchParams<{ assetId?: string }>();

  const [assets, setAssets] = useState<Asset[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Asset | null>(null);
  const [property, setProperty] = useState(user?.property_assignment && user.property_assignment !== "All Properties" ? user.property_assignment : "");
  const [properties, setProperties] = useState<{ id: string; name: string }[]>([]);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().split("T")[0];
  });
  const [purpose, setPurpose] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const [a, p] = await Promise.all([
        api.get<Asset[]>("/assets"),
        api.get<{ id: string; name: string }[]>("/properties"),
      ]);
      setAssets(a.data);
      setProperties(p.data);
      if (params.assetId) {
        const found = a.data.find((x) => x.id === params.assetId);
        if (found) setSelected(found);
      }
    })();
  }, []);

  const filtered = assets.filter((a) =>
    !search ? true : (a.name + a.asset_id + (a.brand || "")).toLowerCase().includes(search.toLowerCase())
  );

  const submit = async () => {
    if (!selected) return Alert.alert("Select an asset");
    if (!property) return Alert.alert("Select a property");
    if (!startDate || !endDate) return Alert.alert("Select dates");
    if (endDate < startDate) return Alert.alert("End date must be after start date");
    setSubmitting(true);
    try {
      await api.post("/bookings", {
        asset_id: selected.id,
        property,
        start_date: startDate,
        end_date: endDate,
        purpose: purpose || null,
      });
      Alert.alert("Booking requested", `${selected.name}\n${startDate} → ${endDate}`, [{ text: "OK", onPress: () => router.back() }]);
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Booking failed");
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
          <Text style={styles.topTitle}>SCHEDULE EQUIPMENT</Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: SPACING.md, paddingBottom: 120, gap: SPACING.md }} keyboardShouldPersistTaps="handled">
          <Text style={styles.stepLabel}>STEP 1 · SELECT ASSET</Text>
          {!selected ? (
            <>
              <View style={styles.searchBox}>
                <MaterialCommunityIcons name="magnify" size={22} color={COLORS.textMuted} />
                <TextInput testID="booking-search" value={search} onChangeText={setSearch} placeholder="Search asset…" placeholderTextColor={COLORS.textMuted} style={styles.searchInput} />
              </View>
              <FlatList
                scrollEnabled={false}
                data={filtered.slice(0, 20)}
                keyExtractor={(i) => i.id}
                ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
                renderItem={({ item }) => (
                  <TouchableOpacity testID={`pick-${item.asset_id}`} style={styles.assetRow} onPress={() => setSelected(item)} activeOpacity={0.85}>
                    {item.image_url ? <Image source={{ uri: item.image_url }} style={styles.thumb} /> : <View style={styles.thumb} />}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.assetName} numberOfLines={1}>{item.name}</Text>
                      <Text style={styles.assetMeta}>{item.asset_id} · {item.category}</Text>
                    </View>
                  </TouchableOpacity>
                )}
              />
            </>
          ) : (
            <View style={styles.selectedCard}>
              {selected.image_url ? <Image source={{ uri: selected.image_url }} style={styles.selectedImg} /> : null}
              <View style={{ flex: 1 }}>
                <Text style={styles.selectedName}>{selected.name}</Text>
                <Text style={styles.selectedMeta}>{selected.asset_id}</Text>
              </View>
              <TouchableOpacity testID="change-asset" onPress={() => setSelected(null)} style={styles.changeBtn}>
                <Text style={styles.changeBtnText}>CHANGE</Text>
              </TouchableOpacity>
            </View>
          )}

          <Text style={[styles.stepLabel, { marginTop: SPACING.md }]}>STEP 2 · DATES</Text>
          <Text style={styles.fieldLabel}>START DATE</Text>
          <TextInput testID="start-date" style={styles.input} value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD" />
          <Text style={styles.fieldLabel}>END DATE</Text>
          <TextInput testID="end-date" style={styles.input} value={endDate} onChangeText={setEndDate} placeholder="YYYY-MM-DD" />

          <Text style={[styles.stepLabel, { marginTop: SPACING.md }]}>STEP 3 · DETAILS</Text>
          <Text style={styles.fieldLabel}>PROPERTY</Text>
          <View style={styles.chipWrap}>
            {properties.map((p) => (
              <TouchableOpacity
                key={p.id}
                testID={`prop-${p.name.replace(/\s+/g, "-")}`}
                style={[styles.propChip, property === p.name && styles.propChipActive]}
                onPress={() => setProperty(p.name)}
              >
                <Text style={[styles.propChipText, property === p.name && styles.propChipTextActive]}>{p.name}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.fieldLabel}>PURPOSE (OPTIONAL)</Text>
          <TextInput
            testID="purpose-input"
            value={purpose}
            onChangeText={setPurpose}
            placeholder="What will this be used for?"
            placeholderTextColor={COLORS.textMuted}
            style={[styles.input, { minHeight: 88, textAlignVertical: "top" }]}
            multiline
          />
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity testID="submit-booking" style={styles.submit} onPress={submit} disabled={submitting} activeOpacity={0.85}>
            {submitting ? <ActivityIndicator color={COLORS.textInverse} /> : (
              <>
                <MaterialCommunityIcons name="calendar-check" size={22} color={COLORS.textInverse} />
                <Text style={styles.submitText}>REQUEST BOOKING</Text>
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
  fieldLabel: { ...TYPE.label, marginTop: SPACING.sm },
  input: { minHeight: TOUCH, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.sm, paddingHorizontal: SPACING.md, fontSize: 16, color: COLORS.text },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  propChip: { paddingHorizontal: SPACING.md, paddingVertical: 14, backgroundColor: COLORS.surface, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.border, minHeight: TOUCH, justifyContent: "center" },
  propChipActive: { backgroundColor: COLORS.text, borderColor: COLORS.text },
  propChipText: { fontWeight: "800", fontSize: 13 },
  propChipTextActive: { color: COLORS.textInverse },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, padding: SPACING.md, backgroundColor: COLORS.surface, borderTopWidth: 2, borderTopColor: COLORS.borderHeavy },
  submit: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACING.sm, backgroundColor: COLORS.primary, minHeight: TOUCH + 4, borderRadius: RADIUS.sm },
  submitText: { color: COLORS.textInverse, fontWeight: "900", letterSpacing: 1, fontSize: 15 },
});
