/**
 * Hindi voiceover script templates — NATURAL CONVERSATIONAL style.
 *
 * v6 improvements for TTS clarity and fluency:
 *   - Commas placed at natural breath points → TTS pauses correctly
 *   - Short-long sentence rhythm → avoids monotone drone
 *   - Ellipsis (...) → converted to SSML <break> pauses by the TTS layer
 *   - Question marks / "ना!" → triggers natural Hindi pitch rise
 *   - Conversational fillers (अरे, सुनिए, देखिए, बताइए, अच्छा) → warmth
 *   - Natural Hindi sentence endings with "है", "ना", "जी" → casual tone
 *   - Mix of Hindi + English words → natural code-switching
 *   - Numbers spelled out in Indian system → lakh/crore pronunciation
 *   - Breathing markers between phrases → pacing control
 *   - Punctuation cues: "।" = finality, "!" = excitement, "?" = curiosity
 */

import { ListingVideoProps } from "../types";
import { ContentRichness } from "../analysis/contentAnalyzer";
import { priceToHindiWords, numberToHindi, rateToHindiWords } from "./hindiNumbers";

export interface ScriptSection {
  sectionId: string;
  text: string;
  estimatedDurationMs: number;
}

/**
 * Price → full Hindi words so TTS speaks naturally.
 * 780000 → "सात लाख अस्सी हज़ार रुपये" (not "7.8 लाख रुपये")
 */
function priceForSpeech(price: number): string {
  return priceToHindiWords(price);
}

/** Per-sqft rate → Hindi words */
function rateForSpeech(rate: number): string {
  return rateToHindiWords(rate);
}

function areaForSpeech(size: number, unit: string): string {
  if (unit === "sq.ft" && size >= 43560) {
    return `${(size / 43560).toFixed(1)} एकड़`;
  }
  return `${numberToHindi(size)} square feet`;
}

/**
 * Estimate Hindi speech duration.
 * v6: ~7 chars/sec (was 8) — accounts for slower detail/number sections.
 * Commas add micro-pauses (~150ms), questions add brief pauses (~200ms).
 */
function estimateDuration(text: string): number {
  const ellipsisCount = (text.match(/\.\.\./g) || []).length;
  const periodCount = (text.match(/।/g) || []).length;
  const commaCount = (text.match(/,/g) || []).length;
  const questionCount = (text.match(/[?ना!]/g) || []).length;
  const pauseMs = ellipsisCount * 350 + periodCount * 300 + commaCount * 150 + questionCount * 200;
  const speechMs = (text.replace(/\.\.\./g, "").length / 7) * 1000;
  return Math.round(speechMs + pauseMs);
}

// ── Hook Generators ─────────────────────────────────────────

/** Multiple hook variants — rotate based on price range for variety */
function generateHook(props: ListingVideoProps, richness: ContentRichness): ScriptSection {
  const price = priceForSpeech(props.price);
  const area = props.area;

  // v6: Better comma placement for TTS breathing + short-long sentence rhythm.
  // Commas after fillers (अरे, सुनिए) give the TTS natural breath points.
  // Short punchy clause + longer descriptive clause = engaging rhythm.
  const hooksByRange: Record<string, string[]> = {
    budget: [
      `अरे सुनिए... ${area} में, एक बढ़िया प्लॉट मिला है... सिर्फ़ ${price} में! BhoomiScan verified।`,
      `ये देखिए... ${area} में प्लॉट आया है... और कीमत? बस ${price}! Documents, सब clear हैं।`,
      `बहुत अच्छी ख़बर है... ${area} में, ${price} का प्लॉट... verified है। ज़रा देखिए तो!`,
    ],
    mid: [
      `देखिए ये! ${area} में, शानदार प्लॉट मिला है... बस ${price}। Documents ready, verification done।`,
      `${area} का ये प्लॉट, देख लीजिए... ${price} में। BhoomiScan ने verify किया है।`,
      `सुनिए ज़रा... ${area} में, एक अच्छा मौका है... ${price} में, प्लॉट available है।`,
    ],
    premium: [
      `${area} का premium प्लॉट... BhoomiScan verified। एक बार, ज़रूर देख लीजिए!`,
      `अगर ${area} में invest करना है... तो ये प्लॉट देखिए। Premium location, ${price}।`,
      `${area} में, ऐसा मौका कम मिलता है... premium plot, title clear, registration ready।`,
    ],
    luxury: [
      `ये मौका, बार बार नहीं आता! ${area} में luxury plot... Title clear, registration ready।`,
      `${area} का सबसे बढ़िया प्लॉट... ${price} में। ये, real opportunity है!`,
      `सुनिए ध्यान से... ${area} में, luxury investment plot आया है... BhoomiScan verified।`,
    ],
  };

  const range = richness.priceRange || "mid";
  const variants = hooksByRange[range] || hooksByRange.mid;
  // Pick variant based on listing ID hash for consistency
  const idx = props.listingId.charCodeAt(0) % variants.length;
  const text = variants[idx];

  return { sectionId: "hook", text, estimatedDurationMs: estimateDuration(text) };
}

// ── Details Generator ─────────────────────────────────────────

function generateDetails(props: ListingVideoProps, richness: ContentRichness): ScriptSection {
  const size = areaForSpeech(props.plotSize, props.areaUnit);
  const feats: string[] = [];
  if (props.hasRoadAccess) feats.push("सड़क");
  if (props.hasWaterSupply) feats.push("पानी");
  if (props.hasElectricity) feats.push("बिजली");
  if (props.hasFencing) feats.push("बाउंड्री");

  // Extra selling points
  const extras: string[] = [];
  if (props.facing) extras.push(`${props.facing} facing`);
  if (props.roadWidth) extras.push(`${props.roadWidth} road`);
  if (props.dimensions) extras.push(props.dimensions);

  // v6: Commas before each feature for TTS to pause and list clearly.
  // Shorter first sentence, then feature list, then reassurance = rhythm.
  let text: string;
  if (richness.featureCount === 0) {
    text = `${size} का प्लॉट है... जगह, एकदम साफ़ है... तुरंत use कर सकते हैं।`;
  } else if (richness.featureCount <= 2) {
    text = `${size} का प्लॉट है... ${feats.join(", और ")} दोनों हैं। सब verified है।`;
  } else {
    text = `सब ready है यहाँ... ${feats.join(", ")}... सब कुछ। ${size} का प्लॉट। Full infrastructure।`;
  }

  // Append extras with comma separation for TTS clarity
  if (extras.length > 0 && text.length < 120) {
    text += ` ${extras.join(", ")}।`;
  }

  return { sectionId: "details", text, estimatedDurationMs: estimateDuration(text) };
}

// ── Context Generator ─────────────────────────────────────────

function generateContext(props: ListingVideoProps, richness: ContentRichness): ScriptSection {
  let text: string;
  if (richness.hasVideo) {
    text = "Site visit का video भी है... ख़ुद आँखों से देख लीजिए... प्लॉट कैसा है।";
  } else if (richness.hasLandmarks && props.landmarks.length > 0) {
    const landmark = props.landmarks[0];
    text = `${landmark} बिल्कुल पास में है... Location बहुत अच्छी है... बताइए क्या चाहिए?`;
  } else {
    text = `ये ${props.city} का तेज़ी से बढ़ता area है... growth potential बहुत अच्छा है!`;
  }

  return { sectionId: "context", text, estimatedDurationMs: estimateDuration(text) };
}

// ── Numbers Generator ─────────────────────────────────────────

function generateNumbers(props: ListingVideoProps): ScriptSection {
  const price = priceForSpeech(props.price);
  const idx = props.listingId.charCodeAt(1) % 3;
  let text: string;
  if (props.pricePerSqft > 0) {
    const sqftRate = rateForSpeech(props.pricePerSqft);
    // v6: Ellipsis before price = anticipation pause. "ना!" at end = rhetorical emphasis.
    const variants = [
      `Price, बात करें तो... ${price}। Per square feet, सिर्फ़ ${sqftRate}। Fair deal है ना!`,
      `कीमत है, बस... ${price}। ये per square feet, ${sqftRate} पड़ता है... area rate से कम!`,
      `अच्छा... price सुनिए... ${price}। Per square feet, सिर्फ़ ${sqftRate}... सोचिए ज़रा!`,
    ];
    text = variants[idx];
  } else {
    const variants = [
      `कीमत है... ${price}। Transparent pricing, कोई hidden charge नहीं। एकदम clear!`,
      `Price, बात करें तो... सिर्फ़ ${price}। सब कुछ transparent है... documents ready!`,
      `बस ${price} में ये plot मिल रहा है... direct deal, कोई extra cost नहीं!`,
    ];
    text = variants[idx];
  }

  return { sectionId: "numbers", text, estimatedDurationMs: estimateDuration(text) };
}

// ── CTA Generator ─────────────────────────────────────────

function generateCTA(props: ListingVideoProps): ScriptSection {
  const name = props.sellerName;
  const idx = props.listingId.charCodeAt(2) % 3;
  let text: string;
  // v6: Commas after "जी" for respectful pause. Short clause + longer clause rhythm.
  if (props.sellerType === "Owner") {
    const variants = [
      `${name} जी, ये direct मालिक हैं। DM में number माँगिए... कोई spam नहीं होगा, बस genuine buyers।`,
      `ये ${name} जी की ज़मीन है, मालिक ख़ुद बेच रहे हैं। DM करें, direct बात होगी।`,
      `${name} जी, direct owner हैं... बिचौलिया नहीं। Number चाहिए तो, DM कीजिए।`,
    ];
    text = variants[idx];
  } else {
    const variants = [
      `Verified agent, ${name} जी से बात कीजिए... भरोसे की बात है, experience है इनको।`,
      `${name} जी, trusted agent हैं। इनसे संपर्क करें, DM में details मिलेंगे।`,
      `ज़मीन देखनी है? ${name} जी, verified agent हैं। DM करें, full support मिलेगा।`,
    ];
    text = variants[idx];
  }

  return { sectionId: "cta", text, estimatedDurationMs: estimateDuration(text) };
}

// ── Branding Generator ─────────────────────────────────────────

function generateBranding(props: ListingVideoProps): ScriptSection {
  const idx = props.listingId.charCodeAt(3) % 4;
  const variants = [
    "bhoomiscan.in पर जाइए... अपनी ज़मीन free में list करें!",
    "bhoomiscan.in... ज़मीन बेचनी हो या ख़रीदनी... यहाँ सब मिलेगा!",
    "अपनी property bhoomiscan.in पर list करें... बिल्कुल free है!",
    "bhoomiscan.in... verified plots... trusted platform। आज ही जुड़िए!",
  ];
  const text = variants[idx];
  return { sectionId: "branding", text, estimatedDurationMs: estimateDuration(text) };
}

// ── Main Generator ─────────────────────────────────────────────

export function generateIntelligentScript(
  props: ListingVideoProps,
  richness: ContentRichness
): ScriptSection[] {
  const sections = [
    generateHook(props, richness),
    generateDetails(props, richness),
    generateContext(props, richness),
    generateNumbers(props),
    generateCTA(props),
    generateBranding(props),
  ];

  // Safety: Hindi Devanagari needs higher char limit
  let totalChars = sections.reduce((sum, s) => sum + s.text.length, 0);
  if (totalChars > 900) {
    for (const trimId of ["context", "details"]) {
      if (totalChars <= 900) break;
      const sec = sections.find((s) => s.sectionId === trimId);
      if (sec && sec.text.length > 30) {
        const excess = totalChars - 900;
        const newLen = Math.max(20, sec.text.length - excess);
        sec.text = sec.text.slice(0, newLen - 1).trimEnd() + "।";
        sec.estimatedDurationMs = estimateDuration(sec.text);
        totalChars = sections.reduce((sum, s) => sum + s.text.length, 0);
      }
    }
  }

  return sections;
}
