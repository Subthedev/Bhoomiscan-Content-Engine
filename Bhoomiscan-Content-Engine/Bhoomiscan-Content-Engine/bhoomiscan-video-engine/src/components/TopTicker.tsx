import React from "react";
import { useCurrentFrame } from "remotion";
import { COLORS, FONTS, VIDEO } from "../utils/theme";

interface TopTickerProps {
  text?: string;
}

/**
 * Top ticker bar — bigger, positioned ~60px down from top (anti-crop).
 * Gold text on semi-transparent dark bar.
 */
export const TopTicker: React.FC<TopTickerProps> = ({
  text = "Verified Plots on bhoomiscan.in  ★  भूमिस्कैन पर सत्यापित प्लॉट  ★  bhoomiscan.in ରେ ଯାଞ୍ଚ ହୋଇଥିବା ପ୍ଲଟ୍",
}) => {
  const frame = useCurrentFrame();
  const speed = 1.8;
  const offset = -(frame * speed) % (VIDEO.width * 3);

  const repeated = `${text}     ★     ${text}     ★     ${text}     ★     ${text}     ★     `;

  return (
    <div
      style={{
        position: "absolute",
        top: 60,
        left: 0,
        width: VIDEO.width,
        height: 56,
        backgroundColor: "rgba(26, 58, 39, 0.85)",
        borderTop: `2px solid ${COLORS.gold}`,
        borderBottom: `2px solid ${COLORS.gold}`,
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        zIndex: 100,
      }}
    >
      <div
        style={{
          whiteSpace: "nowrap",
          fontFamily: FONTS.body,
          fontSize: 22,
          fontWeight: 600,
          color: COLORS.gold,
          letterSpacing: 0.8,
          transform: `translateX(${offset}px)`,
        }}
      >
        {repeated}
      </div>
    </div>
  );
};
