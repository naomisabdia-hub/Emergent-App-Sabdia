import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "../src/auth";
import { COLORS, SPACING, RADIUS, TOUCH, TYPE } from "../src/theme";

export default function Login() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("naomi@sabdia.com");
  const [password, setPassword] = useState("Admin123!");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setLoading(true);
    setError(null);
    try {
      await login(email.trim(), password);
      router.replace("/(tabs)/dashboard");
    } catch (e: any) {
      const d = e?.response?.data?.detail;
      setError(typeof d === "string" ? d : "Login failed. Check credentials.");
    } finally {
      setLoading(false);
    }
  };

  const fillAs = (e: string, p: string) => {
    setEmail(e);
    setPassword(p);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.brandWrap}>
            <View style={styles.logoBox}>
              <MaterialCommunityIcons name="hard-hat" size={48} color={COLORS.textInverse} />
            </View>
            <Text style={styles.brand}>SABDIA</Text>
            <Text style={styles.brandSub}>EQUIPMENT MANAGEMENT</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>EMAIL</Text>
            <TextInput
              testID="login-email-input"
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="you@sabdia.com"
              placeholderTextColor={COLORS.textMuted}
            />
            <Text style={[styles.label, { marginTop: SPACING.md }]}>PASSWORD</Text>
            <TextInput
              testID="login-password-input"
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="••••••••"
              placeholderTextColor={COLORS.textMuted}
            />
            {error ? (
              <Text testID="login-error" style={styles.error}>
                {error}
              </Text>
            ) : null}
            <TouchableOpacity
              testID="login-submit-button"
              style={styles.primaryBtn}
              onPress={submit}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.textInverse} />
              ) : (
                <Text style={styles.primaryBtnText}>SIGN IN</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.demoWrap}>
            <Text style={styles.demoTitle}>QUICK DEMO LOGINS</Text>
            <TouchableOpacity testID="demo-admin" style={styles.demoBtn} onPress={() => fillAs("naomi@sabdia.com", "Admin123!")}>
              <View style={[styles.demoIcon, { backgroundColor: COLORS.primary + "22" }]}>
                <MaterialCommunityIcons name="shield-account" size={18} color={COLORS.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.demoText}>Naomi Durcau</Text>
                <Text style={styles.demoSub}>Admin · full control</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity testID="demo-team" style={styles.demoBtn} onPress={() => fillAs("johnny@sabdia.com", "Team123!")}>
              <View style={[styles.demoIcon, { backgroundColor: COLORS.text + "22" }]}>
                <MaterialCommunityIcons name="hammer-wrench" size={18} color={COLORS.text} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.demoText}>Johnny Fainges</Text>
                <Text style={styles.demoSub}>Team · check out / in</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  container: { padding: SPACING.lg, paddingTop: SPACING.xl, gap: SPACING.lg },
  brandWrap: { alignItems: "center", marginBottom: SPACING.lg },
  logoBox: {
    width: 88,
    height: 88,
    backgroundColor: COLORS.text,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: RADIUS.sm,
    marginBottom: SPACING.md,
  },
  brand: { ...TYPE.h1, fontSize: 36, letterSpacing: 2 },
  brandSub: { ...TYPE.label, marginTop: 4, color: COLORS.primary },
  card: {
    backgroundColor: COLORS.surface,
    padding: SPACING.lg,
    borderRadius: RADIUS.sm,
    borderWidth: 2,
    borderColor: COLORS.borderHeavy,
  },
  label: { ...TYPE.label, marginBottom: SPACING.xs },
  input: {
    minHeight: TOUCH,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.md,
    fontSize: 16,
    color: COLORS.text,
  },
  primaryBtn: {
    marginTop: SPACING.lg,
    backgroundColor: COLORS.primary,
    minHeight: TOUCH,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: RADIUS.sm,
  },
  primaryBtnText: { ...TYPE.h3, color: COLORS.textInverse, letterSpacing: 1 },
  error: {
    marginTop: SPACING.md,
    color: COLORS.dangerText,
    backgroundColor: COLORS.dangerBg,
    padding: SPACING.md,
    borderRadius: RADIUS.sm,
  },
  demoWrap: { gap: SPACING.sm },
  demoTitle: { ...TYPE.label, marginBottom: SPACING.xs },
  demoBtn: {
    minHeight: TOUCH,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
  },
  demoIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  demoText: { fontSize: 14, fontWeight: "700", color: COLORS.text },
  demoSub: { fontSize: 11, color: COLORS.textSecondary, marginTop: 1 },
});
