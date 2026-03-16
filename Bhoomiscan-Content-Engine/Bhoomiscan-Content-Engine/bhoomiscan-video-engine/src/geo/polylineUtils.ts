/**
 * Polyline processing utilities for smooth route animation.
 *
 * - Douglas-Peucker simplification (removes micro-jitter)
 * - Cumulative distance computation (haversine-based)
 * - Distance-based interpolation (constant-speed movement)
 */

/**
 * Haversine distance in meters between two [lng, lat] points.
 */
function haversineM(a: [number, number], b: [number, number]): number {
  const R = 6371000;
  const dLat = ((b[1] - a[1]) * Math.PI) / 180;
  const dLng = ((b[0] - a[0]) * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h =
    sinDLat * sinDLat +
    Math.cos((a[1] * Math.PI) / 180) *
      Math.cos((b[1] * Math.PI) / 180) *
      sinDLng * sinDLng;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/**
 * Perpendicular distance from a point to a line segment (in degrees).
 * Used by Douglas-Peucker. Fine for short segments at Indian latitudes.
 */
function perpendicularDistance(
  point: [number, number],
  lineStart: [number, number],
  lineEnd: [number, number]
): number {
  const dx = lineEnd[0] - lineStart[0];
  const dy = lineEnd[1] - lineStart[1];
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    // Degenerate segment
    const ddx = point[0] - lineStart[0];
    const ddy = point[1] - lineStart[1];
    return Math.sqrt(ddx * ddx + ddy * ddy);
  }

  // Project point onto line and clamp
  const t = Math.max(0, Math.min(1, ((point[0] - lineStart[0]) * dx + (point[1] - lineStart[1]) * dy) / lenSq));
  const projX = lineStart[0] + t * dx;
  const projY = lineStart[1] + t * dy;

  const ddx = point[0] - projX;
  const ddy = point[1] - projY;
  return Math.sqrt(ddx * ddx + ddy * ddy);
}

/**
 * Douglas-Peucker polyline simplification.
 * Removes micro-jitter while preserving meaningful shape.
 *
 * @param coords - [lng, lat][] polyline
 * @param epsilon - tolerance in degrees (~0.00005 = 5.5m at equator)
 * @returns simplified polyline
 */
export function simplifyPolyline(
  coords: [number, number][],
  epsilon: number = 0.00005
): [number, number][] {
  if (coords.length < 20) return coords; // too short to simplify

  return douglasPeucker(coords, epsilon);
}

function douglasPeucker(
  coords: [number, number][],
  epsilon: number
): [number, number][] {
  if (coords.length <= 2) return coords;

  // Find the point with maximum distance from the start-end line
  let maxDist = 0;
  let maxIdx = 0;
  const start = coords[0];
  const end = coords[coords.length - 1];

  for (let i = 1; i < coords.length - 1; i++) {
    const d = perpendicularDistance(coords[i], start, end);
    if (d > maxDist) {
      maxDist = d;
      maxIdx = i;
    }
  }

  if (maxDist > epsilon) {
    // Recursively simplify each half
    const left = douglasPeucker(coords.slice(0, maxIdx + 1), epsilon);
    const right = douglasPeucker(coords.slice(maxIdx), epsilon);
    return [...left.slice(0, -1), ...right];
  }

  // All points within tolerance — keep only endpoints
  return [start, end];
}

/**
 * Compute cumulative distance array for a polyline.
 * cumDist[i] = total distance in meters from coords[0] to coords[i].
 */
export function computeCumulativeDistances(
  coords: [number, number][]
): number[] {
  const cumDist = new Array(coords.length);
  cumDist[0] = 0;
  for (let i = 1; i < coords.length; i++) {
    cumDist[i] = cumDist[i - 1] + haversineM(coords[i - 1], coords[i]);
  }
  return cumDist;
}

export interface InterpolationResult {
  point: [number, number];
  segmentIndex: number;
  fraction: number;
}

/**
 * Interpolate a point along a polyline at a given distance from start.
 * Uses binary search for O(log n) performance.
 */
export function interpolateByDistance(
  coords: [number, number][],
  cumDist: number[],
  targetDist: number
): InterpolationResult {
  if (coords.length < 2 || targetDist <= 0) {
    return { point: coords[0] || [0, 0], segmentIndex: 0, fraction: 0 };
  }

  const totalDist = cumDist[cumDist.length - 1];
  if (targetDist >= totalDist) {
    return {
      point: coords[coords.length - 1],
      segmentIndex: coords.length - 2,
      fraction: 1,
    };
  }

  // Binary search for the segment containing targetDist
  let lo = 0;
  let hi = coords.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (cumDist[mid] <= targetDist) lo = mid;
    else hi = mid;
  }

  // lo is the segment start index, hi = lo + 1
  const segStart = cumDist[lo];
  const segEnd = cumDist[hi];
  const segLen = segEnd - segStart;
  const fraction = segLen > 0 ? (targetDist - segStart) / segLen : 0;

  const from = coords[lo];
  const to = coords[hi];
  const point: [number, number] = [
    from[0] + (to[0] - from[0]) * fraction,
    from[1] + (to[1] - from[1]) * fraction,
  ];

  return { point, segmentIndex: lo, fraction };
}

/**
 * easeInOutQuad: smooth acceleration at start, deceleration at end.
 * Creates natural driving speed curve.
 */
export function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/**
 * Get recent trail points (last N meters behind a position on the polyline).
 * Returns [lng, lat][] for rendering the car's trailing effect.
 */
export function getRecentTrail(
  coords: [number, number][],
  cumDist: number[],
  progress: number,
  trailMeters: number = 30
): [number, number][] {
  const totalDist = cumDist[cumDist.length - 1];
  const currentDist = progress * totalDist;
  const trailStartDist = Math.max(0, currentDist - trailMeters);

  const startResult = interpolateByDistance(coords, cumDist, trailStartDist);
  const endResult = interpolateByDistance(coords, cumDist, currentDist);

  const trail: [number, number][] = [startResult.point];

  // Add intermediate points between start and end
  const startIdx = startResult.segmentIndex + 1;
  const endIdx = endResult.segmentIndex;
  for (let i = startIdx; i <= endIdx; i++) {
    trail.push(coords[i]);
  }

  trail.push(endResult.point);
  return trail;
}
