/**
 * Neon green distance label for discovered amenities.
 * Shows icon + distance in km/m + name.
 *
 * Spring animation is controlled externally via opacity prop
 * (MapSequence triggers label 4 frames after pin).
 */

import React from "react";

interface AmenityLabelProps {
  name: string;
  icon: string;
  distanceKm: number;
  opacity: number;
  index: number;
  x: number;
  y: number;
}

export const AmenityLabel: React.FC<AmenityLabelProps> = ({
  name,
  icon,
  distanceKm,
  opacity,
  x,
  y,
}) => {
  const distanceText =
    distanceKm < 1
      ? `${Math.round(distanceKm * 1000)}m`
      : `${distanceKm} km`;

  const displayName = name.length > 18 ? name.slice(0, 16) + "\u2026" : name;

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: `translate(-50%, -130%) scale(${opacity})`,
        opacity,
        pointerEvents: "none",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 3,
      }}
    >
      <div
        style={{
          backgroundColor: "rgba(15, 40, 20, 0.9)",
          border: "2px solid #39FF14",
          borderRadius: 20,
          padding: "5px 14px",
          display: "flex",
          alignItems: "center",
          gap: 6,
          whiteSpace: "nowrap",
          boxShadow: "0 0 8px rgba(57, 255, 20, 0.3)",
        }}
      >
        <span style={{ fontSize: 16, lineHeight: 1 }}>{icon}</span>
        <span
          style={{
            color: "#39FF14",
            fontSize: 20,
            fontWeight: 700,
            fontFamily: "Inter, sans-serif",
          }}
        >
          {distanceText}
        </span>
      </div>
      <div
        style={{
          backgroundColor: "rgba(0, 0, 0, 0.75)",
          borderRadius: 8,
          padding: "3px 8px",
          whiteSpace: "nowrap",
        }}
      >
        <span
          style={{
            color: "#39FF14",
            fontSize: 14,
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
