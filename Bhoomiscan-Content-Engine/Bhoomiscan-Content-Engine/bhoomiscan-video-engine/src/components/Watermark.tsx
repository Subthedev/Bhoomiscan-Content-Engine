import React from "react";
import { useCurrentFrame, useVideoConfig, spring } from "remotion";
import { LogoMark } from "./LogoMark";
import { COLORS, FONTS } from "../utils/theme";

/**
 * BhoomiScan logo watermark — positioned ABOVE the TopTicker bar
 * with a semi-transparent dark backdrop pill for readability.
 */
export const Watermark: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const opacity = spring({
    frame: frame - 5,
    fps,
    config: { damping: 20, mass: 1, stiffness: 120, overshootClamping: false },
  });

  return (
    <div
      style={{
        position: "absolute",
        top: 14,
        left: 12,
        zIndex: 110,
        display: "flex",
        alignItems: "center",
        gap: 8,
        opacity: Math.min(opacity, 0.92),
        backgroundColor: "rgba(0, 0, 0, 0.35)",
        borderRadius: 20,
        padding: "4px 12px 4px 6px",
      }}
    >
      <LogoMark size={39} opacity={1} />
      <span
        style={{
          fontFamily: FONTS.body,
          fontSize: 18,
          fontWeight: 700,
          color: COLORS.white,
          letterSpacing: 0.5,
          textShadow: "0 1px 4px rgba(0,0,0,0.5)",
        }}
      >
        BhoomiScan
      </span>
    </div>
  );
};
