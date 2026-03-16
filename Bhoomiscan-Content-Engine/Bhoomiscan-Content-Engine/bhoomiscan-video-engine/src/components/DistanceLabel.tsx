/**
 * Distance label shown at the end of a route trace.
 * Displays "{X} km" with a spring entrance animation.
 */

import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";

interface DistanceLabelProps {
  landmarkName: string;
  distanceKm: number;
  /** Screen position from map projection */
  x: number;
  y: number;
  opacity: number;
  index: number;
}

export const DistanceLabel: React.FC<DistanceLabelProps> = ({
  landmarkName,
  distanceKm,
  x,
  y,
  opacity,
  index,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Stagger spring by index
  const scale = spring({
    frame: Math.max(0, frame - index * 8),
    fps,
    config: { damping: 14, stiffness: 200, mass: 0.6 },
  });

  const distanceText =
    distanceKm < 1
      ? `${Math.round(distanceKm * 1000)}m`
      : `${distanceKm} km`;

  // Truncate landmark name
  const displayName =
    landmarkName.length > 20
      ? landmarkName.slice(0, 18) + "…"
      : landmarkName;

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: `translate(-50%, -120%) scale(${scale})`,
        opacity: opacity * scale,
        pointerEvents: "none",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
      }}
    >
      {/* Distance pill */}
      <div
        style={{
          backgroundColor: "rgba(26, 58, 39, 0.9)",
          border: "2px solid #d4a43a",
          borderRadius: 20,
          padding: "6px 16px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          whiteSpace: "nowrap",
        }}
      >
        <span
          style={{
            color: "#d4a43a",
            fontSize: 22,
            fontWeight: 700,
            fontFamily: "Inter, sans-serif",
          }}
        >
          {distanceText}
        </span>
      </div>
      {/* Landmark name */}
      <div
        style={{
          backgroundColor: "rgba(0, 0, 0, 0.7)",
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
