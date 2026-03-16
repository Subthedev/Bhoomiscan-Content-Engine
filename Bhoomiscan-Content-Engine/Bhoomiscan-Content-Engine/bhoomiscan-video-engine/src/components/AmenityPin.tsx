/**
 * Amenity pin marker — white circle with category emoji.
 * 48px diameter for clear visibility on satellite imagery.
 * Spring bounce entrance with pulse ring.
 */

import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";

interface AmenityPinProps {
  icon: string;
  x: number;
  y: number;
  triggerFrame: number;
  amenityIndex?: number;
}

export const AmenityPin: React.FC<AmenityPinProps> = ({
  icon,
  x,
  y,
  triggerFrame,
  amenityIndex = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Actual stagger: each pin delayed by 2-5 frames
  const stagger = (amenityIndex % 4) * 2 + 1;
  const localFrame = frame - triggerFrame - stagger;
  if (localFrame < 0) return null;

  // Spring bounce
  const drop = spring({
    frame: localFrame,
    fps,
    config: { damping: 10, stiffness: 200, mass: 0.5 },
  });

  // Pulse ring
  const ringProgress = Math.min(localFrame / 18, 1);
  const ringScale = 1 + ringProgress * 1.5;
  const ringOpacity = (1 - ringProgress) * 0.5;

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: "translate(-50%, -50%)",
        pointerEvents: "none",
        zIndex: 40,
      }}
    >
      {/* Pulse ring */}
      {localFrame < 18 && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: 48,
            height: 48,
            transform: `translate(-50%, -50%) scale(${ringScale})`,
            border: "2px solid #39FF14",
            borderRadius: "50%",
            opacity: ringOpacity,
          }}
        />
      )}

      {/* Pin circle — 48px white with green border */}
      <div
        style={{
          transform: `scale(${drop})`,
          opacity: drop,
          transformOrigin: "center center",
          width: 48,
          height: 48,
          borderRadius: "50%",
          backgroundColor: "#ffffff",
          border: "3px solid #39FF14",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow:
            "0 3px 10px rgba(0,0,0,0.5), 0 0 16px rgba(57, 255, 20, 0.35)",
        }}
      >
        <span style={{ fontSize: 24, lineHeight: 1 }}>{icon}</span>
      </div>
    </div>
  );
};
