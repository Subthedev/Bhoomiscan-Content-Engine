/**
 * Data-driven script templates that select variants based on ContentRichness.
 * Conversational Odia with natural connectors and breathing cues.
 */

import { ListingVideoProps } from "../types";
import { ContentRichness } from "../analysis/contentAnalyzer";
import type { GeoData } from "../geo/types";

export interface ScriptSection {
  sectionId: string;
  text: string;
  estimatedDurationMs: number;
}

const CRORE = 10_000_000;
const LAKH = 100_000;

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

/** Estimate duration at ~10 chars/sec for Odia at 0.95x pace */
function estimateDuration(text: string): number {
  return Math.round((text.length / 10) * 1000);
}

function generateHook(props: ListingVideoProps, richness: ContentRichness): ScriptSection {
  let text: string;
  const plotType = props.plotType.toLowerCase();
  const price = priceForSpeech(props.price);
  const area = props.area;

  switch (richness.priceRange) {
    case "budget":
      text = `Aapananka paain, ${area} re plot ${price} re achhi. BhoomiScan dwara verified.`;
      break;
    case "mid":
      text = `Dekhantu, ${area} re ${plotType} plot. Mulya, maatra ${price}. Sabu document ready.`;
      break;
    case "premium":
      text = `${area} ra premium ${plotType} plot. BhoomiScan verified listing. Dekhantu...`;
      break;
    case "luxury":
      text = `${area} re luxury ${plotType} investment. Title clear, registration ready. Bahut bhala opportunity!`;
      break;
  }

  return { sectionId: "hook", text, estimatedDurationMs: estimateDuration(text) };
}

function generateDetails(props: ListingVideoProps, richness: ContentRichness): ScriptSection {
  const size = areaForSpeech(props.plotSize, props.areaUnit);
  const feats: string[] = [];
  if (props.hasRoadAccess) feats.push("rasta");
  if (props.hasWaterSupply) feats.push("pani");
  if (props.hasElectricity) feats.push("bijuli");
  if (props.hasFencing) feats.push("fencing");

  let text: string;
  if (richness.featureCount === 0) {
    text = `${size} ra plot. Jagaa sapha achhi, ready for use.`;
  } else if (richness.featureCount <= 2) {
    text = `Aau sunibe, ${size} plot, ${feats.join(" aur ")} sahita. Sabukichhi verified.`;
  } else {
    text = `Sabukichhi ready - ${feats.join(", ")}. ${size} ra plot. Jaanintu ki, sabu infrastructure achhi.`;
  }

  return { sectionId: "details", text, estimatedDurationMs: estimateDuration(text) };
}

function generateContext(props: ListingVideoProps, richness: ContentRichness): ScriptSection {
  let text: string;
  if (richness.hasVideo) {
    text = "Site visit video dekhantu. Nijaku dekhibe, plot kemiti achhi.";
  } else if (richness.hasLandmarks && props.landmarks.length > 0) {
    const landmark = props.landmarks[0];
    text = `${landmark} tharu paase. Badhia location, growing area.`;
  } else {
    text = `${props.city} ra fastest growing area re eha plot achhi.`;
  }

  return { sectionId: "context", text, estimatedDurationMs: estimateDuration(text) };
}

function generateNumbers(props: ListingVideoProps): ScriptSection {
  const price = priceForSpeech(props.price);
  let text: string;
  if (props.pricePerSqft > 0) {
    text = `Mulya, ${price}. Matlab, ${Math.round(props.pricePerSqft)} taka per sq.ft. Fair price, transparent.`;
  } else {
    text = `Mulya, ${price}. Transparent pricing, kichhi hidden nahni.`;
  }

  return { sectionId: "numbers", text, estimatedDurationMs: estimateDuration(text) };
}

function generateCTA(props: ListingVideoProps): ScriptSection {
  const name = props.sellerName;
  let text: string;
  if (props.sellerType === "Owner") {
    text = `${name}, direct malik. DM karantu apana number, spam nahni heba.`;
  } else {
    text = `Verified agent ${name} sahita contact karantu. Bharosa karantu.`;
  }

  return { sectionId: "cta", text, estimatedDurationMs: estimateDuration(text) };
}

function generateBranding(): ScriptSection {
  const text = "bhoomiscan.in re apana jami free re list karantu. Aaji hi try karantu!";
  return { sectionId: "branding", text, estimatedDurationMs: estimateDuration(text) };
}

function generateMapNarration(
  props: ListingVideoProps,
  richness: ContentRichness
): ScriptSection | null {
  if (richness.geoTier === "none") return null;

  const geoData = props.geoData as GeoData | undefined;
  let text: string;

  if (geoData?.amenities && geoData.amenities.length >= 2) {
    const sorted = geoData.amenities.slice(0, 3);
    const mentions = sorted.map((a) => `${a.label} ${a.distanceKm}km`).join(", ");
    text = `Dekhantu, ${props.city} re eha plot ra location. Paase re ${mentions} achhi. Badhia connectivity!`;
  } else if (richness.geoTier === "full" && geoData?.landmarks && geoData.landmarks.length > 0) {
    const landmark = geoData.landmarks[0];
    text = `Dekhantu, ${props.city} re ${props.area} ra location. ${landmark.name} tharu ${landmark.distanceKm} km paase.`;
  } else {
    text = `Eha plot ${props.city}, ${props.state} re achhi. Badhia location.`;
  }

  return { sectionId: "map", text, estimatedDurationMs: estimateDuration(text) };
}

/**
 * Generate an intelligent script composed of sections, each with timing estimates.
 */
export function generateIntelligentScript(
  props: ListingVideoProps,
  richness: ContentRichness
): ScriptSection[] {
  const mapSection = generateMapNarration(props, richness);
  const sections = [
    generateHook(props, richness),
    ...(mapSection ? [mapSection] : []),
    generateDetails(props, richness),
    generateContext(props, richness),
    generateNumbers(props),
    generateCTA(props),
    generateBranding(),
  ];

  // Safety: ensure total text under 600 chars (per-section TTS handles longer scripts)
  let totalChars = sections.reduce((sum, s) => sum + s.text.length, 0);
  if (totalChars > 600) {
    // Trim from the context section first, then details
    for (const trimId of ["context", "details"]) {
      if (totalChars <= 600) break;
      const sec = sections.find((s) => s.sectionId === trimId);
      if (sec && sec.text.length > 30) {
        const excess = totalChars - 600;
        const newLen = Math.max(20, sec.text.length - excess);
        sec.text = sec.text.slice(0, newLen - 1).trimEnd() + ".";
        sec.estimatedDurationMs = estimateDuration(sec.text);
        totalChars = sections.reduce((sum, s) => sum + s.text.length, 0);
      }
    }
  }

  return sections;
}
