import { ListingVideoProps } from "../types";
import { ContentRichness } from "../analysis/contentAnalyzer";
import { generateIntelligentScript, ScriptSection } from "./scriptTemplates";

const CRORE = 10_000_000;
const LAKH = 100_000;

/** Short price format for voiceover (no symbol — spoken as words) */
function priceForSpeech(price: number): string {
  if (price >= CRORE) return `${(price / CRORE).toFixed(1)} crore taka`;
  if (price >= LAKH) return `${(price / LAKH).toFixed(1)} lakh taka`;
  return `${Math.round(price / 1000)} hajar taka`;
}

function areaForSpeech(size: number, unit: string): string {
  if (unit === "sq.ft" && size >= 43560) {
    return `${(size / 43560).toFixed(1)} acre`;
  }
  return `${size.toLocaleString("en-IN")} ${unit}`;
}

/**
 * Generate a concise Odia voiceover script (max ~480 chars).
 * This is the legacy single-string version, kept for backward compat.
 */
export function generateScript(props: ListingVideoProps): string {
  const parts: string[] = [];

  // 1. Hook
  parts.push(
    `${props.area} re ${props.plotType.toLowerCase()} plot ${priceForSpeech(props.price)} re bikri achhi.`
  );

  // 2. Property details
  const details: string[] = [];
  details.push(`Plot size ${areaForSpeech(props.plotSize, props.areaUnit)}`);

  const feats: string[] = [];
  if (props.hasRoadAccess) feats.push("rasta");
  if (props.hasWaterSupply) feats.push("pani");
  if (props.hasElectricity) feats.push("bijuli");
  if (props.hasFencing) feats.push("fencing");
  if (feats.length > 0) {
    details.push(`${feats.join(", ")} achhi`);
  }
  parts.push(details.join(", ") + ".");

  // 3. Walkthrough / location context
  if (props.videoUrl) {
    parts.push(`Dekhantu site visit video. Location bahut bhala.`);
  } else {
    parts.push(`${props.city} ra growing area re eha plot achhi.`);
  }

  // 4. Numbers recap
  const rateStr = props.pricePerSqft > 0
    ? ` Per sqft ${Math.round(props.pricePerSqft)} taka.`
    : "";
  parts.push(`Price ${priceForSpeech(props.price)}.${rateStr}`);

  // 5. Seller CTA
  const role = props.sellerType === "Owner" ? "malik" : "broker";
  parts.push(`${props.sellerName}, ${role} dwara listed. DM karantu.`);

  // 6. Branding
  parts.push(`bhoomiscan.in re free listing karantu.`);

  let script = parts.join(" ");

  // Safety: truncate to 495 chars at last sentence boundary
  if (script.length > 495) {
    script = script.substring(0, 495);
    const lastDot = script.lastIndexOf(".");
    if (lastDot > 200) {
      script = script.substring(0, lastDot + 1);
    }
  }

  return script;
}

/**
 * Generate a timed script using intelligent templates.
 * Returns ScriptSection[] with per-section timing estimates.
 */
export function generateTimedScript(
  props: ListingVideoProps,
  richness: ContentRichness
): ScriptSection[] {
  const sections = generateIntelligentScript(props, richness);
  if (sections.length === 0) {
    // Fallback to legacy script as a single section
    const text = generateScript(props);
    return [{ sectionId: "full", text, estimatedDurationMs: Math.round((text.length / 10) * 1000) }];
  }
  return sections;
}
