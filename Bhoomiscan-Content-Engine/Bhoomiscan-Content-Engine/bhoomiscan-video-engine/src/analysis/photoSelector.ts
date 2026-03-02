/**
 * Smart photo selection: multi-signal scoring with resolution, aspect ratio,
 * bits-per-pixel, file size, and filename hints.
 */

import { getImageDimensions, ImageDimensions } from "./imageMetadata";

export interface PhotoScore {
  url: string;
  composite: number;
  resolution: number;
  aspectRatio: number;
  bitsPerPixel: number;
  sizeScore: number;
  filenameHint: number;
}

const WEIGHTS = {
  resolution: 0.3,
  aspectRatio: 0.2,
  bitsPerPixel: 0.25,
  sizeMinimum: 0.15,
  filenameHint: 0.1,
};

const HINT_KEYWORDS = ["front", "road", "aerial", "main", "entrance", "gate", "boundary", "view"];
const FEATURE_KEYWORDS = ["road", "water", "boundary", "fence", "electric", "well", "borewell"];

/**
 * Select and reorder photos for optimal video presentation.
 * Returns ordered URLs and detailed scores for each photo.
 */
export async function selectAndOrderPhotos(
  photos: string[]
): Promise<{ ordered: string[]; scores: PhotoScore[] }> {
  // Filter out placeholders
  const real = photos.filter((p) => !p.includes("placehold.co"));
  if (real.length === 0) {
    return { ordered: photos, scores: [] };
  }
  if (real.length === 1) {
    return { ordered: real, scores: [{ url: real[0], composite: 1, resolution: 1, aspectRatio: 1, bitsPerPixel: 1, sizeScore: 1, filenameHint: 0 }] };
  }

  // Score all photos in parallel
  const scored = await Promise.all(real.map((url) => scorePhoto(url)));

  // Hero: highest composite score
  scored.sort((a, b) => b.composite - a.composite);
  const hero = scored[0];
  const rest = scored.slice(1);

  // Smart ordering for remaining:
  // Feature-relevant photos first, then by composite score
  const featureRelevant: PhotoScore[] = [];
  const others: PhotoScore[] = [];
  for (const s of rest) {
    if (s.filenameHint > 0 || hasFeatureKeyword(s.url)) {
      featureRelevant.push(s);
    } else {
      others.push(s);
    }
  }

  // Feature-relevant sorted by composite, then others by composite
  featureRelevant.sort((a, b) => b.composite - a.composite);
  others.sort((a, b) => b.composite - a.composite);

  const ordered = [hero, ...featureRelevant, ...others];

  return {
    ordered: ordered.map((s) => s.url),
    scores: ordered,
  };
}

async function scorePhoto(url: string): Promise<PhotoScore> {
  let fileSize = 0;
  let dims: ImageDimensions | null = null;

  // Fetch file size and dimensions in parallel
  const [headResult, dimsResult] = await Promise.allSettled([
    fetch(url, { method: "HEAD" }).then((res) =>
      parseInt(res.headers.get("content-length") || "0", 10)
    ),
    getImageDimensions(url),
  ]);

  if (headResult.status === "fulfilled") fileSize = headResult.value;
  if (dimsResult.status === "fulfilled") dims = dimsResult.value;

  // 1. Resolution score: min(1, min(w,h) / 1080)
  let resolution = 0.5; // default if we can't determine
  if (dims) {
    resolution = Math.min(1, Math.min(dims.width, dims.height) / 1080);
  }

  // 2. Aspect ratio fit: prefer 9:16 portrait (h/w ≈ 1.78)
  // Score: 1 - abs(h/w - 16/9) / (16/9)
  let aspectRatio = 0.5;
  if (dims && dims.width > 0) {
    const ratio = dims.height / dims.width;
    const target = 16 / 9;
    aspectRatio = Math.max(0, 1 - Math.abs(ratio - target) / target);
  }

  // 3. Bits-per-pixel: fileSize / (w * h) — normalized
  // Higher BPP = more detail. Normalize to 0-1 range (cap at 3 bytes/pixel)
  let bitsPerPixel = 0.5;
  if (dims && dims.width > 0 && dims.height > 0 && fileSize > 0) {
    const bpp = fileSize / (dims.width * dims.height);
    bitsPerPixel = Math.min(1, bpp / 3);
  }

  // 4. File size minimum: penalize < 50KB
  let sizeScore = 1;
  if (fileSize > 0 && fileSize < 50_000) {
    sizeScore = fileSize / 50_000;
  } else if (fileSize === 0) {
    sizeScore = 0.3;
  }

  // 5. Filename hints
  const filename = decodeURIComponent(url.split("/").pop() || "").toLowerCase();
  const filenameHint = HINT_KEYWORDS.some((kw) => filename.includes(kw)) ? 1 : 0;

  const composite =
    WEIGHTS.resolution * resolution +
    WEIGHTS.aspectRatio * aspectRatio +
    WEIGHTS.bitsPerPixel * bitsPerPixel +
    WEIGHTS.sizeMinimum * sizeScore +
    WEIGHTS.filenameHint * filenameHint;

  return { url, composite, resolution, aspectRatio, bitsPerPixel, sizeScore, filenameHint };
}

function hasFeatureKeyword(url: string): boolean {
  const filename = decodeURIComponent(url.split("/").pop() || "").toLowerCase();
  return FEATURE_KEYWORDS.some((kw) => filename.includes(kw));
}
