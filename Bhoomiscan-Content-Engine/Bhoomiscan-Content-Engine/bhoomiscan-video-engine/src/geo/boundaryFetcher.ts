/**
 * Fetch administrative boundaries from Overpass API (OpenStreetMap).
 *
 * - State boundaries: pre-bundled GeoJSON for Odisha, fetched for others
 * - District boundaries: fetched on demand, cached to file system
 *
 * Cost: FREE (Overpass API is public)
 */

import * as fs from "fs";
import * as path from "path";
import { getCached, setCache } from "./cache";
import { acquireToken } from "./rateLimiter";

const OVERPASS_API = "https://overpass-api.de/api/interpreter";
const PRE_BUNDLED_DIR = path.join(__dirname, "..", "..", "public", "geo");

/**
 * Fetch a state boundary GeoJSON.
 * Uses pre-bundled file for Odisha, Overpass for others.
 */
export async function fetchStateBoundary(
  stateName: string
): Promise<GeoJSON.Feature | null> {
  const normalizedState = stateName.toLowerCase().trim();

  // Check pre-bundled file first
  const bundledPath = path.join(PRE_BUNDLED_DIR, `${normalizedState}-state.geojson`);
  if (fs.existsSync(bundledPath)) {
    try {
      const raw = fs.readFileSync(bundledPath, "utf-8");
      const geojson = JSON.parse(raw);
      // Handle both Feature and FeatureCollection
      if (geojson.type === "FeatureCollection" && geojson.features?.length > 0) {
        return geojson.features[0] as GeoJSON.Feature;
      }
      return geojson as GeoJSON.Feature;
    } catch {
      console.warn(`[boundary] Failed to read bundled ${bundledPath}`);
    }
  }

  // Check cache
  const cached = getCached<GeoJSON.Feature>("boundary", `state:${normalizedState}`);
  if (cached) {
    console.log(`[boundary] Cache hit for state: ${stateName}`);
    return cached;
  }

  // Fetch from Overpass
  return fetchBoundaryFromOverpass(stateName, 4, `state:${normalizedState}`);
}

/**
 * Fetch a district boundary GeoJSON from Overpass.
 */
export async function fetchDistrictBoundary(
  districtName: string,
  stateName: string
): Promise<GeoJSON.Feature | null> {
  const cacheKey = `district:${districtName.toLowerCase()}:${stateName.toLowerCase()}`;
  const cached = getCached<GeoJSON.Feature>("boundary", cacheKey);
  if (cached) {
    console.log(`[boundary] Cache hit for district: ${districtName}`);
    return cached;
  }

  return fetchBoundaryFromOverpass(
    `${districtName}, ${stateName}`,
    6, // admin_level 6 = district in India
    cacheKey
  );
}

async function fetchBoundaryFromOverpass(
  name: string,
  adminLevel: number,
  cacheKey: string
): Promise<GeoJSON.Feature | null> {
  const query = `
    [out:json][timeout:25];
    relation["name"~"${name}",i]["admin_level"="${adminLevel}"]["boundary"="administrative"];
    out geom;
  `;

  try {
    await acquireToken("overpass");
    const res = await fetch(OVERPASS_API, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (!res.ok) {
      console.warn(`[boundary] Overpass HTTP ${res.status} for "${name}"`);
      return null;
    }

    const data = await res.json();
    if (!data.elements || data.elements.length === 0) {
      console.warn(`[boundary] No boundary found for "${name}" (admin_level=${adminLevel})`);
      return null;
    }

    const element = data.elements[0];
    const feature = overpassElementToGeoJSON(element);

    if (feature) {
      setCache("boundary", cacheKey, feature);
      console.log(`[boundary] Fetched boundary for "${name}"`);
    }

    return feature;
  } catch (err) {
    console.warn(`[boundary] Overpass error for "${name}":`, err);
    return null;
  }
}

/**
 * Convert an Overpass relation element with geometry to a GeoJSON Feature.
 */
function overpassElementToGeoJSON(element: any): GeoJSON.Feature | null {
  if (!element.members) return null;

  // Extract outer ways to build polygon rings
  const outerWays = element.members
    .filter((m: any) => m.type === "way" && m.role === "outer" && m.geometry)
    .map((m: any) => m.geometry.map((p: any) => [p.lon, p.lat]));

  if (outerWays.length === 0) return null;

  // Try to merge ways into closed rings
  const rings = mergeWaysIntoRings(outerWays);
  if (rings.length === 0) return null;

  const geometry: GeoJSON.Geometry =
    rings.length === 1
      ? { type: "Polygon", coordinates: [rings[0]] }
      : { type: "MultiPolygon", coordinates: rings.map((r) => [r]) };

  return {
    type: "Feature",
    properties: {
      name: element.tags?.name || "",
      admin_level: element.tags?.admin_level || "",
    },
    geometry,
  };
}

/**
 * Merge a list of coordinate arrays into closed rings.
 * Ways from Overpass may come in arbitrary order and need to be stitched together.
 */
function mergeWaysIntoRings(ways: [number, number][][]): [number, number][][] {
  if (ways.length === 0) return [];

  const rings: [number, number][][] = [];
  const remaining = [...ways];

  while (remaining.length > 0) {
    let current = remaining.shift()!;

    let merged = true;
    while (merged) {
      merged = false;
      for (let i = 0; i < remaining.length; i++) {
        const way = remaining[i];
        const currentEnd = current[current.length - 1];
        const wayStart = way[0];
        const wayEnd = way[way.length - 1];

        if (coordsEqual(currentEnd, wayStart)) {
          current = current.concat(way.slice(1));
          remaining.splice(i, 1);
          merged = true;
          break;
        } else if (coordsEqual(currentEnd, wayEnd)) {
          current = current.concat(way.reverse().slice(1));
          remaining.splice(i, 1);
          merged = true;
          break;
        }
      }
    }

    // Close ring if not already closed
    if (!coordsEqual(current[0], current[current.length - 1])) {
      current.push(current[0]);
    }

    rings.push(current);
  }

  return rings;
}

function coordsEqual(a: [number, number], b: [number, number]): boolean {
  return Math.abs(a[0] - b[0]) < 0.00001 && Math.abs(a[1] - b[1]) < 0.00001;
}
