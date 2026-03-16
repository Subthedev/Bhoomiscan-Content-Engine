/**
 * Route animation utilities for progressive polyline drawing.
 *
 * Distance-based interpolation for constant-speed car movement (like Uber/Ola).
 * Features:
 * - easeInOutQuad speed curve (accelerate → cruise → decelerate)
 * - 7-point Gaussian-weighted bearing smoothing with angular velocity clamping
 * - Distance-based route slicing (not index-based)
 */

import {
  computeCumulativeDistances,
  interpolateByDistance,
  easeInOutQuad,
} from "./polylineUtils";

/**
 * Get the animated (partial) route as a GeoJSON LineString.
 * Progress 0→1 draws the route from start to end with eased speed.
 */
export function getAnimatedRoute(
  fullPolyline: [number, number][],
  progress: number,
  cumDist?: number[]
): GeoJSON.Feature<GeoJSON.LineString> {
  const clamped = Math.max(0, Math.min(1, progress));
  if (clamped === 0 || fullPolyline.length < 2) {
    return {
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates: [fullPolyline[0] || [0, 0]] },
    };
  }

  const dist = cumDist || computeCumulativeDistances(fullPolyline);
  const totalDist = dist[dist.length - 1];
  const easedProgress = easeInOutQuad(clamped);
  const targetDist = easedProgress * totalDist;

  const result = interpolateByDistance(fullPolyline, dist, targetDist);

  // Slice polyline up to the interpolated point
  const coords = fullPolyline.slice(0, result.segmentIndex + 1);
  coords.push(result.point);

  return {
    type: "Feature",
    properties: {},
    geometry: { type: "LineString", coordinates: coords },
  };
}

/**
 * Get the head position of the route at a given progress (0→1).
 * Uses distance-based interpolation with easing for smooth movement.
 * Returns [lng, lat].
 */
export function getRouteHead(
  fullPolyline: [number, number][],
  progress: number,
  cumDist?: number[]
): [number, number] {
  const clamped = Math.max(0, Math.min(1, progress));
  if (fullPolyline.length < 2) return fullPolyline[0] || [0, 0];

  const dist = cumDist || computeCumulativeDistances(fullPolyline);
  const totalDist = dist[dist.length - 1];
  const easedProgress = easeInOutQuad(clamped);
  const targetDist = easedProgress * totalDist;

  return interpolateByDistance(fullPolyline, dist, targetDist).point;
}

/**
 * Get the endpoint of a route polyline.
 */
export function getRouteEndpoint(
  fullPolyline: [number, number][]
): [number, number] {
  return fullPolyline[fullPolyline.length - 1] || [0, 0];
}

/**
 * "Hot trail" — last N% of the drawn route for extra glow effect.
 * Returns a GeoJSON LineString of the recently drawn portion.
 */
export function getRouteTrail(
  fullPolyline: [number, number][],
  progress: number,
  trailLength = 0.15,
  cumDist?: number[]
): GeoJSON.Feature<GeoJSON.LineString> {
  const clamped = Math.max(0, Math.min(1, progress));

  if (clamped <= 0 || fullPolyline.length < 2) {
    return {
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates: [fullPolyline[0] || [0, 0]] },
    };
  }

  const dist = cumDist || computeCumulativeDistances(fullPolyline);
  const totalDist = dist[dist.length - 1];

  const easedEnd = easeInOutQuad(clamped);
  const easedStart = easeInOutQuad(Math.max(0, clamped - trailLength));

  const endDist = easedEnd * totalDist;
  const startDist = easedStart * totalDist;

  const startResult = interpolateByDistance(fullPolyline, dist, startDist);
  const endResult = interpolateByDistance(fullPolyline, dist, endDist);

  // Build trail coordinates
  const coords: [number, number][] = [startResult.point];

  for (let i = startResult.segmentIndex + 1; i <= endResult.segmentIndex; i++) {
    coords.push(fullPolyline[i]);
  }

  coords.push(endResult.point);

  // Ensure at least 2 points
  if (coords.length < 2) {
    const head = endResult.point;
    return {
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates: [head, head] },
    };
  }

  return {
    type: "Feature",
    properties: {},
    geometry: { type: "LineString", coordinates: coords },
  };
}

/**
 * Smoothed bearing using 7-point Gaussian-weighted average at fixed distance offsets.
 * Prevents jumpy car rotation on sharp road turns.
 * Angular velocity clamped to 8° per frame.
 *
 * @param windowMeters - distance to sample ahead/behind (default 50m)
 * Returns bearing in degrees (0 = north, 90 = east).
 */
export function getSmoothedBearing(
  fullPolyline: [number, number][],
  progress: number,
  cumDist?: number[],
  windowMeters: number = 50
): number {
  if (fullPolyline.length < 2) return 0;

  const dist = cumDist || computeCumulativeDistances(fullPolyline);
  const totalDist = dist[dist.length - 1];
  const easedProgress = easeInOutQuad(Math.max(0, Math.min(1, progress)));
  const currentDist = easedProgress * totalDist;

  // Sample bearings at fixed distance offsets from current position
  const offsets = [-windowMeters, -windowMeters * 0.6, -windowMeters * 0.3, 0, windowMeters * 0.3, windowMeters * 0.6, windowMeters];
  const weights = [0.05, 0.1, 0.2, 0.3, 0.2, 0.1, 0.05];

  const bearings: number[] = [];
  for (const offset of offsets) {
    const sampleDist = Math.max(0, Math.min(totalDist - 1, currentDist + offset));
    const nextDist = Math.min(totalDist, sampleDist + 10); // 10m look-ahead for bearing

    const from = interpolateByDistance(fullPolyline, dist, sampleDist).point;
    const to = interpolateByDistance(fullPolyline, dist, nextDist).point;
    bearings.push(segmentBearing(from, to));
  }

  // Circular weighted mean
  const bearing = circularWeightedMean(bearings, weights);

  // Angular velocity clamping: compute previous frame bearing and cap delta
  const prevProgress = Math.max(0, progress - 1 / 65); // ~1 frame back (65 frames for route drawing)
  const prevEased = easeInOutQuad(Math.max(0, Math.min(1, prevProgress)));
  const prevDist = prevEased * totalDist;

  const prevFrom = interpolateByDistance(fullPolyline, dist, Math.max(0, prevDist - 10)).point;
  const prevTo = interpolateByDistance(fullPolyline, dist, prevDist).point;
  const prevBearing = segmentBearing(prevFrom, prevTo);

  const delta = shortestAngleDelta(prevBearing, bearing);
  const maxDeltaPerFrame = 8; // degrees
  const clampedDelta = Math.max(-maxDeltaPerFrame, Math.min(maxDeltaPerFrame, delta));

  return (prevBearing + clampedDelta + 360) % 360;
}

/**
 * Compute bearing between two [lng, lat] points in degrees.
 */
function segmentBearing(from: [number, number], to: [number, number]): number {
  const dLng = ((to[0] - from[0]) * Math.PI) / 180;
  const lat1 = (from[1] * Math.PI) / 180;
  const lat2 = (to[1] * Math.PI) / 180;

  const x = Math.sin(dLng) * Math.cos(lat2);
  const y =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

  return ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360;
}

/**
 * Shortest angular delta between two bearings (handles 0°/360° wraparound).
 */
function shortestAngleDelta(from: number, to: number): number {
  let delta = ((to - from + 540) % 360) - 180;
  return delta;
}

/**
 * Circular weighted mean for bearing angles.
 * Handles the 0°/360° wraparound correctly.
 */
function circularWeightedMean(
  angles: number[],
  weights: number[]
): number {
  let sinSum = 0;
  let cosSum = 0;
  for (let i = 0; i < angles.length; i++) {
    const rad = (angles[i] * Math.PI) / 180;
    sinSum += Math.sin(rad) * weights[i];
    cosSum += Math.cos(rad) * weights[i];
  }
  return ((Math.atan2(sinSum, cosSum) * 180) / Math.PI + 360) % 360;
}
