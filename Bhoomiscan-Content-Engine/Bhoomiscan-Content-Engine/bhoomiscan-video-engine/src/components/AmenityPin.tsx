/**
 * Neon green circular pin for discovered amenities.
 * Distinct from the gold teardrop property pin.
 *
 * Spring animation is controlled externally via opacity prop
 * (MapSequence triggers pin when its route reaches the amenity).
 */

import React from "react";

interface AmenityPinProps {
  icon: string;
  opacity: number;
  index: number;
  x: number;
  y: number;
}

export const AmenityPin: React.FC<AmenityPinProps> = ({
  icon,
  opacity,
  x,
  y,
}) => {
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: `translate(-50%, -50%) scale(${opacity})`,
        opacity,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: "50%",
          backgroundColor: "rgba(15, 40, 20, 0.9)",
          border: "2px solid #39FF14",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 0 12px rgba(57, 255, 20, 0.4)",
        }}
      >
        <span style={{ fontSize: 20, lineHeight: 1 }}>{icon}</span>
      </div>
    </div>
  );
};
