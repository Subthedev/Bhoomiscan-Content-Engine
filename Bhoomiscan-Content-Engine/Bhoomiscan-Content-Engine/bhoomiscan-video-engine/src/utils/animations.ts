import { interpolate, spring, SpringConfig } from "remotion";

export const SPRING_CONFIGS: Record<string, SpringConfig> = {
  snappy: { damping: 15, mass: 0.8, stiffness: 200, overshootClamping: false },
  gentle: { damping: 20, mass: 1, stiffness: 120, overshootClamping: false },
  bouncy: { damping: 10, mass: 0.6, stiffness: 180, overshootClamping: false },
  slow: { damping: 25, mass: 1.2, stiffness: 80, overshootClamping: false },
};

/** Fade in from 0 to 1 opacity over a range of frames */
export function fadeIn(
  frame: number,
  startFrame: number,
  durationFrames: number = 15
): number {
  return interpolate(frame, [startFrame, startFrame + durationFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

/** Fade out from 1 to 0 opacity over a range of frames */
export function fadeOut(
  frame: number,
  startFrame: number,
  durationFrames: number = 15
): number {
  return interpolate(frame, [startFrame, startFrame + durationFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

/** Slide up entrance: returns translateY value */
export function slideUp(
  frame: number,
  fps: number,
  delay: number = 0,
  config: SpringConfig = SPRING_CONFIGS.snappy
): number {
  const progress = spring({
    frame: frame - delay,
    fps,
    config,
  });
  return interpolate(progress, [0, 1], [40, 0]);
}

/** Scale entrance: returns scale value */
export function scaleIn(
  frame: number,
  fps: number,
  delay: number = 0,
  config: SpringConfig = SPRING_CONFIGS.bouncy
): number {
  return spring({
    frame: frame - delay,
    fps,
    config,
  });
}

/** Spring-based opacity (for coordinated spring animations) */
export function springOpacity(
  frame: number,
  fps: number,
  delay: number = 0,
  config: SpringConfig = SPRING_CONFIGS.snappy
): number {
  return spring({
    frame: frame - delay,
    fps,
    config,
  });
}

/** Sine wave pulse oscillation for scale/opacity effects */
export function pulseScale(
  frame: number,
  min: number = 1.0,
  max: number = 1.03,
  periodFrames: number = 60
): number {
  const t = (frame % periodFrames) / periodFrames;
  const sine = Math.sin(t * Math.PI * 2);
  // Map sine [-1,1] to [min,max]
  return min + ((sine + 1) / 2) * (max - min);
}

/** Slow linear drift for parallax background effects */
export function parallaxDrift(
  frame: number,
  totalFrames: number,
  maxPx: number = 20
): number {
  const progress = Math.min(1, frame / totalFrames);
  return -progress * maxPx;
}

/** Sharp flash effect: bright peak at peakFrame, quick fade out */
export function flashOpacity(
  frame: number,
  peakFrame: number = 0,
  fadeDuration: number = 5
): number {
  if (frame < peakFrame) return 0;
  const elapsed = frame - peakFrame;
  if (elapsed >= fadeDuration) return 0;
  return interpolate(elapsed, [0, fadeDuration], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}
