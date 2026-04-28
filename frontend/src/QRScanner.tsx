import { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform, Alert } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { COLORS, SPACING, RADIUS, TOUCH } from "./theme";

type Props = {
  visible: boolean;
  onClose: () => void;
  onScan: (value: string) => void;
};

export default function QRScanner({ visible, onClose, onScan }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    if (visible) setScanned(false);
  }, [visible]);

  if (!visible) return null;

  if (Platform.OS === "web") {
    return (
      <View style={styles.overlay} testID="qr-scanner-overlay">
        <View style={styles.topBar}>
          <Text style={styles.topTitle}>SCAN QR CODE</Text>
          <TouchableOpacity onPress={onClose} style={styles.iconBtn} testID="qr-close">
            <MaterialCommunityIcons name="close" size={28} color={COLORS.textInverse} />
          </TouchableOpacity>
        </View>
        <View style={styles.center}>
          <MaterialCommunityIcons name="qrcode-scan" size={96} color={COLORS.textInverse} style={{ opacity: 0.4 }} />
          <Text style={styles.helpText}>QR scanning works on iOS / Android.{"\n"}Use search to select asset on web preview.</Text>
        </View>
      </View>
    );
  }

  if (!permission) return null;

  if (!permission.granted) {
    return (
      <View style={styles.overlay} testID="qr-scanner-overlay">
        <View style={styles.topBar}>
          <Text style={styles.topTitle}>CAMERA PERMISSION</Text>
          <TouchableOpacity onPress={onClose} style={styles.iconBtn} testID="qr-close">
            <MaterialCommunityIcons name="close" size={28} color={COLORS.textInverse} />
          </TouchableOpacity>
        </View>
        <View style={styles.center}>
          <MaterialCommunityIcons name="camera-off" size={64} color={COLORS.textInverse} />
          <Text style={styles.helpText}>Camera access is required to scan QR codes.</Text>
          <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission} testID="qr-grant">
            <Text style={styles.permissionBtnText}>GRANT PERMISSION</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.overlay} testID="qr-scanner-overlay">
      <View style={styles.topBar}>
        <Text style={styles.topTitle}>SCAN ASSET QR CODE</Text>
        <TouchableOpacity onPress={onClose} style={styles.iconBtn} testID="qr-close">
          <MaterialCommunityIcons name="close" size={28} color={COLORS.textInverse} />
        </TouchableOpacity>
      </View>
      <View style={{ flex: 1 }}>
        <CameraView
          style={{ flex: 1 }}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ["qr", "code128", "code39", "ean13", "ean8", "datamatrix", "pdf417"] }}
          onBarcodeScanned={(result) => {
            if (scanned) return;
            setScanned(true);
            onScan(result.data);
          }}
        />
        <View style={styles.frame} pointerEvents="none">
          <View style={[styles.corner, { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4 }]} />
          <View style={[styles.corner, { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4 }]} />
          <View style={[styles.corner, { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4 }]} />
          <View style={[styles.corner, { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4 }]} />
        </View>
        <View style={styles.bottomHelp}>
          <Text style={styles.helpText}>Point camera at asset's QR / barcode</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "#000", zIndex: 1000 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: SPACING.md, paddingTop: SPACING.lg + 16, backgroundColor: "#000" },
  topTitle: { color: COLORS.textInverse, fontWeight: "900", letterSpacing: 1, fontSize: 14 },
  iconBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: SPACING.lg, gap: SPACING.md },
  helpText: { color: COLORS.textInverse, textAlign: "center", fontSize: 14, fontWeight: "600" },
  permissionBtn: { marginTop: SPACING.md, backgroundColor: COLORS.primary, paddingHorizontal: SPACING.lg, paddingVertical: 14, borderRadius: RADIUS.sm },
  permissionBtnText: { color: COLORS.textInverse, fontWeight: "900", letterSpacing: 1 },
  frame: { position: "absolute", top: "30%", left: "15%", width: "70%", aspectRatio: 1 },
  corner: { position: "absolute", width: 36, height: 36, borderColor: COLORS.primary },
  bottomHelp: { position: "absolute", bottom: 32, left: 0, right: 0, alignItems: "center" },
});
