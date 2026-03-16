/**
 * Centralized multi-transition library for section and photo transitions.
 */

import { interpolate, Easing } from "remotion";
import type { CSSProperties } from "react";

export type TransitionType = "fade" | "slideUp" | "slideLeft" | "zoom" | "wipe" | "blur";

/**
 * Get CSS styles for a transition at a given progress (0→1).
 */
export function getTransitionStyle(
  type: TransitionType,
  progress: number,
  direction: "enter" | "exit" = "enter"
): CSSProperties {
  // For exit, invert progress
  const p = direction === "exit" ? 1 - progress : progress;

  switch (type) {
    case "fade":
      return { opacity: p };

    case "slideUp":
      return {
        opacity: p,
        transform: `translateY(${(1 - p) * 60}px)`,
      };

    case "slideLeft":
      return {
        opacity: p,
        transform: `translateX(${(1 - p) * 80}px)`,
      };

    case "zoom":
      return {
        opacity: p,
        transform: `scale(${0.85 + p * 0.15})`,
      };

    case "wipe": {
      // Clip-based wipe from left to right
      const clipX = (1 - p) * 100;
      return {
        clipPath: `inset(0 ${clipX}% 0 0)`,
        opacity: Math.min(1, p * 2), // Quick opacity boost
      };
    }

    case "blur":
      return {
        opacity: p,
        filter: `blur(${(1 - p) * 8}px)`,
      };

    default:
      return { opacity: p };
  }
}

/**
 * Compute transition progress for enter/exit with configurable durations.
 */
export function computeTransitionProgress(
  frame: number,
  totalFrames: number,
  enterDuration: number = 10,
  exitDuration: number = 8
): { enterProgress: number; exitProgress: number; combinedOpacity: number } {
  const enterProgress = interpolate(frame, [0, enterDuration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const exitProgress = interpolate(
    frame,
    [totalFrames - exitDuration, totalFrames],
    [1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.in(Easing.cubic),
    }
  );

  return {
    enterProgress,
    exitProgress,
    combinedOpacity: Math.min(enterProgress, exitProgress),
  };
}

/** Transition presets for each section */
export const SECTION_TRANSITIONS: Record<string, { enter: TransitionType; exit: TransitionType }> = {
  introHook: { enter: "zoom", exit: "fade" },
  mapSequence: { enter: "zoom", exit: "fade" },
  photoShowcase: { enter: "slideLeft", exit: "fade" },
  videoWalkthrough: { enter: "wipe", exit: "blur" },
  detailsCard: { enter: "slideUp", exit: "fade" },
  sellerCTA: { enter: "zoom", exit: "fade" },
  endCard: { enter: "fade", exit: "fade" },
};

/** Photo-to-photo transition types, cycled */
export const PHOTO_TRANSITIONS: TransitionType[] = ["fade", "slideLeft", "zoom"];

export function getPhotoTransition(index: number): TransitionType {
  return PHOTO_TRANSITIONS[index % PHOTO_TRANSITIONS.length];
}
