import { ListingVideoProps } from "../types";

export type PriceRange = "budget" | "mid" | "premium" | "luxury";
export type ContentTier = "minimal" | "standard" | "rich";

export interface ContentRichness {
  tier: ContentTier;
  photoCount: number;
  featureCount: number; // 0-4 (road/water/electricity/fencing)
  hasVideo: boolean;
  hasDescription: boolean;
  hasLandmarks: boolean;
  priceRange: PriceRange;
}

const LAKH = 100_000;
const CRORE = 10_000_000;

function getPriceRange(price: number): PriceRange {
  if (price < 5 * LAKH) return "budget";
  if (price < 25 * LAKH) return "mid";
  if (price < CRORE) return "premium";
  return "luxury";
}

export function analyzeContent(props: ListingVideoProps): ContentRichness {
  const featureCount = [
    props.hasRoadAccess,
    props.hasWaterSupply,
    props.hasElectricity,
    props.hasFencing,
  ].filter(Boolean).length;

  const realPhotos = props.photos.filter((p) => !p.includes("placehold.co"));
  const photoCount = realPhotos.length;
  const hasVideo = !!props.videoUrl;

  let tier: ContentTier;
  if (photoCount <= 1) {
    tier = "minimal";
  } else if (photoCount >= 5 || hasVideo) {
    tier = "rich";
  } else {
    tier = "standard";
  }

  return {
    tier,
    photoCount,
    featureCount,
    hasVideo,
    hasDescription: !!props.description && props.description.length > 10,
    hasLandmarks: props.landmarks.length > 0,
    priceRange: getPriceRange(props.price),
  };
}
