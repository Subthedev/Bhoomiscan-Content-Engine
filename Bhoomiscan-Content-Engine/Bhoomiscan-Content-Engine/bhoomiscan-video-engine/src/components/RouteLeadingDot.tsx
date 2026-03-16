/**
 * Pulsing neon green dot at the tip of the drawing route.
 * Visible only during active route drawing (frames 5-70 of each ride).
 */

import React from "react";

interface RouteLeadingDotProps {
  x: number;
  y: number;
  frame: number;
  visible: boolean;
}

export const RouteLeadingDot: React.FC<RouteLeadingDotProps> = ({
  x,
  y,
  frame,
  visible,
}) => {
  if (!visible) return null;

  // 15% size pulse
  const scale = 1 + Math.sin(frame * 0.4) * 0.15;

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: `translate(-50%, -50%) scale(${scale})`,
        width: 16,
        height: 16,
        borderRadius: "50%",
        backgroundColor: "#39FF14",
        boxShadow:
          "0 0 8px rgba(57, 255, 20, 0.9), 0 0 20px rgba(57, 255, 20, 0.6), 0 0 40px rgba(57, 255, 20, 0.3)",
        pointerEvents: "none",
        zIndex: 45,
      }}
    />
  );
};
