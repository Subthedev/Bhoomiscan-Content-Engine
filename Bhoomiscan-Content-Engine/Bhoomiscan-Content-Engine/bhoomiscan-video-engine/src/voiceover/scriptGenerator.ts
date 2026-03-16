/**
 * Hindi voiceover script generator.
 * Produces conversational Hindi (Devanagari) scripts for property listings.
 */

import { ListingVideoProps } from "../types";
import { ContentRichness } from "../analysis/contentAnalyzer";
import { generateIntelligentScript, ScriptSection } from "./scriptTemplates";
import { priceToHindiWords, numberToHindi, rateToHindiWords } from "./hindiNumbers";

/** Price → full Hindi words: 780000 → "सात लाख अस्सी हज़ार रुपये" */
function priceForSpeech(price: number): string {
  return priceToHindiWords(price);
}

function areaForSpeech(size: number, unit: string): string {
  if (unit === "sq.ft" && size >= 43560) {
    return `${(size / 43560).toFixed(1)} एकड़`;
  }
  return `${numberToHindi(size)} ${unit}`;
}

/**
 * Generate a concise Hindi voiceover script.
 * This is the legacy single-string version, kept for backward compat.
 */
export function generateScript(props: ListingVideoProps): string {
  const parts: string[] = [];

  // 1. Hook
  parts.push(
    `${props.area} में ${props.plotType.toLowerCase()} प्लॉट ${priceForSpeech(props.price)} में उपलब्ध है।`
  );

  // 2. Property details
  const details: string[] = [];
  details.push(`प्लॉट का साइज़ ${areaForSpeech(props.plotSize, props.areaUnit)} है`);

  const feats: string[] = [];
  if (props.hasRoadAccess) feats.push("सड़क");
  if (props.hasWaterSupply) feats.push("पानी");
  if (props.hasElectricity) feats.push("बिजली");
  if (props.hasFencing) feats.push("फेंसिंग");
  if (feats.length > 0) {
    details.push(`${feats.join(", ")} की सुविधा है`);
  }
  parts.push(details.join(", ") + "।");

  // 3. Context
  if (props.videoUrl) {
    parts.push(`साइट विज़िट वीडियो देखिए। बहुत अच्छी लोकेशन है।`);
  } else {
    parts.push(`${props.city} के तेज़ी से बढ़ते एरिया में ये प्लॉट है।`);
  }

  // 4. Numbers
  const rateStr = props.pricePerSqft > 0
    ? ` प्रति square feet सिर्फ़ ${rateToHindiWords(props.pricePerSqft)}।`
    : "";
  parts.push(`कीमत ${priceForSpeech(props.price)}।${rateStr}`);

  // 5. Seller CTA
  const role = props.sellerType === "Owner" ? "मालिक" : "एजेंट";
  parts.push(`${props.sellerName} जी, ${role} द्वारा लिस्ट किया गया। DM करें।`);

  // 6. Branding
  parts.push(`bhoomiscan.in पर फ़्री लिस्टिंग करें।`);

  let script = parts.join(" ");

  // Safety: truncate at sentence boundary
  if (script.length > 600) {
    script = script.substring(0, 600);
    const lastDot = script.lastIndexOf("।");
    if (lastDot > 200) {
      script = script.substring(0, lastDot + 1);
    }
  }

  return script;
}

/**
 * Generate a timed script using intelligent Hindi templates.
 */
export function generateTimedScript(
  props: ListingVideoProps,
  richness: ContentRichness
): ScriptSection[] {
  const sections = generateIntelligentScript(props, richness);
  if (sections.length === 0) {
    const text = generateScript(props);
    return [{ sectionId: "full", text, estimatedDurationMs: Math.round((text.length / 8) * 1000) }];
  }
  return sections;
}
