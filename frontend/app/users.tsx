import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Alert, FlatList, ActivityIndicator, Modal, KeyboardAvoidingView, Platform, Share } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "../src/auth";
import { COLORS, SPACING, RADIUS, TOUCH, TYPE } from "../src/theme";

type User = {
  id: string;
  email: string;
  full_name: string;
  role: "admin" | "team";
  property_assignment?: string | null;
  phone?: string | null;
  status: "Active" | "Deactivated";
  last_login?: string | null;
  initial_password?: string;
};

export default function UsersScreen() {
  const router = useRouter();
  const { api, user: me } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [credToShow, setCredToShow] = useState<{ name: string; email: string; password: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get<User[]>("/users");
      setUsers(r.data);
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Could not load users");
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { load(); }, [load]);

  const handleDeactivate = (u: User) => {
    Alert.alert(
      "Deactivate user?",
      `${u.full_name} will not be able to sign in.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Deactivate", style: "destructive", onPress: async () => {
            try {
              await api.post(`/users/${u.id}/deactivate`);
              load();
            } catch (e: any) {
              Alert.alert("Error", e?.response?.data?.detail || "Failed");
            }
          }
        },
      ]
    );
  };

  const handleReactivate = async (u: User) => {
    try {
      await api.post(`/users/${u.id}/reactivate`);
      load();
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Failed");
    }
  };

  const handleResetPw = (u: User) => {
    Alert.alert("Reset password?", `Generate a new login password for ${u.full_name}?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Reset", onPress: async () => {
        try {
          const r = await api.post<{ ok: boolean; new_password: string }>(`/users/${u.id}/reset-password`);
          setCredToShow({ name: u.full_name, email: u.email, password: r.data.new_password });
        } catch (e: any) { Alert.alert("Error", e?.response?.data?.detail || "Failed"); }
      } },
    ]);
  };

  const counts = {
    total: users.length,
    admin: users.filter((u) => u.role === "admin").length,
    team: users.filter((u) => u.role === "team").length,
    deact: users.filter((u) => u.status === "Deactivated").length,
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Team & Users</Text>
        <TouchableOpacity onPress={() => setShowInvite(true)} style={styles.inviteBtn} testID="invite-user-btn">
          <MaterialCommunityIcons name="account-plus" size={18} color={COLORS.textInverse} />
          <Text style={styles.inviteBtnText}>Invite</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statsRow}>
        <Stat label="Total" value={counts.total} />
        <Stat label="Admins" value={counts.admin} />
        <Stat label="Team" value={counts.team} />
        <Stat label="Disabled" value={counts.deact} tone="danger" />
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(u) => u.id}
          contentContainerStyle={{ padding: SPACING.md, gap: 10, paddingBottom: SPACING.xxl }}
          renderItem={({ item }) => (
            <UserCard
              user={item}
              isMe={item.id === me?.id}
              onEdit={() => setEditing(item)}
              onDeactivate={() => handleDeactivate(item)}
              onReactivate={() => handleReactivate(item)}
              onResetPw={() => handleResetPw(item)}
            />
          )}
        />
      )}

      <InviteModal
        visible={showInvite}
        onClose={() => setShowInvite(false)}
        onCreated={(u) => {
          setShowInvite(false);
          if (u.initial_password) {
            setCredToShow({ name: u.full_name, email: u.email, password: u.initial_password });
          }
          load();
        }}
        api={api}
      />
      <EditModal
        visible={!!editing}
        user={editing}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); load(); }}
        api={api}
      />
      <CredentialsModal
        visible={!!credToShow}
        cred={credToShow}
        onClose={() => setCredToShow(null)}
      />
    </SafeAreaView>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "danger" }) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, tone === "danger" && { color: COLORS.dangerText }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function UserCard({ user, isMe, onEdit, onDeactivate, onReactivate, onResetPw }: any) {
  const initial = (user.full_name || "?").trim().split(/\s+/).map((p: string) => p[0]).slice(0, 2).join("").toUpperCase();
  const isActive = user.status === "Active";
  const isAdmin = user.role === "admin";
  return (
    <View style={[styles.userCard, !isActive && { opacity: 0.6 }]}>
      <View style={[styles.avatar, isAdmin ? { backgroundColor: COLORS.primary } : { backgroundColor: COLORS.text }]}>
        <Text style={styles.avatarText}>{initial}</Text>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={styles.userName}>{user.full_name}</Text>
          {isMe ? <Text style={styles.youBadge}>YOU</Text> : null}
        </View>
        <Text style={styles.userEmail}>{user.email}</Text>
        <View style={{ flexDirection: "row", gap: 6, marginTop: 4 }}>
          <Pill label={isAdmin ? "ADMIN" : "TEAM"} tone={isAdmin ? "primary" : "neutral"} />
          {!isActive ? <Pill label="DEACTIVATED" tone="danger" /> : <Pill label="ACTIVE" tone="success" />}
          {user.property_assignment ? <Pill label={user.property_assignment} tone="neutral" /> : null}
        </View>
      </View>
      {!isMe ? (
        <View style={styles.userActions}>
          <TouchableOpacity onPress={onEdit} style={styles.actionBtn} testID={`edit-${user.email}`}>
            <MaterialCommunityIcons name="pencil" size={18} color={COLORS.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onResetPw} style={styles.actionBtn} testID={`reset-${user.email}`}>
            <MaterialCommunityIcons name="lock-reset" size={18} color={COLORS.text} />
          </TouchableOpacity>
          {isActive ? (
            <TouchableOpacity onPress={onDeactivate} style={[styles.actionBtn, { backgroundColor: COLORS.dangerBg }]} testID={`deact-${user.email}`}>
              <MaterialCommunityIcons name="account-cancel" size={18} color={COLORS.dangerText} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={onReactivate} style={[styles.actionBtn, { backgroundColor: COLORS.successBg }]}>
              <MaterialCommunityIcons name="account-check" size={18} color={COLORS.successText} />
            </TouchableOpacity>
          )}
        </View>
      ) : null}
    </View>
  );
}

function Pill({ label, tone }: { label: string; tone: "primary" | "neutral" | "danger" | "success" }) {
  const styles2: any = {
    primary: { bg: COLORS.primary + "22", fg: COLORS.primary },
    neutral: { bg: "#F3F4F6", fg: "#374151" },
    danger: { bg: COLORS.dangerBg, fg: COLORS.dangerText },
    success: { bg: COLORS.successBg, fg: COLORS.successText },
  }[tone];
  return (
    <View style={[styles.pill, { backgroundColor: styles2.bg }]}>
      <Text style={[styles.pillText, { color: styles2.fg }]}>{label}</Text>
    </View>
  );
}

function InviteModal({ visible, onClose, onCreated, api }: any) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"admin" | "team">("team");
  const [property, setProperty] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!visible) {
      setEmail(""); setName(""); setRole("team"); setProperty(""); setPhone("");
    }
  }, [visible]);

  const submit = async () => {
    if (!email.trim() || !name.trim()) return Alert.alert("Required", "Please enter name and email.");
    setSubmitting(true);
    try {
      const r = await api.post("/users", { email: email.trim().toLowerCase(), full_name: name.trim(), role, property_assignment: property || null, phone: phone || null });
      onCreated(r.data);
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Failed to invite user");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View style={styles.topBar}>
            <TouchableOpacity onPress={onClose} style={styles.iconBtn}><MaterialCommunityIcons name="close" size={24} color={COLORS.text} /></TouchableOpacity>
            <Text style={styles.topTitle}>Invite Team Member</Text>
            <View style={{ width: 44 }} />
          </View>
          <ScrollView contentContainerStyle={{ padding: SPACING.md, gap: 14 }} keyboardShouldPersistTaps="handled">
            <Text style={styles.help}>A login password will be auto-generated and shown once. You can share it with the user.</Text>
            <Field label="Full name" value={name} onChange={setName} placeholder="e.g. Sam Johnson" testID="invite-name" />
            <Field label="Email" value={email} onChange={setEmail} placeholder="user@sabdia.com" testID="invite-email" autoCap="none" keyboardType="email-address" />
            <View>
              <Text style={styles.fieldLabel}>Role</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <RolePick label="TEAM" desc="Standard access" active={role === "team"} onPress={() => setRole("team")} />
                <RolePick label="ADMIN" desc="Full control" active={role === "admin"} onPress={() => setRole("admin")} />
              </View>
            </View>
            <Field label="Property (optional)" value={property} onChange={setProperty} placeholder="e.g. 96 Newman Avenue" />
            <Field label="Phone (optional)" value={phone} onChange={setPhone} placeholder="0400 000 000" keyboardType="phone-pad" />
          </ScrollView>
          <View style={styles.footer}>
            <TouchableOpacity onPress={submit} disabled={submitting} style={styles.submit} testID="invite-submit">
              {submitting ? <ActivityIndicator color={COLORS.textInverse} /> : <Text style={styles.submitText}>Send Invite</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

function EditModal({ visible, user, onClose, onSaved, api }: any) {
  const [name, setName] = useState("");
  const [role, setRole] = useState<"admin" | "team">("team");
  const [property, setProperty] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.full_name || "");
      setRole(user.role || "team");
      setProperty(user.property_assignment || "");
      setPhone(user.phone || "");
    }
  }, [user]);

  if (!user) return null;

  const save = async () => {
    setSaving(true);
    try {
      await api.patch(`/users/${user.id}`, { full_name: name, role, property_assignment: property || null, phone: phone || null });
      onSaved();
    } catch (e: any) { Alert.alert("Error", e?.response?.data?.detail || "Failed"); }
    finally { setSaving(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={onClose} style={styles.iconBtn}><MaterialCommunityIcons name="close" size={24} color={COLORS.text} /></TouchableOpacity>
          <Text style={styles.topTitle}>Edit User</Text>
          <View style={{ width: 44 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: SPACING.md, gap: 14 }}>
          <Field label="Full name" value={name} onChange={setName} />
          <View>
            <Text style={styles.fieldLabel}>Role</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <RolePick label="TEAM" desc="Standard access" active={role === "team"} onPress={() => setRole("team")} />
              <RolePick label="ADMIN" desc="Full control" active={role === "admin"} onPress={() => setRole("admin")} />
            </View>
          </View>
          <Field label="Property" value={property} onChange={setProperty} placeholder="(optional)" />
          <Field label="Phone" value={phone} onChange={setPhone} placeholder="(optional)" keyboardType="phone-pad" />
        </ScrollView>
        <View style={styles.footer}>
          <TouchableOpacity onPress={save} disabled={saving} style={styles.submit}>
            {saving ? <ActivityIndicator color={COLORS.textInverse} /> : <Text style={styles.submitText}>Save Changes</Text>}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function CredentialsModal({ visible, cred, onClose }: { visible: boolean; cred: any; onClose: () => void }) {
  if (!cred) return null;
  const message = `Sabdia Equipment Login\n\nName: ${cred.name}\nEmail: ${cred.email}\nPassword: ${cred.password}\n\nPlease change your password after first login.`;
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.modalBg}>
        <View style={styles.modalCard}>
          <View style={[styles.iconCircle, { backgroundColor: COLORS.successBg }]}>
            <MaterialCommunityIcons name="check-circle" size={32} color={COLORS.successText} />
          </View>
          <Text style={styles.modalTitle}>User credentials ready</Text>
          <Text style={styles.modalSub}>Share these login details with the user. They will only be shown once.</Text>
          <View style={styles.credBox}>
            <Text style={styles.credLabel}>Email</Text>
            <Text style={styles.credValue} selectable>{cred.email}</Text>
            <Text style={[styles.credLabel, { marginTop: 8 }]}>Password</Text>
            <Text style={[styles.credValue, { fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" }]} selectable>{cred.password}</Text>
          </View>
          <TouchableOpacity style={styles.shareBtn} onPress={() => Share.share({ message })}>
            <MaterialCommunityIcons name="share-variant" size={18} color={COLORS.text} />
            <Text style={styles.shareText}>Share / Copy</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} style={[styles.submit, { marginTop: 8 }]}>
            <Text style={styles.submitText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function Field({ label, value, onChange, placeholder, testID, autoCap, keyboardType }: any) {
  return (
    <View>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textMuted}
        style={styles.input}
        autoCapitalize={autoCap || "words"}
        keyboardType={keyboardType || "default"}
      />
    </View>
  );
}

function RolePick({ label, desc, active, onPress }: any) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.roleCard, active && { borderColor: COLORS.primary, backgroundColor: COLORS.primary + "11" }]} activeOpacity={0.85}>
      <Text style={[styles.roleLabel, active && { color: COLORS.primary }]}>{label}</Text>
      <Text style={styles.roleDesc}>{desc}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: SPACING.md, backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  topTitle: { fontSize: 18, fontWeight: "800", color: COLORS.text },
  iconBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  inviteBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: COLORS.primary, paddingHorizontal: 14, height: 36, borderRadius: 8 },
  inviteBtnText: { color: COLORS.textInverse, fontWeight: "800", fontSize: 13 },
  statsRow: { flexDirection: "row", padding: SPACING.md, gap: 8 },
  statCard: { flex: 1, backgroundColor: COLORS.surface, padding: 12, borderRadius: 10, alignItems: "center", borderWidth: 1, borderColor: COLORS.border },
  statValue: { fontSize: 22, fontWeight: "900", color: COLORS.text },
  statLabel: { fontSize: 11, color: COLORS.textSecondary, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase", marginTop: 2 },
  userCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: COLORS.surface, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  avatarText: { color: COLORS.textInverse, fontWeight: "800", fontSize: 14 },
  userName: { fontSize: 15, fontWeight: "700", color: COLORS.text },
  userEmail: { fontSize: 12, color: COLORS.textSecondary },
  youBadge: { fontSize: 9, fontWeight: "900", color: COLORS.primary, backgroundColor: COLORS.primary + "22", paddingHorizontal: 5, paddingVertical: 2, borderRadius: 3, letterSpacing: 0.5 },
  userActions: { flexDirection: "row", gap: 4 },
  actionBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 8, backgroundColor: COLORS.bg },
  pill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3 },
  pillText: { fontSize: 9, fontWeight: "800", letterSpacing: 0.4 },
  fieldLabel: { fontSize: 12, fontWeight: "700", color: COLORS.textSecondary, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  input: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 14, height: 48, fontSize: 15, color: COLORS.text },
  roleCard: { flex: 1, padding: 14, borderRadius: 10, borderWidth: 2, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  roleLabel: { fontSize: 14, fontWeight: "900", color: COLORS.text, letterSpacing: 0.5 },
  roleDesc: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  help: { fontSize: 13, color: COLORS.textSecondary, padding: 12, backgroundColor: COLORS.infoBg, borderRadius: 8, borderLeftWidth: 3, borderLeftColor: COLORS.info },
  footer: { padding: SPACING.md, backgroundColor: COLORS.surface, borderTopWidth: 1, borderTopColor: COLORS.border },
  submit: { backgroundColor: COLORS.primary, height: 52, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  submitText: { color: COLORS.textInverse, fontWeight: "800", fontSize: 15, letterSpacing: 0.3 },
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", padding: SPACING.lg },
  modalCard: { backgroundColor: COLORS.surface, padding: 20, borderRadius: 14, gap: 10, alignItems: "center", width: "100%", maxWidth: 420 },
  iconCircle: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  modalTitle: { fontSize: 18, fontWeight: "800", color: COLORS.text },
  modalSub: { fontSize: 13, color: COLORS.textSecondary, textAlign: "center" },
  credBox: { width: "100%", padding: 14, backgroundColor: COLORS.bg, borderRadius: 8 },
  credLabel: { fontSize: 11, fontWeight: "700", color: COLORS.textSecondary, letterSpacing: 0.5, textTransform: "uppercase" },
  credValue: { fontSize: 15, fontWeight: "700", color: COLORS.text, marginTop: 2 },
  shareBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 44, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, width: "100%" },
  shareText: { fontSize: 14, fontWeight: "700", color: COLORS.text },
});
