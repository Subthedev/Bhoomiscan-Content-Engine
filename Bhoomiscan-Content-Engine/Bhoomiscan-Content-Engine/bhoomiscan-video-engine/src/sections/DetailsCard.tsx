import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from "remotion";
import { COLORS, FONTS, GRADIENTS } from "../utils/theme";
import { ListingVideoProps } from "../types";
import { formatIndianPrice, formatArea, formatPricePerSqft } from "../utils/formatPrice";
import { SAFE } from "../utils/safeZones";
import { truncate } from "../utils/textOverflow";
import { pulseScale } from "../utils/animations";
import { countingNumber } from "../utils/typography";

/**
 * DetailsCard: Professional feature grid + price breakdown.
 * Lateral slide entrances, animated price counter, gold divider glow.
 */
export const DetailsCard: React.FC<ListingVideoProps> = (props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Build feature items
  const features: { icon: string; label: string; value: string; numericValue?: number }[] = [];

  features.push({ icon: "📐", label: "Land Area", value: formatArea(props.plotSize, props.areaUnit) });
  features.push({ icon: "💰", label: "Asking Price", value: formatIndianPrice(props.price), numericValue: props.price });
  features.push({ icon: "📊", label: "Per Sq.ft Rate", value: formatPricePerSqft(props.pricePerSqft), numericValue: props.pricePerSqft });
  features.push({ icon: "🏷️", label: "Plot Category", value: `${props.plotType}` });

  if (props.hasRoadAccess) features.push({ icon: "🛣️", label: "Road Access", value: "Connected ✓" });
  if (props.hasWaterSupply) features.push({ icon: "💧", label: "Water Supply", value: "Available ✓" });
  if (props.hasElectricity) features.push({ icon: "⚡", label: "Electricity", value: "Connected ✓" });
  if (props.hasFencing) features.push({ icon: "🏗️", label: "Boundary", value: "Secured ✓" });

  const headerProgress = spring({
    frame,
    fps,
    config: { damping: 15, mass: 0.8, stiffness: 200, overshootClamping: false },
  });

  // Animated gold divider: width expansion + glow pulse
  const dividerWidth = interpolate(frame, [0, 20], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const dividerGlow = pulseScale(frame, 0.7, 1.0, 60);

  return (
    <AbsoluteFill
      style={{
        background: GRADIENTS.heroGreenDark,
        display: "flex",
        flexDirection: "column",
        padding: `${SAFE.PADDING_SOLID.top}px ${SAFE.PADDING_SOLID.horizontal}px ${SAFE.PADDING_SOLID.bottom}px ${SAFE.PADDING_SOLID.horizontal}px`,
        gap: 24,
      }}
    >
      {/* Header */}
      <div
        style={{
          opacity: headerProgress,
          transform: `translateY(${(1 - headerProgress) * 20}px)`,
          textAlign: "center",
          marginBottom: 8,
        }}
      >
        <div
          style={{
            fontFamily: FONTS.body,
            fontSize: 18,
            fontWeight: 700,
            color: COLORS.gold,
            textTransform: "uppercase",
            letterSpacing: 4,
            marginBottom: 10,
          }}
        >
          Why This Plot?
        </div>
        <div
          style={{
            fontFamily: FONTS.display,
            fontSize: 36,
            fontWeight: 700,
            color: COLORS.white,
            lineHeight: 1.3,
          }}
        >
          {props.area}, {props.city}
        </div>
        <div
          style={{
            fontFamily: FONTS.body,
            fontSize: 16,
            fontWeight: 500,
            color: COLORS.goldLight,
            marginTop: 6,
            letterSpacing: 0.5,
          }}
        >
          Every Detail Verified by BhoomiScan
        </div>
      </div>

      {/* Animated divider line with glow */}
      <div
        style={{
          width: `${dividerWidth}%`,
          height: 2,
          margin: "0 auto",
          background: `linear-gradient(to right, transparent, ${COLORS.gold}, transparent)`,
          opacity: dividerGlow,
          boxShadow: `0 0 ${8 * dividerGlow}px ${COLORS.gold}40`,
        }}
      />

      {/* Features grid — 2 columns with lateral slide */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 16,
          justifyContent: "center",
          flex: 1,
          alignContent: "center",
        }}
      >
        {features.map((feat, i) => {
          const delay = 10 + i * 6;
          const progress = spring({
            frame: frame - delay,
            fps,
            config: { damping: 15, mass: 0.8, stiffness: 200, overshootClamping: false },
          });

          // Lateral slide: odd from left, even from right + slight scale
          const isOdd = i % 2 === 1;
          const slideX = isOdd ? 30 : -30;
          const scaleVal = 0.9 + progress * 0.1;

          // Animated counting for numeric values
          let displayValue = feat.value;
          if (feat.numericValue && feat.label === "Per Sq.ft Rate") {
            const counted = countingNumber(Math.round(feat.numericValue), frame, 20, delay);
            displayValue = `₹${counted.toLocaleString("en-IN")}/ft²`;
          }

          return (
            <div
              key={i}
              style={{
                width: "46%",
                opacity: progress,
                transform: `translateX(${(1 - progress) * slideX}px) scale(${scaleVal})`,
                backgroundColor: "rgba(255, 255, 255, 0.06)",
                borderRadius: 16,
                padding: "18px 20px",
                borderLeft: `3px solid ${COLORS.gold}`,
                display: "flex",
                alignItems: "center",
                gap: 14,
              }}
            >
              <span style={{ fontSize: 30 }}>{feat.icon}</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span
                  style={{
                    fontFamily: FONTS.body,
                    fontSize: 14,
                    fontWeight: 600,
                    color: COLORS.goldLight,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                  }}
                >
                  {feat.label}
                </span>
                <span
                  style={{
                    fontFamily: FONTS.body,
                    fontSize: 24,
                    fontWeight: 700,
                    color: COLORS.white,
                  }}
                >
                  {truncate(displayValue, 12)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
