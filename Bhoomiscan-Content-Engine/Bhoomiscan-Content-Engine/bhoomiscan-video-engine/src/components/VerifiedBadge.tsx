import React from "react";
import { useCurrentFrame, useVideoConfig, spring } from "remotion";
import { COLORS, FONTS } from "../utils/theme";

interface VerifiedBadgeProps {
  delay?: number;
  size?: "small" | "medium" | "large";
  showShine?: boolean;
}

const SIZES = {
  small: { fontSize: 16, paddingH: 12, paddingV: 6, iconSize: 16 },
  medium: { fontSize: 20, paddingH: 16, paddingV: 8, iconSize: 20 },
  large: { fontSize: 26, paddingH: 20, paddingV: 10, iconSize: 24 },
};

export const VerifiedBadge: React.FC<VerifiedBadgeProps> = ({
  delay = 0,
  size = "medium",
  showShine = false,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = SIZES[size];

  const scale = spring({
    frame: frame - delay,
    fps,
    config: { damping: 12, mass: 0.8, stiffness: 200 },
  });

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        backgroundColor: COLORS.emerald,
        borderRadius: 999,
        paddingLeft: s.paddingH,
        paddingRight: s.paddingH,
        paddingTop: s.paddingV,
        paddingBottom: s.paddingV,
        transform: `scale(${scale})`,
        boxShadow: "0 4px 12px rgba(16, 185, 129, 0.4)",
      }}
    >
      <svg
        width={s.iconSize}
        height={s.iconSize}
        viewBox="0 0 24 24"
        fill="none"
        stroke={COLORS.white}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
      <span
        style={{
          fontFamily: FONTS.body,
          fontSize: s.fontSize,
          fontWeight: 700,
          color: COLORS.white,
          letterSpacing: 0.5,
        }}
      >
        BhoomiScan Verified
      </span>
    </div>
  );
};
