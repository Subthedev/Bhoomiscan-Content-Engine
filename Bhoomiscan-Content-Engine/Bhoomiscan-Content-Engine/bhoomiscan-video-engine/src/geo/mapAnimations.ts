/**
 * Camera interpolation + amenity ride timing calculator for MapSequence.
 *
 * Uniform staged zoom-in with holds at each geographic level:
 *   India overview → State → District → Locality → Plot (with holds)
 * Then smooth zoom-out to amenity-fit view for sequential rides.
 *
 * All animations are pure functions of frame number (Remotion-compatible).
 */

import type { GeoCoordinates, GeoData, GeoConfidence, DiscoveredAmenity } from "./types";

const FPS = 30;
const ZOOM_IN_SECONDS = 5;    // 5s for staged zoom with holds
const ZOOM_OUT_SECONDS = 1.5;
const RIDE_SECONDS = 3;
const ZOOM_IN_FRAMES = ZOOM_IN_SECONDS * FPS;       // 150
const ZOOM_OUT_FRAMES = ZOOM_OUT_SECONDS * FPS;      // 45
const RIDE_FRAMES = RIDE_SECONDS * FPS;               // 90

export interface AmenityRideTiming {
  amenityIndex: number;
  startFrame: number;
  endFrame: number;
  routeDrawEnd: number;   // frame 70 of ride (route reaches amenity)
  pinDropFrame: number;   // frame 72
  labelPopFrame: number;  // frame 76
}

export interface Viewport {
  latitude: number;
  longitude: number;
  zoom: number;
  pitch: number;
  bearing: number;
}

/**
 * Compute ride timings for all amenities.
 * Sequential: each ride starts after the previous one ends.
 */
export function computeAmenityRideTimings(
  durationInFrames: number,
  amenityCount: number
): AmenityRideTiming[] {
  if (amenityCount === 0) return [];

  const ridesStart = ZOOM_IN_FRAMES + ZOOM_OUT_FRAMES;

  return Array.from({ length: amenityCount }, (_, i) => {
    const startFrame = ridesStart + i * RIDE_FRAMES;
    return {
      amenityIndex: i,
      startFrame,
      endFrame: startFrame + RIDE_FRAMES,
      routeDrawEnd: startFrame + 70,
      pinDropFrame: startFrame + 72,
      labelPopFrame: startFrame + 76,
    };
  });
}

/**
 * Compute the total MapSequence duration in frames.
 */
export function computeMapDuration(amenityCount: number): number {
  if (amenityCount === 0) return 6 * FPS; // no amenities: 6s zoom only
  return (ZOOM_IN_SECONDS + ZOOM_OUT_SECONDS + amenityCount * RIDE_SECONDS) * FPS;
}

/**
 * Compute the camera viewport for any frame within MapSequence.
 */
export function computeViewport(
  frame: number,
  durationInFrames: number,
  geoData: GeoData,
  rideTimings: AmenityRideTiming[]
): Viewport {
  const { plotCenter, stateCenter } = geoData;

  const maxZoom = getMaxZoomForConfidence(geoData.confidence);

  const rawAmenityFitZoom =
    geoData.amenities.length > 0
      ? computeAmenityFitZoom(plotCenter, geoData.amenities)
      : 13;
  const amenityFitZoom = Math.min(rawAmenityFitZoom, maxZoom - 1);

  // ── Phase 1: Staged Zoom-In (frames 0 → 150) ──
  if (frame < ZOOM_IN_FRAMES) {
    return computeZoomInViewport(frame, stateCenter, plotCenter, maxZoom);
  }

  // ── Phase 1→2 Transition: Smooth zoom-out to amenity fit (frames 150 → 195) ──
  // Uses easeInOutCubic for smooth start AND end (no jarring initial zoom-out)
  const transitionEnd = ZOOM_IN_FRAMES + ZOOM_OUT_FRAMES;
  if (frame < transitionEnd) {
    const t = easeInOutCubic((frame - ZOOM_IN_FRAMES) / ZOOM_OUT_FRAMES);
    return {
      latitude: plotCenter.lat,
      longitude: plotCenter.lng,
      zoom: maxZoom + (amenityFitZoom - maxZoom) * t,
      pitch: 45 - 10 * t,  // 45° → 35°
      bearing: -10 * t,     // 0° → -10°
    };
  }

  // ── Phase 2: Sequential Rides (frames 195 → end) ──
  const activeRide = rideTimings.find((r) => frame >= r.startFrame && frame < r.endFrame);

  if (activeRide && geoData.amenities[activeRide.amenityIndex]) {
    const amenity = geoData.amenities[activeRide.amenityIndex];
    const localProgress = (frame - activeRide.startFrame) / RIDE_FRAMES;

    // 15% offset toward active amenity for subtle pan
    const panFactor = 0.15 * easeOutCubic(Math.min(localProgress * 2, 1));
    return {
      latitude: plotCenter.lat + (amenity.coords.lat - plotCenter.lat) * panFactor,
      longitude: plotCenter.lng + (amenity.coords.lng - plotCenter.lng) * panFactor,
      zoom: amenityFitZoom,
      pitch: 35,
      bearing: -10,
    };
  }

  return {
    latitude: plotCenter.lat,
    longitude: plotCenter.lng,
    zoom: amenityFitZoom,
    pitch: 35,
    bearing: -10,
  };
}

/**
 * Camera keyframe for Hermite spline interpolation.
 */
interface CameraKeyframe {
  progress: number;
  lat: number;
  lng: number;
  zoom: number;
  pitch: number;
}

/**
 * Phase 1: Smooth staged zoom-in with holds at each geographic level.
 * NO zoom-out during zoom-in — zoom is monotonically clamped.
 * Longer holds (0.5-1s) for cinematic effect.
 *
 * Timeline (5 seconds = 150 frames):
 *   0.00-0.10  India overview (zoom 4.5)           — hold 0.5s
 *   0.10-0.22  Fly to state (zoom 6.5)             — 0.6s transition
 *   0.22-0.33  State hold (zoom 6.5)               — hold 0.55s
 *   0.33-0.46  Fly to district (zoom 9.5)           — 0.65s transition
 *   0.46-0.55  District hold (zoom 9.5)             — hold 0.45s
 *   0.55-0.68  Fly to locality (zoom 12.5)          — 0.65s transition
 *   0.68-0.77  Locality hold (zoom 12.5)            — hold 0.45s
 *   0.77-0.90  Fly to plot (zoom maxZoom)           — 0.65s transition
 *   0.90-1.00  Plot hold (zoom maxZoom, pitch 45)   — hold 0.5s
 */
function computeZoomInViewport(
  frame: number,
  stateCenter: GeoCoordinates,
  plotCenter: GeoCoordinates,
  maxZoom: number
): Viewport {
  const progress = frame / ZOOM_IN_FRAMES; // 0→1

  // India center
  const indiaLat = 20.5937;
  const indiaLng = 78.9629;

  // Midpoint between state and plot for district level
  const midLat = (stateCenter.lat + plotCenter.lat) / 2;
  const midLng = (stateCenter.lng + plotCenter.lng) / 2;

  // 3/4 point toward plot for locality level
  const localityLat = stateCenter.lat + (plotCenter.lat - stateCenter.lat) * 0.75;
  const localityLng = stateCenter.lng + (plotCenter.lng - stateCenter.lng) * 0.75;

  const keyframes: CameraKeyframe[] = [
    // India overview + hold (longer 0.5s hold)
    { progress: 0.00, lat: indiaLat,       lng: indiaLng,       zoom: 4.5,     pitch: 0 },
    { progress: 0.10, lat: indiaLat,       lng: indiaLng,       zoom: 4.5,     pitch: 0 },
    // Fly to state
    { progress: 0.22, lat: stateCenter.lat, lng: stateCenter.lng, zoom: 6.5,    pitch: 0 },
    // State hold (0.55s)
    { progress: 0.33, lat: stateCenter.lat, lng: stateCenter.lng, zoom: 6.5,    pitch: 5 },
    // Fly to district
    { progress: 0.46, lat: midLat,          lng: midLng,          zoom: 9.5,    pitch: 10 },
    // District hold (0.45s)
    { progress: 0.55, lat: midLat,          lng: midLng,          zoom: 9.5,    pitch: 12 },
    // Fly to locality
    { progress: 0.68, lat: localityLat,     lng: localityLng,     zoom: 12.5,   pitch: 20 },
    // Locality hold (0.45s)
    { progress: 0.77, lat: localityLat,     lng: localityLng,     zoom: 12.5,   pitch: 25 },
    // Fly to plot
    { progress: 0.90, lat: plotCenter.lat,  lng: plotCenter.lng,  zoom: maxZoom, pitch: 45 },
    // Plot hold (0.5s)
    { progress: 1.00, lat: plotCenter.lat,  lng: plotCenter.lng,  zoom: maxZoom, pitch: 45 },
  ];

  const result = hermiteInterpolate(progress, keyframes);

  // ── Monotonic zoom clamping ──
  // Prevent any zoom-out during zoom-in by clamping to the floor of the current segment.
  // This eliminates Hermite spline overshoot at hold/fly transitions.
  let floorZoom = keyframes[0].zoom;
  for (const kf of keyframes) {
    if (kf.progress <= progress) floorZoom = kf.zoom;
  }
  const clampedZoom = Math.max(result.zoom, floorZoom);

  // Also clamp pitch to be monotonically non-decreasing
  let floorPitch = keyframes[0].pitch;
  for (const kf of keyframes) {
    if (kf.progress <= progress) floorPitch = kf.pitch;
  }
  const clampedPitch = Math.max(result.pitch, floorPitch);

  return {
    latitude: result.lat,
    longitude: result.lng,
    zoom: clampedZoom,
    pitch: clampedPitch,
    bearing: 0,
  };
}

/**
 * Cubic Hermite spline interpolation across camera keyframes.
 * Ensures C1 continuity (no visible jumps at keyframe boundaries).
 */
function hermiteInterpolate(
  t: number,
  keyframes: CameraKeyframe[]
): { lat: number; lng: number; zoom: number; pitch: number } {
  const clamped = Math.max(0, Math.min(1, t));

  // Find the bracketing keyframe segment
  let segIdx = 0;
  for (let i = 0; i < keyframes.length - 1; i++) {
    if (clamped >= keyframes[i].progress && clamped <= keyframes[i + 1].progress) {
      segIdx = i;
      break;
    }
    if (i === keyframes.length - 2) segIdx = i;
  }

  const k0 = keyframes[segIdx];
  const k1 = keyframes[segIdx + 1];
  const segLen = k1.progress - k0.progress;

  const localT = segLen > 0 ? (clamped - k0.progress) / segLen : 0;

  const prev = keyframes[Math.max(0, segIdx - 1)];
  const next = keyframes[Math.min(keyframes.length - 1, segIdx + 2)];

  const tangentScale = segLen;

  const m0 = {
    lat: catmullRomTangent(prev.lat, k0.lat, k1.lat, prev.progress, k0.progress, k1.progress) * tangentScale,
    lng: catmullRomTangent(prev.lng, k0.lng, k1.lng, prev.progress, k0.progress, k1.progress) * tangentScale,
    zoom: catmullRomTangent(prev.zoom, k0.zoom, k1.zoom, prev.progress, k0.progress, k1.progress) * tangentScale,
    pitch: catmullRomTangent(prev.pitch, k0.pitch, k1.pitch, prev.progress, k0.progress, k1.progress) * tangentScale,
  };

  const m1 = {
    lat: catmullRomTangent(k0.lat, k1.lat, next.lat, k0.progress, k1.progress, next.progress) * tangentScale,
    lng: catmullRomTangent(k0.lng, k1.lng, next.lng, k0.progress, k1.progress, next.progress) * tangentScale,
    zoom: catmullRomTangent(k0.zoom, k1.zoom, next.zoom, k0.progress, k1.progress, next.progress) * tangentScale,
    pitch: catmullRomTangent(k0.pitch, k1.pitch, next.pitch, k0.progress, k1.progress, next.progress) * tangentScale,
  };

  // Hermite basis functions
  const t2 = localT * localT;
  const t3 = t2 * localT;
  const h00 = 2 * t3 - 3 * t2 + 1;
  const h10 = t3 - 2 * t2 + localT;
  const h01 = -2 * t3 + 3 * t2;
  const h11 = t3 - t2;

  return {
    lat: h00 * k0.lat + h10 * m0.lat + h01 * k1.lat + h11 * m1.lat,
    lng: h00 * k0.lng + h10 * m0.lng + h01 * k1.lng + h11 * m1.lng,
    zoom: h00 * k0.zoom + h10 * m0.zoom + h01 * k1.zoom + h11 * m1.zoom,
    pitch: h00 * k0.pitch + h10 * m0.pitch + h01 * k1.pitch + h11 * m1.pitch,
  };
}

/**
 * Catmull-Rom tangent estimation.
 */
function catmullRomTangent(
  vPrev: number,
  vCurr: number,
  vNext: number,
  tPrev: number,
  tCurr: number,
  tNext: number
): number {
  const dtPrev = tCurr - tPrev;
  const dtNext = tNext - tCurr;

  if (dtPrev === 0 && dtNext === 0) return 0;
  if (dtPrev === 0) return (vNext - vCurr) / dtNext;
  if (dtNext === 0) return (vCurr - vPrev) / dtPrev;

  return 0.5 * ((vCurr - vPrev) / dtPrev + (vNext - vCurr) / dtNext);
}

/**
 * Compute zoom level that fits all amenities + plot center in viewport.
 * Clamped to [10, 13.5].
 */
function computeAmenityFitZoom(
  plotCenter: GeoCoordinates,
  amenities: DiscoveredAmenity[]
): number {
  if (amenities.length === 0) return 14;

  let minLat = plotCenter.lat;
  let maxLat = plotCenter.lat;
  let minLng = plotCenter.lng;
  let maxLng = plotCenter.lng;

  for (const a of amenities) {
    minLat = Math.min(minLat, a.coords.lat);
    maxLat = Math.max(maxLat, a.coords.lat);
    minLng = Math.min(minLng, a.coords.lng);
    maxLng = Math.max(maxLng, a.coords.lng);
  }

  // Reduced padding — tighter framing for better route visibility
  const latPad = (maxLat - minLat) * 0.15;
  const lngPad = (maxLng - minLng) * 0.15;
  minLat -= latPad;
  maxLat += latPad;
  minLng -= lngPad;
  maxLng += lngPad;

  const viewportW = 1080;
  const viewportH = 1920;

  const latRange = maxLat - minLat;
  const lngRange = maxLng - minLng;

  if (latRange === 0 && lngRange === 0) return 14;

  const zoomLat = lngRange > 0 ? Math.log2((360 * viewportW) / (256 * lngRange)) : 14;
  const zoomLng = latRange > 0 ? Math.log2((180 * viewportH) / (256 * latRange)) : 14;

  // +1 zoom level = 2X more zoomed in (routes clearly visible)
  const zoom = Math.min(zoomLat, zoomLng) + 1;
  return Math.max(11.5, Math.min(15, zoom));
}

/**
 * Map geocoding confidence to max zoom level.
 * India satellite tiles degrade above 15.5.
 */
function getMaxZoomForConfidence(confidence: GeoConfidence): number {
  switch (confidence) {
    case "high":   return 15.5;
    case "medium": return 13.5;
    case "low":    return 11.5;
  }
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// Re-export constants for use in timing.ts
export { ZOOM_IN_SECONDS, ZOOM_OUT_SECONDS, RIDE_SECONDS };
