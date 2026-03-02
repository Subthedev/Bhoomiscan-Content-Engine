import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
} from "remotion";
import { COLORS, FONTS, GRADIENTS } from "../utils/theme";
import { LogoMark } from "../components/LogoMark";

/**
 * EndCard (28-30s): BhoomiScan branding + listing call-to-action.
 * Short, punchy, memorable.
 */
export const EndCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoScale = spring({
    frame,
    fps,
    config: { damping: 10, mass: 0.6, stiffness: 200, overshootClamping: false },
  });

  const textOpacity = spring({
    frame: frame - 8,
    fps,
    config: { damping: 18, mass: 1, stiffness: 150, overshootClamping: false },
  });

  const urlOpacity = spring({
    frame: frame - 20,
    fps,
    config: { damping: 18, mass: 1, stiffness: 150, overshootClamping: false },
  });

  return (
    <AbsoluteFill
      style={{
        background: GRADIENTS.heroGreenDark,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 32,
        padding: 60,
      }}
    >
      {/* Logo */}
      <div style={{ transform: `scale(${logoScale})` }}>
        <LogoMark size={100} opacity={1} />
      </div>

      {/* Tagline */}
      <div
        style={{
          opacity: textOpacity,
          transform: `translateY(${(1 - textOpacity) * 15}px)`,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontFamily: FONTS.display,
            fontSize: 44,
            fontWeight: 700,
            color: COLORS.white,
            lineHeight: 1.3,
          }}
        >
          India's Most Trusted Land Platform
        </div>
        <div
          style={{
            fontFamily: FONTS.body,
            fontSize: 28,
            fontWeight: 500,
            color: COLORS.goldLight,
            marginTop: 8,
          }}
        >
          Verified Plots  •  Legal-Ready  •  Direct Sellers
        </div>
      </div>

      {/* URL button */}
      <div
        style={{
          opacity: urlOpacity,
          backgroundColor: COLORS.gold,
          borderRadius: 14,
          padding: "14px 40px",
          boxShadow: "0 4px 20px rgba(212, 164, 58, 0.4)",
        }}
      >
        <span
          style={{
            fontFamily: FONTS.body,
            fontSize: 36,
            fontWeight: 800,
            color: COLORS.forest,
            letterSpacing: 1,
          }}
        >
          bhoomiscan.in
        </span>
      </div>

      {/* List free text */}
      <div
        style={{
          opacity: urlOpacity,
          textAlign: "center",
        }}
      >
        <span
          style={{
            fontFamily: FONTS.body,
            fontSize: 20,
            fontWeight: 600,
            color: COLORS.goldLight,
            letterSpacing: 0.5,
          }}
        >
          List Your Land for FREE
        </span>
      </div>
    </AbsoluteFill>
  );
};
