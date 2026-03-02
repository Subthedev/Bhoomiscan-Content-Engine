import { z } from "zod";

export type VideoVariant = "spotlight" | "area-context" | "availability";
export type PlotType = "Residential" | "Commercial" | "Agricultural" | "Industrial";
export type SellerType = "Owner" | "Broker";

export interface ListingVideoProps {
  [key: string]: unknown;
  listingId: string;
  title: string;
  description: string;
  location: string;        // full: "Back Side Of GIET, Khordha"
  area: string;            // locality: "Back Side Of GIET"
  city: string;            // "Khordha"
  state: string;           // "Odisha"
  price: number;
  pricePerSqft: number;
  plotSize: number;
  areaUnit: string;
  dimensions?: string;
  facing?: string;
  roadWidth?: string;
  plotType: PlotType;
  landmarks: string[];
  // Media
  photos: string[];           // image URLs
  videoUrl?: string;          // seller-uploaded walkthrough video URL
  videoUrl2?: string;         // second video URL
  // Features
  hasRoadAccess: boolean;
  hasWaterSupply: boolean;
  hasElectricity: boolean;
  hasFencing: boolean;
  // Verification
  isVerified: boolean;
  verificationTier: string;
  // Seller
  sellerName: string;
  sellerType: SellerType;
  // Meta
  listingUrl: string;
  variant: VideoVariant;
  topTickerText?: string;
  bottomTickerText?: string;
  voiceoverAudioUrl?: string;
  videoStartFrom?: number;
  sectionTimings?: {
    introHook: { from: number; duration: number };
    photoShowcase: { from: number; duration: number };
    videoWalkthrough: { from: number; duration: number };
    detailsCard: { from: number; duration: number };
    sellerCTA: { from: number; duration: number };
    endCard: { from: number; duration: number };
  };
  totalFrames?: number;
}

export const ListingVideoPropsSchema = z.object({
  listingId: z.string(),
  title: z.string(),
  description: z.string(),
  location: z.string(),
  area: z.string(),
  city: z.string(),
  state: z.string(),
  price: z.number().positive(),
  pricePerSqft: z.number().nonnegative(),
  plotSize: z.number().positive(),
  areaUnit: z.string(),
  dimensions: z.string().optional(),
  facing: z.string().optional(),
  roadWidth: z.string().optional(),
  plotType: z.enum(["Residential", "Commercial", "Agricultural", "Industrial"]),
  landmarks: z.array(z.string()),
  photos: z.array(z.string()).min(1),
  videoUrl: z.string().optional(),
  videoUrl2: z.string().optional(),
  hasRoadAccess: z.boolean(),
  hasWaterSupply: z.boolean(),
  hasElectricity: z.boolean(),
  hasFencing: z.boolean(),
  isVerified: z.boolean(),
  verificationTier: z.string(),
  sellerName: z.string(),
  sellerType: z.enum(["Owner", "Broker"]),
  listingUrl: z.string(),
  variant: z.enum(["spotlight", "area-context", "availability"]),
  topTickerText: z.string().optional(),
  bottomTickerText: z.string().optional(),
  voiceoverAudioUrl: z.string().optional(),
  videoStartFrom: z.number().optional(),
  sectionTimings: z.object({
    introHook: z.object({ from: z.number(), duration: z.number() }),
    photoShowcase: z.object({ from: z.number(), duration: z.number() }),
    videoWalkthrough: z.object({ from: z.number(), duration: z.number() }),
    detailsCard: z.object({ from: z.number(), duration: z.number() }),
    sellerCTA: z.object({ from: z.number(), duration: z.number() }),
    endCard: z.object({ from: z.number(), duration: z.number() }),
  }).optional(),
  totalFrames: z.number().optional(),
});

/**
 * Map a Supabase property row (with joins) to ListingVideoProps.
 */
export function mapPropertyToVideoProps(
  property: Record<string, any>,
  variant: VideoVariant = "spotlight"
): ListingVideoProps {
  const plotTypeMap: Record<string, PlotType> = {
    residential: "Residential",
    commercial: "Commercial",
    agricultural: "Agricultural",
    industrial: "Industrial",
  };

  const photos = (property.property_images || [])
    .sort((a: any, b: any) => {
      // Primary first, then by display_order
      if (a.is_primary && !b.is_primary) return -1;
      if (!a.is_primary && b.is_primary) return 1;
      return (a.display_order || 0) - (b.display_order || 0);
    })
    .map((img: any) => img.image_url);

  const features = property.features || {};
  const pricePerSqft =
    property.price_analysis?.pricePerSqFt ||
    (property.area > 0 ? Math.round(property.price / property.area) : 0);

  const address = property.address || "";
  const locality = address.split(",")[0]?.trim() || property.city;

  return {
    listingId: property.id,
    title: property.title || `${property.area} sq.ft ${plotTypeMap[property.type] || "Residential"} Plot`,
    description: property.description || "",
    location: `${address}, ${property.city}`,
    area: locality,
    city: property.city,
    state: property.state || "Odisha",
    price: property.price,
    pricePerSqft,
    plotSize: property.area,
    areaUnit: property.area_unit || "sq.ft",
    plotType: plotTypeMap[property.type] || "Residential",
    landmarks: property.nearby_landmarks || [],
    photos: photos.length > 0
      ? photos
      : ["https://placehold.co/1080x1920/1a3a27/d4a43a?text=BhoomiScan"],
    videoUrl: property.video_url || undefined,
    videoUrl2: property.video_url_2 || undefined,
    hasRoadAccess: !!features.roadAccess,
    hasWaterSupply: !!features.waterSupply,
    hasElectricity: !!features.electricity,
    hasFencing: !!features.fencing,
    isVerified: !!property.is_verified,
    verificationTier: property.verification_tier || "unverified",
    sellerName: property.profiles?.full_name || "BhoomiScan Seller",
    sellerType: property.seller_type === "broker" ? "Broker" : "Owner",
    listingUrl: `https://bhoomiscan.in/property/${property.id}`,
    variant,
  };
}
