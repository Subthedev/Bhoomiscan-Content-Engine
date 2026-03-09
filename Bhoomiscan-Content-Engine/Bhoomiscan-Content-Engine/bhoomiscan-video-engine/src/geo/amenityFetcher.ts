/**
 * Amenity Discovery Engine — finds nearby POIs via Overpass API.
 *
 * Single compound query fetches hospitals, schools, highways, airports,
 * malls, temples, and parks. Results are classified, deduplicated,
 * and sorted by priority + distance.
 *
 * Cost: FREE (Overpass API is public)
 */

import type { GeoCoordinates, DiscoveredAmenity } from "./types";
import { getCached, setCache } from "./cache";
import { acquireToken } from "./rateLimiter";

const OVERPASS_API = "https://overpass-api.de/api/interpreter";

interface AmenityCategory {
  key: string;
  label: string;
  icon: string;
  overpassTag: string;
  radius: number; // meters
  priority: number;
}

const CATEGORIES: AmenityCategory[] = [
  { key: "highway",  label: "Highway",       icon: "\u{1F6E3}\u{FE0F}", overpassTag: 'way["highway"~"trunk|primary|motorway"]', radius: 3000,  priority: 1 },
  { key: "hospital", label: "Hospital",      icon: "\u{1F3E5}",         overpassTag: 'node["amenity"="hospital"]',              radius: 5000,  priority: 2 },
  { key: "school",   label: "School",        icon: "\u{1F3EB}",         overpassTag: 'node["amenity"="school"]',                radius: 3000,  priority: 3 },
  { key: "airport",  label: "Airport",       icon: "\u{2708}\u{FE0F}",  overpassTag: 'node["aeroway"="aerodrome"]',             radius: 30000, priority: 4 },
  { key: "mall",     label: "Shopping Mall",  icon: "\u{1F6CD}\u{FE0F}", overpassTag: 'node["shop"="mall"]',                     radius: 5000,  priority: 5 },
  { key: "temple",   label: "Temple",        icon: "\u{1F6D5}",         overpassTag: 'node["amenity"="place_of_worship"]',      radius: 3000,  priority: 6 },
  { key: "park",     label: "Park",          icon: "\u{1F333}",         overpassTag: 'node["leisure"="park"]',                  radius: 3000,  priority: 7 },
];

/**
 * Haversine distance in km between two coordinates.
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

/**
 * Build a single compound Overpass query for all categories.
 */
function buildQuery(lat: number, lng: number, radiusMultiplier = 1): string {
  const stmts = CATEGORIES.map(
    (c) => `  ${c.overpassTag}(around:${c.radius * radiusMultiplier},${lat},${lng});`
  ).join("\n");

  return `[out:json][timeout:25];\n(\n${stmts}\n);\nout center 30;`;
}

/**
 * Classify an Overpass element into an amenity category.
 */
function classifyElement(el: any): AmenityCategory | null {
  const tags = el.tags || {};
  if (tags.highway && /trunk|primary|motorway/.test(tags.highway)) {
    return CATEGORIES.find((c) => c.key === "highway")!;
  }
  if (tags.aeroway === "aerodrome") return CATEGORIES.find((c) => c.key === "airport")!;
  if (tags.shop === "mall") return CATEGORIES.find((c) => c.key === "mall")!;
  if (tags.leisure === "park") return CATEGORIES.find((c) => c.key === "park")!;
  if (tags.amenity === "hospital") return CATEGORIES.find((c) => c.key === "hospital")!;
  if (tags.amenity === "school") return CATEGORIES.find((c) => c.key === "school")!;
  if (tags.amenity === "place_of_worship") return CATEGORIES.find((c) => c.key === "temple")!;
  return null;
}

/**
 * Get coordinates from an Overpass element (node or way with center).
 */
function getElementCoords(el: any): GeoCoordinates | null {
  if (el.lat != null && el.lon != null) return { lat: el.lat, lng: el.lon };
  if (el.center?.lat != null && el.center?.lon != null) return { lat: el.center.lat, lng: el.center.lon };
  return null;
}

/**
 * Discover nearby amenities for a plot location.
 * Returns up to maxAmenities results, minimum 2 if possible.
 */
export async function discoverAmenities(
  plotCenter: GeoCoordinates,
  maxAmenities = 5
): Promise<DiscoveredAmenity[]> {
  const cacheKey = `${plotCenter.lat.toFixed(4)},${plotCenter.lng.toFixed(4)}`;
  const cached = getCached<DiscoveredAmenity[]>("amenity", cacheKey);
  if (cached) {
    console.log(`[amenity] Cache hit: ${cached.length} amenities`);
    return cached;
  }

  const results = await fetchAmenities(plotCenter, 1);

  // Retry with 2x radii if fewer than 2 found
  if (results.length < 2) {
    console.log(`[amenity] Only ${results.length} found, retrying with 2x radii`);
    const expanded = await fetchAmenities(plotCenter, 2);
    if (expanded.length > results.length) {
      const final = expanded.slice(0, maxAmenities);
      setCache("amenity", cacheKey, final);
      console.log(`[amenity] Discovered ${final.length} amenities (expanded)`);
      return final;
    }
  }

  const final = results.slice(0, maxAmenities);
  setCache("amenity", cacheKey, final);
  console.log(`[amenity] Discovered ${final.length} amenities`);
  return final;
}

async function fetchAmenities(
  plotCenter: GeoCoordinates,
  radiusMultiplier: number
): Promise<DiscoveredAmenity[]> {
  const query = buildQuery(plotCenter.lat, plotCenter.lng, radiusMultiplier);

  try {
    await acquireToken("overpass");
    const res = await fetch(OVERPASS_API, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (!res.ok) {
      console.warn(`[amenity] Overpass HTTP ${res.status}`);
      return [];
    }

    const data = await res.json();
    if (!data.elements || data.elements.length === 0) {
      console.warn(`[amenity] No amenities found`);
      return [];
    }

    // Classify and pick closest per category
    const byCategory = new Map<string, DiscoveredAmenity>();

    for (const el of data.elements) {
      const cat = classifyElement(el);
      if (!cat) continue;

      const coords = getElementCoords(el);
      if (!coords) continue;

      const name = el.tags?.name || cat.label;
      const distanceKm = haversineDistance(plotCenter, coords);

      const existing = byCategory.get(cat.key);
      if (!existing || distanceKm < existing.distanceKm) {
        byCategory.set(cat.key, {
          category: cat.key,
          name,
          label: cat.label,
          icon: cat.icon,
          coords,
          distanceKm,
        });
      }
    }

    // Sort by distance (shortest first) for sequential reveal
    return Array.from(byCategory.values()).sort((a, b) => a.distanceKm - b.distanceKm);
  } catch (err) {
    console.warn(`[amenity] Overpass error:`, err);
    return [];
  }
}
