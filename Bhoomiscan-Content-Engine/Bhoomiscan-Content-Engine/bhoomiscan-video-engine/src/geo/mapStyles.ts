/**
 * Mapbox GL layer styles for boundaries, plot outlines, and route traces.
 * Clean 3-layer active route: glow → core → white center.
 * Optimized for satellite imagery readability.
 */

import type { LayerProps } from "react-map-gl/mapbox";

// Brand colors
const GOLD = "#d4a43a";
const GOLD_LIGHT = "#e0c06a";
const EMERALD = "#10b981";
const NEON_GREEN = "#39FF14";
const NEON_GREEN_GLOW = "#32CD32";

// ── Boundary layers ──

export function stateBoundaryLayer(opacity: number): LayerProps {
  return {
    id: "state-boundary-fill",
    type: "fill",
    paint: {
      "fill-color": GOLD,
      "fill-opacity": 0.15 * opacity,
    },
  };
}

export function stateBoundaryOutline(opacity: number): LayerProps {
  return {
    id: "state-boundary-outline",
    type: "line",
    paint: {
      "line-color": GOLD,
      "line-width": 2,
      "line-opacity": opacity,
    },
  };
}

export function districtBoundaryLayer(opacity: number): LayerProps {
  return {
    id: "district-boundary-outline",
    type: "line",
    paint: {
      "line-color": EMERALD,
      "line-width": 2.5,
      "line-opacity": opacity,
    },
  };
}

export function plotBoundaryFill(opacity: number): LayerProps {
  return {
    id: "plot-boundary-fill",
    type: "fill",
    paint: {
      "fill-color": GOLD_LIGHT,
      "fill-opacity": 0.25 * opacity,
    },
  };
}

export function plotBoundaryOutline(opacity: number): LayerProps {
  return {
    id: "plot-boundary-outline",
    type: "line",
    paint: {
      "line-color": GOLD,
      "line-width": 3,
      "line-opacity": opacity,
      "line-dasharray": [3, 2],
    },
  };
}

// ── Legacy route layer (for landmarks) ──

export function routeLineLayer(index: number, opacity: number): LayerProps {
  return {
    id: `route-line-${index}`,
    type: "line",
    paint: {
      "line-color": GOLD_LIGHT,
      "line-width": 3,
      "line-opacity": 0.9 * opacity,
      "line-dasharray": [2, 1],
    },
    layout: {
      "line-cap": "round",
      "line-join": "round",
    },
  };
}

// ── Clean 3-Layer Active Route System ──
// Layer order (bottom to top): glow → core → white center
// Thinner lines for clean satellite overlay look

export function activeRouteGlow(index: number, opacity: number, frame: number): LayerProps {
  const pulse = 1 + Math.sin(frame * 0.12) * 0.08;
  return {
    id: `active-route-glow-${index}`,
    type: "line",
    paint: {
      "line-color": NEON_GREEN,
      "line-width": 14,
      "line-opacity": 0.3 * opacity * pulse,
      "line-blur": 8,
    },
    layout: { "line-cap": "round", "line-join": "round" },
  };
}

export function activeRouteCore(index: number, opacity: number): LayerProps {
  return {
    id: `active-route-core-${index}`,
    type: "line",
    paint: {
      "line-color": NEON_GREEN,
      "line-width": 5,
      "line-opacity": 1.0 * opacity,
      "line-blur": 0,
    },
    layout: { "line-cap": "round", "line-join": "round" },
  };
}

export function activeRouteCenter(index: number, opacity: number): LayerProps {
  return {
    id: `active-route-center-${index}`,
    type: "line",
    paint: {
      "line-color": "#FFFFFF",
      "line-width": 2,
      "line-opacity": 0.6 * opacity,
      "line-blur": 0,
    },
    layout: { "line-cap": "round", "line-join": "round" },
  };
}

export function activeRouteHotTrail(index: number, opacity: number): LayerProps {
  return {
    id: `active-route-hot-trail-${index}`,
    type: "line",
    paint: {
      "line-color": "#FFFFFF",
      "line-width": 8,
      "line-opacity": 0.45 * opacity,
      "line-blur": 4,
    },
    layout: { "line-cap": "round", "line-join": "round" },
  };
}

// ── 2-Layer Completed Route System ──

export function completedRouteFadedGlow(index: number, opacity: number): LayerProps {
  return {
    id: `completed-route-glow-${index}`,
    type: "line",
    paint: {
      "line-color": NEON_GREEN_GLOW,
      "line-width": 6,
      "line-opacity": 0.08 * opacity,
      "line-blur": 4,
    },
    layout: { "line-cap": "round", "line-join": "round" },
  };
}

export function completedRouteFadedLine(index: number, opacity: number): LayerProps {
  return {
    id: `completed-route-line-${index}`,
    type: "line",
    paint: {
      "line-color": NEON_GREEN,
      "line-width": 3,
      "line-opacity": 0.35 * opacity,
      "line-blur": 0,
    },
    layout: { "line-cap": "round", "line-join": "round" },
  };
}
