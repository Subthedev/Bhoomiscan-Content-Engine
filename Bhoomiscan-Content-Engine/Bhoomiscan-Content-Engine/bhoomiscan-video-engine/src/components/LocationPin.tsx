/**
 * Animated gold location pin marker.
 * Drops in with a spring animation and pulses gently.
 */

import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

interface LocationPinProps {
  opacity: number;
}

export const LocationPin: React.FC<LocationPinProps> = ({ opacity }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Spring drop animation
  const drop = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 180, mass: 0.8 },
  });

  // Gentle pulse
  const pulse = 1 + Math.sin(frame * 0.15) * 0.05;

  const scale = drop * pulse;
  const translateY = interpolate(drop, [0, 1], [-40, 0]);

  return (
    <div
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: `translate(-50%, -100%) translateY(${translateY}px) scale(${scale})`,
        opacity,
        pointerEvents: "none",
        filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.4))",
      }}
    >
      <svg width="48" height="64" viewBox="0 0 48 64" fill="none">
        {/* Pin body */}
        <path
          d="M24 0C10.745 0 0 10.745 0 24c0 18 24 40 24 40s24-22 24-40C48 10.745 37.255 0 24 0z"
          fill="#d4a43a"
        />
        {/* Inner circle */}
        <circle cx="24" cy="22" r="10" fill="#1a3a27" />
        {/* Inner dot */}
        <circle cx="24" cy="22" r="5" fill="#e0c06a" />
      </svg>
    </div>
  );
};
