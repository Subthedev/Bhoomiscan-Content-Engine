/**
 * Safe zone constants to prevent content from overlapping
 * TopTicker (bottom ~116px) and BottomTicker (top ~116px from bottom).
 */
export const SAFE = {
  /** Content must start below this Y to clear TopTicker */
  CONTENT_TOP: 155,
  /** Content must end above (viewport height - this) to clear BottomTicker */
  CONTENT_BOTTOM: 230,
  /** Top-right badges (FOR SALE, photo counter) */
  BADGE_TOP: 155,
  BADGE_RIGHT: 24,
  /** Horizontal margins for content */
  CONTENT_LEFT: 40,
  CONTENT_RIGHT: 40,
  /** Padding for solid-background sections (DetailsCard, SellerCTA) */
  PADDING_SOLID: {
    top: 155,
    bottom: 155,
    horizontal: 40,
  },
} as const;
