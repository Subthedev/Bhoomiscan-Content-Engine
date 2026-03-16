/**
 * Geo data types for cinematic map animations.
 * All coordinates use WGS84 (standard GPS lat/lng).
 */

export interface GeoCoordinates {
  lat: number;
  lng: number;
}

export interface GeoLandmark {
  name: string;
  coords: GeoCoordinates;
  distanceKm: number;
  /** Decoded polyline as [lng, lat][] for Mapbox rendering */
  routePolyline?: [number, number][];
}

export interface GeoBoundary {
  type: "state" | "district" | "plot";
  geojson: GeoJSON.Feature;
}

export type GeoConfidence = "high" | "medium" | "low";
export type GeoSource = "database" | "geocoded" | "city-level";
export type GeoTier = "full" | "partial" | "none";

export interface DiscoveredAmenity {
  category: string;       // "hospital", "school", "highway", etc.
  name: string;           // OSM name tag
  label: string;          // Human-readable: "Hospital", "School"
  icon: string;           // Emoji: "🏥", "🏫"
  coords: GeoCoordinates;
  distanceKm: number;     // Haversine initially, upgraded to road distance after OSRM
  routePolyline?: [number, number][];  // OSRM decoded polyline
  wayGeometry?: [number, number][];    // Raw OSM way coords (highways only, [lng, lat])
}

export interface GeoData {
  plotCenter: GeoCoordinates;
  /** State center for the initial wide zoom */
  stateCenter: GeoCoordinates;
  landmarks: GeoLandmark[];
  amenities: DiscoveredAmenity[];
  boundaries: GeoBoundary[];
  confidence: GeoConfidence;
  source: GeoSource;
}
