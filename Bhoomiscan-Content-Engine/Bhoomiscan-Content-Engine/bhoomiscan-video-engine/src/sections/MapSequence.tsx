/**
 * MapSequence — Cinematic satellite zoom from state → district → plot,
 * with optional zoom-out phase showing discovered amenities.
 *
 * Phase 1: State → District → Plot (zoom in)
 * Phase 2: Plot → Zoom out with sequential neon green amenity route reveals
 *
 * Each amenity route draws sequentially (nearest first), with car icon
 * riding the route head. Pin drops when route reaches amenity (~80%),
 * label appears 4 frames after pin.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Map, Source, Layer } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import type { MapRef } from "react-map-gl/mapbox";

import type { ListingVideoProps } from "../types";
import type { GeoData, DiscoveredAmenity } from "../geo/types";
import { computeViewport, computeLayerOpacities } from "../geo/mapAnimations";
import {
  stateBoundaryLayer,
  stateBoundaryOutline,
  districtBoundaryLayer,
  plotBoundaryFill,
  plotBoundaryOutline,
  routeLineLayer,
  amenityRouteGlowLayer,
  amenityRouteLineLayer,
} from "../geo/mapStyles";
import { getAnimatedRoute, getRouteHead } from "../geo/routeAnimator";
import { LocationPin } from "../components/LocationPin";
import { DistanceLabel } from "../components/DistanceLabel";
import { AmenityPin } from "../components/AmenityPin";
import { AmenityLabel } from "../components/AmenityLabel";
import { AnimatedCar } from "../components/AnimatedCar";
import { COLORS } from "../utils/theme";

const MAPBOX_TOKEN = process.env.MAPBOX_ACCESS_TOKEN || "";
const TILE_TIMEOUT_MS = 5000;

// Phase 2 timing constants for sequential amenity reveals
const PHASE2_START = 0.55;
const PHASE2_END = 0.95;

/**
 * Get per-amenity route progress (0-1) within its sequential time slot.
 */
function getAmenityProgress(
  overallProgress: number,
  amenityIndex: number,
  totalAmenities: number
): number {
  if (totalAmenities === 0) return 0;
  const slotDuration = (PHASE2_END - PHASE2_START) / totalAmenities;
  const slotStart = PHASE2_START + amenityIndex * slotDuration;
  const slotEnd = slotStart + slotDuration * 1.3; // 30% overlap with next

  return interpolate(overallProgress, [slotStart, slotEnd], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

/**
 * Compute screen position for an amenity using Mapbox projection when available,
 * falling back to bearing-based calculation.
 */
function getAmenityScreenPosition(
  amenity: DiscoveredAmenity,
  plotCenter: { lat: number; lng: number },
  mapRef: React.RefObject<MapRef>
): { x: number; y: number } {
  // Try Mapbox projection first
  const map = mapRef.current?.getMap();
  if (map) {
    try {
      const point = map.project([amenity.coords.lng, amenity.coords.lat]);
      return {
        x: Math.max(80, Math.min(1000, point.x)),
        y: Math.max(200, Math.min(1600, point.y)),
      };
    } catch {
      // Fall through to bearing-based
    }
  }

  // Fallback: bearing-based elliptical placement
  const bearing = Math.atan2(
    amenity.coords.lng - plotCenter.lng,
    amenity.coords.lat - plotCenter.lat
  );
  const radiusX = 350;
  const radiusY = 450;
  return {
    x: Math.max(100, Math.min(980, 540 + radiusX * Math.sin(bearing))),
    y: Math.max(300, Math.min(1500, 900 + radiusY * Math.cos(bearing) * -1)),
  };
}

export const MapSequence: React.FC<ListingVideoProps> = (props) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const mapRef = useRef<MapRef>(null);
  const [initialHandle] = useState(() => delayRender("Loading satellite map tiles..."));
  const [mapReady, setMapReady] = useState(false);
  const tileHandleRef = useRef<number | null>(null);

  const geoData = props.geoData as GeoData | undefined;

  // If no geo data, release handle and render nothing
  if (!geoData) {
    useEffect(() => { continueRender(initialHandle); }, [initialHandle]);
    return null;
  }

  const isLowConfidence = geoData.confidence === "low";

  // Extract amenities with valid routes, sorted by distance (nearest first)
  const amenities = (geoData.amenities || []).filter(
    (a) => a.routePolyline && a.routePolyline.length > 1
  );
  const hasAmenities = amenities.length >= 2;

  // --- Initial map load ---
  const handleMapLoad = useCallback(() => {
    setMapReady(true);
  }, []);

  // Release initial handle once map fires 'idle' after first load
  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current?.getMap();
    if (!map) {
      continueRender(initialHandle);
      return;
    }

    const onIdle = () => {
      continueRender(initialHandle);
      map.off("idle", onIdle);
    };

    if (map.areTilesLoaded()) {
      continueRender(initialHandle);
    } else {
      map.on("idle", onIdle);
      const timeout = setTimeout(() => {
        map.off("idle", onIdle);
        continueRender(initialHandle);
      }, TILE_TIMEOUT_MS);
      return () => {
        clearTimeout(timeout);
        map.off("idle", onIdle);
      };
    }
  }, [mapReady, initialHandle]);

  // --- Per-frame tile readiness ---
  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current?.getMap();
    if (!map) return;

    const handle = delayRender(`Waiting for tiles at frame ${frame}`);
    tileHandleRef.current = handle;

    const checkTiles = () => {
      if (map.areTilesLoaded()) {
        continueRender(handle);
      } else {
        const onIdle = () => {
          continueRender(handle);
          map.off("idle", onIdle);
        };
        map.on("idle", onIdle);
        const timeout = setTimeout(() => {
          map.off("idle", onIdle);
          continueRender(handle);
        }, TILE_TIMEOUT_MS);
        return () => {
          clearTimeout(timeout);
          map.off("idle", onIdle);
        };
      }
    };

    const raf = requestAnimationFrame(() => checkTiles());
    return () => cancelAnimationFrame(raf);
  }, [frame, mapReady]);

  // Compute camera viewport for this frame
  const viewport = computeViewport(frame, durationInFrames, geoData, hasAmenities);
  const opacities = computeLayerOpacities(frame, durationInFrames, hasAmenities);
  const progress = frame / durationInFrames;

  // Fade in from forest green background
  const fadeIn = interpolate(frame, [0, 12], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Find boundaries by type
  const stateBoundary = geoData.boundaries.find((b) => b.type === "state");
  const districtBoundary = geoData.boundaries.find((b) => b.type === "district");
  const plotBoundary = geoData.boundaries.find((b) => b.type === "plot");
  const showPlotBoundary = !isLowConfidence && plotBoundary;

  // Landmark route animation progress
  const routeProgress = interpolate(
    progress,
    hasAmenities ? [0.43, 0.50] : [0.82, 0.97],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Location label spring
  const labelTriggerFrame = hasAmenities ? 0.42 : 0.78;
  const labelScale = spring({
    frame: Math.max(0, frame - Math.floor(durationInFrames * labelTriggerFrame)),
    fps,
    config: { damping: 14, stiffness: 180, mass: 0.7 },
  });

  const labelText = isLowConfidence
    ? `Near ${props.city}`
    : `${props.area}, ${props.city}`;

  // Shared spring config for synchronized pin + label
  const amenitySpringConfig = { damping: 14, stiffness: 180, mass: 0.6 };

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.forest }}>
      <div style={{
        opacity: fadeIn,
        width: "100%",
        height: "100%",
      }}>
        <Map
          ref={mapRef}
          mapboxAccessToken={MAPBOX_TOKEN}
          latitude={viewport.latitude}
          longitude={viewport.longitude}
          zoom={viewport.zoom}
          pitch={viewport.pitch}
          bearing={viewport.bearing}
          style={{ width: "100%", height: "100%" }}
          mapStyle="mapbox://styles/mapbox/satellite-streets-v12"
          interactive={false}
          attributionControl={false}
          failIfMajorPerformanceCaveat={false}
          onLoad={handleMapLoad}
        >
          {/* State boundary */}
          {stateBoundary && opacities.stateBoundary > 0.01 && (
            <Source type="geojson" data={stateBoundary.geojson}>
              <Layer {...stateBoundaryLayer(opacities.stateBoundary)} />
              <Layer {...stateBoundaryOutline(opacities.stateBoundary)} />
            </Source>
          )}

          {/* District boundary */}
          {districtBoundary && opacities.districtBoundary > 0.01 && (
            <Source type="geojson" data={districtBoundary.geojson}>
              <Layer {...districtBoundaryLayer(opacities.districtBoundary)} />
            </Source>
          )}

          {/* Plot boundary */}
          {showPlotBoundary && opacities.plotBoundary > 0.01 && (
            <Source type="geojson" data={plotBoundary.geojson}>
              <Layer {...plotBoundaryFill(opacities.plotBoundary)} />
              <Layer {...plotBoundaryOutline(opacities.plotBoundary)} />
            </Source>
          )}

          {/* Landmark route traces */}
          {opacities.routeTraces > 0.01 &&
            geoData.landmarks
              .filter((l) => l.routePolyline && l.routePolyline.length > 1)
              .map((landmark, i) => {
                const animatedRoute = getAnimatedRoute(
                  landmark.routePolyline!,
                  routeProgress
                );
                return (
                  <Source key={`route-${i}`} type="geojson" data={animatedRoute}>
                    <Layer {...routeLineLayer(i, opacities.routeTraces)} />
                  </Source>
                );
              })}

          {/* Amenity route traces (neon green) — sequential per-amenity */}
          {hasAmenities && progress >= PHASE2_START &&
            amenities.map((amenity, i) => {
              const amenityProgress = getAmenityProgress(progress, i, amenities.length);
              if (amenityProgress <= 0) return null;
              const animatedRoute = getAnimatedRoute(
                amenity.routePolyline!,
                amenityProgress
              );
              const routeOpacity = Math.min(1, amenityProgress * 3); // fade in quickly
              return (
                <Source key={`amenity-route-${i}`} type="geojson" data={animatedRoute}>
                  <Layer {...amenityRouteGlowLayer(i, routeOpacity)} />
                  <Layer {...amenityRouteLineLayer(i, routeOpacity)} />
                </Source>
              );
            })}
        </Map>

        {/* Cinematic vignette */}
        <div style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(ellipse at center, transparent 50%, rgba(15,40,25,0.4) 100%)",
          pointerEvents: "none",
        }} />

        {/* Gold tint overlay */}
        <div style={{
          position: "absolute",
          inset: 0,
          background: "rgba(212,164,58,0.06)",
          mixBlendMode: "overlay",
          pointerEvents: "none",
        }} />

        {/* Location pin overlay */}
        {opacities.locationPin > 0.01 && (
          <LocationPin opacity={opacities.locationPin} />
        )}

        {/* Location label */}
        {opacities.locationLabel > 0.01 && (
          <div
            style={{
              position: "absolute",
              bottom: "38%",
              left: "50%",
              transform: `translateX(-50%) scale(${labelScale})`,
              opacity: opacities.locationLabel,
              display: "flex",
              alignItems: "center",
              gap: 8,
              backgroundColor: "rgba(26, 58, 39, 0.85)",
              border: "2px solid #d4a43a",
              borderRadius: 12,
              padding: "10px 24px",
              whiteSpace: "nowrap",
            }}
          >
            <span style={{ fontSize: 20 }}>{"\u{1F4CD}"}</span>
            <span
              style={{
                color: "#ffffff",
                fontSize: 26,
                fontWeight: 700,
                fontFamily: "Inter, sans-serif",
                letterSpacing: 0.5,
              }}
            >
              {labelText}
            </span>
          </div>
        )}

        {/* Distance labels for landmarks */}
        {opacities.routeTraces > 0.01 &&
          geoData.landmarks
            .filter((l) => l.routePolyline && l.routePolyline.length > 1)
            .slice(0, 3)
            .map((landmark, i) => {
              const xPositions = [270, 810, 540];
              const yPositions = [350, 350, 200];
              return (
                <DistanceLabel
                  key={`label-${i}`}
                  landmarkName={landmark.name}
                  distanceKm={landmark.distanceKm}
                  x={xPositions[i % 3]}
                  y={yPositions[i % 3]}
                  opacity={opacities.routeTraces}
                  index={i}
                />
              );
            })}

        {/* Animated car + amenity pins/labels — sequential per-amenity */}
        {hasAmenities && progress >= PHASE2_START &&
          amenities.map((amenity, i) => {
            const amenityProgress = getAmenityProgress(progress, i, amenities.length);
            if (amenityProgress <= 0) return null;

            const pos = getAmenityScreenPosition(amenity, geoData.plotCenter, mapRef);
            const routeComplete = amenityProgress >= 0.8;

            // Car position from route head
            const head = amenityProgress < 1
              ? getRouteHead(amenity.routePolyline!, amenityProgress)
              : null;

            // Pin: triggers when route reaches amenity (80%)
            const pinTriggerFrame = Math.floor(durationInFrames * (PHASE2_START + i * ((PHASE2_END - PHASE2_START) / amenities.length) + ((PHASE2_END - PHASE2_START) / amenities.length) * 0.8 * 1.3));
            const pinFrame = Math.max(0, frame - pinTriggerFrame);
            const pinDrop = routeComplete ? spring({
              frame: pinFrame,
              fps,
              config: amenitySpringConfig,
            }) : 0;

            // Label: 4 frames after pin
            const labelFrame = Math.max(0, pinFrame - 4);
            const labelPop = routeComplete ? spring({
              frame: labelFrame,
              fps,
              config: amenitySpringConfig,
            }) : 0;

            // Car screen position via Mapbox projection
            let carX = 0, carY = 0, carBearing = 0;
            if (head) {
              const map = mapRef.current?.getMap();
              if (map) {
                try {
                  const pt = map.project(head.coords);
                  carX = pt.x;
                  carY = pt.y;
                  carBearing = head.bearing;
                } catch { /* ignore */ }
              }
            }

            return (
              <React.Fragment key={`amenity-group-${i}`}>
                {/* Animated car */}
                <AnimatedCar
                  x={carX}
                  y={carY}
                  bearing={carBearing}
                  opacity={amenityProgress < 1 ? Math.min(1, amenityProgress * 3) : 0}
                  visible={!!head && amenityProgress > 0 && amenityProgress < 1}
                />

                {/* Pin — drops when route arrives */}
                {routeComplete && (
                  <AmenityPin
                    icon={amenity.icon}
                    opacity={pinDrop}
                    index={0}
                    x={pos.x}
                    y={pos.y}
                  />
                )}

                {/* Label — appears after pin */}
                {routeComplete && labelPop > 0.01 && (
                  <AmenityLabel
                    name={amenity.name}
                    icon={amenity.icon}
                    distanceKm={amenity.distanceKm}
                    opacity={labelPop}
                    index={0}
                    x={pos.x}
                    y={pos.y}
                  />
                )}
              </React.Fragment>
            );
          })}
      </div>
    </AbsoluteFill>
  );
};
