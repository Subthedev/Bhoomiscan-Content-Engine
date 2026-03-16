/**
 * Amenity Discovery Engine — Compulsory / Backup / Bonus selection.
 *
 * Selection algorithm:
 * 1. COMPULSORY (must show, 25km): Highway, Hospital, School
 * 2. BACKUP (fill if compulsory missing, priority order): Mall > Airport > Park > Temple
 * 3. BONUS (if backup within 5km AND already have 3, add 1 extra → max 4)
 *
 * Uses a single compound Overpass query for all 7 categories at 25km radius.
 * Results cached with versioned key (amenity_v2_).
 *
 * Cost: FREE (Overpass API is public)
 */

import { GeoCoordinates, DiscoveredAmenity } from "./types";
import { getCached, setCache } from "./cache";
import { acquireToken } from "./rateLimiter";
import { fetchRoute, fetchHighwayRoute, isRouteSane } from "./routeFetcher";
import { simplifyPolyline } from "./polylineUtils";

const OVERPASS_API = "https://overpass-api.de/api/interpreter";
const MAX_AMENITIES = 4;
const SEARCH_RADIUS = 25000; // 25km uniform
const BONUS_RADIUS_KM = 5;

interface AmenityCategory {
  category: string;
  label: string;
  icon: string;
  priority: "compulsory" | "backup";
  backupOrder: number; // for backup sorting (lower = higher priority)
}

const CATEGORIES: AmenityCategory[] = [
  { category: "hospital",  label: "Hospital",       icon: "🏥", priority: "compulsory", backupOrder: 99 },
  { category: "school",    label: "School",         icon: "🏫", priority: "compulsory", backupOrder: 99 },
  { category: "highway",   label: "Highway",        icon: "🛣️",  priority: "compulsory", backupOrder: 99 },
  { category: "mall",      label: "Shopping Mall",  icon: "🏬", priority: "backup",     backupOrder: 1 },
  { category: "airport",   label: "Airport",        icon: "✈️",  priority: "backup",     backupOrder: 2 },
  { category: "park",      label: "Park",           icon: "🌳", priority: "backup",     backupOrder: 3 },
  { category: "temple",    label: "Temple",         icon: "🛕", priority: "backup",     backupOrder: 4 },
];

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
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function getElementCoords(el: any): GeoCoordinates | null {
  if (el.type === "node" && el.lat != null && el.lon != null) {
    return { lat: el.lat, lng: el.lon };
  }
  if (el.center) {
    return { lat: el.center.lat, lng: el.center.lon };
  }
  if (el.geometry && el.geometry.length > 0) {
    const mid = el.geometry[Math.floor(el.geometry.length / 2)];
    return { lat: mid.lat, lng: mid.lon };
  }
  return null;
}

/**
 * Extract full way geometry as [lng, lat][] for highway way elements.
 */
function getElementGeometry(el: any): [number, number][] | null {
  if (el.geometry && el.geometry.length > 0) {
    return el.geometry.map((p: any) => [p.lon, p.lat] as [number, number]);
  }
  return null;
}

function getElementName(el: any): string {
  return el.tags?.name || el.tags?.["name:en"] || el.tags?.ref || "";
}

/**
 * Build a single compound Overpass query for all 7 categories at 25km.
 */
function buildQuery(lat: number, lng: number): string {
  return `
    [out:json][timeout:25];
    (
      // Hospital
      node["amenity"="hospital"](around:${SEARCH_RADIUS},${lat},${lng});
      way["amenity"="hospital"](around:${SEARCH_RADIUS},${lat},${lng});

      // School
      node["amenity"="school"](around:${SEARCH_RADIUS},${lat},${lng});
      way["amenity"="school"](around:${SEARCH_RADIUS},${lat},${lng});
      node["amenity"="college"](around:${SEARCH_RADIUS},${lat},${lng});
      way["amenity"="college"](around:${SEARCH_RADIUS},${lat},${lng});

      // Highway (trunk/primary/motorway)
      way["highway"="trunk"](around:${SEARCH_RADIUS},${lat},${lng});
      way["highway"="primary"](around:${SEARCH_RADIUS},${lat},${lng});
      way["highway"="motorway"](around:${SEARCH_RADIUS},${lat},${lng});

      // Mall
      node["shop"="mall"](around:${SEARCH_RADIUS},${lat},${lng});
      way["shop"="mall"](around:${SEARCH_RADIUS},${lat},${lng});

      // Airport
      node["aeroway"="aerodrome"](around:${SEARCH_RADIUS},${lat},${lng});
      way["aeroway"="aerodrome"](around:${SEARCH_RADIUS},${lat},${lng});

      // Park
      node["leisure"="park"](around:${SEARCH_RADIUS},${lat},${lng});
      way["leisure"="park"](around:${SEARCH_RADIUS},${lat},${lng});

      // Temple
      node["amenity"="place_of_worship"](around:${SEARCH_RADIUS},${lat},${lng});
      way["amenity"="place_of_worship"](around:${SEARCH_RADIUS},${lat},${lng});
    );
    out geom 50;
  `;
}

function classifyElement(el: any): string | null {
  const tags = el.tags || {};
  if (tags.amenity === "hospital") return "hospital";
  if (tags.amenity === "school" || tags.amenity === "college") return "school";
  if (tags.highway === "trunk" || tags.highway === "primary" || tags.highway === "motorway")
    return "highway";
  if (tags.shop === "mall") return "mall";
  if (tags.aeroway === "aerodrome") return "airport";
  if (tags.leisure === "park") return "park";
  if (tags.amenity === "place_of_worship") return "temple";
  return null;
}

/**
 * Discover nearby amenities using compulsory/backup/bonus selection.
 * Returns sorted by distance (nearest first) for sequential animation.
 */
export async function discoverAmenities(
  plotCenter: GeoCoordinates
): Promise<DiscoveredAmenity[]> {
  const cacheInput = `amenity_v2_${plotCenter.lat},${plotCenter.lng}`;
  const cached = getCached<DiscoveredAmenity[]>("amenity", cacheInput);
  if (cached) {
    console.log(`[amenity] Cache hit: ${cached.length} amenities`);
    return cached;
  }

  let elements: any[];
  try {
    elements = await fetchOverpassElements(plotCenter);
  } catch (err) {
    console.warn("[amenity] Overpass query failed:", err);
    return [];
  }

  if (elements.length === 0) {
    console.log("[amenity] No elements returned from Overpass");
    return [];
  }

  // Group by category, pick closest per category
  const closestByCategory = new Map<
    string,
    { el: any; coords: GeoCoordinates; distance: number; wayGeometry?: [number, number][] }
  >();

  for (const el of elements) {
    const category = classifyElement(el);
    if (!category) continue;

    const coords = getElementCoords(el);
    if (!coords) continue;

    const distance = haversineKm(plotCenter, coords);
    const existing = closestByCategory.get(category);
    if (!existing || distance < existing.distance) {
      // Capture way geometry for highways (used for nearest-point routing)
      const wayGeometry = category === "highway" ? getElementGeometry(el) ?? undefined : undefined;
      closestByCategory.set(category, { el, coords, distance, wayGeometry });
    }
  }

  console.log(`[amenity] Categories found: ${Array.from(closestByCategory.keys()).join(", ")}`);

  // Build candidate map
  const categoryMeta = new Map(CATEGORIES.map((c) => [c.category, c]));

  // Step 1: Collect compulsory amenities found
  const compulsory: DiscoveredAmenity[] = [];
  for (const cat of CATEGORIES.filter((c) => c.priority === "compulsory")) {
    const found = closestByCategory.get(cat.category);
    if (found) {
      compulsory.push({
        category: cat.category,
        name: getElementName(found.el) || cat.label,
        label: cat.label,
        icon: cat.icon,
        coords: found.coords,
        distanceKm: Math.round(found.distance * 10) / 10,
      });
    }
  }

  // Step 2: If fewer than 3 compulsory, fill from backup in priority order
  const backupCats = CATEGORIES.filter((c) => c.priority === "backup")
    .sort((a, b) => a.backupOrder - b.backupOrder);

  const selected = [...compulsory];
  if (selected.length < 3) {
    for (const cat of backupCats) {
      if (selected.length >= 3) break;
      const found = closestByCategory.get(cat.category);
      if (found) {
        selected.push({
          category: cat.category,
          name: getElementName(found.el) || cat.label,
          label: cat.label,
          icon: cat.icon,
          coords: found.coords,
          distanceKm: Math.round(found.distance * 10) / 10,
        });
      }
    }
  }

  // Step 3: Bonus — if already have 3 and a backup is within 5km, add it
  if (selected.length >= 3 && selected.length < MAX_AMENITIES) {
    const selectedCategories = new Set(selected.map((s) => s.category));
    for (const cat of backupCats) {
      if (selectedCategories.has(cat.category)) continue;
      const found = closestByCategory.get(cat.category);
      if (found && found.distance <= BONUS_RADIUS_KM) {
        selected.push({
          category: cat.category,
          name: getElementName(found.el) || cat.label,
          label: cat.label,
          icon: cat.icon,
          coords: found.coords,
          distanceKm: Math.round(found.distance * 10) / 10,
        });
        break; // max 1 bonus
      }
    }
  }

  // Edge case: < 2 total — retry with 2x radius
  if (selected.length < 2) {
    console.log("[amenity] < 2 amenities found, retrying with 2x radius...");
    const retryElements = await fetchOverpassElements(plotCenter, SEARCH_RADIUS * 2);
    // Re-run same logic with wider results
    for (const el of retryElements) {
      const category = classifyElement(el);
      if (!category) continue;
      const coords = getElementCoords(el);
      if (!coords) continue;
      const distance = haversineKm(plotCenter, coords);
      const existing = closestByCategory.get(category);
      if (!existing || distance < existing.distance) {
        closestByCategory.set(category, { el, coords, distance });
      }
    }
    // Re-select with wider results
    selected.length = 0;
    for (const cat of CATEGORIES.filter((c) => c.priority === "compulsory")) {
      const found = closestByCategory.get(cat.category);
      if (found) {
        selected.push({
          category: cat.category,
          name: getElementName(found.el) || cat.label,
          label: cat.label,
          icon: cat.icon,
          coords: found.coords,
          distanceKm: Math.round(found.distance * 10) / 10,
        });
      }
    }
    if (selected.length < 3) {
      for (const cat of backupCats) {
        if (selected.length >= 3) break;
        const found = closestByCategory.get(cat.category);
        if (found && !selected.some((s) => s.category === cat.category)) {
          selected.push({
            category: cat.category,
            name: getElementName(found.el) || cat.label,
            label: cat.label,
            icon: cat.icon,
            coords: found.coords,
            distanceKm: Math.round(found.distance * 10) / 10,
          });
        }
      }
    }
  }

  // Sort by distance (nearest first) for sequential animation
  selected.sort((a, b) => a.distanceKm - b.distanceKm);

  // Fetch OSRM routes in parallel (highway-specific routing for highway amenities)
  const withRoutes = await Promise.all(
    selected.map(async (amenity) => {
      // Highway amenities: use nearest-point routing + trimming
      if (amenity.category === "highway") {
        const hwData = closestByCategory.get("highway");
        const route = await fetchHighwayRoute(
          plotCenter,
          amenity.coords,
          hwData?.wayGeometry
        );
        if (route && isRouteSane(plotCenter, amenity.coords, route.distanceKm)) {
          return {
            ...amenity,
            distanceKm: route.distanceKm,
            routePolyline: simplifyPolyline(route.polyline),
            wayGeometry: hwData?.wayGeometry,
          };
        }
        // Insane route — keep haversine distance, no route animation
        console.warn(
          `[amenity] Highway route insane (${route?.distanceKm}km road vs haversine), skipping polyline`
        );
        return amenity;
      }

      // Non-highway amenities: standard routing with sanity check
      const route = await fetchRoute(plotCenter, amenity.coords);
      if (route && isRouteSane(plotCenter, amenity.coords, route.distanceKm)) {
        return {
          ...amenity,
          distanceKm: route.distanceKm,
          routePolyline: simplifyPolyline(route.polyline),
        };
      }
      if (route) {
        console.warn(
          `[amenity] Route to ${amenity.label} insane (${route.distanceKm}km road), skipping polyline`
        );
      }
      return amenity;
    })
  );

  // Re-sort by road distance
  withRoutes.sort((a, b) => a.distanceKm - b.distanceKm);

  console.log(
    `[amenity] Selected ${withRoutes.length}: ${withRoutes.map((a) => `${a.icon} ${a.label} (${a.distanceKm}km)`).join(", ")}`
  );

  setCache("amenity", cacheInput, withRoutes);
  return withRoutes;
}

async function fetchOverpassElements(
  center: GeoCoordinates,
  radius?: number
): Promise<any[]> {
  await acquireToken("overpass");

  const query = radius
    ? buildQuery(center.lat, center.lng).replace(
        new RegExp(String(SEARCH_RADIUS), "g"),
        String(radius)
      )
    : buildQuery(center.lat, center.lng);

  const res = await fetch(OVERPASS_API, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `data=${encodeURIComponent(query)}`,
  });

  if (!res.ok) {
    throw new Error(`Overpass HTTP ${res.status}`);
  }

  const data = await res.json();
  return data.elements || [];
}
