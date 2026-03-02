import React from "react";
import {
  AbsoluteFill,
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
import { formatIndianPrice, formatArea } from "../utils/formatPrice";
import { SAFE } from "../utils/safeZones";
import { truncate } from "../utils/textOverflow";
import { flashOpacity } from "../utils/animations";
import { typewriterText } from "../utils/typography";

/**
 * IntroHook (0-3s): Cinematic attention-grabbing opening.
 * Camera flash opener, typewriter price reveal, cinematic vignette.
 */
export const IntroHook: React.FC<ListingVideoProps> = (props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const [handle] = React.useState(() => delayRender("Loading intro image"));

  // Ken Burns on first image
  const scale = interpolate(frame, [0, 90], [1.0, 1.08], {
    extrapolateRight: "clamp",
  });

  const badgeProgress = spring({
    frame,
    fps,
    config: { damping: 12, mass: 0.6, stiffness: 250, overshootClamping: false },
  });

  const priceProgress = spring({
    frame: frame - 8,
    fps,
    config: { damping: 15, mass: 0.8, stiffness: 200, overshootClamping: false },
  });

  const infoProgress = spring({
    frame: frame - 18,
    fps,
    config: { damping: 18, mass: 1, stiffness: 150, overshootClamping: false },
  });

  // Camera flash: 3-frame white overlay at frame 0 that fades instantly
  const flashAlpha = flashOpacity(frame, 0, 4);

  // Typewriter price reveal: chars appear over ~10 frames starting at frame 8
  const priceText = formatIndianPrice(props.price);
  const revealedPrice = typewriterText(priceText, frame, 1.5, 8);

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.forest }}>
      {/* Background: primary photo with Ken Burns */}
      <AbsoluteFill>
        <Img
          src={props.photos[0]}
          style={{
            width: VIDEO.width,
            height: VIDEO.height,
            objectFit: "cover",
            transform: `scale(${scale})`,
          }}
          onLoad={() => continueRender(handle)}
          onError={() => continueRender(handle)}
        />
      </AbsoluteFill>

      {/* Dark gradient overlay */}
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.15) 40%, rgba(0,0,0,0.7) 100%)",
        }}
      />

      {/* Cinematic vignette overlay */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.4) 100%)",
        }}
      />

      {/* Camera flash overlay */}
      {flashAlpha > 0 && (
        <AbsoluteFill
          style={{
            backgroundColor: `rgba(255,255,255,${flashAlpha * 0.85})`,
          }}
        />
      )}

      {/* FOR SALE badge — top right */}
      <div
        style={{
          position: "absolute",
          top: SAFE.BADGE_TOP,
          right: SAFE.BADGE_RIGHT,
          transform: `scale(${badgeProgress})`,
          backgroundColor: COLORS.gold,
          borderRadius: 8,
          padding: "10px 24px",
          boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
        }}
      >
        <span
          style={{
            fontFamily: FONTS.body,
            fontSize: 22,
            fontWeight: 800,
            color: COLORS.forest,
            textTransform: "uppercase",
            letterSpacing: 2,
          }}
        >
          Verified Listing
        </span>
      </div>

      {/* Bottom content area */}
      <div
        style={{
          position: "absolute",
          bottom: SAFE.CONTENT_BOTTOM,
          left: SAFE.CONTENT_LEFT,
          right: SAFE.CONTENT_RIGHT,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {/* Property type pill */}
        <div
          style={{
            opacity: infoProgress,
            transform: `translateY(${(1 - infoProgress) * 20}px)`,
          }}
        >
          <span
            style={{
              display: "inline-block",
              fontFamily: FONTS.body,
              fontSize: 18,
              fontWeight: 700,
              color: COLORS.white,
              backgroundColor: "rgba(16, 185, 129, 0.8)",
              borderRadius: 6,
              padding: "6px 14px",
              textTransform: "uppercase",
              letterSpacing: 1.5,
            }}
          >
            {props.plotType} Plot
          </span>
        </div>

        {/* Price — typewriter reveal */}
        <div
          style={{
            opacity: priceProgress,
            transform: `translateY(${(1 - priceProgress) * 30}px)`,
          }}
        >
          <span
            style={{
              fontFamily: FONTS.display,
              fontSize: 76,
              fontWeight: 700,
              color: COLORS.white,
              textShadow: "0 3px 12px rgba(0,0,0,0.5)",
              lineHeight: 1,
            }}
          >
            {revealedPrice}
          </span>
        </div>

        {/* Location + size */}
        <div
          style={{
            opacity: infoProgress,
            transform: `translateY(${(1 - infoProgress) * 20}px)`,
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <span
            style={{
              fontFamily: FONTS.body,
              fontSize: 30,
              fontWeight: 600,
              color: COLORS.white,
              textShadow: "0 1px 6px rgba(0,0,0,0.4)",
            }}
          >
            📍 {truncate(`${props.area}, ${props.city}`, 30)}
          </span>
          <span
            style={{
              fontFamily: FONTS.body,
              fontSize: 26,
              fontWeight: 500,
              color: COLORS.goldLight,
              textShadow: "0 1px 4px rgba(0,0,0,0.4)",
            }}
          >
            {formatArea(props.plotSize, props.areaUnit)} • ₹{Math.round(props.pricePerSqft).toLocaleString("en-IN")}/sq.ft
          </span>
          <span
            style={{
              fontFamily: FONTS.body,
              fontSize: 22,
              fontWeight: 600,
              color: COLORS.emerald,
              textShadow: "0 1px 4px rgba(0,0,0,0.4)",
              marginTop: 4,
            }}
          >
            {props.sellerType === "Owner"
              ? "Direct from Owner  •  Title Clear"
              : "Verified Agent  •  Legal-Ready Plot"}
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
