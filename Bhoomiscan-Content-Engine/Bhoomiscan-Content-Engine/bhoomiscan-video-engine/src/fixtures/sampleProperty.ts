import { ListingVideoProps } from "../types";

/** Real property: dca74421 — 11 images + video, all features enabled */
export const sampleProperty: ListingVideoProps = {
  listingId: "dca74421-7b18-4341-b1d6-f3c23ff1cf36",
  title: "1,200 sq.ft Residential Land in Back Side Of GIET, Einstein College, Khordha",
  description:
    "1,200 sq.ft of residential land available for sale. Located in Back Side Of GIET, Einstein college, Khordha District, Odisha. Listed at ₹7,80,000. Contact for site visit and more details.",
  location: "Back Side Of GIET, Einstein College, Khordha",
  area: "GIET Einstein College",
  city: "Khordha",
  state: "Odisha",
  price: 780000,
  pricePerSqft: 650,
  plotSize: 1200,
  areaUnit: "sq.ft",
  plotType: "Residential",
  landmarks: [],
  photos: [
    "https://syrtrcrqespmdwflcern.supabase.co/storage/v1/object/public/property-images/dca74421-7b18-4341-b1d6-f3c23ff1cf36/1771602404214-jixjop.jpg",
    "https://syrtrcrqespmdwflcern.supabase.co/storage/v1/object/public/property-images/dca74421-7b18-4341-b1d6-f3c23ff1cf36/1771602404269-602k8w.jpg",
    "https://syrtrcrqespmdwflcern.supabase.co/storage/v1/object/public/property-images/dca74421-7b18-4341-b1d6-f3c23ff1cf36/1771602403781-29yle6.jpg",
    "https://syrtrcrqespmdwflcern.supabase.co/storage/v1/object/public/property-images/dca74421-7b18-4341-b1d6-f3c23ff1cf36/1771602404250-96llw3.jpg",
    "https://syrtrcrqespmdwflcern.supabase.co/storage/v1/object/public/property-images/dca74421-7b18-4341-b1d6-f3c23ff1cf36/1771602404117-09dz08.jpg",
  ],
  videoUrl:
    "https://syrtrcrqespmdwflcern.supabase.co/storage/v1/object/public/property-videos/dca74421-7b18-4341-b1d6-f3c23ff1cf36/1771602428659-iidx05.mp4",
  hasRoadAccess: true,
  hasWaterSupply: true,
  hasElectricity: true,
  hasFencing: true,
  isVerified: false,
  verificationTier: "unverified",
  sellerName: "Satish Sahoo",
  sellerType: "Owner",
  listingUrl: "https://bhoomiscan.in/property/dca74421-7b18-4341-b1d6-f3c23ff1cf36",
  variant: "spotlight",
};

/** Minimal: property with no images, high-value */
export const sampleMinimal: ListingVideoProps = {
  listingId: "22b5f57b-6536-4f27-b27d-d915a21a8bb3",
  title: "5,000 sq.ft Residential Land in Infosys 2 Backside, Khordha",
  description: "5,000 sq.ft of residential land near Infosys campus.",
  location: "Infosys 2 Backside, Khordha",
  area: "Infosys 2 Backside",
  city: "Khordha",
  state: "Odisha",
  price: 11000000,
  pricePerSqft: 2200,
  plotSize: 5000,
  areaUnit: "sq.ft",
  plotType: "Residential",
  landmarks: [],
  photos: ["https://placehold.co/1080x1920/1a3a27/d4a43a?text=Plot+Near+Infosys"],
  videoUrl:
    "https://syrtrcrqespmdwflcern.supabase.co/storage/v1/object/public/property-videos/22b5f57b-6536-4f27-b27d-d915a21a8bb3/1771434076159-glcntr.mp4",
  hasRoadAccess: false,
  hasWaterSupply: false,
  hasElectricity: false,
  hasFencing: false,
  isVerified: false,
  verificationTier: "unverified",
  sellerName: "Mohana Realty",
  sellerType: "Broker",
  listingUrl: "https://bhoomiscan.in/property/22b5f57b-6536-4f27-b27d-d915a21a8bb3",
  variant: "area-context",
};
