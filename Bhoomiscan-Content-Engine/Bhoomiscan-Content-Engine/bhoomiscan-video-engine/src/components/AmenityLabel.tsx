/**
 * Amenity distance pill + name label.
 * High-contrast design with larger text for video readability.
 * Spring slide-up entrance.
 */

import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";

interface AmenityLabelProps {
  icon: string;
  name: string;
  distanceKm: number;
  x: number;
  y: number;
  triggerFrame: number;
}

export const AmenityLabel: React.FC<AmenityLabelProps> = ({
  icon,
  name,
  distanceKm,
  x,
  y,
  triggerFrame,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const localFrame = frame - triggerFrame;
  if (localFrame < 0) return null;

  const progress = spring({
    frame: localFrame,
    fps,
    config: { damping: 12, stiffness: 200, mass: 0.6 },
  });

  const slideY = (1 - progress) * 12;
  const scale = 0.9 + 0.1 * progress;

  const distanceText =
    distanceKm < 1
      ? `${Math.round(distanceKm * 1000)}m`
      : `${distanceKm} km`;

  const displayName = name.length > 20 ? name.slice(0, 18) + "\u2026" : name;

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: `translate(-50%, -120%) translateY(${slideY}px) scale(${scale})`,
        opacity: progress,
        pointerEvents: "none",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        zIndex: 35,
      }}
    >
      {/* Distance pill */}
      <div
        style={{
          backgroundColor: "rgba(0, 0, 0, 0.85)",
          border: "2px solid #39FF14",
          borderRadius: 18,
          padding: "5px 14px",
          display: "flex",
          alignItems: "center",
          gap: 6,
          whiteSpace: "nowrap",
          boxShadow: "0 2px 10px rgba(0,0,0,0.6), 0 0 12px rgba(57, 255, 20, 0.3)",
        }}
      >
        <span style={{ fontSize: 18, lineHeight: 1 }}>{icon}</span>
        <span
          style={{
            color: "#39FF14",
            fontSize: 22,
            fontWeight: 700,
            fontFamily: "Inter, sans-serif",
          }}
        >
          {distanceText}
        </span>
      </div>

      {/* Name label */}
      <div
        style={{
          backgroundColor: "rgba(0, 0, 0, 0.8)",
          borderRadius: 8,
          padding: "4px 10px",
          whiteSpace: "nowrap",
        }}
      >
        <span
          style={{
            color: "#ffffff",
            fontSize: 16,
            fontWeight: 500,
            fontFamily: "Inter, sans-serif",
          }}
        >
          {displayName}
        </span>
      </div>
    </div>
  );
};
