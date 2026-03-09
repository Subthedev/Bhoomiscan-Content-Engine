/**
 * Route animation — returns a partial GeoJSON LineString
 * based on the current frame progress, creating a smooth "drawing" effect.
 *
 * Uses sub-point interpolation for smooth tips instead of discrete point jumps.
 */

/**
 * Given a full polyline and a progress (0-1), return a GeoJSON
 * LineString with sub-point interpolation for smooth drawing.
 */
export function getAnimatedRoute(
  fullPolyline: [number, number][],
  progress: number
): GeoJSON.Feature<GeoJSON.LineString> {
  if (fullPolyline.length < 2 || progress <= 0) {
    return {
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates: [] },
    };
  }

  const clamped = Math.min(1, Math.max(0, progress));
  const totalSegments = fullPolyline.length - 1;
  const exactIndex = clamped * totalSegments;
  const floorIndex = Math.floor(exactIndex);
  const fraction = exactIndex - floorIndex;

  // All complete points up to floorIndex
  const coords = fullPolyline.slice(0, floorIndex + 1);

  // Interpolate partial segment for smooth tip
  if (floorIndex < totalSegments && fraction > 0) {
    const from = fullPolyline[floorIndex];
    const to = fullPolyline[floorIndex + 1];
    coords.push([
      from[0] + (to[0] - from[0]) * fraction,
      from[1] + (to[1] - from[1]) * fraction,
    ]);
  }

  return {
    type: "Feature",
    properties: {},
    geometry: { type: "LineString", coordinates: coords },
  };
}

/**
 * Get the current "head" position of the animated route (for car icon placement).
 */
export function getRouteHead(
  fullPolyline: [number, number][],
  progress: number
): { coords: [number, number]; bearing: number } | null {
  if (fullPolyline.length < 2 || progress <= 0) return null;

  const clamped = Math.min(1, Math.max(0, progress));
  const totalSegments = fullPolyline.length - 1;
  const exactIndex = clamped * totalSegments;
  const floorIndex = Math.min(Math.floor(exactIndex), totalSegments - 1);
  const fraction = exactIndex - floorIndex;

  const from = fullPolyline[floorIndex];
  const to = fullPolyline[Math.min(floorIndex + 1, fullPolyline.length - 1)];

  const lng = from[0] + (to[0] - from[0]) * fraction;
  const lat = from[1] + (to[1] - from[1]) * fraction;

  // Bearing for car rotation (degrees, 0=north, clockwise)
  const dLng = to[0] - from[0];
  const dLat = to[1] - from[1];
  const bearing = (Math.atan2(dLng, dLat) * 180) / Math.PI;

  return { coords: [lng, lat], bearing };
}

/**
 * Get the endpoint coordinate of the animated route (for placing the distance label).
 */
export function getRouteEndpoint(
  fullPolyline: [number, number][],
  progress: number
): [number, number] | null {
  if (fullPolyline.length < 2 || progress <= 0) return null;

  const head = getRouteHead(fullPolyline, progress);
  return head ? head.coords : null;
}
