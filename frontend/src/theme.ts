export const COLORS = {
  primary: "#1B3A5C",       // Sabdia deep navy
  primaryActive: "#132B45", // pressed state
  bg: "#F5F4F1",            // warm off-white — feels premium not clinical
  surface: "#FFFFFF",
  surfaceDark: "#0F1F30",
  text: "#0F1F30",
  textSecondary: "#4B5563",
  textInverse: "#FFFFFF",
  textMuted: "#9CA3AF",
  border: "#E8E6E1",        // slightly warm border
  borderHeavy: "#1B3A5C",   // navy border instead of harsh black
  success: "#10B981",
  successBg: "#D1FAE5",
  successText: "#065F46",
  warning: "#F59E0B",
  warningBg: "#FEF3C7",
  warningText: "#92400E",
  danger: "#EF4444",
  dangerBg: "#FEE2E2",
  dangerText: "#991B1B",
  info: "#3B82F6",
  infoBg: "#DBEAFE",
  infoText: "#1E40AF",
};

export const SPACING = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 };
export const RADIUS = { none: 0, sm: 4, md: 8 };
export const TOUCH = 56;

export const TYPE = {
  h1: { fontSize: 32, lineHeight: 40, fontWeight: "900" as const, letterSpacing: -1, color: COLORS.text },
  h2: { fontSize: 24, lineHeight: 32, fontWeight: "800" as const, letterSpacing: -0.5, color: COLORS.text },
  h3: { fontSize: 20, lineHeight: 28, fontWeight: "700" as const, color: COLORS.text },
  body: { fontSize: 16, lineHeight: 24, color: COLORS.text },
  bodyLarge: { fontSize: 18, lineHeight: 28, color: COLORS.text },
  bodyMuted: { fontSize: 14, lineHeight: 20, color: COLORS.textSecondary },
  label: { fontSize: 12, lineHeight: 16, fontWeight: "800" as const, textTransform: "uppercase" as const, letterSpacing: 1, color: COLORS.textSecondary },
};

export function statusColor(status?: string) {
  switch (status) {
    case "Available": return { bg: COLORS.successBg, fg: COLORS.successText };
    case "Checked Out": return { bg: COLORS.dangerBg, fg: COLORS.dangerText };
    case "Booked":
    case "Reserved": return { bg: COLORS.warningBg, fg: COLORS.warningText };
    case "Maintenance":
    case "Damaged": return { bg: "#F3F4F6", fg: "#374151" };
    default: return { bg: COLORS.infoBg, fg: COLORS.infoText };
  }
}
