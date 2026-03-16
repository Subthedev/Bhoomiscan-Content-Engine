/**
 * Nominatim geocoder with cascading fallback, structured queries,
 * and state bounding box validation.
 *
 * Strategy:
 * 1. Check Supabase properties.latitude/longitude (already geocoded? skip)
 * 2. Check local file cache
 * 3. Structured query (street/city/state) → full address free-form →
 *    locality+city → city+state via Nominatim (free)
 * 4. Validate all results against state bounding boxes
 * 5. Write-back coords to Supabase + local cache
 *
 * Rate limit: 1 request/second (Nominatim usage policy)
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { GeoCoordinates } from "./types";
import { getCached, setCache } from "./cache";
import { acquireToken } from "./rateLimiter";
import { lookupPincode } from "./pincodeGeocoder";

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "BhoomiScan-VideoEngine/1.0";

// ── B.1: State bounding boxes for validation ──
// Reject results that fall outside the expected state
const STATE_BOUNDS: Record<string, { minLat: number; maxLat: number; minLng: number; maxLng: number }> = {
  odisha:           { minLat: 17.78, maxLat: 22.57, minLng: 81.34, maxLng: 87.53 },
  "andhra pradesh": { minLat: 12.41, maxLat: 19.92, minLng: 76.76, maxLng: 84.74 },
  telangana:        { minLat: 15.83, maxLat: 19.92, minLng: 77.21, maxLng: 81.33 },
  "west bengal":    { minLat: 21.25, maxLat: 27.22, minLng: 85.82, maxLng: 89.88 },
  chhattisgarh:     { minLat: 17.78, maxLat: 24.12, minLng: 80.24, maxLng: 84.40 },
  jharkhand:        { minLat: 21.95, maxLat: 25.35, minLng: 83.33, maxLng: 87.95 },
  "madhya pradesh": { minLat: 21.07, maxLat: 26.87, minLng: 74.02, maxLng: 82.82 },
  maharashtra:      { minLat: 15.60, maxLat: 22.03, minLng: 72.60, maxLng: 80.90 },
  karnataka:        { minLat: 11.59, maxLat: 18.45, minLng: 74.05, maxLng: 78.59 },
  "tamil nadu":     { minLat: 8.07,  maxLat: 13.57, minLng: 76.23, maxLng: 80.35 },
  kerala:           { minLat: 8.18,  maxLat: 12.79, minLng: 74.86, maxLng: 77.42 },
  gujarat:          { minLat: 20.05, maxLat: 24.71, minLng: 68.16, maxLng: 74.48 },
  rajasthan:        { minLat: 23.06, maxLat: 30.19, minLng: 69.48, maxLng: 78.27 },
  "uttar pradesh":  { minLat: 23.87, maxLat: 30.41, minLng: 77.09, maxLng: 84.63 },
  bihar:            { minLat: 24.28, maxLat: 27.52, minLng: 83.33, maxLng: 88.17 },
  punjab:           { minLat: 29.53, maxLat: 32.51, minLng: 73.87, maxLng: 76.95 },
  haryana:          { minLat: 27.66, maxLat: 30.93, minLng: 74.46, maxLng: 77.60 },
  assam:            { minLat: 24.13, maxLat: 28.01, minLng: 89.69, maxLng: 96.02 },
  goa:              { minLat: 14.89, maxLat: 15.80, minLng: 73.68, maxLng: 74.34 },
  uttarakhand:      { minLat: 28.72, maxLat: 31.46, minLng: 77.57, maxLng: 81.03 },
  delhi:            { minLat: 28.40, maxLat: 28.88, minLng: 76.84, maxLng: 77.35 },
};

function isWithinStateBounds(coords: GeoCoordinates, state: string): boolean {
  const bounds = STATE_BOUNDS[state.toLowerCase()];
  if (!bounds) return true; // Unknown state — don't reject
  return (
    coords.lat >= bounds.minLat &&
    coords.lat <= bounds.maxLat &&
    coords.lng >= bounds.minLng &&
    coords.lng <= bounds.maxLng
  );
}

async function rateLimitedFetch(url: string): Promise<Response> {
  await acquireToken("nominatim");

  return fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
    },
  });
}

/**
 * Free-form Nominatim search. Returns up to `limit` results.
 */
async function nominatimSearch(query: string, limit = 3): Promise<GeoCoordinates[]> {
  try {
    const url = `${NOMINATIM_BASE}?q=${encodeURIComponent(query)}&format=json&limit=${limit}&countrycodes=in`;
    const res = await rateLimitedFetch(url);

    if (!res.ok) {
      console.warn(`[geocoder] Nominatim HTTP ${res.status} for "${query}"`);
      return [];
    }

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return [];

    return data.map((d: any) => ({
      lat: parseFloat(d.lat),
      lng: parseFloat(d.lon),
    }));
  } catch (err) {
    console.warn(`[geocoder] Nominatim error for "${query}":`, err);
    return [];
  }
}

/**
 * B.2: Structured Nominatim query (more accurate than free-form for Indian addresses).
 */
async function nominatimStructuredSearch(
  street: string,
  city: string,
  state: string,
  postalcode?: string
): Promise<GeoCoordinates[]> {
  try {
    const params = new URLSearchParams({
      street,
      city,
      state,
      country: "India",
      format: "json",
      limit: "3",
    });
    if (postalcode) params.set("postalcode", postalcode);
    const url = `${NOMINATIM_BASE}?${params.toString()}`;
    const res = await rateLimitedFetch(url);

    if (!res.ok) {
      console.warn(`[geocoder] Structured query HTTP ${res.status}`);
      return [];
    }

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return [];

    return data.map((d: any) => ({
      lat: parseFloat(d.lat),
      lng: parseFloat(d.lon),
    }));
  } catch (err) {
    console.warn(`[geocoder] Structured query error:`, err);
    return [];
  }
}

/**
 * Pick the first result that falls within the expected state bounds.
 */
function pickValidResult(results: GeoCoordinates[], state: string): GeoCoordinates | null {
  for (const coords of results) {
    if (isWithinStateBounds(coords, state)) {
      return coords;
    }
  }
  if (results.length > 0) {
    console.warn(`[geocoder] All ${results.length} results outside ${state} bounds — rejected`);
  }
  return null;
}

/**
 * Nominatim search constrained to a viewbox (bounding box) around a center point.
 * Used for landmark-based triangulation re-geocoding.
 */
export async function geocodeWithViewbox(
  query: string,
  center: GeoCoordinates,
  radiusKm: number,
  state: string
): Promise<GeoCoordinates | null> {
  // Convert km to approximate degrees (1 deg ≈ 111km)
  const delta = radiusKm / 111;
  const viewbox = [
    center.lng - delta,
    center.lat + delta,
    center.lng + delta,
    center.lat - delta,
  ].join(",");

  try {
    const url = `${NOMINATIM_BASE}?q=${encodeURIComponent(query)}&format=json&limit=3&countrycodes=in&viewbox=${viewbox}&bounded=1`;
    const res = await rateLimitedFetch(url);
    if (!res.ok) return null;

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;

    const results = data.map((d: any) => ({
      lat: parseFloat(d.lat),
      lng: parseFloat(d.lon),
    }));
    return pickValidResult(results, state);
  } catch {
    return null;
  }
}

/**
 * Check if Supabase already has coordinates for this property.
 */
export async function getDbCoordinates(
  supabase: SupabaseClient,
  propertyId: string
): Promise<GeoCoordinates | null> {
  try {
    const { data, error } = await supabase
      .from("properties")
      .select("latitude, longitude")
      .eq("id", propertyId)
      .single();

    if (error || !data) return null;
    if (data.latitude && data.longitude) {
      return { lat: data.latitude, lng: data.longitude };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Write geocoded coordinates back to Supabase.
 */
export async function writeBackCoordinates(
  supabase: SupabaseClient,
  propertyId: string,
  coords: GeoCoordinates
): Promise<void> {
  try {
    await supabase
      .from("properties")
      .update({ latitude: coords.lat, longitude: coords.lng })
      .eq("id", propertyId);
  } catch (err) {
    console.warn(`[geocoder] Failed to write-back coords for ${propertyId}:`, err);
  }
}

/**
 * Geocode an address using cascading fallback with state validation:
 * 1. Structured query (NEW — most accurate for Indian addresses)
 * 2. Free-form full address
 * 3. Locality + city
 * 4. City + state
 *
 * All results are validated against state bounding boxes.
 */
export async function geocodeAddress(
  address: string,
  city: string,
  state: string,
  pincode?: string
): Promise<{ coords: GeoCoordinates; confidence: "high" | "medium" | "low" } | null> {
  const cacheInput = `${address}|${city}|${state}|${pincode || ""}`;

  // Check local cache first
  const cached = getCached<{ coords: GeoCoordinates; confidence: "high" | "medium" | "low" }>(
    "geocode",
    cacheInput
  );
  if (cached) {
    // Validate cached result against state bounds (old cache entries may be wrong)
    if (isWithinStateBounds(cached.coords, state)) {
      console.log(`[geocoder] Cache hit for "${city}"`);
      return cached;
    }
    console.warn(`[geocoder] Cached result outside ${state} bounds — re-geocoding`);
  }

  // Strategy 1: Structured query — street/city/state separated
  const structuredResults = await nominatimStructuredSearch(address, city, state);
  let coords = pickValidResult(structuredResults, state);
  if (coords) {
    const result = { coords, confidence: "high" as const };
    setCache("geocode", cacheInput, result);
    console.log(`[geocoder] Structured match: ${coords.lat}, ${coords.lng}`);
    return result;
  }

  // Strategy 2: Structured query WITH pincode (more precise)
  if (pincode) {
    const pincodeStructuredResults = await nominatimStructuredSearch(address, city, state, pincode);
    coords = pickValidResult(pincodeStructuredResults, state);
    if (coords) {
      const result = { coords, confidence: "high" as const };
      setCache("geocode", cacheInput, result);
      console.log(`[geocoder] Pincode-structured match: ${coords.lat}, ${coords.lng}`);
      return result;
    }
  }

  // Strategy 3: Free-form full address + city + state
  const fullQuery = `${address}, ${city}, ${state}, India`;
  const fullResults = await nominatimSearch(fullQuery);
  coords = pickValidResult(fullResults, state);
  if (coords) {
    const result = { coords, confidence: "high" as const };
    setCache("geocode", cacheInput, result);
    console.log(`[geocoder] Full address match: ${coords.lat}, ${coords.lng}`);
    return result;
  }

  // Strategy 4: Locality + city
  const locality = address.split(",")[0]?.trim();
  if (locality && locality !== city) {
    const localResults = await nominatimSearch(`${locality}, ${city}, ${state}, India`);
    coords = pickValidResult(localResults, state);
    if (coords) {
      const result = { coords, confidence: "medium" as const };
      setCache("geocode", cacheInput, result);
      console.log(`[geocoder] Locality match: ${coords.lat}, ${coords.lng}`);
      return result;
    }
  }

  // Strategy 5: Pincode → India Post API → place name → Nominatim
  if (pincode) {
    try {
      const pincodeInfo = await lookupPincode(pincode);
      if (pincodeInfo) {
        const pincodeResults = await nominatimSearch(
          `${pincodeInfo.placeName}, ${pincodeInfo.district}, ${state}, India`
        );
        coords = pickValidResult(pincodeResults, state);
        if (coords) {
          const result = { coords, confidence: "medium" as const };
          setCache("geocode", cacheInput, result);
          console.log(`[geocoder] Pincode-place match: ${coords.lat}, ${coords.lng}`);
          return result;
        }
      }
    } catch (err) {
      console.warn(`[geocoder] Pincode lookup failed for ${pincode}:`, err);
    }
  }

  // Strategy 6: City + state only
  const cityResults = await nominatimSearch(`${city}, ${state}, India`);
  coords = pickValidResult(cityResults, state);
  if (coords) {
    const result = { coords, confidence: "low" as const };
    setCache("geocode", cacheInput, result);
    console.log(`[geocoder] City-level match: ${coords.lat}, ${coords.lng}`);
    return result;
  }

  console.warn(`[geocoder] All strategies failed for "${address}, ${city}, ${state}"`);
  return null;
}

/**
 * Geocode a landmark name within a city context.
 * Also validates against state bounds.
 */
export async function geocodeLandmark(
  landmarkName: string,
  city: string,
  state: string
): Promise<GeoCoordinates | null> {
  const cacheInput = `landmark:${landmarkName}|${city}|${state}`;
  const cached = getCached<GeoCoordinates>("geocode", cacheInput);
  if (cached && isWithinStateBounds(cached, state)) return cached;

  const results = await nominatimSearch(`${landmarkName}, ${city}, ${state}, India`);
  const coords = pickValidResult(results, state);
  if (coords) {
    setCache("geocode", cacheInput, coords);
  }
  return coords;
}
