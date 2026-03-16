/**
 * Geo Data Extraction Orchestrator.
 *
 * Pipeline:
 * 1. Check DB for cached lat/lng → geocode if missing
 * 2. Write-back coords to Supabase
 * 3. In parallel: amenities + boundaries + plot polygon
 * 4. Assemble GeoData object
 *
 * Skipped if --no-geo flag or no MAPBOX_ACCESS_TOKEN.
 */

import { SupabaseClient } from "@supabase/supabase-js";
import type { ListingVideoProps } from "../types";
import {
  GeoCoordinates,
  GeoData,
  GeoConfidence,
  GeoSource,
  GeoBoundary,
  GeoLandmark,
} from "./types";
import {
  geocodeAddress,
  geocodeLandmark,
  getDbCoordinates,
  writeBackCoordinates,
} from "./geocoder";
import { extractPincode } from "./pincodeGeocoder";
import { fetchStateBoundary, fetchDistrictBoundary } from "./boundaryFetcher";
import { estimatePlotBoundary } from "./plotEstimator";
import { discoverAmenities } from "./amenityFetcher";
import { fetchRoute } from "./routeFetcher";

// Approx state centers for zoom-in animation start
const STATE_CENTERS: Record<string, GeoCoordinates> = {
  odisha:           { lat: 20.9517, lng: 85.0985 },
  "andhra pradesh": { lat: 15.9129, lng: 79.74 },
  telangana:        { lat: 17.385,  lng: 78.4867 },
  "west bengal":    { lat: 22.9868, lng: 87.855 },
  chhattisgarh:     { lat: 21.2787, lng: 81.8661 },
  jharkhand:        { lat: 23.6102, lng: 85.2799 },
  maharashtra:      { lat: 19.7515, lng: 75.7139 },
  karnataka:        { lat: 15.3173, lng: 75.7139 },
  "tamil nadu":     { lat: 11.1271, lng: 78.6569 },
  kerala:           { lat: 10.8505, lng: 76.2711 },
  gujarat:          { lat: 22.2587, lng: 71.1924 },
  rajasthan:        { lat: 27.0238, lng: 74.2179 },
  "uttar pradesh":  { lat: 26.8467, lng: 80.9462 },
  bihar:            { lat: 25.0961, lng: 85.3131 },
  delhi:            { lat: 28.7041, lng: 77.1025 },
};

function getStateCenter(state: string): GeoCoordinates {
  return STATE_CENTERS[state.toLowerCase()] || { lat: 20.5937, lng: 78.9629 }; // India center
}

/**
 * Extract all geo data for a property. Runs in parallel with photo/video analysis.
 * Returns null if geocoding fails entirely.
 */
export async function extractGeoData(
  props: ListingVideoProps,
  supabase: SupabaseClient
): Promise<GeoData | null> {
  const startTime = Date.now();
  console.log(`[geo] Starting extraction for "${props.area}, ${props.city}"`);

  // ── Step 1: Get coordinates ──
  let plotCenter: GeoCoordinates | null = null;
  let confidence: GeoConfidence = "low";
  let source: GeoSource = "city-level";

  // Check DB first
  const dbCoords = await getDbCoordinates(supabase, props.listingId);
  if (dbCoords) {
    plotCenter = dbCoords;
    confidence = "high";
    source = "database";
    console.log(`[geo] DB coords: ${dbCoords.lat}, ${dbCoords.lng}`);
  }

  // Extract pincode from props or address text
  let pincode = props.pincode;
  if (!pincode) {
    pincode = extractPincode(props.location) || extractPincode(props.description) || undefined;
  }

  // Geocode if not in DB
  if (!plotCenter) {
    const geocoded = await geocodeAddress(
      props.location,
      props.city,
      props.state,
      pincode
    );
    if (geocoded) {
      plotCenter = geocoded.coords;
      confidence = geocoded.confidence;
      source = geocoded.confidence === "low" ? "city-level" : "geocoded";
      console.log(
        `[geo] Geocoded (${geocoded.confidence}): ${plotCenter.lat}, ${plotCenter.lng}`
      );

      // Write back to DB for future use
      await writeBackCoordinates(supabase, props.listingId, plotCenter);
    }
  }

  if (!plotCenter) {
    console.warn("[geo] Failed to geocode property — no map animation");
    return null;
  }

  const stateCenter = getStateCenter(props.state);

  // ── Step 2: Parallel data fetch ──
  const [amenities, stateBoundary, districtBoundary, landmarks] =
    await Promise.all([
      discoverAmenities(plotCenter),
      fetchStateBoundary(props.state).catch(() => null),
      fetchDistrictBoundary(props.city, props.state).catch(() => null),
      geocodeLandmarks(props.landmarks, props.city, props.state, plotCenter),
    ]);

  // ── Step 3: Build boundaries array ──
  const boundaries: GeoBoundary[] = [];
  if (stateBoundary) {
    boundaries.push({ type: "state", geojson: stateBoundary });
  }
  if (districtBoundary) {
    boundaries.push({ type: "district", geojson: districtBoundary });
  }

  // Plot boundary (always available if we have coords)
  const plotBoundary = estimatePlotBoundary(
    plotCenter,
    props.plotSize,
    props.areaUnit,
    props.dimensions
  );
  boundaries.push({ type: "plot", geojson: plotBoundary });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(
    `[geo] Done in ${elapsed}s: amenities=${amenities.length}, boundaries=${boundaries.length}, landmarks=${landmarks.length}`
  );

  return {
    plotCenter,
    stateCenter,
    landmarks,
    amenities,
    boundaries,
    confidence,
    source,
  };
}

/**
 * Geocode seller-provided landmarks and fetch routes.
 */
async function geocodeLandmarks(
  landmarkNames: string[],
  city: string,
  state: string,
  plotCenter: GeoCoordinates
): Promise<GeoLandmark[]> {
  if (landmarkNames.length === 0) return [];

  const results: GeoLandmark[] = [];

  // Geocode up to 3 landmarks
  const toGeocode = landmarkNames.slice(0, 3);
  const geocoded = await Promise.all(
    toGeocode.map((name) => geocodeLandmark(name, city, state))
  );

  for (let i = 0; i < toGeocode.length; i++) {
    const coords = geocoded[i];
    if (!coords) continue;

    const route = await fetchRoute(plotCenter, coords);
    results.push({
      name: toGeocode[i],
      coords,
      distanceKm: route?.distanceKm || haversineKm(plotCenter, coords),
      routePolyline: route?.polyline,
    });
  }

  return results;
}

function haversineKm(a: GeoCoordinates, b: GeoCoordinates): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h =
    sinDLat * sinDLat +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      sinDLng * sinDLng;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)) * 10) / 10;
}
