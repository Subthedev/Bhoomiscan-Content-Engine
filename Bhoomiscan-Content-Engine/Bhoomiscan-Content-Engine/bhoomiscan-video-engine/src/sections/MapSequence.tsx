/**
 * MapSequence — Cinematic satellite map section with sequential amenity rides.
 *
 * Phase 1: Staged zoom-in (India → State → District → Locality → Plot) with holds
 * Phase 1→2: Smooth zoom-out to fit amenities
 * Phase 2: Sequential car rides from pinned plot location to each amenity
 *
 * Key behaviors:
 * - Property location pin stays visible throughout ALL phases
 * - Routes visually start from the pinned plot location
 * - Per-frame tile sync via delayRender + map.once('idle')
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Map, MapRef, Source, Layer } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";

import type { ListingVideoProps } from "../types";
import {
  computeAmenityRideTimings,
  computeViewport,
} from "../geo/mapAnimations";
import {
  getAnimatedRoute,
  getRouteHead,
  getRouteTrail,
  getSmoothedBearing,
} from "../geo/routeAnimator";
import { computeCumulativeDistances, getRecentTrail } from "../geo/polylineUtils";
import {
  stateBoundaryLayer,
  stateBoundaryOutline,
  districtBoundaryLayer,
  plotBoundaryFill,
  plotBoundaryOutline,
  activeRouteGlow,
  activeRouteCore,
  activeRouteCenter,
  activeRouteHotTrail,
  completedRouteFadedGlow,
  completedRouteFadedLine,
} from "../geo/mapStyles";

import { AnimatedCar } from "../components/AnimatedCar";
import { AmenityPin } from "../components/AmenityPin";
import { AmenityLabel } from "../components/AmenityLabel";

const MAPBOX_TOKEN = process.env.MAPBOX_ACCESS_TOKEN || "";

const EMPTY_GEOJSON: GeoJSON.Feature<GeoJSON.LineString> = {
  type: "Feature",
  properties: {},
  geometry: { type: "LineString", coordinates: [] },
};

export const MapSequence: React.FC<ListingVideoProps> = (props) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const mapRef = useRef<MapRef>(null);
  const [handle] = useState(() => delayRender("Loading map tiles..."));
  const [mapReady, setMapReady] = useState(false);

  const geoData = props.geoData;
  if (!geoData) return <AbsoluteFill style={{ backgroundColor: "#0f2819" }} />;

  const amenities = geoData.amenities || [];
  const plotCenter = geoData.plotCenter;

  // Prepend plotCenter to each route polyline so routes visually start from the pin
  const amenitiesWithPlotStart = useMemo(() => {
    const plotCoord: [number, number] = [plotCenter.lng, plotCenter.lat];
    return amenities.map((a) => {
      if (!a.routePolyline || a.routePolyline.length === 0) return a;
      // Only prepend if first point differs from plot center
      const first = a.routePolyline[0];
      const distLng = Math.abs(first[0] - plotCoord[0]);
      const distLat = Math.abs(first[1] - plotCoord[1]);
      if (distLng > 0.0001 || distLat > 0.0001) {
        return { ...a, routePolyline: [plotCoord, ...a.routePolyline] };
      }
      return a;
    });
  }, [amenities, plotCenter]);

  // Compute ride timings
  const rideTimings = useMemo(
    () => computeAmenityRideTimings(durationInFrames, amenitiesWithPlotStart.length),
    [durationInFrames, amenitiesWithPlotStart.length]
  );

  // Pre-compute cumulative distances
  const amenityCumDists = useMemo(
    () =>
      amenitiesWithPlotStart.map((a) =>
        a.routePolyline ? computeCumulativeDistances(a.routePolyline) : []
      ),
    [amenitiesWithPlotStart]
  );

  // Compute camera viewport for current frame
  const viewport = useMemo(
    () => computeViewport(frame, durationInFrames, geoData, rideTimings),
    [frame, durationInFrames, geoData, rideTimings]
  );

  // ── Per-frame tile synchronization ──
  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current?.getMap();
    if (!map) {
      continueRender(handle);
      return;
    }
    const onIdle = () => continueRender(handle);
    map.once("idle", onIdle);
    const safety = setTimeout(() => {
      map.off("idle", onIdle);
      continueRender(handle);
    }, 8000);
    return () => {
      clearTimeout(safety);
      map.off("idle", onIdle);
    };
  }, [mapReady, handle]);

  // Per-frame delay for tile loading after camera move
  const frameHandleRef = useRef<number | null>(null);
  useEffect(() => {
    if (!mapReady || frame === 0) return;
    const map = mapRef.current?.getMap();
    if (!map) return;

    const fh = delayRender(`Tiles for frame ${frame}`);
    frameHandleRef.current = fh;

    const onIdle = () => {
      continueRender(fh);
      frameHandleRef.current = null;
    };
    map.once("idle", onIdle);

    const safety = setTimeout(() => {
      map.off("idle", onIdle);
      if (frameHandleRef.current === fh) {
        continueRender(fh);
        frameHandleRef.current = null;
      }
    }, 6000);

    return () => {
      clearTimeout(safety);
      map.off("idle", onIdle);
      if (frameHandleRef.current === fh) {
        continueRender(fh);
        frameHandleRef.current = null;
      }
    };
  }, [frame, mapReady]);

  // Find active ride
  const activeRide = rideTimings.find((r) => {
    const local = frame - r.startFrame;
    return local >= 0 && local < 90;
  });

  const activeLocalFrame = activeRide ? frame - activeRide.startFrame : -1;
  // Cap route at 0.95 to prevent endpoint overshoot (u-turn artifacts on highways)
  const routeProgress = activeRide
    ? interpolate(activeLocalFrame, [5, 70], [0, 0.95], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 0;

  const activeIdx = activeRide?.amenityIndex ?? -1;

  const completedRides = rideTimings.filter(
    (r) => frame > r.routeDrawEnd && r.amenityIndex !== activeIdx
  );

  // Boundary sources
  const stateBoundaryGeo = geoData.boundaries.find((b) => b.type === "state");
  const districtBoundaryGeo = geoData.boundaries.find((b) => b.type === "district");
  const plotBoundaryGeo = geoData.boundaries.find((b) => b.type === "plot");

  const boundaryOpacity = interpolate(frame, [0, 30, 130, 160], [0, 1, 1, 0.3], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Project geo coords to screen position
  const project = (coords: { lat: number; lng: number }): { x: number; y: number } | null => {
    const map = mapRef.current?.getMap();
    if (!map) return null;
    try {
      const point = map.project([coords.lng, coords.lat]);
      return { x: point.x, y: point.y };
    } catch {
      return null;
    }
  };

  // ── Property location pin — ALWAYS visible from frame 120 onward ──
  // Uses project() to stay pinned to actual plot coordinates during camera movement
  const plotScreenPos = project(plotCenter);
  const plotPinOpacity = interpolate(frame, [110, 125], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ── Car position ──
  let carPos: { x: number; y: number } | null = null;
  let carBearing = 0;
  let carVisible = false;
  let carOpacity = 0;
  let carTrailPoints: { x: number; y: number }[] | undefined;

  if (activeRide && activeLocalFrame >= 5 && activeLocalFrame <= 72) {
    const amenity = amenitiesWithPlotStart[activeIdx];
    const cumDist = amenityCumDists[activeIdx];
    if (amenity?.routePolyline && cumDist.length > 0) {
      const totalDistM = cumDist[cumDist.length - 1];
      const carOffset = Math.min(0.03, 30 / totalDistM);
      // Cap car at 0.95 — prevents overshooting the endpoint (highway u-turn fix)
      const carProgress = Math.min(0.95, routeProgress + carOffset);

      const head = getRouteHead(amenity.routePolyline, carProgress, cumDist);
      carPos = project({ lat: head[1], lng: head[0] });
      carBearing = getSmoothedBearing(amenity.routePolyline, carProgress, cumDist);
      carVisible = true;
      // Car stays visible at destination, fades out at end of ride
      carOpacity = interpolate(activeLocalFrame, [5, 10, 68, 72], [0, 1, 1, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });

      // Screen-space trail behind car (40m of road)
      const trailGeo = getRecentTrail(amenity.routePolyline, cumDist, carProgress, 40);
      if (trailGeo.length >= 2) {
        const projected = trailGeo
          .map((pt) => project({ lat: pt[1], lng: pt[0] }))
          .filter((p): p is { x: number; y: number } => p !== null);
        if (projected.length >= 2) {
          carTrailPoints = projected;
        }
      }
    }
  }

  return (
    <AbsoluteFill>
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
        fadeDuration={0}
        preserveDrawingBuffer={true}
        maxTileCacheSize={300}
        onLoad={() => setMapReady(true)}
      >
        {/* Boundary layers */}
        {stateBoundaryGeo && (
          <Source id="state-boundary" type="geojson" data={stateBoundaryGeo.geojson}>
            <Layer {...stateBoundaryLayer(boundaryOpacity)} />
            <Layer {...stateBoundaryOutline(boundaryOpacity)} />
          </Source>
        )}

        {districtBoundaryGeo && (
          <Source id="district-boundary" type="geojson" data={districtBoundaryGeo.geojson}>
            <Layer {...districtBoundaryLayer(boundaryOpacity)} />
          </Source>
        )}

        {plotBoundaryGeo && (
          <Source id="plot-boundary" type="geojson" data={plotBoundaryGeo.geojson}>
            <Layer {...plotBoundaryFill(boundaryOpacity)} />
            <Layer {...plotBoundaryOutline(boundaryOpacity)} />
          </Source>
        )}

        {/* Completed route layers */}
        {completedRides.map((ride) => {
          const amenity = amenitiesWithPlotStart[ride.amenityIndex];
          if (!amenity?.routePolyline) return null;
          const fullRoute: GeoJSON.Feature<GeoJSON.LineString> = {
            type: "Feature",
            properties: {},
            geometry: { type: "LineString", coordinates: amenity.routePolyline },
          };
          return (
            <Source
              key={`completed-${ride.amenityIndex}`}
              id={`completed-route-src-${ride.amenityIndex}`}
              type="geojson"
              data={fullRoute}
            >
              <Layer {...completedRouteFadedGlow(ride.amenityIndex, 1)} />
              <Layer {...completedRouteFadedLine(ride.amenityIndex, 1)} />
            </Source>
          );
        })}

        {/* Active route layers */}
        <Source
          id="active-route-src"
          type="geojson"
          data={
            activeRide && amenitiesWithPlotStart[activeIdx]?.routePolyline
              ? getAnimatedRoute(
                  amenitiesWithPlotStart[activeIdx].routePolyline!,
                  routeProgress,
                  amenityCumDists[activeIdx]
                )
              : EMPTY_GEOJSON
          }
        >
          <Layer {...activeRouteGlow(0, activeRide ? 1 : 0, frame)} />
          <Layer {...activeRouteCore(0, activeRide ? 1 : 0)} />
          <Layer {...activeRouteCenter(0, activeRide ? 1 : 0)} />
        </Source>

        {/* Hot trail */}
        <Source
          id="active-trail-src"
          type="geojson"
          data={
            activeRide && amenitiesWithPlotStart[activeIdx]?.routePolyline
              ? getRouteTrail(
                  amenitiesWithPlotStart[activeIdx].routePolyline!,
                  routeProgress,
                  0.15,
                  amenityCumDists[activeIdx]
                )
              : EMPTY_GEOJSON
          }
        >
          <Layer {...activeRouteHotTrail(0, activeRide ? 1 : 0)} />
        </Source>
      </Map>

      {/* Subtle vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at center, transparent 60%, rgba(0, 0, 0, 0.4) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* ── Property location pin — stays visible from zoom-in through all rides ── */}
      {plotScreenPos && plotPinOpacity > 0 && (
        <div
          style={{
            position: "absolute",
            left: plotScreenPos.x,
            top: plotScreenPos.y,
            transform: "translate(-50%, -100%)",
            opacity: plotPinOpacity,
            pointerEvents: "none",
            zIndex: 45,
            filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.5))",
          }}
        >
          <svg width="48" height="64" viewBox="0 0 48 64" fill="none">
            <path
              d="M24 0C10.745 0 0 10.745 0 24c0 18 24 40 24 40s24-22 24-40C48 10.745 37.255 0 24 0z"
              fill="#d4a43a"
            />
            <circle cx="24" cy="22" r="10" fill="#1a3a27" />
            <circle cx="24" cy="22" r="5" fill="#e0c06a" />
          </svg>
        </div>
      )}

      {/* Animated car following route */}
      {carPos && (
        <AnimatedCar
          x={carPos.x}
          y={carPos.y}
          bearing={carBearing}
          opacity={carOpacity}
          visible={carVisible}
          frame={frame}
          trailPoints={carTrailPoints}
        />
      )}

      {/* Amenity pins and labels */}
      {rideTimings.map((ride) => {
        const amenity = amenitiesWithPlotStart[ride.amenityIndex];
        if (!amenity) return null;

        const pos = project(amenity.coords);
        if (!pos) return null;

        return (
          <React.Fragment key={`amenity-overlay-${ride.amenityIndex}`}>
            <AmenityPin
              icon={amenity.icon}
              x={pos.x}
              y={pos.y}
              triggerFrame={ride.pinDropFrame}
              amenityIndex={ride.amenityIndex}
            />
            <AmenityLabel
              icon={amenity.icon}
              name={amenity.name}
              distanceKm={amenity.distanceKm}
              x={pos.x}
              y={pos.y - 28}
              triggerFrame={ride.labelPopFrame}
            />
          </React.Fragment>
        );
      })}
    </AbsoluteFill>
  );
};
