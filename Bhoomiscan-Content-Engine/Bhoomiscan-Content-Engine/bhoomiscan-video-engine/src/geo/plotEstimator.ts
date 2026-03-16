/**
 * Generate an approximate plot polygon from property dimensions.
 *
 * Since exact plot boundaries don't exist in OSM for individual properties,
 * we create a reasonable rectangular polygon centered on the geocoded point
 * using the plotSize and optional dimensions string.
 */

import { GeoCoordinates } from "./types";

/** Meters per degree latitude (roughly constant) */
const METERS_PER_DEG_LAT = 111_320;

/** Meters per degree longitude at a given latitude */
function metersPerDegLng(lat: number): number {
  return METERS_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
}

/** Convert sq.ft to sq.m */
function sqftToSqm(sqft: number): number {
  return sqft * 0.092903;
}

/**
 * Parse a dimensions string like "40x30", "40'x30'", "40ft x 30ft"
 * Returns [width, height] in feet, or null if unparseable.
 */
function parseDimensions(dim: string): [number, number] | null {
  const match = dim.match(/(\d+(?:\.\d+)?)\s*[''ftm]*\s*[xX×]\s*(\d+(?:\.\d+)?)/);
  if (!match) return null;
  return [parseFloat(match[1]), parseFloat(match[2])];
}

/**
 * Generate an approximate rectangular GeoJSON polygon for a property.
 */
export function estimatePlotBoundary(
  center: GeoCoordinates,
  plotSize: number,
  areaUnit: string,
  dimensions?: string
): GeoJSON.Feature {
  let widthM: number;
  let heightM: number;

  if (dimensions) {
    const parsed = parseDimensions(dimensions);
    if (parsed) {
      // Assume dimensions are in feet
      widthM = parsed[0] * 0.3048;
      heightM = parsed[1] * 0.3048;
    } else {
      // Fallback: compute from area assuming square
      const areaSqM = convertToSqM(plotSize, areaUnit);
      const side = Math.sqrt(areaSqM);
      widthM = side;
      heightM = side;
    }
  } else {
    // No dimensions: compute from area assuming square
    const areaSqM = convertToSqM(plotSize, areaUnit);
    const side = Math.sqrt(areaSqM);
    widthM = side;
    heightM = side;
  }

  // Convert meters to degrees
  const halfWidthDeg = widthM / 2 / metersPerDegLng(center.lat);
  const halfHeightDeg = heightM / 2 / METERS_PER_DEG_LAT;

  // Create rectangle corners (clockwise from SW)
  const sw: [number, number] = [center.lng - halfWidthDeg, center.lat - halfHeightDeg];
  const se: [number, number] = [center.lng + halfWidthDeg, center.lat - halfHeightDeg];
  const ne: [number, number] = [center.lng + halfWidthDeg, center.lat + halfHeightDeg];
  const nw: [number, number] = [center.lng - halfWidthDeg, center.lat + halfHeightDeg];

  return {
    type: "Feature",
    properties: {
      plotSize,
      areaUnit,
      widthM: Math.round(widthM * 10) / 10,
      heightM: Math.round(heightM * 10) / 10,
    },
    geometry: {
      type: "Polygon",
      coordinates: [[sw, se, ne, nw, sw]], // closed ring
    },
  };
}

function convertToSqM(size: number, unit: string): number {
  const u = unit.toLowerCase().replace(/[.\s]/g, "");
  switch (u) {
    case "sqft":
    case "sqfeet":
    case "squarefeet":
      return sqftToSqm(size);
    case "sqm":
    case "sqmeter":
    case "squaremeter":
      return size;
    case "acre":
    case "acres":
      return size * 4046.86;
    case "cent":
    case "cents":
      return size * 40.4686;
    case "gunta":
    case "guntha":
      return size * 101.17;
    case "decimal":
      return size * 40.4686;
    default:
      // Default: assume sq.ft (most common in Indian real estate)
      return sqftToSqm(size);
  }
}
