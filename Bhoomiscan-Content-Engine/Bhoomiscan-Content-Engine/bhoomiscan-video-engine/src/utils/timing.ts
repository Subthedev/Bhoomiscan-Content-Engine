/**
 * Frame timing constants at 30fps for a 30-second video (900 total frames).
 *
 * Video structure (professional real estate showcase):
 * 1. IntroHook (0-3s)       — Attention grab: price + location + type
 * 2. PhotoShowcase (3-13s)  — Ken Burns through seller photos with overlay details
 * 3. VideoWalkthrough (13-20s) — Seller's actual video clip if available, else more photos
 * 4. DetailsCard (20-25s)   — Features grid + price breakdown
 * 5. SellerCTA (25-28s)     — Seller info + contact CTA
 * 6. EndCard (28-30s)       — BhoomiScan branding + listing URL
 */

export const FPS = 30;
export const TOTAL_DURATION = 30; // seconds
export const TOTAL_FRAMES = FPS * TOTAL_DURATION; // 900

export const SECTIONS = {
  introHook:        { from: 0,       duration: 3 * FPS },    // 0–89
  photoShowcase:    { from: 3 * FPS, duration: 10 * FPS },   // 90–389
  videoWalkthrough: { from: 13 * FPS, duration: 7 * FPS },   // 390–599
  detailsCard:      { from: 20 * FPS, duration: 5 * FPS },   // 600–749
  sellerCTA:        { from: 25 * FPS, duration: 3 * FPS },   // 750–839
  endCard:          { from: 28 * FPS, duration: 2 * FPS },   // 840–899
} as const;

/** Convert seconds to frames */
export const s = (seconds: number) => Math.round(seconds * FPS);

/** Convert frames to seconds */
export const toSeconds = (frames: number) => frames / FPS;

// --- Dynamic section timing ---

import type { ContentRichness } from "../analysis/contentAnalyzer";
import type { TimedVoiceover } from "../voiceover/generateVoiceover";

export interface DynamicSections {
  introHook: { from: number; duration: number };
  photoShowcase: { from: number; duration: number };
  videoWalkthrough: { from: number; duration: number };
  detailsCard: { from: number; duration: number };
  sellerCTA: { from: number; duration: number };
  endCard: { from: number; duration: number };
}

/** Minimum frames per section */
const MIN_FRAMES = {
  introHook: 75,         // 2.5s
  photoShowcase: 240,    // 8s
  videoWalkthrough: 150, // 5s
  detailsCard: 120,      // 4s
  sellerCTA: 75,         // 2.5s
  endCard: 45,           // 1.5s
} as const;

const PADDING_FRAMES = 15;

/** Section ID to video section mapping */
const SECTION_MAP: Record<string, keyof typeof MIN_FRAMES> = {
  hook: "introHook",
  details: "photoShowcase",
  context: "videoWalkthrough",
  numbers: "detailsCard",
  cta: "sellerCTA",
  branding: "endCard",
};

/** Max total frames for rich content (35s) */
const MAX_FRAMES_RICH = 35 * FPS; // 1050

/**
 * Compute dynamic section timings from voiceover timing estimates.
 * Each section = max(minimumFrames, ceil(estimatedDurationMs / 1000 * FPS) + padding)
 *
 * Content-aware redistributions:
 * - Few photos (≤2): shrink photoShowcase, grow detailsCard
 * - No video: reduce videoWalkthrough, redistribute to photoShowcase + detailsCard
 * - Rich content (5+ photos or video): allow up to 35s total
 */
export function computeDynamicSections(
  sectionEstimates: TimedVoiceover["sectionEstimates"],
  richness: ContentRichness
): { sections: DynamicSections; totalFrames: number } {
  const durations: Record<keyof typeof MIN_FRAMES, number> = {
    introHook: MIN_FRAMES.introHook,
    photoShowcase: MIN_FRAMES.photoShowcase,
    videoWalkthrough: MIN_FRAMES.videoWalkthrough,
    detailsCard: MIN_FRAMES.detailsCard,
    sellerCTA: MIN_FRAMES.sellerCTA,
    endCard: MIN_FRAMES.endCard,
  };

  // Map voiceover sections to video sections
  for (const est of sectionEstimates) {
    const sectionKey = SECTION_MAP[est.sectionId];
    if (sectionKey) {
      const durationMs = est.estimatedEndMs - est.estimatedStartMs;
      const frames = Math.ceil((durationMs / 1000) * FPS) + PADDING_FRAMES;
      durations[sectionKey] = Math.max(MIN_FRAMES[sectionKey], frames);
    }
  }

  // Content-aware redistributions
  if (richness.photoCount <= 2) {
    // Few photos — shrink photoShowcase by 30%, boost detailsCard
    const reduction = Math.round(durations.photoShowcase * 0.3);
    durations.photoShowcase -= reduction;
    durations.photoShowcase = Math.max(MIN_FRAMES.photoShowcase, durations.photoShowcase);
    durations.detailsCard += reduction;
  }

  if (!richness.hasVideo) {
    // No video — reduce videoWalkthrough to minimum, redistribute
    const excess = durations.videoWalkthrough - MIN_FRAMES.videoWalkthrough;
    if (excess > 0) {
      durations.videoWalkthrough = MIN_FRAMES.videoWalkthrough;
      // 60% to photoShowcase, 40% to detailsCard
      durations.photoShowcase += Math.round(excess * 0.6);
      durations.detailsCard += Math.round(excess * 0.4);
    }
  }

  // Compute cumulative `from` values
  let from = 0;
  const sections: DynamicSections = {
    introHook: { from: 0, duration: durations.introHook },
    photoShowcase: { from: 0, duration: durations.photoShowcase },
    videoWalkthrough: { from: 0, duration: durations.videoWalkthrough },
    detailsCard: { from: 0, duration: durations.detailsCard },
    sellerCTA: { from: 0, duration: durations.sellerCTA },
    endCard: { from: 0, duration: durations.endCard },
  };

  for (const key of ["introHook", "photoShowcase", "videoWalkthrough", "detailsCard", "sellerCTA", "endCard"] as const) {
    sections[key].from = from;
    from += sections[key].duration;
  }

  // Rich content: allow up to 35s total
  const maxFrames = richness.tier === "rich" ? MAX_FRAMES_RICH : TOTAL_FRAMES;
  if (from > maxFrames) {
    // Scale all sections proportionally to fit
    const scale = maxFrames / from;
    let newFrom = 0;
    for (const key of ["introHook", "photoShowcase", "videoWalkthrough", "detailsCard", "sellerCTA", "endCard"] as const) {
      const newDuration = Math.max(MIN_FRAMES[key], Math.round(sections[key].duration * scale));
      sections[key] = { from: newFrom, duration: newDuration };
      newFrom += newDuration;
    }
    from = newFrom;
  }

  return { sections, totalFrames: from };
}
