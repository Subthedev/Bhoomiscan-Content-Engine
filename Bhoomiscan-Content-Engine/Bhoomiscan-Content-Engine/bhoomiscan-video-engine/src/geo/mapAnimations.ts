/**
 * Camera interpolation curves for the cinematic satellite zoom.
 *
 * Phase 1 (zoom-in only, or first half with amenities):
 * State hold → Arc dip → State→District → District dwell → District→Plot → Plot hold
 *
 * Phase 2 (amenity zoom-out, when hasAmenities=true):
 * Plot dwell → Zoom out → Route traces animate → Labels hold
 *
 * Uses per-segment easing to eliminate flickering at phase transitions.
 */

import { interpolate, Easing } from "remotion";
import type { GeoData, GeoConfidence, DiscoveredAmenity } from "./types";

export interface MapViewport {
  latitude: number;
  longitude: number;
  zoom: number;
  bearing: number;
  pitch: number;
}

export interface LayerOpacities {
  stateBoundary: number;
  districtBoundary: number;
  plotBoundary: number;
  locationPin: number;
  routeTraces: number;
  locationLabel: number;
}

export interface AmenityOpacities {
  amenityRoutes: number;
  amenityPins: number;
  amenityLabels: number;
}

interface Segment {
  start: number;
  end: number;
  from: number;
  to: number;
  easing: (t: number) => number;
}

/**
 * Per-segment interpolation — each segment gets its own easing curve.
 * Eliminates the flickering caused by single easing across discontinuous keyframes.
 */
function segmentInterpolate(progress: number, segments: Segment[]): number {
  for (const seg of segments) {
    if (progress >= seg.start && progress <= seg.end) {
      if (seg.start === seg.end) return seg.from;
      const segProgress = (progress - seg.start) / (seg.end - seg.start);
      return seg.from + (seg.to - seg.from) * seg.easing(segProgress);
    }
  }
  // Before first segment
  if (progress < segments[0].start) return segments[0].from;
  // After last segment
  return segments[segments.length - 1].to;
}

/**
 * Max zoom based on geocoding confidence.
 */
function getMaxZoom(confidence: GeoConfidence): number {
  switch (confidence) {
    case "high": return 15;
    case "medium": return 14;
    case "low": return 12;
  }
}

/**
 * Compute zoom level that fits all amenities + plot center in viewport.
 * Accounts for 1080x1920 (9:16) aspect ratio using Mercator projection.
 */
function computeAmenityZoomLevel(
  plotCenter: { lat: number; lng: number },
  amenities: DiscoveredAmenity[]
): number {
  if (amenities.length === 0) return 12;

  let minLat = plotCenter.lat, maxLat = plotCenter.lat;
  let minLng = plotCenter.lng, maxLng = plotCenter.lng;

  for (const a of amenities) {
    minLat = Math.min(minLat, a.coords.lat);
    maxLat = Math.max(maxLat, a.coords.lat);
    minLng = Math.min(minLng, a.coords.lng);
    maxLng = Math.max(maxLng, a.coords.lng);
  }

  // 25% padding
  const latSpan = (maxLat - minLat) * 1.25 || 0.01;
  const lngSpan = (maxLng - minLng) * 1.25 || 0.01;

  // Tile size at zoom 0: 256px covers 360° longitude
  const TILE_SIZE = 256;
  const VIEWPORT_WIDTH = 1080;
  const VIEWPORT_HEIGHT = 1920;

  const lngZoom = Math.log2((VIEWPORT_WIDTH / TILE_SIZE) * (360 / lngSpan));
  const latZoom = Math.log2((VIEWPORT_HEIGHT / TILE_SIZE) * (180 / latSpan));

  // Use the more constrained axis
  const zoom = Math.floor(Math.min(lngZoom, latZoom));
  return Math.max(10, Math.min(13.5, zoom));
}

const linear = (t: number) => t;
const easeInOutSine = Easing.inOut(Easing.sin);
const easeOutCubic = Easing.out(Easing.cubic);
const easeInOutCubic = Easing.inOut(Easing.cubic);

export function computeViewport(
  frame: number,
  totalFrames: number,
  geoData: GeoData,
  hasAmenities = false
): MapViewport {
  const progress = frame / totalFrames;
  const maxZoom = getMaxZoom(geoData.confidence);

  const districtLat = (geoData.stateCenter.lat + geoData.plotCenter.lat) / 2;
  const districtLng = (geoData.stateCenter.lng + geoData.plotCenter.lng) / 2;

  if (!hasAmenities) {
    // Original single-phase zoom-in with segment easing
    const lat = segmentInterpolate(progress, [
      { start: 0, end: 0.12, from: geoData.stateCenter.lat, to: geoData.stateCenter.lat, easing: linear },
      { start: 0.12, end: 0.45, from: geoData.stateCenter.lat, to: districtLat, easing: easeOutCubic },
      { start: 0.45, end: 0.55, from: districtLat, to: districtLat, easing: linear },
      { start: 0.55, end: 0.80, from: districtLat, to: geoData.plotCenter.lat, easing: easeOutCubic },
      { start: 0.80, end: 1, from: geoData.plotCenter.lat, to: geoData.plotCenter.lat, easing: linear },
    ]);
    const lng = segmentInterpolate(progress, [
      { start: 0, end: 0.12, from: geoData.stateCenter.lng, to: geoData.stateCenter.lng, easing: linear },
      { start: 0.12, end: 0.45, from: geoData.stateCenter.lng, to: districtLng, easing: easeOutCubic },
      { start: 0.45, end: 0.55, from: districtLng, to: districtLng, easing: linear },
      { start: 0.55, end: 0.80, from: districtLng, to: geoData.plotCenter.lng, easing: easeOutCubic },
      { start: 0.80, end: 1, from: geoData.plotCenter.lng, to: geoData.plotCenter.lng, easing: linear },
    ]);
    const zoom = segmentInterpolate(progress, [
      { start: 0, end: 0.12, from: 6, to: 6, easing: linear },
      { start: 0.12, end: 0.20, from: 6, to: 5.5, easing: easeInOutSine },
      { start: 0.20, end: 0.45, from: 5.5, to: 11, easing: easeOutCubic },
      { start: 0.45, end: 0.55, from: 11, to: 11, easing: linear },
      { start: 0.55, end: 0.80, from: 11, to: maxZoom, easing: easeOutCubic },
      { start: 0.80, end: 1, from: maxZoom, to: maxZoom, easing: linear },
    ]);
    const pitch = segmentInterpolate(progress, [
      { start: 0, end: 0.40, from: 0, to: 0, easing: linear },
      { start: 0.40, end: 0.75, from: 0, to: 45, easing: easeOutCubic },
      { start: 0.75, end: 1, from: 45, to: 45, easing: linear },
    ]);
    const bearing = segmentInterpolate(progress, [
      { start: 0, end: 0.45, from: 0, to: 0, easing: linear },
      { start: 0.45, end: 0.80, from: 0, to: -15, easing: easeInOutCubic },
      { start: 0.80, end: 1, from: -15, to: -15, easing: linear },
    ]);
    return { latitude: lat, longitude: lng, zoom, bearing, pitch };
  }

  // Two-phase animation with amenity zoom-out
  const amenities = geoData.amenities || [];
  const targetZoom = computeAmenityZoomLevel(geoData.plotCenter, amenities);

  // Phase 1 (0.00–0.50): Compressed zoom IN
  // Phase 2 (0.50–1.00): Zoom OUT + amenity reveal

  const lat = segmentInterpolate(progress, [
    { start: 0, end: 0.06, from: geoData.stateCenter.lat, to: geoData.stateCenter.lat, easing: linear },
    { start: 0.06, end: 0.22, from: geoData.stateCenter.lat, to: districtLat, easing: easeOutCubic },
    { start: 0.22, end: 0.28, from: districtLat, to: districtLat, easing: linear },
    { start: 0.28, end: 0.40, from: districtLat, to: geoData.plotCenter.lat, easing: easeOutCubic },
    { start: 0.40, end: 1, from: geoData.plotCenter.lat, to: geoData.plotCenter.lat, easing: linear },
  ]);

  const lng = segmentInterpolate(progress, [
    { start: 0, end: 0.06, from: geoData.stateCenter.lng, to: geoData.stateCenter.lng, easing: linear },
    { start: 0.06, end: 0.22, from: geoData.stateCenter.lng, to: districtLng, easing: easeOutCubic },
    { start: 0.22, end: 0.28, from: districtLng, to: districtLng, easing: linear },
    { start: 0.28, end: 0.40, from: districtLng, to: geoData.plotCenter.lng, easing: easeOutCubic },
    { start: 0.40, end: 1, from: geoData.plotCenter.lng, to: geoData.plotCenter.lng, easing: linear },
  ]);

  // Zoom: in then out — same easing for zoom-out phase as pitch/bearing
  const zoom = segmentInterpolate(progress, [
    { start: 0, end: 0.06, from: 6, to: 6, easing: linear },
    { start: 0.06, end: 0.10, from: 6, to: 5.5, easing: easeInOutSine },
    { start: 0.10, end: 0.22, from: 5.5, to: 11, easing: easeOutCubic },
    { start: 0.22, end: 0.28, from: 11, to: 11, easing: linear },
    { start: 0.28, end: 0.40, from: 11, to: maxZoom, easing: easeOutCubic },
    { start: 0.40, end: 0.55, from: maxZoom, to: maxZoom, easing: linear },
    { start: 0.55, end: 0.70, from: maxZoom, to: targetZoom, easing: easeInOutCubic },
    { start: 0.70, end: 1, from: targetZoom, to: targetZoom, easing: linear },
  ]);

  // Pitch and bearing use the SAME easing as zoom during zoom-out (0.55→0.70)
  const pitch = segmentInterpolate(progress, [
    { start: 0, end: 0.25, from: 0, to: 0, easing: linear },
    { start: 0.25, end: 0.40, from: 0, to: 45, easing: easeOutCubic },
    { start: 0.40, end: 0.55, from: 45, to: 45, easing: linear },
    { start: 0.55, end: 0.70, from: 45, to: 30, easing: easeInOutCubic },
    { start: 0.70, end: 1, from: 30, to: 30, easing: linear },
  ]);

  const bearing = segmentInterpolate(progress, [
    { start: 0, end: 0.28, from: 0, to: 0, easing: linear },
    { start: 0.28, end: 0.40, from: 0, to: -15, easing: easeInOutCubic },
    { start: 0.40, end: 0.55, from: -15, to: -15, easing: linear },
    { start: 0.55, end: 0.70, from: -15, to: -5, easing: easeInOutCubic },
    { start: 0.70, end: 1, from: -5, to: -5, easing: linear },
  ]);

  return { latitude: lat, longitude: lng, zoom, bearing, pitch };
}

export function computeLayerOpacities(
  frame: number,
  totalFrames: number,
  hasAmenities = false
): LayerOpacities & AmenityOpacities {
  const progress = frame / totalFrames;

  if (!hasAmenities) {
    return {
      stateBoundary: interpolate(progress, [0.12, 0.18, 0.45, 0.55], [0, 0.7, 0.7, 0], {
        extrapolateLeft: "clamp", extrapolateRight: "clamp",
      }),
      districtBoundary: interpolate(progress, [0.35, 0.45, 0.70, 0.80], [0, 0.6, 0.6, 0.3], {
        extrapolateLeft: "clamp", extrapolateRight: "clamp",
      }),
      plotBoundary: interpolate(progress, [0.72, 0.80], [0, 1], {
        extrapolateLeft: "clamp", extrapolateRight: "clamp",
      }),
      locationPin: interpolate(progress, [0.75, 0.82], [0, 1], {
        extrapolateLeft: "clamp", extrapolateRight: "clamp",
      }),
      routeTraces: interpolate(progress, [0.82, 0.88], [0, 1], {
        extrapolateLeft: "clamp", extrapolateRight: "clamp",
      }),
      locationLabel: interpolate(progress, [0.78, 0.85], [0, 1], {
        extrapolateLeft: "clamp", extrapolateRight: "clamp",
      }),
      amenityRoutes: 0,
      amenityPins: 0,
      amenityLabels: 0,
    };
  }

  // Two-phase opacities
  return {
    // Phase 1 boundaries (compressed timeline)
    stateBoundary: interpolate(progress, [0.06, 0.10, 0.22, 0.28], [0, 0.7, 0.7, 0], {
      extrapolateLeft: "clamp", extrapolateRight: "clamp",
    }),
    districtBoundary: interpolate(progress, [0.18, 0.22, 0.35, 0.40], [0, 0.6, 0.6, 0.3], {
      extrapolateLeft: "clamp", extrapolateRight: "clamp",
    }),
    plotBoundary: interpolate(progress, [0.38, 0.42], [0, 1], {
      extrapolateLeft: "clamp", extrapolateRight: "clamp",
    }),
    locationPin: interpolate(progress, [0.40, 0.45], [0, 1], {
      extrapolateLeft: "clamp", extrapolateRight: "clamp",
    }),
    routeTraces: interpolate(progress, [0.43, 0.48], [0, 1], {
      extrapolateLeft: "clamp", extrapolateRight: "clamp",
    }),
    locationLabel: interpolate(progress, [0.42, 0.47], [0, 1], {
      extrapolateLeft: "clamp", extrapolateRight: "clamp",
    }),
    // Phase 2 amenity opacities — now controlled per-amenity in MapSequence
    amenityRoutes: interpolate(progress, [0.55, 0.60], [0, 1], {
      extrapolateLeft: "clamp", extrapolateRight: "clamp",
    }),
    amenityPins: interpolate(progress, [0.55, 0.60], [0, 1], {
      extrapolateLeft: "clamp", extrapolateRight: "clamp",
    }),
    amenityLabels: interpolate(progress, [0.55, 0.60], [0, 1], {
      extrapolateLeft: "clamp", extrapolateRight: "clamp",
    }),
  };
}
