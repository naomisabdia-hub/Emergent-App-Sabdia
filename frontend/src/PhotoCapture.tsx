import { useState, forwardRef, useImperativeHandle } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image, Platform, Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { COLORS, SPACING, RADIUS } from "./theme";

export type PhotoCaptureRef = { reset: () => void };

type Props = {
  onPhoto: (dataUri: string | null) => void;
  label?: string;
  required?: boolean;
  testID?: string;
};

const PhotoCapture = forwardRef<PhotoCaptureRef, Props>(function PhotoCapture(
  { onPhoto, label = "Take Photo", required, testID },
  ref
) {
  const [preview, setPreview] = useState<string | null>(null);

  useImperativeHandle(ref, () => ({
    reset: () => {
      setPreview(null);
      onPhoto(null);
    },
  }));

  const pick = async () => {
    // Web browsers don't have a camera API — fall back to file picker
    if (Platform.OS === "web") {
      await pickFromLibrary();
      return;
    }
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Camera permission denied", "Please allow camera access to take photos.");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.6,
        base64: true,
        allowsEditing: false,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const a = result.assets[0];
      const uri = a.base64 ? `data:image/jpeg;base64,${a.base64}` : a.uri;
      setPreview(uri);
      onPhoto(uri);
    } catch (e: any) {
      Alert.alert("Camera error", e?.message || "Could not open camera");
    }
  };

  const pickFromLibrary = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permission denied", "Please allow photo library access.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.6,
        base64: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const a = result.assets[0];
      const uri = a.base64 ? `data:image/jpeg;base64,${a.base64}` : a.uri;
      setPreview(uri);
      onPhoto(uri);
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Could not open gallery");
    }
  };

  if (preview) {
    return (
      <View style={styles.previewBox} testID={testID}>
        <Image source={{ uri: preview }} style={styles.previewImg} />
        <View style={styles.previewActions}>
          <TouchableOpacity style={styles.smallBtn} onPress={pick}>
            <MaterialCommunityIcons name="camera-retake" size={18} color={COLORS.text} />
            <Text style={styles.smallBtnText}>RETAKE</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.smallBtn, { backgroundColor: COLORS.dangerBg, borderColor: COLORS.danger }]} onPress={() => { setPreview(null); onPhoto(null); }}>
            <MaterialCommunityIcons name="close" size={18} color={COLORS.dangerText} />
            <Text style={[styles.smallBtnText, { color: COLORS.dangerText }]}>REMOVE</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={{ gap: SPACING.sm }}>
      <TouchableOpacity testID={testID || "photo-capture"} style={styles.captureBox} onPress={pick} activeOpacity={0.85}>
        <MaterialCommunityIcons name="camera" size={32} color={COLORS.text} />
        <Text style={styles.captureLabel}>{label}</Text>
        {required ? <Text style={styles.required}>REQUIRED</Text> : null}
      </TouchableOpacity>
      <TouchableOpacity onPress={pickFromLibrary} style={styles.galleryBtn}>
        <MaterialCommunityIcons name="image" size={18} color={COLORS.textSecondary} />
        <Text style={styles.galleryText}>{Platform.OS === "web" ? "Upload photo" : "Choose from gallery"}</Text>
      </TouchableOpacity>
    </View>
  );
});

export default PhotoCapture;

const styles = StyleSheet.create({
  captureBox: {
    height: 140,
    borderWidth: 2,
    borderColor: COLORS.borderHeavy,
    borderStyle: "dashed",
    borderRadius: RADIUS.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surface,
    gap: 6,
  },
  captureLabel: { fontSize: 14, fontWeight: "800", color: COLORS.text },
  required: { fontSize: 10, fontWeight: "900", color: COLORS.dangerText, letterSpacing: 1 },
  galleryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, padding: 8 },
  galleryText: { fontSize: 13, color: COLORS.textSecondary, fontWeight: "600" },
  previewBox: { gap: SPACING.sm },
  previewImg: { width: "100%", height: 220, borderRadius: RADIUS.sm, backgroundColor: COLORS.bg },
  previewActions: { flexDirection: "row", gap: SPACING.sm },
  smallBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderRadius: RADIUS.sm, borderWidth: 2, borderColor: COLORS.text, backgroundColor: COLORS.surface },
  smallBtnText: { fontSize: 12, fontWeight: "900", color: COLORS.text, letterSpacing: 1 },
});
