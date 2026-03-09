/**
 * Animated car icon that follows the route polyline head.
 * Neon green (#39FF14) top-down car silhouette with glow.
 */

import React from "react";

interface AnimatedCarProps {
  x: number;
  y: number;
  bearing: number;
  opacity: number;
  visible: boolean;
}

export const AnimatedCar: React.FC<AnimatedCarProps> = ({
  x,
  y,
  bearing,
  opacity,
  visible,
}) => {
  if (!visible || opacity <= 0) return null;

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: `translate(-50%, -50%) rotate(${bearing}deg)`,
        opacity,
        pointerEvents: "none",
        filter: "drop-shadow(0 0 6px rgba(57, 255, 20, 0.6))",
      }}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        {/* Top-down car silhouette */}
        <rect x="7" y="2" width="10" height="20" rx="4" fill="#39FF14" />
        <rect x="8" y="4" width="8" height="5" rx="2" fill="rgba(0,0,0,0.3)" />
        <rect x="8" y="15" width="8" height="4" rx="2" fill="rgba(0,0,0,0.3)" />
        {/* Wheels */}
        <rect x="5" y="6" width="3" height="4" rx="1" fill="#39FF14" />
        <rect x="16" y="6" width="3" height="4" rx="1" fill="#39FF14" />
        <rect x="5" y="14" width="3" height="4" rx="1" fill="#39FF14" />
        <rect x="16" y="14" width="3" height="4" rx="1" fill="#39FF14" />
      </svg>
    </div>
  );
};
