/**
 * Kinetic typography utilities for cinematic text reveals.
 */

/**
 * Typewriter effect: reveals text character by character.
 * Returns the partial string to display at the given frame.
 */
export function typewriterText(
  fullText: string,
  frame: number,
  charsPerFrame: number = 1.5,
  startFrame: number = 0
): string {
  const elapsed = Math.max(0, frame - startFrame);
  const charCount = Math.min(fullText.length, Math.floor(elapsed * charsPerFrame));
  return fullText.slice(0, charCount);
}

/**
 * Animated counting number: counts up from 0 to target.
 * Returns the current displayed number at the given frame.
 */
export function countingNumber(
  target: number,
  frame: number,
  durationFrames: number = 20,
  startFrame: number = 0
): number {
  const elapsed = Math.max(0, frame - startFrame);
  const progress = Math.min(1, elapsed / durationFrames);
  // Ease-out cubic for satisfying deceleration
  const eased = 1 - Math.pow(1 - progress, 3);
  return Math.round(target * eased);
}

/**
 * Format a counting number as Indian price string.
 */
export function countingPrice(
  targetPrice: number,
  frame: number,
  durationFrames: number = 20,
  startFrame: number = 0
): string {
  const current = countingNumber(targetPrice, frame, durationFrames, startFrame);
  if (current >= 10_000_000) return `₹${(current / 10_000_000).toFixed(2)} Cr`;
  if (current >= 100_000) return `₹${(current / 100_000).toFixed(2)} L`;
  return `₹${current.toLocaleString("en-IN")}`;
}
