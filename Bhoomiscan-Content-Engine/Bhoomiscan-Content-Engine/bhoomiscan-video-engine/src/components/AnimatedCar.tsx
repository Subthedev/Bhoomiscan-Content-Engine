/**
 * Animated car marker for route following.
 * 36x36px clean top-down car with neon green glow.
 * Pure function of frame number — Remotion-compatible.
 */

import React from "react";

interface AnimatedCarProps {
  x: number;
  y: number;
  bearing: number;
  opacity: number;
  visible: boolean;
  frame: number;
  trailPoints?: { x: number; y: number }[];
}

export const AnimatedCar: React.FC<AnimatedCarProps> = ({
  x,
  y,
  bearing,
  opacity,
  visible,
  frame,
  trailPoints,
}) => {
  if (!visible || opacity <= 0) return null;

  const pulseGlow = 12 + Math.sin(frame * 0.2) * 4;

  return (
    <>
      {/* Dynamic road-following trail */}
      {trailPoints && trailPoints.length >= 2 && (
        <svg
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            zIndex: 48,
          }}
          width="1080"
          height="1920"
        >
          <defs>
            <linearGradient id="car-trail-grad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgba(57, 255, 20, 0)" />
              <stop offset="100%" stopColor="rgba(57, 255, 20, 0.35)" />
            </linearGradient>
          </defs>
          <polyline
            points={trailPoints.map((p) => `${p.x},${p.y}`).join(" ")}
            stroke="url(#car-trail-grad)"
            strokeWidth="5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ filter: "blur(2px)" }}
          />
        </svg>
      )}

      <div
        style={{
          position: "absolute",
          left: x,
          top: y,
          transform: `translate(-50%, -50%) rotate(${bearing}deg)`,
          opacity,
          pointerEvents: "none",
          zIndex: 50,
          filter: `
            drop-shadow(0 0 4px rgba(57, 255, 20, 0.9))
            drop-shadow(0 0 ${pulseGlow}px rgba(57, 255, 20, 0.3))
          `,
        }}
      >
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
          {/* Car body */}
          <rect x="8" y="3" width="20" height="30" rx="5" fill="#39FF14" />
          {/* Roof */}
          <rect x="10" y="5" width="16" height="26" rx="4" fill="#2DD910" />
          {/* Windshield */}
          <rect x="11" y="6" width="14" height="7" rx="3" fill="rgba(0,0,0,0.5)" />
          {/* Rear window */}
          <rect x="11" y="23" width="14" height="5" rx="2" fill="rgba(0,0,0,0.35)" />
          {/* Wheels */}
          <rect x="5" y="7" width="4" height="7" rx="2" fill="#39FF14" opacity="0.8" />
          <rect x="27" y="7" width="4" height="7" rx="2" fill="#39FF14" opacity="0.8" />
          <rect x="5" y="22" width="4" height="7" rx="2" fill="#39FF14" opacity="0.8" />
          <rect x="27" y="22" width="4" height="7" rx="2" fill="#39FF14" opacity="0.8" />
          {/* Headlights */}
          <circle cx="13" cy="4.5" r="2" fill="#fff" opacity="0.9" />
          <circle cx="23" cy="4.5" r="2" fill="#fff" opacity="0.9" />
          {/* Tail lights */}
          <circle cx="13" cy="31.5" r="1.5" fill="#FF4444" opacity="0.6" />
          <circle cx="23" cy="31.5" r="1.5" fill="#FF4444" opacity="0.6" />
        </svg>
      </div>
    </>
  );
};
