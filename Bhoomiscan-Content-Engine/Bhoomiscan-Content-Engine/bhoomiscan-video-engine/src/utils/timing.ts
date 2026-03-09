/**
 * Frame timing constants at 30fps.
 *
 * Video structure (professional real estate showcase):
 * 1. IntroHook (0-3s)         — Attention grab: price + location + type
 * 2. MapSequence (3-9s)       — Cinematic satellite zoom (if geo data available)
 * 3. PhotoShowcase (9-19s)    — Ken Burns through seller photos with overlay details
 * 4. VideoWalkthrough (19-26s) — Seller's actual video clip if available, else more photos
 * 5. DetailsCard (26-31s)     — Features grid + price breakdown
 * 6. SellerCTA (31-34s)       — Seller info + contact CTA
 * 7. EndCard (34-36s)         — BhoomiScan branding + listing URL
 *
 * Without geo data, MapSequence is skipped → original 30s structure.
 */

export const FPS = 30;
export const TOTAL_DURATION = 30; // seconds (default without map)
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
  mapSequence?: { from: number; duration: number };
  photoShowcase: { from: number; duration: number };
  videoWalkthrough: { from: number; duration: number };
  detailsCard: { from: number; duration: number };
  sellerCTA: { from: number; duration: number };
  endCard: { from: number; duration: number };
}

/** Minimum frames per section */
const MIN_FRAMES: Record<string, number> = {
  introHook: 75,         // 2.5s
  mapSequence: 270,      // 9s (two-phase: zoom-in + zoom-out with amenities)
  photoShowcase: 240,    // 8s
  videoWalkthrough: 150, // 5s
  detailsCard: 120,      // 4s
  sellerCTA: 75,         // 2.5s
  endCard: 45,           // 1.5s
};

const PADDING_FRAMES = 15;

/** Section ID to video section mapping */
const SECTION_MAP: Record<string, string> = {
  hook: "introHook",
  map: "mapSequence",
  details: "photoShowcase",
  context: "videoWalkthrough",
  numbers: "detailsCard",
  cta: "sellerCTA",
  branding: "endCard",
};

/** Max total frames: 44s for geo+amenities, 40s for geo, 35s for rich, 30s default */
const MAX_FRAMES_GEO_AMENITY = 50 * FPS; // 1500
const MAX_FRAMES_GEO = 40 * FPS;   // 1200
const MAX_FRAMES_RICH = 35 * FPS;  // 1050

/** Section ordering for layout computation */
const SECTION_ORDER = [
  "introHook",
  "mapSequence",
  "photoShowcase",
  "videoWalkthrough",
  "detailsCard",
  "sellerCTA",
  "endCard",
] as const;

/**
 * Compute dynamic section timings from voiceover timing estimates.
 * Each section = max(minimumFrames, ceil(estimatedDurationMs / 1000 * FPS) + padding)
 *
 * Content-aware redistributions:
 * - Few photos (<=2): shrink photoShowcase, grow detailsCard
 * - No video: reduce videoWalkthrough, redistribute to photoShowcase + detailsCard
 * - Geo data available: insert mapSequence (6s default) between introHook and photoShowcase
 * - Rich content + geo: allow up to 40s total
 */
export function computeDynamicSections(
  sectionEstimates: TimedVoiceover["sectionEstimates"],
  richness: ContentRichness
): { sections: DynamicSections; totalFrames: number } {
  const hasGeo = richness.geoTier !== "none";

  const durations: Record<string, number> = {
    introHook: MIN_FRAMES.introHook,
    mapSequence: hasGeo
      ? (richness.hasAmenities
        ? Math.min(5 + (richness.amenityCount || 3) * 2.5, 18) * FPS
        : 6 * FPS)
      : 0,
    photoShowcase: MIN_FRAMES.photoShowcase,
    videoWalkthrough: MIN_FRAMES.videoWalkthrough,
    detailsCard: MIN_FRAMES.detailsCard,
    sellerCTA: MIN_FRAMES.sellerCTA,
    endCard: MIN_FRAMES.endCard,
  };

  // Map voiceover sections to video sections
  for (const est of sectionEstimates) {
    const sectionKey = SECTION_MAP[est.sectionId];
    if (sectionKey && sectionKey !== "mapSequence") {
      const durationMs = est.estimatedEndMs - est.estimatedStartMs;
      const frames = Math.ceil((durationMs / 1000) * FPS) + PADDING_FRAMES;
      durations[sectionKey] = Math.max(MIN_FRAMES[sectionKey] || 0, frames);
    }
  }

  // Handle map voiceover section if present
  if (hasGeo) {
    const mapEst = sectionEstimates.find((e) => e.sectionId === "map");
    if (mapEst) {
      const durationMs = mapEst.estimatedEndMs - mapEst.estimatedStartMs;
      const frames = Math.ceil((durationMs / 1000) * FPS) + PADDING_FRAMES;
      durations.mapSequence = Math.max(MIN_FRAMES.mapSequence, frames);
    }
  }

  // Content-aware redistributions
  if (richness.photoCount <= 2) {
    const reduction = Math.round(durations.photoShowcase * 0.3);
    durations.photoShowcase -= reduction;
    durations.photoShowcase = Math.max(MIN_FRAMES.photoShowcase, durations.photoShowcase);
    durations.detailsCard += reduction;
  }

  if (!richness.hasVideo) {
    const excess = durations.videoWalkthrough - MIN_FRAMES.videoWalkthrough;
    if (excess > 0) {
      durations.videoWalkthrough = MIN_FRAMES.videoWalkthrough;
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

  // Insert mapSequence only if geo data available
  if (hasGeo && durations.mapSequence > 0) {
    sections.mapSequence = { from: 0, duration: durations.mapSequence };
  }

  for (const key of SECTION_ORDER) {
    if (key === "mapSequence" && (!hasGeo || durations.mapSequence === 0)) continue;
    if (key === "mapSequence" && sections.mapSequence) {
      sections.mapSequence.from = from;
      from += sections.mapSequence.duration;
    } else if (key in sections && key !== "mapSequence") {
      (sections as any)[key].from = from;
      from += (sections as any)[key].duration;
    }
  }

  // Max frames: geo+amenities 44s, geo 40s, rich 35s, default 30s
  let maxFrames = TOTAL_FRAMES;
  if (hasGeo && richness.hasAmenities) {
    maxFrames = MAX_FRAMES_GEO_AMENITY;
  } else if (hasGeo) {
    maxFrames = MAX_FRAMES_GEO;
  } else if (richness.tier === "rich") {
    maxFrames = MAX_FRAMES_RICH;
  }

  if (from > maxFrames) {
    const scale = maxFrames / from;
    let newFrom = 0;
    for (const key of SECTION_ORDER) {
      if (key === "mapSequence") {
        if (sections.mapSequence) {
          const newDuration = Math.max(MIN_FRAMES.mapSequence, Math.round(sections.mapSequence.duration * scale));
          sections.mapSequence = { from: newFrom, duration: newDuration };
          newFrom += newDuration;
        }
        continue;
      }
      const minF = MIN_FRAMES[key] || 45;
      const newDuration = Math.max(minF, Math.round((sections as any)[key].duration * scale));
      (sections as any)[key] = { from: newFrom, duration: newDuration };
      newFrom += newDuration;
    }
    from = newFrom;
  }

  return { sections, totalFrames: from };
}
