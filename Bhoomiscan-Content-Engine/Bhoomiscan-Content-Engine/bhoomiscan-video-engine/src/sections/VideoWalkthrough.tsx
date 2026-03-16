import React from "react";
import {
  AbsoluteFill,
  Video,
  Img,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
  delayRender,
  continueRender,
} from "remotion";
import { COLORS, FONTS, VIDEO } from "../utils/theme";
import { ListingVideoProps } from "../types";
import { SAFE } from "../utils/safeZones";

/**
 * VideoWalkthrough (13-20s):
 * - If seller video exists: plays the walkthrough video with "Site Visit" overlay
 * - If no video: continues photo Ken Burns with a "View from site" feel
 */
export const VideoWalkthrough: React.FC<ListingVideoProps> = (props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const hasVideo = !!props.videoUrl;

  const labelProgress = spring({
    frame: frame - 5,
    fps,
    config: { damping: 15, mass: 0.8, stiffness: 180, overshootClamping: false },
  });

  if (hasVideo) {
    return (
      <AbsoluteFill style={{ backgroundColor: COLORS.black }}>
        {/* Seller's walkthrough video */}
        <Video
          src={props.videoUrl!}
          style={{
            width: VIDEO.width,
            height: VIDEO.height,
            objectFit: "cover",
          }}
          volume={0}
          startFrom={Math.round((props.videoStartFrom || 0) * fps)}
        />

        {/* Light gradient at top and bottom */}
        <AbsoluteFill
          style={{
            background:
              "linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, transparent 20%, transparent 80%, rgba(0,0,0,0.5) 100%)",
          }}
        />

        {/* "Site Visit" badge — top right */}
        <div
          style={{
            position: "absolute",
            top: SAFE.BADGE_TOP,
            right: SAFE.BADGE_RIGHT,
            opacity: labelProgress,
            transform: `translateX(${(1 - labelProgress) * 20}px)`,
            display: "flex",
            alignItems: "center",
            gap: 8,
            backgroundColor: "rgba(26, 58, 39, 0.9)",
            borderRadius: 10,
            padding: "8px 18px",
            border: `1.5px solid ${COLORS.gold}`,
          }}
        >
          <svg width={20} height={20} viewBox="0 0 24 24" fill={COLORS.gold}>
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
          <span
            style={{
              fontFamily: FONTS.body,
              fontSize: 18,
              fontWeight: 700,
              color: COLORS.gold,
              textTransform: "uppercase",
              letterSpacing: 1.5,
            }}
          >
            Site Visit
          </span>
        </div>

        {/* Bottom: location reminder */}
        <div
          style={{
            position: "absolute",
            bottom: SAFE.CONTENT_BOTTOM,
            left: SAFE.CONTENT_LEFT,
            right: SAFE.CONTENT_RIGHT,
            opacity: labelProgress,
          }}
        >
          <span
            style={{
              fontFamily: FONTS.body,
              fontSize: 24,
              fontWeight: 600,
              color: COLORS.white,
              textShadow: "0 2px 8px rgba(0,0,0,0.6)",
            }}
          >
            📍 {props.area}, {props.city}
          </span>
        </div>
      </AbsoluteFill>
    );
  }

  // Fallback: no video — show remaining photos with Ken Burns
  const fallbackPhotos = props.photos.slice(2, 5);
  const photo =
    fallbackPhotos.length > 0
      ? fallbackPhotos[Math.floor(frame / 70) % fallbackPhotos.length]
      : props.photos[0];

  const scale = interpolate(frame, [0, 210], [1.05, 1.15], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.forest }}>
      <FallbackPhoto src={photo} scale={scale} />
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(to top, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.1) 40%, rgba(0,0,0,0.25) 100%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: SAFE.CONTENT_BOTTOM,
          left: SAFE.CONTENT_LEFT,
          right: SAFE.CONTENT_RIGHT,
          opacity: labelProgress,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <span
          style={{
            fontFamily: FONTS.display,
            fontSize: 40,
            fontWeight: 700,
            color: COLORS.white,
            textShadow: "0 2px 10px rgba(0,0,0,0.5)",
          }}
        >
          {props.area}
        </span>
        <span
          style={{
            fontFamily: FONTS.body,
            fontSize: 24,
            fontWeight: 500,
            color: COLORS.goldLight,
          }}
        >
          {props.city}, {props.state}
        </span>
      </div>
    </AbsoluteFill>
  );
};

const FallbackPhoto: React.FC<{ src: string; scale: number }> = ({
  src,
  scale,
}) => {
  const [handle] = React.useState(() => delayRender("Fallback photo"));
  return (
    <Img
      src={src}
      style={{
        width: VIDEO.width,
        height: VIDEO.height,
        objectFit: "cover",
        transform: `scale(${scale})`,
      }}
      onLoad={() => continueRender(handle)}
      onError={() => continueRender(handle)}
    />
  );
};
