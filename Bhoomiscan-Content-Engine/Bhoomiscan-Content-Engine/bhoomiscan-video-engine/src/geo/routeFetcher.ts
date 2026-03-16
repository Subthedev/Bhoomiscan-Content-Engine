/**
 * OSRM routing — fetch road routes between coordinates.
 *
 * Uses the public OSRM demo server (free, good India coverage).
 * Returns decoded polyline as [lng, lat][] for Mapbox rendering + distance in km.
 *
 * Cost: FREE
 */

import { GeoCoordinates } from "./types";
import { getCached, setCache } from "./cache";
import { acquireToken } from "./rateLimiter";

const OSRM_BASE =
  process.env.OSRM_URL || "https://router.project-osrm.org/route/v1/driving";

/**
 * Fetch a driving route between two coordinates.
 * Returns the polyline coordinates and distance.
 */
export async function fetchRoute(
  from: GeoCoordinates,
  to: GeoCoordinates
): Promise<{ polyline: [number, number][]; distanceKm: number } | null> {
  const cacheInput = `${from.lat},${from.lng}|${to.lat},${to.lng}`;
  const cached = getCached<{ polyline: [number, number][]; distanceKm: number }>(
    "route",
    cacheInput
  );
  if (cached) return cached;

  try {
    await acquireToken("osrm");
    // radiuses=unlimited;200 limits destination snap to 200m, preventing overshooting
    const url = `${OSRM_BASE}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=polyline&radiuses=unlimited;200`;
    const res = await fetch(url, {
      headers: { "User-Agent": "BhoomiScan-VideoEngine/1.0" },
    });

    if (!res.ok) {
      console.warn(`[route] OSRM HTTP ${res.status}`);
      return null;
    }

    const data = await res.json();
    if (data.code !== "Ok" || !data.routes || data.routes.length === 0) {
      console.warn(`[route] No route found`);
      return null;
    }

    const route = data.routes[0];
    const polyline = decodePolyline(route.geometry);
    const distanceKm = Math.round((route.distance / 1000) * 10) / 10; // 1 decimal

    const result = { polyline, distanceKm };
    setCache("route", cacheInput, result);
    console.log(`[route] Found route: ${distanceKm}km, ${polyline.length} points`);
    return result;
  } catch (err) {
    console.warn(`[route] OSRM error:`, err);
    return null;
  }
}

/**
 * Haversine distance in meters between two coordinate objects.
 */
function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371000;
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

/**
 * Check if a route distance is sane relative to straight-line distance.
 * Returns false if road distance > 3x haversine (likely an overshoot/detour).
 */
export function isRouteSane(
  from: GeoCoordinates,
  to: GeoCoordinates,
  routeDistanceKm: number
): boolean {
  const straight = haversineMeters(from, to) / 1000;
  if (straight < 0.1) return true;
  return routeDistanceKm / straight < 3.0;
}

/**
 * Find the nearest point on a polyline (way geometry) to a given point.
 * Uses perpendicular foot projection on each segment.
 */
function findNearestPointOnLine(
  wayGeometry: [number, number][],
  point: GeoCoordinates
): { coords: GeoCoordinates; distanceM: number } | null {
  if (wayGeometry.length < 2) return null;

  let bestDist = Infinity;
  let bestCoords: GeoCoordinates | null = null;

  for (let i = 0; i < wayGeometry.length - 1; i++) {
    const A = wayGeometry[i]; // [lng, lat]
    const B = wayGeometry[i + 1];

    const dx = B[0] - A[0];
    const dy = B[1] - A[1];
    const lenSq = dx * dx + dy * dy;

    let t = 0;
    if (lenSq > 0) {
      t = ((point.lng - A[0]) * dx + (point.lat - A[1]) * dy) / lenSq;
      t = Math.max(0, Math.min(1, t));
    }

    const nearLng = A[0] + t * dx;
    const nearLat = A[1] + t * dy;
    const nearCoords = { lat: nearLat, lng: nearLng };
    const dist = haversineMeters(point, nearCoords);

    if (dist < bestDist) {
      bestDist = dist;
      bestCoords = nearCoords;
    }
  }

  return bestCoords ? { coords: bestCoords, distanceM: bestDist } : null;
}

/**
 * Trim a route polyline to stop at the first point near the highway.
 * Uses perpendicular foot projection on highway segments (not just nodes)
 * to catch routes passing between highway nodes.
 */
function trimRouteToHighway(
  routePolyline: [number, number][],
  wayGeometry: [number, number][],
  thresholdMeters: number = 50
): [number, number][] {
  if (wayGeometry.length < 2 || routePolyline.length < 2) return routePolyline;

  // Track the closest point to highway across entire route (fallback)
  let bestIdx = -1;
  let bestDist = Infinity;
  let bestSnap: { lng: number; lat: number } | null = null;

  for (let i = 0; i < routePolyline.length; i++) {
    const rPt = { lat: routePolyline[i][1], lng: routePolyline[i][0] };
    const nearest = findNearestPointOnLine(wayGeometry, rPt);
    if (!nearest) continue;

    // First point within threshold — trim here
    if (nearest.distanceM < thresholdMeters) {
      const trimmed = routePolyline.slice(0, i + 1);
      trimmed.push([nearest.coords.lng, nearest.coords.lat]);
      return trimmed;
    }

    // Track overall closest for fallback
    if (nearest.distanceM < bestDist) {
      bestDist = nearest.distanceM;
      bestIdx = i;
      bestSnap = { lng: nearest.coords.lng, lat: nearest.coords.lat };
    }
  }

  // Fallback: if no point within threshold but we found a closest point, trim there
  if (bestIdx >= 0 && bestSnap && bestDist < 500) {
    const trimmed = routePolyline.slice(0, bestIdx + 1);
    trimmed.push([bestSnap.lng, bestSnap.lat]);
    console.log(`[route] Highway trim fallback: closest point at ${Math.round(bestDist)}m (idx ${bestIdx})`);
    return trimmed;
  }

  return routePolyline;
}

/**
 * Fetch a highway-specific route: routes to the nearest point on the highway
 * way geometry rather than the center/interchange node, then trims overshoot.
 */
export async function fetchHighwayRoute(
  plotCenter: GeoCoordinates,
  highwayCoords: GeoCoordinates,
  wayGeometry?: [number, number][]
): Promise<{ polyline: [number, number][]; distanceKm: number } | null> {
  let targetCoords = highwayCoords;

  // If we have way geometry, route to the nearest point on the highway
  if (wayGeometry && wayGeometry.length >= 2) {
    const nearest = findNearestPointOnLine(wayGeometry, plotCenter);
    if (nearest) {
      targetCoords = nearest.coords;
      console.log(
        `[route] Highway: nearest point on way is ${Math.round(nearest.distanceM)}m from plot`
      );
    }
  }

  const route = await fetchRoute(plotCenter, targetCoords);
  if (!route) return null;

  // Trim route to stop when it first reaches the highway
  let polyline = route.polyline;
  if (wayGeometry && wayGeometry.length >= 2) {
    polyline = trimRouteToHighway(polyline, wayGeometry, 50);
  }

  // Recalculate distance from trimmed polyline
  let distanceM = 0;
  for (let i = 1; i < polyline.length; i++) {
    distanceM += haversineMeters(
      { lat: polyline[i - 1][1], lng: polyline[i - 1][0] },
      { lat: polyline[i][1], lng: polyline[i][0] }
    );
  }
  const distanceKm = Math.round((distanceM / 1000) * 10) / 10;

  console.log(
    `[route] Highway route: ${distanceKm}km (trimmed from ${route.distanceKm}km), ${polyline.length} pts`
  );

  return { polyline, distanceKm };
}

/**
 * Decode a Google-encoded polyline string into [lng, lat][] coordinates.
 * OSRM uses the same encoding format.
 */
function decodePolyline(encoded: string): [number, number][] {
  const coords: [number, number][] = [];
  let lat = 0;
  let lng = 0;
  let i = 0;

  while (i < encoded.length) {
    // Decode latitude
    let shift = 0;
    let result = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(i++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    // Decode longitude
    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(i++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    // OSRM returns [lng, lat] for GeoJSON compatibility
    coords.push([lng / 1e5, lat / 1e5]);
  }

  return coords;
}
