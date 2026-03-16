import { ListingVideoProps } from "../types";
import type { GeoData } from "../geo/types";

/**
 * Sample geo data using real OSRM routes from Khordha, Odisha.
 * Hospital route: 23 points, 1.9km road distance.
 * Highway route: 92 points, 11.8km road distance.
 */
const sampleGeoData: GeoData = {
  plotCenter: { lat: 20.0538149, lng: 85.5023308 },
  stateCenter: { lat: 20.9517, lng: 85.0985 },
  landmarks: [],
  amenities: [
    {
      category: "hospital",
      name: "Govt Hospital, Olasingh",
      label: "Hospital",
      icon: "🏥",
      coords: { lat: 20.0604765, lng: 85.4918021 },
      distanceKm: 1.9,
      routePolyline: [
        [85.5023308,20.0538149], // start at plotCenter
        [85.50504,20.05577],[85.50357,20.05756],[85.50262,20.0574],
        [85.50225,20.05726],[85.49959,20.05746],[85.4989,20.05734],[85.49852,20.05743],
        [85.49689,20.05892],[85.49609,20.05954],[85.49608,20.05947],[85.49544,20.05962],
        [85.49481,20.05949],[85.49423,20.05907],[85.49368,20.05894],[85.49333,20.05886],
        [85.49267,20.05887],[85.49189,20.05901],[85.49089,20.05922],[85.49042,20.0595],
        [85.49051,20.05969],[85.49056,20.06008],[85.49059,20.06055],
      ],
    },
    {
      category: "highway",
      name: "NH-16 Highway",
      label: "Highway",
      icon: "🛣️",
      coords: { lat: 20.0331483, lng: 85.5188494 },
      distanceKm: 11.8,
      routePolyline: [
        [85.5023308,20.0538149], // start at plotCenter
        [85.50504,20.05577],[85.50357,20.05756],[85.504,20.05768],
        [85.50603,20.05945],[85.50869,20.06174],[85.50986,20.06357],[85.51178,20.06522],
        [85.51341,20.06652],[85.51421,20.06706],[85.51481,20.06709],[85.5163,20.06713],
        [85.51748,20.06727],[85.5181,20.06735],[85.51891,20.06728],[85.51962,20.067],
        [85.51911,20.06508],[85.52134,20.06486],[85.52224,20.0649],[85.52241,20.0649],
        [85.52258,20.06473],[85.5226,20.06464],[85.5227,20.06422],[85.52271,20.06351],
        [85.52293,20.06332],[85.52321,20.06254],[85.52417,20.06139],[85.525,20.06007],
        [85.5252,20.05967],[85.52572,20.05886],[85.52626,20.05871],[85.52733,20.0579],
        [85.52914,20.05729],[85.53022,20.05692],[85.53038,20.05473],[85.53073,20.0521],
        [85.53178,20.05248],[85.53238,20.05176],[85.53306,20.05184],[85.53356,20.05098],
        [85.53428,20.05007],[85.53493,20.0494],[85.53537,20.0498],[85.5371,20.05126],
        [85.53739,20.05151],[85.53829,20.05224],[85.53893,20.05277],[85.53916,20.05296],
        [85.53927,20.05306],[85.53936,20.05299],[85.53749,20.05143],[85.53544,20.0497],
        [85.53485,20.04916],[85.53456,20.04887],[85.53428,20.04859],[85.53369,20.04797],
        [85.53308,20.04729],[85.53256,20.04667],[85.53202,20.046],[85.53146,20.04532],
        [85.53092,20.04472],[85.53049,20.04425],[85.53041,20.04417],[85.53025,20.04401],
        [85.52978,20.04355],[85.52675,20.04062],[85.52524,20.03915],[85.52464,20.03856],
        [85.52441,20.03833],[85.52382,20.03774],[85.52376,20.03767],[85.52223,20.03623],
        [85.52003,20.03414],[85.51889,20.03304],[85.51841,20.03258],[85.51815,20.03233],
        [85.51717,20.03148],[85.51632,20.03067],[85.51585,20.03021],[85.51533,20.02966],
        [85.5143,20.0286],[85.51404,20.02834],[85.51351,20.02781],[85.51258,20.0269],
        [85.51243,20.02676],[85.5123,20.02646],[85.51169,20.02584],[85.51096,20.02518],
        [85.5102,20.02455],[85.50991,20.02487],[85.51094,20.0257],[85.51157,20.02627],
        [85.51241,20.0271],[85.51291,20.02762],[85.51331,20.02799],[85.51423,20.0289],
        [85.51494,20.02957],[85.51522,20.02973],[85.51574,20.03029],[85.51622,20.03075],
        [85.51757,20.03198],[85.51834,20.03266],[85.51839,20.0327],[85.51882,20.03311],
        [85.51885,20.03314],
      ],
    },
  ],
  boundaries: [],
  confidence: "low",
  source: "geocoded",
};

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
  geoData: sampleGeoData,
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
