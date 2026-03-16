import React, { useEffect, useRef, useState } from "react";
import { AbsoluteFill, continueRender, delayRender, useCurrentFrame } from "remotion";
import { Map, MapRef } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";

const MAPBOX_TOKEN = process.env.MAPBOX_ACCESS_TOKEN || "";

// Odisha center coordinates
const ODISHA_CENTER = {
  latitude: 20.9517,
  longitude: 85.0985,
};

export const MapTest: React.FC = () => {
  const frame = useCurrentFrame();
  const mapRef = useRef<MapRef>(null);
  const [handle] = useState(() => delayRender("Loading map tiles..."));
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    if (mapLoaded) {
      // Give tiles a moment to render after map load
      const timeout = setTimeout(() => {
        continueRender(handle);
      }, 2000);
      return () => clearTimeout(timeout);
    }
  }, [mapLoaded, handle]);

  // Simple zoom animation: zoom 5 -> 10 over 90 frames
  const zoom = 5 + (frame / 90) * 5;

  return (
    <AbsoluteFill>
      <Map
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={{
          latitude: ODISHA_CENTER.latitude,
          longitude: ODISHA_CENTER.longitude,
          zoom: 5,
          pitch: 0,
          bearing: 0,
        }}
        latitude={ODISHA_CENTER.latitude}
        longitude={ODISHA_CENTER.longitude}
        zoom={Math.min(zoom, 10)}
        pitch={frame > 45 ? ((frame - 45) / 45) * 30 : 0}
        bearing={0}
        style={{ width: "100%", height: "100%" }}
        mapStyle="mapbox://styles/mapbox/satellite-streets-v12"
        interactive={false}
        attributionControl={false}
        failIfMajorPerformanceCaveat={false}
        onLoad={() => setMapLoaded(true)}
      />
    </AbsoluteFill>
  );
};
