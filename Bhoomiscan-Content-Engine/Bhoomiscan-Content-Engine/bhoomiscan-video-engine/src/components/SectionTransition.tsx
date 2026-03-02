import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import {
  TransitionType,
  getTransitionStyle,
  computeTransitionProgress,
} from "../utils/transitions";

interface SectionTransitionProps {
  children: React.ReactNode;
  durationInFrames: number;
  enterTransition?: TransitionType;
  exitTransition?: TransitionType;
  enterDuration?: number;
  exitDuration?: number;
}

/**
 * Wrapper that adds configurable enter/exit transitions to a section.
 * Supports: fade, slideUp, slideLeft, zoom, wipe, blur.
 */
export const SectionTransition: React.FC<SectionTransitionProps> = ({
  children,
  durationInFrames,
  enterTransition = "fade",
  exitTransition = "fade",
  enterDuration = 10,
  exitDuration = 8,
}) => {
  const frame = useCurrentFrame();

  const { enterProgress, exitProgress } = computeTransitionProgress(
    frame,
    durationInFrames,
    enterDuration,
    exitDuration
  );

  // Apply enter style during first half, exit style during last portion
  const isExiting = frame > durationInFrames - exitDuration;

  const style: React.CSSProperties = isExiting
    ? getTransitionStyle(exitTransition, exitProgress, "exit")
    : getTransitionStyle(enterTransition, enterProgress, "enter");

  // Combine: during the middle portion, ensure full visibility
  if (!isExiting && frame >= enterDuration) {
    // Fully entered — no transform needed, just full opacity
    return (
      <AbsoluteFill style={{ opacity: exitProgress }}>
        {children}
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill style={style}>
      {children}
    </AbsoluteFill>
  );
};
