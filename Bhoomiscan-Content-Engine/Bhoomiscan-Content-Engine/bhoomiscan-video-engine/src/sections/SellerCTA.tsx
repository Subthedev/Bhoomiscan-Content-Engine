import React from "react";
import {
  AbsoluteFill,
  Img,
  useCurrentFrame,
  useVideoConfig,
  spring,
  delayRender,
  continueRender,
} from "remotion";
import { COLORS, FONTS, GRADIENTS } from "../utils/theme";
import { ListingVideoProps } from "../types";
import { formatIndianPrice } from "../utils/formatPrice";
import { SAFE } from "../utils/safeZones";
import { fitText } from "../utils/textOverflow";
import { pulseScale, parallaxDrift } from "../utils/animations";
import { SECTIONS } from "../utils/timing";

/**
 * SellerCTA: Seller info + strong call-to-action.
 * Features parallax background drift and pulsing CTA button.
 */
export const SellerCTA: React.FC<ListingVideoProps> = (props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const sectionDuration = props.sectionTimings?.sellerCTA?.duration || SECTIONS.sellerCTA.duration;

  const avatarProgress = spring({
    frame,
    fps,
    config: { damping: 12, mass: 0.6, stiffness: 220, overshootClamping: false },
  });

  const textProgress = spring({
    frame: frame - 12,
    fps,
    config: { damping: 15, mass: 0.8, stiffness: 180, overshootClamping: false },
  });

  const ctaProgress = spring({
    frame: frame - 25,
    fps,
    config: { damping: 18, mass: 1, stiffness: 150, overshootClamping: false },
  });

  // Parallax background drift: slow translateX over section duration
  const bgDriftX = parallaxDrift(frame, sectionDuration, 20);

  // CTA button pulse: gentle scale oscillation after it appears
  const ctaScale = frame > 30 ? pulseScale(frame - 30, 1.0, 1.03, 45) : ctaProgress;

  const bgPhoto = props.photos[0];
  const [bgHandle] = React.useState(() =>
    bgPhoto ? delayRender("SellerCTA bg") : null
  );

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.forest }}>
      {/* Blurred photo background with parallax drift */}
      {bgPhoto && (
        <AbsoluteFill>
          <Img
            src={bgPhoto}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              filter: "blur(20px)",
              transform: `scale(1.15) translateX(${bgDriftX}px)`,
            }}
            onLoad={() => bgHandle && continueRender(bgHandle)}
            onError={() => bgHandle && continueRender(bgHandle)}
          />
          <AbsoluteFill style={{ background: "rgba(0,0,0,0.6)" }} />
        </AbsoluteFill>
      )}

      {/* Content overlay */}
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: `${SAFE.PADDING_SOLID.top}px 50px ${SAFE.PADDING_SOLID.bottom}px 50px`,
          gap: 22,
        }}
      >
      {/* Listed by label */}
      <div style={{ opacity: avatarProgress }}>
        <span
          style={{
            fontFamily: FONTS.body,
            fontSize: 16,
            fontWeight: 600,
            color: COLORS.goldLight,
            textTransform: "uppercase",
            letterSpacing: 3,
          }}
        >
          Your Direct Contact
        </span>
      </div>

      {/* Seller avatar + name */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 10,
          opacity: avatarProgress,
          transform: `scale(${avatarProgress})`,
        }}
      >
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            background: GRADIENTS.gold,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 4px 20px rgba(212, 164, 58, 0.3)",
          }}
        >
          <span
            style={{
              fontFamily: FONTS.body,
              fontSize: 36,
              fontWeight: 700,
              color: COLORS.forest,
            }}
          >
            {props.sellerName.charAt(0).toUpperCase()}
          </span>
        </div>

        <span
          style={{
            fontFamily: FONTS.display,
            fontSize: fitText(props.sellerName, 20, 36, 26).fontSize,
            fontWeight: 700,
            color: COLORS.white,
          }}
        >
          {fitText(props.sellerName, 20, 36, 26).text}
        </span>

        {/* Seller type badge */}
        <div
          style={{
            backgroundColor:
              props.sellerType === "Owner" ? COLORS.emerald : COLORS.gold,
            borderRadius: 999,
            padding: "5px 18px",
          }}
        >
          <span
            style={{
              fontFamily: FONTS.body,
              fontSize: 16,
              fontWeight: 700,
              color: props.sellerType === "Owner" ? COLORS.white : COLORS.forest,
              textTransform: "uppercase",
              letterSpacing: 1,
            }}
          >
            VERIFIED {props.sellerType}
          </span>
        </div>
      </div>

      {/* Price reminder */}
      <div
        style={{
          opacity: textProgress,
          transform: `translateY(${(1 - textProgress) * 16}px)`,
          textAlign: "center",
        }}
      >
        <span
          style={{
            fontFamily: FONTS.display,
            fontSize: 46,
            fontWeight: 700,
            color: COLORS.gold,
            textShadow: "0 2px 8px rgba(0,0,0,0.2)",
          }}
        >
          {formatIndianPrice(props.price)}
        </span>
      </div>

      {/* CTA with pulse animation */}
      <div
        style={{
          opacity: ctaProgress,
          transform: `translateY(${(1 - ctaProgress) * 16}px) scale(${ctaScale})`,
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          alignItems: "center",
        }}
      >
        <div
          style={{
            backgroundColor: COLORS.gold,
            borderRadius: 12,
            padding: "12px 32px",
            boxShadow: "0 4px 16px rgba(212, 164, 58, 0.4)",
          }}
        >
          <span
            style={{
              fontFamily: FONTS.body,
              fontSize: 22,
              fontWeight: 800,
              color: COLORS.forest,
            }}
          >
            Interested? DM Your Phone Number
          </span>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
            marginTop: 2,
          }}
        >
          <span
            style={{
              fontFamily: FONTS.body,
              fontSize: 16,
              fontWeight: 600,
              color: COLORS.white,
            }}
          >
            The direct seller will contact you personally
          </span>
          <span
            style={{
              fontFamily: FONTS.body,
              fontSize: 14,
              fontWeight: 600,
              color: COLORS.emerald,
            }}
          >
            No spam calls  •  No brokers  •  Verified seller only
          </span>
        </div>
      </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
