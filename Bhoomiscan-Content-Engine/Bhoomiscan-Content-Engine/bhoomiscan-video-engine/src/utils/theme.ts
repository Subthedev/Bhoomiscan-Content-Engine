/**
 * Brand constants for Remotion video rendering (inline styles, no Tailwind).
 * Source of truth: main app's src/index.css HSL values converted to hex.
 */

export const COLORS = {
  forest: "#1a3a27",
  forestLight: "#234d35",
  forestDark: "#0f2819",
  gold: "#d4a43a",
  goldLight: "#e0c06a",
  goldDark: "#b8862a",
  emerald: "#10b981",
  emeraldLight: "#34d399",
  cream: "#f9f7f4",
  white: "#ffffff",
  black: "#000000",
  textPrimary: "#1a1a1a",
  textSecondary: "#6b7280",
  overlay: "rgba(0, 0, 0, 0.55)",
  overlayLight: "rgba(0, 0, 0, 0.35)",
} as const;

export const FONTS = {
  body: "Inter, sans-serif",
  display: "'Source Serif 4', Georgia, serif",
} as const;

export const GRADIENTS = {
  heroGreen: `linear-gradient(135deg, ${COLORS.forest} 0%, ${COLORS.forestLight} 100%)`,
  heroGreenDark: `linear-gradient(135deg, ${COLORS.forestDark} 0%, ${COLORS.forest} 100%)`,
  gold: `linear-gradient(135deg, ${COLORS.gold} 0%, ${COLORS.goldLight} 100%)`,
  goldDark: `linear-gradient(135deg, ${COLORS.goldDark} 0%, ${COLORS.gold} 100%)`,
  overlay: `linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.1) 50%, rgba(0,0,0,0.3) 100%)`,
  overlayBottom: `linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 60%)`,
} as const;

/** Video dimensions: 1080x1920 (9:16 vertical) */
export const VIDEO = {
  width: 1080,
  height: 1920,
} as const;
