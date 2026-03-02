/**
 * Text overflow utilities for video sections.
 */

/** Truncate text with ellipsis if it exceeds max characters. */
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1).trimEnd() + "\u2026";
}

/**
 * Auto-shrink font size to fit text within character budget.
 * Returns truncated text and appropriate font size.
 */
export function fitText(
  text: string,
  maxChars: number,
  maxFontSize: number,
  minFontSize: number
): { text: string; fontSize: number } {
  if (text.length <= maxChars) {
    return { text, fontSize: maxFontSize };
  }

  // Scale font down proportionally
  const ratio = maxChars / text.length;
  const scaled = Math.max(Math.round(maxFontSize * ratio), minFontSize);

  return {
    text: truncate(text, maxChars),
    fontSize: scaled,
  };
}
