import React from "react";
import { useCurrentFrame } from "remotion";
import { COLORS, FONTS, VIDEO } from "../utils/theme";

interface BottomTickerProps {
  text?: string;
}

/**
 * Bottom ticker bar — bigger, positioned ~60px up from bottom (anti-crop).
 * Scrolls in opposite direction to top ticker.
 */
export const BottomTicker: React.FC<BottomTickerProps> = ({
  text = "List Your Land FREE  ★  अपनी ज़मीन मुफ़्त लिस्ट करें  ★  ଆପଣଙ୍କ ଜମି ମାଗଣାରେ ଲିଷ୍ଟ କରନ୍ତୁ",
}) => {
  const frame = useCurrentFrame();
  const speed = 1.4;
  // Scroll right (opposite direction)
  const offset = (frame * speed) % (VIDEO.width * 3) - VIDEO.width * 2;

  const repeated = `${text}     ★     ${text}     ★     ${text}     ★     ${text}     ★     `;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 62,
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
          color: COLORS.goldLight,
          letterSpacing: 0.8,
          transform: `translateX(${offset}px)`,
        }}
      >
        {repeated}
      </div>
    </div>
  );
};
