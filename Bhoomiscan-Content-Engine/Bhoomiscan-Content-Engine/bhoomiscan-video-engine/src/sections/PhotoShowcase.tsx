import React from "react";
import {
  AbsoluteFill,
  Img,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
  Easing,
  delayRender,
  continueRender,
} from "remotion";
import { COLORS, FONTS, VIDEO } from "../utils/theme";
import { ListingVideoProps } from "../types";
import { formatArea } from "../utils/formatPrice";
import { SECTIONS } from "../utils/timing";
import { SAFE } from "../utils/safeZones";
import { truncate } from "../utils/textOverflow";
import { getPhotoTransition, getTransitionStyle } from "../utils/transitions";

/**
 * PhotoShowcase: Ken Burns through seller photos with contextual overlays.
 * Features weighted photo durations, 6 Ken Burns patterns, and varied transitions.
 */
export const PhotoShowcase: React.FC<ListingVideoProps> = (props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Use dynamic timings if available, fall back to static SECTIONS
  const totalFrames = props.sectionTimings?.photoShowcase?.duration || SECTIONS.photoShowcase.duration;

  // Use up to 5 photos for showcase
  const photos = props.photos.slice(0, 5);
  const photoCount = photos.length;
  const crossfade = 12;

  // Weighted photo durations: hero gets 35%, rest share 65%
  const frameAllocations = computeWeightedFrames(photoCount, totalFrames);

  // Find current photo index based on weighted frame allocations
  let cumulativeFrames = 0;
  let currentIdx = 0;
  for (let i = 0; i < photoCount; i++) {
    if (frame < cumulativeFrames + frameAllocations[i]) {
      currentIdx = i;
      break;
    }
    cumulativeFrames += frameAllocations[i];
    if (i === photoCount - 1) currentIdx = photoCount - 1;
  }
  const framesForCurrentPhoto = frameAllocations[currentIdx];
  const frameInSlide = frame - cumulativeFrames;
  const nextIdx = Math.min(currentIdx + 1, photoCount - 1);

  // 6 Ken Burns patterns, cycled per photo (eased with bezier)
  const pattern = currentIdx % 6;
  const easeProgress = interpolate(frameInSlide, [0, framesForCurrentPhoto], [0, 1], {
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.25, 0.1, 0.25, 1.0),
  });

  let currentScale: number;
  let panX: number;
  let panY = 0;

  switch (pattern) {
    case 0: // zoomPanLeft
      currentScale = 1.0 + easeProgress * 0.15;
      panX = easeProgress * -30;
      break;
    case 1: // zoomOutPanRight
      currentScale = 1.15 - easeProgress * 0.15;
      panX = -20 + easeProgress * 40;
      break;
    case 2: // zoomVerticalPan
      currentScale = 1.0 + easeProgress * 0.12;
      panX = 0;
      panY = -20 + easeProgress * 40;
      break;
    case 3: // subtleDrift
      currentScale = 1.05 + easeProgress * 0.05;
      panX = 10 - easeProgress * 20;
      break;
    case 4: // diagonalPan: scale 1→1.1, drift diagonally
      currentScale = 1.0 + easeProgress * 0.1;
      panX = easeProgress * -15;
      panY = easeProgress * -10;
      break;
    case 5: // focusPull: scale 1.15→1.0, simulated rack-focus via CSS blur
    default:
      currentScale = 1.15 - easeProgress * 0.15;
      panX = 0;
      panY = 0;
      break;
  }

  // Focus-pull blur for pattern 5
  const focusBlur = pattern === 5
    ? interpolate(easeProgress, [0, 0.4, 1], [3, 0, 0], { extrapolateRight: "clamp" })
    : 0;

  // Varied photo-to-photo transitions (cycle through fade→slideLeft→zoom)
  const transitionType = getPhotoTransition(currentIdx);
  const isCrossfading =
    frameInSlide >= framesForCurrentPhoto - crossfade && currentIdx < photoCount - 1;

  let currentOpacity = 1;
  let nextOpacity = 0;
  let nextStyle: React.CSSProperties = {};

  if (isCrossfading) {
    const cf = frameInSlide - (framesForCurrentPhoto - crossfade);
    const progress = interpolate(cf, [0, crossfade], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.bezier(0.25, 0.1, 0.25, 1.0),
    });

    if (transitionType === "fade") {
      currentOpacity = 1 - progress;
      nextOpacity = progress;
    } else {
      // For slide/zoom, use transition styles on the incoming photo
      currentOpacity = 1 - progress;
      nextOpacity = 1;
      nextStyle = getTransitionStyle(transitionType, progress, "enter");
    }
  }

  // Overlay text per photo
  const overlays = buildOverlays(props);
  const overlay = overlays[currentIdx % overlays.length];

  const textProgress = spring({
    frame: frameInSlide,
    fps,
    config: { damping: 15, mass: 0.8, stiffness: 200, overshootClamping: false },
  });

  const counterText = `${currentIdx + 1} / ${photoCount}`;

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.forest }}>
      {/* Current photo */}
      <PhotoLayer
        src={photos[currentIdx]}
        scale={currentScale}
        panX={panX}
        panY={panY}
        opacity={currentOpacity}
        blur={focusBlur}
      />

      {/* Next photo (transition) */}
      {isCrossfading && nextIdx !== currentIdx && (
        <AbsoluteFill style={nextStyle}>
          <PhotoLayer
            src={photos[nextIdx]}
            scale={1.0}
            panX={0}
            opacity={nextOpacity}
          />
        </AbsoluteFill>
      )}

      {/* Dark gradient — heavier at bottom */}
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.05) 45%, rgba(0,0,0,0.3) 100%)",
        }}
      />

      {/* Photo counter — top right */}
      <div
        style={{
          position: "absolute",
          top: SAFE.BADGE_TOP,
          right: SAFE.BADGE_RIGHT,
          backgroundColor: "rgba(0,0,0,0.6)",
          borderRadius: 8,
          padding: "6px 14px",
          border: `1px solid rgba(255,255,255,0.2)`,
        }}
      >
        <span
          style={{
            fontFamily: FONTS.body,
            fontSize: 18,
            fontWeight: 600,
            color: COLORS.white,
          }}
        >
          📷 {counterText}
        </span>
      </div>

      {/* Bottom overlay text */}
      <div
        style={{
          position: "absolute",
          bottom: SAFE.CONTENT_BOTTOM,
          left: SAFE.CONTENT_LEFT,
          right: SAFE.CONTENT_RIGHT,
          opacity: textProgress,
          transform: `translateY(${(1 - textProgress) * 25}px)`,
        }}
      >
        {overlay.badge && (
          <div
            style={{
              display: "inline-block",
              backgroundColor: overlay.badgeColor || COLORS.emerald,
              borderRadius: 6,
              padding: "5px 12px",
              marginBottom: 10,
            }}
          >
            <span
              style={{
                fontFamily: FONTS.body,
                fontSize: 16,
                fontWeight: 700,
                color: COLORS.white,
                textTransform: "uppercase",
                letterSpacing: 1,
              }}
            >
              {overlay.badge}
            </span>
          </div>
        )}
        <div
          style={{
            fontFamily: FONTS.display,
            fontSize: 36,
            fontWeight: 700,
            color: COLORS.white,
            lineHeight: 1.25,
            textShadow: "0 2px 10px rgba(0,0,0,0.5)",
          }}
        >
          {truncate(overlay.headline, 35)}
        </div>
        {overlay.subline && (
          <div
            style={{
              fontFamily: FONTS.body,
              fontSize: 21,
              fontWeight: 500,
              color: COLORS.goldLight,
              marginTop: 6,
              textShadow: "0 1px 6px rgba(0,0,0,0.4)",
            }}
          >
            {overlay.subline}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

// --- Weighted frame allocation ---

function computeWeightedFrames(photoCount: number, totalFrames: number): number[] {
  if (photoCount <= 1) return [totalFrames];

  // Hero gets 35% of total time, rest share 65%
  const heroFrames = Math.floor(totalFrames * 0.35);
  const restTotal = totalFrames - heroFrames;
  const restPerPhoto = Math.floor(restTotal / (photoCount - 1));

  const allocations = [heroFrames];
  for (let i = 1; i < photoCount; i++) {
    allocations.push(restPerPhoto);
  }

  // Distribute remaining frames to last photo
  const allocated = allocations.reduce((a, b) => a + b, 0);
  allocations[allocations.length - 1] += totalFrames - allocated;

  return allocations;
}

// --- Helper components ---

const PhotoLayer: React.FC<{
  src: string;
  scale: number;
  panX: number;
  panY?: number;
  opacity: number;
  blur?: number;
}> = ({ src, scale, panX, panY = 0, opacity, blur = 0 }) => {
  const [handle] = React.useState(() => delayRender("Photo: " + src.slice(-20)));
  return (
    <AbsoluteFill style={{ opacity }}>
      <Img
        src={src}
        style={{
          width: VIDEO.width,
          height: VIDEO.height,
          objectFit: "cover",
          transform: `scale(${scale}) translateX(${panX}px) translateY(${panY}px)`,
          filter: blur > 0 ? `blur(${blur}px)` : undefined,
        }}
        onLoad={() => continueRender(handle)}
        onError={() => continueRender(handle)}
      />
    </AbsoluteFill>
  );
};

interface OverlayItem {
  badge?: string;
  badgeColor?: string;
  headline: string;
  subline?: string;
}

function buildOverlays(props: ListingVideoProps): OverlayItem[] {
  const overlays: OverlayItem[] = [];

  overlays.push({
    badge: "✓ VERIFIED",
    badgeColor: COLORS.emerald,
    headline: `${formatArea(props.plotSize, props.areaUnit)} ${props.plotType} Plot`,
    subline: "Clear Title  •  Ready for Registration",
  });

  const features: string[] = [];
  if (props.hasRoadAccess) features.push("Road Access");
  if (props.hasWaterSupply) features.push("Water Supply");
  if (props.hasElectricity) features.push("Electricity");
  if (props.hasFencing) features.push("Boundary Wall");
  if (features.length > 0) {
    overlays.push({
      badge: "AMENITIES",
      badgeColor: COLORS.gold,
      headline: features.slice(0, 3).join(" • "),
      subline: "All Infrastructure in Place",
    });
  }

  overlays.push({
    badge: "LOCATION",
    badgeColor: COLORS.emerald,
    headline: `${props.area}`,
    subline: `${props.city}, ${props.state}  •  Growing Locality`,
  });

  if (props.pricePerSqft > 0) {
    overlays.push({
      badge: "FAIR PRICE",
      badgeColor: "#2563eb",
      headline: `₹${Math.round(props.pricePerSqft).toLocaleString("en-IN")}/sq.ft`,
      subline: "Transparent Pricing  •  No Hidden Costs",
    });
  }

  overlays.push({
    badge: "INVEST NOW",
    badgeColor: COLORS.gold,
    headline: `Total: ${formatIndianPriceShort(props.price)}`,
    subline: "Secure Your Plot Before Prices Rise",
  });

  return overlays;
}

function formatIndianPriceShort(price: number): string {
  if (price >= 10_000_000) return `₹${(price / 10_000_000).toFixed(2)} Cr`;
  if (price >= 100_000) return `₹${(price / 100_000).toFixed(2)} L`;
  return `₹${price.toLocaleString("en-IN")}`;
}
