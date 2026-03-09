/**
 * Geo Data Extractor — orchestrates geocoding, boundaries, routing, and plot estimation.
 *
 * Called from pipeline.ts in parallel with content analysis and photo selection.
 * All APIs are FREE (Nominatim, Overpass, OSRM, India Post).
 *
 * Priority for plot center coordinates:
 * 0. Supabase DB lat/lng (previously geocoded or manually set)
 * 1. Pincode-constrained Nominatim (if pincode in address/description)
 * 2. Standard Nominatim cascade (structured → free-form → locality → city)
 * 3. Landmark triangulation (re-geocode if plot center is far from landmarks)
 *
 * Returns GeoData | null (null = geocoding completely failed)
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { GeoData, GeoCoordinates, GeoLandmark, GeoBoundary } from "./types";
import { geocodeAddress, geocodeLandmark, geocodeWithViewbox, getDbCoordinates, writeBackCoordinates } from "./geocoder";
import { fetchDistrictBoundary, fetchStateBoundary } from "./boundaryFetcher";
import { fetchRoute } from "./routeFetcher";
import { estimatePlotBoundary } from "./plotEstimator";
import { extractPincode, lookupPincode } from "./pincodeGeocoder";
import { discoverAmenities } from "./amenityFetcher";
import { ListingVideoProps } from "../types";

// Odisha state center (for initial wide zoom)
const STATE_CENTERS: Record<string, GeoCoordinates> = {
  odisha: { lat: 20.9517, lng: 85.0985 },
  // Add more states as BhoomiScan expands
};

/**
 * Extract all geo data for a property.
 * Designed to be called from pipeline.ts Promise.all().
 */
export async function extractGeoData(
  props: ListingVideoProps,
  supabase?: SupabaseClient
): Promise<GeoData | null> {
  const startTime = Date.now();

  // ── 0. Get plot center coordinates (priority cascade) ──
  let plotCenter: GeoCoordinates | null = null;
  let source: GeoData["source"] = "geocoded";
  let confidence: GeoData["confidence"] = "medium";

  // Priority 0: Supabase DB lat/lng (previously geocoded or manually set)
  if (supabase && props.listingId) {
    plotCenter = await getDbCoordinates(supabase, props.listingId);
    if (plotCenter) {
      source = "database";
      confidence = "high";
      console.log(`[geo] DB hit: ${plotCenter.lat}, ${plotCenter.lng}`);
    }
  }

  // Priority 2: Pincode-constrained Nominatim
  if (!plotCenter) {
    const searchText = `${props.location || ""} ${props.description || ""}`;
    const pincode = (props.pincode as string) || extractPincode(searchText);

    if (pincode) {
      console.log(`[geo] Found pincode: ${pincode}`);
      const pincodeInfo = await lookupPincode(pincode);

      if (pincodeInfo) {
        // Use pincode place name as viewbox context for Nominatim
        const pincodeQuery = `${pincodeInfo.placeName}, ${pincodeInfo.district}, ${pincodeInfo.state}, India`;
        const pincodeCenter = await geocodeAddress(pincodeQuery, pincodeInfo.district, pincodeInfo.state);

        if (pincodeCenter) {
          // Re-geocode original address constrained to pincode area
          const constrained = await geocodeWithViewbox(
            `${props.location || props.area}, ${props.city}`,
            pincodeCenter.coords,
            10, // 10km radius
            props.state
          );

          if (constrained) {
            plotCenter = constrained;
            confidence = "high";
            source = "geocoded";
            console.log(`[geo] Pincode-constrained match: ${plotCenter.lat}, ${plotCenter.lng}`);
          } else {
            // Use pincode center as medium-confidence fallback
            plotCenter = pincodeCenter.coords;
            confidence = "medium";
            source = "geocoded";
            console.log(`[geo] Pincode centroid fallback: ${plotCenter.lat}, ${plotCenter.lng}`);
          }
        }
      }
    }
  }

  // Priority 3: Standard Nominatim cascade
  if (!plotCenter) {
    const result = await geocodeAddress(props.location || props.area, props.city, props.state);
    if (!result) {
      console.warn(`[geo] Geocoding failed for "${props.city}, ${props.state}" — skipping map`);
      return null;
    }
    plotCenter = result.coords;
    confidence = result.confidence;
    source = result.confidence === "low" ? "city-level" : "geocoded";
  }

  // Write-back to Supabase for future runs (if we geocoded fresh)
  if (source !== "database" && supabase && props.listingId) {
    await writeBackCoordinates(supabase, props.listingId, plotCenter);
    console.log(`[geo] Wrote coords to DB for ${props.listingId}`);
  }

  // ── 1. State center for wide zoom ──
  const stateLower = (props.state || "odisha").toLowerCase();
  const stateCenter = STATE_CENTERS[stateLower] || STATE_CENTERS.odisha;

  // ── 2. Geocode landmarks (parallel, max 3) ──
  const landmarkNames = (props.landmarks || []).slice(0, 3);
  const landmarks: GeoLandmark[] = [];

  if (landmarkNames.length > 0) {
    const landmarkPromises = landmarkNames.map(async (name) => {
      const coords = await geocodeLandmark(name, props.city, props.state);
      return coords ? { name, coords } : null;
    });

    const landmarkResults = await Promise.all(landmarkPromises);

    for (const result of landmarkResults) {
      if (result) {
        const distanceKm = haversineDistance(plotCenter, result.coords);
        landmarks.push({
          name: result.name,
          coords: result.coords,
          distanceKm,
        });
      }
    }
  }

  // ── 3. Landmark-based triangulation (verify plot center) ──
  if (landmarks.length >= 2 && source !== "database") {
    const centroid = computeCentroid(landmarks.map((l) => l.coords));
    const distFromCentroid = haversineDistance(plotCenter, centroid);

    if (distFromCentroid > 20) {
      console.log(`[geo] Plot center ${distFromCentroid.toFixed(1)}km from landmark centroid — re-geocoding with viewbox`);
      const reGeocoded = await geocodeWithViewbox(
        `${props.location || props.area}, ${props.city}, ${props.state}`,
        centroid,
        10,
        props.state
      );

      if (reGeocoded) {
        const newDist = haversineDistance(reGeocoded, centroid);
        if (newDist < distFromCentroid) {
          console.log(`[geo] Triangulation improved: ${distFromCentroid.toFixed(1)}km → ${newDist.toFixed(1)}km`);
          plotCenter = reGeocoded;
          confidence = "medium";

          // Recalculate landmark distances
          for (const lm of landmarks) {
            lm.distanceKm = haversineDistance(plotCenter, lm.coords);
          }

          // Write corrected coords
          if (supabase && props.listingId) {
            await writeBackCoordinates(supabase, props.listingId, plotCenter);
          }
        }
      }
    }
  }

  // ── 4. Fetch boundaries ──
  const boundaries: GeoBoundary[] = [];

  const [stateBoundary, districtBoundary, rawAmenities] = await Promise.all([
    fetchStateBoundary(props.state || "Odisha"),
    fetchDistrictBoundary(props.city, props.state || "Odisha"),
    discoverAmenities(plotCenter, 5),
  ]);

  if (stateBoundary) {
    boundaries.push({ type: "state", geojson: stateBoundary });
  }
  if (districtBoundary) {
    boundaries.push({ type: "district", geojson: districtBoundary });
  }

  // ── 5. Generate plot polygon ──
  const plotBoundary = estimatePlotBoundary(
    plotCenter,
    props.plotSize,
    props.areaUnit,
    props.dimensions
  );
  boundaries.push({ type: "plot", geojson: plotBoundary });

  // ── 6. Fetch routes (parallel) ──
  if (landmarks.length > 0) {
    const routePromises = landmarks.map(async (landmark) => {
      if (landmark.distanceKm > 50) return;
      const route = await fetchRoute(plotCenter!, landmark.coords);
      if (route) {
        landmark.routePolyline = route.polyline;
        landmark.distanceKm = route.distanceKm;
      }
    });
    await Promise.all(routePromises);
  }

  // Fetch OSRM routes for discovered amenities
  if (rawAmenities.length > 0) {
    await Promise.all(rawAmenities.map(async (amenity) => {
      if (amenity.distanceKm > 50) return;
      const route = await fetchRoute(plotCenter!, amenity.coords);
      if (route) {
        amenity.routePolyline = route.polyline;
        amenity.distanceKm = route.distanceKm;
      }
    }));

    // Re-sort by road distance after OSRM upgrades haversine distances
    rawAmenities.sort((a, b) => a.distanceKm - b.distanceKm);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(
    `[geo] Complete in ${elapsed}s: confidence=${confidence}, landmarks=${landmarks.length}, amenities=${rawAmenities.length}, boundaries=${boundaries.length}`
  );

  return {
    plotCenter,
    stateCenter,
    landmarks,
    amenities: rawAmenities,
    boundaries,
    confidence,
    source,
  };
}

/**
 * Compute centroid of a set of coordinates.
 */
function computeCentroid(coords: GeoCoordinates[]): GeoCoordinates {
  const sum = coords.reduce(
    (acc, c) => ({ lat: acc.lat + c.lat, lng: acc.lng + c.lng }),
    { lat: 0, lng: 0 }
  );
  return { lat: sum.lat / coords.length, lng: sum.lng / coords.length };
}

/**
 * Haversine formula for straight-line distance between two coordinates.
 * Returns distance in km.
 */
function haversineDistance(a: GeoCoordinates, b: GeoCoordinates): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return Math.round(R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)) * 10) / 10;
}
