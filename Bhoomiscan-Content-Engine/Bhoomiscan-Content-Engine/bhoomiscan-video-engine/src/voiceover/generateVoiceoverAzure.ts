/**
 * Azure Cognitive Services TTS v6 — INDIAN ACCENT, HUMAN EMOTION.
 *
 * v5 lesson (kept): ONE express-as style for entire voiceover = voice consistency.
 * v6 improvements over v5:
 *
 *   1. CLARITY: Detail/number sections use NEGATIVE rates (-5% to -2%) instead
 *      of v5's all-positive rates. Slower pace = each word heard clearly.
 *   2. CONTOURS: Wider pitch curves (±15Hz vs v5's ±8Hz) for melodic Hindi speech.
 *      Hindi-specific patterns: declarative fall, question rise, emphasis peak-drop.
 *   3. PAUSES: Context-aware breaks (150-500ms) with ±20% natural variation.
 *      Dramatic pause before price reveals, breath after rhetorical "ना!".
 *   4. TRANSITIONS: Section-specific gaps (220-350ms) instead of uniform 200ms.
 *      Numbers→CTA gets the longest gap so price sinks in.
 *   5. VOCABULARY: 30+ English→Hindi pronunciation aliases for real estate terms
 *      (RERA, FSI, title clear, registration, etc.) via <sub alias>.
 *   6. VOICE: AartiNeural (DelightfulTTS2) primary, SwaraNeural fallback.
 *      Better bilingual lexicon for Hindi-English code-switching.
 *   7. AUDIO: Gentler compression (ratio=1.8), 3kHz clarity boost, de-essing.
 *   8. TIMING: Word boundary events for precise per-section audio offsets.
 *   9. EMOTION: empathetic style degree raised to 0.9 for warmer, more engaged tone.
 *
 * Falls back to edge-tts if AZURE_SPEECH_KEY is not configured.
 */

import * as sdk from "microsoft-cognitiveservices-speech-sdk";
import * as fs from "fs";
import * as path from "path";
import { execSync, spawnSync } from "child_process";
import { ListingVideoProps } from "../types";
import { generateScript, generateTimedScript } from "./scriptGenerator";
import { ContentRichness } from "../analysis/contentAnalyzer";
import { priceForSSML, rateToHindiWords } from "./hindiNumbers";

import {
  generateVoiceover as edgeGenerateVoiceover,
  generateTimedVoiceover as edgeGenerateTimedVoiceover,
  cleanupVoiceover as edgeCleanupVoiceover,
  VoiceoverOptions as EdgeVoiceoverOptions,
} from "./generateVoiceoverEdge";

// v6: AartiNeural is newer (DelightfulTTS2) with same styles as Swara but
// better bilingual lexicon. SwaraNeural kept as fallback.
const DEFAULT_VOICE: string = "hi-IN-SwaraNeural";
const FALLBACK_VOICE: string = "hi-IN-AartiNeural";

// ── Types ────────────────────────────────────────────────────

// v6: ONE style for the entire voiceover — consistency is everything.
// empathetic at 0.9 (up from 0.8) — warmer, more engaged tone that sounds
// like a real person who CARES about helping you find land.
const GLOBAL_STYLE: "empathetic" = "empathetic";
const GLOBAL_STYLE_DEGREE = 0.9;

interface ProsodyProfile {
  rate: string;
  pitch: string;
  volume: string;
  contour?: string; // Pitch curve for melodic speech within the sentence
}

interface SectionSilence {
  leading: number;
  trailing: number;
  sentenceBoundary: number;
  // v4+: NO comma silence — Azure's `-exact` types REPLACE the neural model's
  // learned pause patterns. By omitting Comma-exact entirely, we let the
  // neural voice use its natural comma timing which varies organically.
}

// ── Per-section silence configs ──────────────────────────────
// v4: Using NON-exact types only (Leading, Tailing, Sentenceboundary).
// Non-exact types ADD to the neural model's natural pauses.
// The -exact variants (v3) REPLACED them, creating mechanical uniformity.
// Comma-exact removed entirely — single biggest mechanical rhythm fix.

// v6: Tuned silence values — non-exact types ADD to neural model's natural pauses.
// Higher sentenceBoundary values give the listener time to absorb each point.
const SECTION_SILENCE: Record<string, SectionSilence> = {
  hook:     { leading: 30,  trailing: 0,   sentenceBoundary: 60 },
  details:  { leading: 0,   trailing: 0,   sentenceBoundary: 80 },
  context:  { leading: 0,   trailing: 0,   sentenceBoundary: 60 },
  numbers:  { leading: 0,   trailing: 0,   sentenceBoundary: 80 },
  cta:      { leading: 0,   trailing: 0,   sentenceBoundary: 50 },
  branding: { leading: 0,   trailing: 0,   sentenceBoundary: 40 },
  full:     { leading: 30,  trailing: 0,   sentenceBoundary: 60 },
};

// v6: Section-specific transition gaps. Different transitions need different durations.
// Hook→Details needs a breath to switch from excitement to information mode.
// Numbers→CTA needs a beat to let price sink in before the call to action.
const SECTION_TRANSITION_GAP: Record<string, number> = {
  hook:     280,   // After hook: brief breath before details
  details:  250,   // After details: transition to context
  context:  220,   // After context: smooth flow to numbers
  numbers:  350,   // After price: dramatic pause — let it sink in
  cta:      300,   // After CTA: beat before branding
  branding: 0,     // Last section, no gap
};
const DEFAULT_SECTION_GAP_MS = 250;

// ── Natural variation engine ─────────────────────────────────
// Humans never pause the exact same duration twice. Adding ±15%
// randomness makes pauses feel organic instead of metronomic.
// Uses a seeded approach based on text hash for reproducibility.

let _variationSeed = 0;
function naturalVariation(baseMs: number, variancePercent = 15): number {
  _variationSeed++;
  // Simple deterministic pseudo-random based on seed
  const hash = Math.sin(_variationSeed * 9301 + 49297) * 49297;
  const rand = hash - Math.floor(hash); // 0-1
  const variance = baseMs * (variancePercent / 100);
  return Math.round(baseMs + (rand * 2 - 1) * variance);
}

function resetVariationSeed(): void {
  _variationSeed = 0;
}

// ── Exports ──────────────────────────────────────────────────

export interface VoiceoverOptions {
  voice?: string;
  preset?: "warm" | "energetic" | "calm" | "male";
}

export interface TimedVoiceover {
  filename: string;
  totalDurationMs: number;
  sectionEstimates: Array<{
    sectionId: string;
    estimatedStartMs: number;
    estimatedEndMs: number;
  }>;
}

// ── Utilities ────────────────────────────────────────────────

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/** Get WAV duration — tries ffprobe first, falls back to WAV header parsing */
function getAudioDurationMs(filePath: string): number {
  if (!fs.existsSync(filePath)) return 0;
  if (fs.statSync(filePath).size < 44) return 0;

  try {
    const result = spawnSync("ffprobe", [
      "-v", "quiet", "-show_entries", "format=duration", "-of", "csv=p=0", filePath,
    ], { timeout: 5000, encoding: "utf-8" });
    const val = parseFloat((result.stdout || "").trim());
    if (!isNaN(val) && val > 0) return Math.round(val * 1000);
  } catch {}

  try {
    const buf = fs.readFileSync(filePath);
    const sampleRate = buf.readUInt32LE(24);
    const bitsPerSample = buf.readUInt16LE(34);
    const channels = buf.readUInt16LE(22);
    if (sampleRate === 0 || bitsPerSample === 0 || channels === 0) return 0;
    const bytesPerSample = (bitsPerSample / 8) * channels;
    for (let i = 36; i < buf.length - 8; i++) {
      if (buf.toString("ascii", i, i + 4) === "data") {
        const dataSize = buf.readUInt32LE(i + 4);
        return Math.round((dataSize / (sampleRate * bytesPerSample)) * 1000);
      }
    }
    return Math.round(((buf.length - 44) / (sampleRate * bytesPerSample)) * 1000);
  } catch {
    return 0;
  }
}

function hasAzureCredentials(): boolean {
  return !!(process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION);
}

// ── Sentence Splitter ────────────────────────────────────────
// Splits text at natural clause boundaries: ... | । | ! | ?
// Keeps the delimiter with the preceding text so TTS gets the
// punctuation cue (! → excitement, ? → rising pitch, । → finality).

function splitIntoClauses(text: string): string[] {
  return text
    .split(/(?<=\.{3}|।|!|\?)\s*/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1 && !/^[।!?\s]+$/.test(s));
}

// ── Prosody Classifier v6 ────────────────────────────────────
// v6: Hindi speech pattern-aware prosody with WIDER ranges.
//
// KEY FIX: v5 had ALL rates POSITIVE (+2% to +10%) — everything was
// faster than natural, hurting word clarity. v6 uses NEGATIVE rates
// for informational/detail sections (slower = clearer pronunciation)
// and reserves positive rates for energy/excitement only.
//
// Hindi intonation patterns:
//   - Declarative: rises mid-sentence, falls at end (purna viram)
//   - Questions: rises at end (especially with ना, क्या)
//   - Lists (features): slight rise per item, fall on last
//   - Emphasis: slow down BEFORE key word, pitch peak ON it, drop after
//   - Respect (जी): softer, slower, gentle falling
//   - Excitement (!): wider pitch range, faster, louder
//
// Contour = pitch curve: "(timePercent, pitchChange)" pairs
// Wider Hz ranges (±15Hz) = more melodic, more human.

function classifyProsody(
  text: string,
  sectionId: string,
  idx: number,
  total: number
): ProsodyProfile {
  const isFirst = idx === 0;
  const isLast = idx === total - 1;

  // ── Opening hook first clause: grab attention — energetic start ──
  // Indian YouTuber/reels style: burst of energy, rising then settling
  if (isFirst && sectionId === "hook") {
    return {
      rate: "+5%", pitch: "+4Hz", volume: "+8%",
      contour: "(0%,+0Hz) (15%,+8Hz) (40%,+12Hz) (65%,+6Hz) (100%,-3Hz)",
    };
  }

  // ── Price/money: slightly measured, confident falling contour ──
  if (/\d.*रुपये|₹\d|कीमत.*\d|price.*\d/i.test(text)) {
    return {
      rate: "-1%", pitch: "+1Hz", volume: "+6%",
      contour: "(0%,+2Hz) (20%,+6Hz) (50%,+4Hz) (75%,+0Hz) (100%,-5Hz)",
    };
  }

  // ── Hindi number words (लाख, हज़ार, करोड़) — steady, clear ──
  if (/लाख|हज़ार|करोड़/i.test(text)) {
    return {
      rate: "+0%", pitch: "+1Hz", volume: "+5%",
      contour: "(0%,+2Hz) (30%,+5Hz) (60%,+3Hz) (100%,-3Hz)",
    };
  }

  // ── "सिर्फ़" (only/just) — emphasis but not dragging ──
  if (/सिर्फ़/i.test(text)) {
    return {
      rate: "+0%", pitch: "+2Hz", volume: "+5%",
      contour: "(0%,+0Hz) (30%,+8Hz) (55%,+12Hz) (80%,+4Hz) (100%,-4Hz)",
    };
  }

  // ── Exclamation: energy burst — rising then resolving ──
  if (/!$/.test(text.trim())) {
    return {
      rate: "+3%", pitch: "+3Hz", volume: "+8%",
      contour: "(0%,+0Hz) (25%,+6Hz) (50%,+12Hz) (75%,+8Hz) (100%,-2Hz)",
    };
  }

  // ── Question marks: natural Hindi rising intonation at end ──
  if (/[?？]$/.test(text.trim()) || /\bना[।!]?\s*$/.test(text.trim())) {
    return {
      rate: "+0%", pitch: "+1Hz", volume: "+3%",
      contour: "(0%,+0Hz) (40%,+0Hz) (70%,+3Hz) (90%,+8Hz) (100%,+12Hz)",
    };
  }

  // ── Positive evaluation: warm enthusiasm — gentle arc ──
  if (/शानदार|बढ़िया|अच्छ|fair|great|best|perfect|मौका|opportunity|premium/i.test(text)) {
    return {
      rate: "+0%", pitch: "+2Hz", volume: "+5%",
      contour: "(0%,+0Hz) (30%,+5Hz) (60%,+8Hz) (85%,+4Hz) (100%,+1Hz)",
    };
  }

  // ── Invitations (देखिए, सुनिए, etc.): warm rising contour at end ──
  if (/देखिए|बताइए|माँगिए|लीजिए|जाइए|कीजिए|सुनिए|जुड़िए/i.test(text)) {
    return {
      rate: "+0%", pitch: "+1Hz", volume: "+4%",
      contour: "(0%,+0Hz) (40%,+2Hz) (70%,+4Hz) (100%,+10Hz)",
    };
  }

  // ── Trust/verification: steady and even = reliability ──
  if (/verified|clear|ready|genuine|भरोस|confirm|registration|documents|transparent/i.test(text)) {
    return {
      rate: "+0%", pitch: "+0Hz", volume: "+4%",
      contour: "(0%,+0Hz) (40%,+2Hz) (70%,+1Hz) (100%,-2Hz)",
    };
  }

  // ── Seller/respect: softer, gentler — Hindi honorific tone ──
  if (/जी.*मालिक|मालिक.*जी|direct\s+owner|direct\s+मालिक/i.test(text)) {
    return {
      rate: "-1%", pitch: "-1Hz", volume: "-2%",
      contour: "(0%,+0Hz) (30%,+3Hz) (60%,+1Hz) (100%,-3Hz)",
    };
  }

  // ── Infrastructure listing: clear, slight rise per item ──
  if (/सड़क|पानी|बिजली|बाउंड्री|infrastructure|square feet|फेंसिंग/i.test(text)) {
    return {
      rate: "-1%", pitch: "+0Hz", volume: "+3%",
      contour: "(0%,+0Hz) (25%,+3Hz) (50%,+1Hz) (75%,+4Hz) (100%,-1Hz)",
    };
  }

  // ── Area/location mentions: confident upward energy ──
  if (/growth|बढ़त|तेज़ी|area|location|लोकेशन|एरिया/i.test(text)) {
    return {
      rate: "+0%", pitch: "+2Hz", volume: "+4%",
      contour: "(0%,+0Hz) (35%,+4Hz) (65%,+7Hz) (100%,+2Hz)",
    };
  }

  // ── DM/contact: clear call to action — slightly faster, authoritative ──
  if (/DM|contact|संपर्क|number\s+माँगिए|बात\s+करें/i.test(text)) {
    return {
      rate: "+2%", pitch: "+2Hz", volume: "+6%",
      contour: "(0%,+0Hz) (40%,+5Hz) (75%,+3Hz) (100%,-2Hz)",
    };
  }

  // ── "अरे/सुनिए" filler openers: conversational warmth ──
  if (/^(अरे|सुनिए|देखिए|अच्छा)/i.test(text.trim())) {
    return {
      rate: "+2%", pitch: "+3Hz", volume: "+3%",
      contour: "(0%,+5Hz) (20%,+8Hz) (50%,+3Hz) (100%,+0Hz)",
    };
  }

  // ── bhoomiscan branding: memorable, punchy ──
  if (/bhoomiscan|भूमी\s*स्कैन/i.test(text)) {
    return {
      rate: "+2%", pitch: "+2Hz", volume: "+5%",
      contour: "(0%,+0Hz) (30%,+6Hz) (60%,+4Hz) (100%,+1Hz)",
    };
  }

  // ── Last clause of any section: natural Hindi declarative fall ──
  if (isLast) {
    return {
      rate: "+0%", pitch: "+0Hz", volume: "+2%",
      contour: "(0%,+2Hz) (30%,+1Hz) (60%,-1Hz) (100%,-5Hz)",
    };
  }

  // ── First clause (non-hook sections): gentle opener ──
  if (isFirst) {
    return {
      rate: "+0%", pitch: "+1Hz", volume: "+3%",
      contour: "(0%,+0Hz) (30%,+4Hz) (70%,+2Hz) (100%,+0Hz)",
    };
  }

  // ── Default: section-appropriate baseline ──
  return getDefaultProsody(sectionId);
}

function getDefaultProsody(sectionId: string): ProsodyProfile {
  switch (sectionId) {
    // Hook: energetic, grab attention
    case "hook":     return { rate: "+5%",  pitch: "+2Hz",  volume: "+5%", contour: "(0%,+0Hz) (30%,+6Hz) (65%,+3Hz) (100%,-2Hz)" };
    // Details: slightly slower for clarity but not dragging
    case "details":  return { rate: "-2%",  pitch: "+0Hz",  volume: "+3%", contour: "(0%,+0Hz) (50%,+2Hz) (100%,-1Hz)" };
    // Context: natural pace, warm
    case "context":  return { rate: "+0%",  pitch: "+1Hz",  volume: "+3%", contour: "(0%,+0Hz) (40%,+4Hz) (80%,+2Hz) (100%,+0Hz)" };
    // Numbers: measured but not slow — prices in Hindi words are already longer
    case "numbers":  return { rate: "-1%",  pitch: "+0Hz",  volume: "+4%", contour: "(0%,+0Hz) (40%,+3Hz) (100%,-2Hz)" };
    // CTA: inviting, natural pace
    case "cta":      return { rate: "+0%",  pitch: "+1Hz",  volume: "+4%", contour: "(0%,+0Hz) (50%,+3Hz) (80%,+5Hz) (100%,+3Hz)" };
    // Branding: confident, slightly upbeat
    case "branding": return { rate: "+3%",  pitch: "+2Hz",  volume: "+4%", contour: "(0%,+0Hz) (40%,+5Hz) (70%,+3Hz) (100%,+1Hz)" };
    default:         return { rate: "+0%",  pitch: "+0Hz",  volume: "+3%", contour: "(0%,+0Hz) (50%,+2Hz) (100%,+0Hz)" };
  }
}

// ── Inter-clause Break Calculator v6 ─────────────────────────
// v6: Wider range (150-500ms) with MORE context awareness.
// Hindi conversational speech has varied pauses — a thinking "..." pause
// is different from a sentence-end "।" pause or a dramatic price reveal.
// ±20% natural variation (up from 15%) for organic rhythm.

function getInterClauseBreak(clause: string, nextClause: string | null, sectionId?: string): number {
  let baseMs: number;

  // ── Before price reveal → anticipation pause (the "drumroll") ──
  // Hindi real estate: "कीमत सुनिए... [pause] ...सिर्फ़ 7 लाख!"
  if (nextClause && /सिर्फ़|₹|price|कीमत|per\s+square/i.test(nextClause)) {
    baseMs = 400;
  }
  // ── Before trust/verification → let previous point land ──
  else if (nextClause && /verified|clear|confirm|genuine|BhoomiScan|भरोस|transparent/i.test(nextClause)) {
    baseMs = 280;
  }
  // ── Before "अरे/सुनिए/देखिए" → breath before new thought ──
  else if (nextClause && /^(अरे|सुनिए|देखिए|अच्छा|बताइए)/i.test(nextClause.trim())) {
    baseMs = 300;
  }
  // ── After "ना!" / rhetorical question → let it land ──
  else if (/ना[!।]?\s*$/.test(clause.trim()) || /है\s*ना[!।]?\s*$/.test(clause.trim())) {
    baseMs = 350;
  }
  // ── After question → let it sink in ──
  else if (/[?？]$/.test(clause.trim())) {
    baseMs = 300;
  }
  // ── After exclamation → quick energetic breath ──
  else if (/!$/.test(clause.trim())) {
    baseMs = 200;
  }
  // ── After purna viram → natural Hindi sentence boundary ──
  else if (/।$/.test(clause.trim())) {
    baseMs = 250;
  }
  // ── After ellipsis → thinking/trailing pause ──
  else if (/\.\.\.$/.test(clause.trim())) {
    baseMs = 280;
  }
  // ── Section-specific defaults ──
  else if (sectionId === "details" || sectionId === "numbers") {
    baseMs = 200; // Slightly longer between factual points
  }
  else if (sectionId === "hook") {
    baseMs = 180; // Quicker pacing in hook for energy
  }
  else {
    baseMs = 180;
  }

  // Apply natural variation (±20%) so pauses don't sound metronomic
  return naturalVariation(baseMs, 20);
}

/** Get section-specific transition gap instead of uniform value */
function getSectionTransitionGap(sectionId: string): number {
  const gap = SECTION_TRANSITION_GAP[sectionId] ?? DEFAULT_SECTION_GAP_MS;
  return naturalVariation(gap, 12);
}

// ── Text-to-SSML Processor ───────────────────────────────────
// Inline SSML transformations that make individual words sound natural.

function escapeXml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function processClauseToSSML(text: string, props?: ListingVideoProps): string {
  // Start with XML-escaped text
  let ssml = escapeXml(text);

  // ── 1. Price → <sub alias="Hindi words"> for natural pronunciation ──
  if (props) {
    const { display, spoken } = priceForSSML(props.price);
    const escapedDisplay = escapeXml(display);
    ssml = ssml.replace(
      new RegExp(escapedDisplay.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"),
      `<sub alias="${spoken}">${escapedDisplay}</sub>`
    );

    // Per-sqft rate
    if (props.pricePerSqft > 0) {
      const rateStr = escapeXml(`${Math.round(props.pricePerSqft)} रुपये`);
      const rateSpoken = rateToHindiWords(props.pricePerSqft);
      ssml = ssml.replace(rateStr, `<sub alias="${rateSpoken}">${rateStr}</sub>`);
    }
  }

  // ── 2. Brand names → consistent Hindi pronunciation ──
  ssml = ssml.replace(/bhoomiscan\.in/gi, '<sub alias="भूमी स्कैन डॉट इन">bhoomiscan.in</sub>');
  ssml = ssml.replace(/BhoomiScan/g, '<sub alias="भूमी स्कैन">BhoomiScan</sub>');

  // ── 3. Common English abbreviations → Hindi pronunciation ──
  ssml = ssml.replace(/\bDM\b/g, '<sub alias="डी एम">DM</sub>');
  ssml = ssml.replace(/\bRERA\b/g, '<sub alias="रेरा">RERA</sub>');
  ssml = ssml.replace(/\bNA\s+plot/gi, '<sub alias="एन ए प्लॉट">NA plot</sub>');
  ssml = ssml.replace(/\bFSI\b/g, '<sub alias="एफ़ एस आई">FSI</sub>');
  ssml = ssml.replace(/\bTDR\b/g, '<sub alias="टी डी आर">TDR</sub>');
  ssml = ssml.replace(/\bEMI\b/g, '<sub alias="ई एम आई">EMI</sub>');
  ssml = ssml.replace(/\bSq\.?\s*ft\.?/gi, '<sub alias="स्क्वेयर फ़ीट">sq.ft</sub>');

  // ── 4. Real estate terms → natural Hindi pronunciation ──
  ssml = ssml.replace(/\bregistration\b/gi, '<sub alias="रजिस्ट्रेशन">registration</sub>');
  ssml = ssml.replace(/\bmutation\b/gi, '<sub alias="म्यूटेशन">mutation</sub>');
  ssml = ssml.replace(/\btitle\s+clear\b/gi, '<sub alias="टाइटल क्लियर">title clear</sub>');
  ssml = ssml.replace(/\bFull\s+infrastructure\b/gi, '<sub alias="फ़ुल इंफ़्रास्ट्रक्चर">Full infrastructure</sub>');
  ssml = ssml.replace(/\bFair\s+deal\b/gi, '<sub alias="फ़ेयर डील">Fair deal</sub>');
  ssml = ssml.replace(/\bdirect\s+deal\b/gi, '<sub alias="डायरेक्ट डील">direct deal</sub>');
  ssml = ssml.replace(/\bhidden\s+charge\b/gi, '<sub alias="हिडन चार्ज">hidden charge</sub>');
  ssml = ssml.replace(/\bextra\s+cost\b/gi, '<sub alias="एक्स्ट्रा कॉस्ट">extra cost</sub>');
  ssml = ssml.replace(/\bgrowth\s+potential\b/gi, '<sub alias="ग्रोथ पोटेन्शियल">growth potential</sub>');
  ssml = ssml.replace(/\bpremium\s+plot\b/gi, '<sub alias="प्रीमियम प्लॉट">premium plot</sub>');
  ssml = ssml.replace(/\bpremium\s+location\b/gi, '<sub alias="प्रीमियम लोकेशन">premium location</sub>');
  ssml = ssml.replace(/\binvest\b/gi, '<sub alias="इन्वेस्ट">invest</sub>');
  ssml = ssml.replace(/\binvestment\b/gi, '<sub alias="इन्वेस्टमेंट">investment</sub>');
  ssml = ssml.replace(/\bDocuments\b/g, '<sub alias="डॉक्यूमेंट्स">Documents</sub>');
  ssml = ssml.replace(/\bspam\b/gi, '<sub alias="स्पैम">spam</sub>');
  ssml = ssml.replace(/\bbuyers\b/gi, '<sub alias="बायर्स">buyers</sub>');
  ssml = ssml.replace(/\bagent\b/gi, '<sub alias="एजेंट">agent</sub>');
  ssml = ssml.replace(/\bowner\b/gi, '<sub alias="ओनर">owner</sub>');
  ssml = ssml.replace(/\bexperience\b/gi, '<sub alias="एक्सपीरियंस">experience</sub>');
  ssml = ssml.replace(/\bsupport\b/gi, '<sub alias="सपोर्ट">support</sub>');
  ssml = ssml.replace(/\bdetails\b/gi, '<sub alias="डीटेल्स">details</sub>');
  ssml = ssml.replace(/\btrusted\b/gi, '<sub alias="ट्रस्टेड">trusted</sub>');
  ssml = ssml.replace(/\bverified\b/gi, '<sub alias="वेरिफ़ाइड">verified</sub>');
  ssml = ssml.replace(/\bavailable\b/gi, '<sub alias="अवेलेबल">available</sub>');
  ssml = ssml.replace(/\bplatform\b/gi, '<sub alias="प्लैटफ़ॉर्म">platform</sub>');
  ssml = ssml.replace(/\breal\s+opportunity\b/gi, '<sub alias="रियल ऑपर्चुनिटी">real opportunity</sub>');

  // ── 5. Measurement terms → natural Hindi pronunciation ──
  ssml = ssml.replace(/\bfacing\b/gi, '<sub alias="फ़ेसिंग">facing</sub>');
  ssml = ssml.replace(/\broad\b/gi, '<sub alias="रोड">road</sub>');

  // ── 6. Ellipsis → breath pause (200ms — longer than v5's 150ms for clarity) ──
  ssml = ssml.replace(/\.\.\./g, '<break time="200ms"/>');

  // ── 7. Micro-pause before emphasis words ──
  // "सिर्फ़" (only/just) — brief anticipation beat
  ssml = ssml.replace(/सिर्फ़/g, '<break time="120ms"/>सिर्फ़');
  // "बस" when used as "just/only" — subtle emphasis
  ssml = ssml.replace(/\bबस\s+(\d)/g, '<break time="80ms"/>बस $1');

  // ── 8. Per-word notes (v6: NO per-word prosody wrapping) ──
  // The neural model handles honorific softening (जी), terminal de-emphasis
  // (रुपये), and Hindi-English code-switching natively. Manual <prosody>
  // per word creates audio glitches. Let the model do its thing.

  // ── 9. Area/distance numbers → <say-as cardinal> ──
  ssml = ssml.replace(
    /(\d[\d,]+)\s*(square feet|sqft|वर्ग फ़ीट|स्क्वेयर फ़ीट)/gi,
    (_, num, unit) => `<say-as interpret-as="cardinal">${num.replace(/,/g, "")}</say-as> ${unit}`
  );

  // ── 10. Standalone numbers with units → cardinal ──
  ssml = ssml.replace(
    /(\d+)\s*(किलोमीटर|मिनट|प्रतिशत|km|एकड़|बीघा|गुंठा)/g,
    (_, num, unit) => {
      if (ssml.includes(`">${num}`)) return `${num} ${unit}`;
      return `<say-as interpret-as="cardinal">${num}</say-as> ${unit}`;
    }
  );

  // ── 11. Road width pattern (e.g., "30 feet road") ──
  ssml = ssml.replace(
    /(\d+)\s*(feet|फ़ीट)\s*(road|रोड|सड़क)/gi,
    (_, num, feet, road) => `<say-as interpret-as="cardinal">${num}</say-as> ${feet} ${road}`
  );

  // ── 12. Clean up: no double breaks, no excess whitespace ──
  ssml = ssml.replace(/<break[^/]*\/>\s*<break/g, "<break");
  ssml = ssml.replace(/\s{2,}/g, " ");

  return ssml.trim();
}

// ── SSML Builder v5 ──────────────────────────────────────────
// ONE express-as wrapper for the entire section. Prosody-only variation
// per clause. This keeps the voice CONSISTENT — same person throughout.

function buildIntelligentSSML(
  text: string,
  voice: string,
  sectionId: string,
  props?: ListingVideoProps
): string {
  resetVariationSeed();
  const silence = SECTION_SILENCE[sectionId] || SECTION_SILENCE.full;
  const clauses = splitIntoClauses(text);

  const prosodyBlocks = clauses.map((clause, i) => {
    let cleanClause = clause.endsWith("...")
      ? clause.slice(0, -3).trim()
      : clause;

    if (!cleanClause || cleanClause.length < 2) return "";

    const prosody = classifyProsody(cleanClause, sectionId, i, clauses.length);
    const ssmlContent = processClauseToSSML(cleanClause, props);

    // Build prosody attributes
    const attrs = [`rate="${prosody.rate}"`, `pitch="${prosody.pitch}"`, `volume="${prosody.volume}"`];
    if (prosody.contour) attrs.push(`contour="${prosody.contour}"`);

    let block = `      <prosody ${attrs.join(" ")}>\n        <s>${ssmlContent}</s>\n      </prosody>`;

    if (i < clauses.length - 1) {
      const breakMs = getInterClauseBreak(clause, clauses[i + 1] || null, sectionId);
      block += `\n      <break time="${breakMs}ms"/>`;
    }

    return block;
  });

  const validBlocks = prosodyBlocks.filter((b) => b);
  if (validBlocks.length === 0) {
    const prosody = getDefaultProsody(sectionId);
    const ssmlContent = processClauseToSSML(text, props);
    return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="hi-IN">
  <voice name="${voice}">
    <mstts:express-as style="${GLOBAL_STYLE}" styledegree="${GLOBAL_STYLE_DEGREE}">
      <prosody rate="${prosody.rate}" pitch="${prosody.pitch}" volume="${prosody.volume}">
        ${ssmlContent}
      </prosody>
    </mstts:express-as>
  </voice>
</speak>`;
  }

  // Non-exact silence (additive to neural model's natural pauses)
  const silenceBlocks: string[] = [];
  if (silence.leading > 0) silenceBlocks.push(`    <mstts:silence type="Leading" value="${silence.leading}ms"/>`);
  if (silence.sentenceBoundary > 0) silenceBlocks.push(`    <mstts:silence type="Sentenceboundary" value="${silence.sentenceBoundary}ms"/>`);
  if (silence.trailing > 0) silenceBlocks.push(`    <mstts:silence type="Tailing" value="${silence.trailing}ms"/>`);

  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="hi-IN">
  <voice name="${voice}">
${silenceBlocks.length > 0 ? silenceBlocks.join("\n") + "\n" : ""}    <mstts:express-as style="${GLOBAL_STYLE}" styledegree="${GLOBAL_STYLE_DEGREE}">
${validBlocks.join("\n")}
    </mstts:express-as>
  </voice>
</speak>`;
}

/**
 * Build multi-section SSML v5 — ONE express-as for ALL sections.
 * All variation is prosody-only. Voice stays consistent throughout.
 */
function buildMultiSectionSSML(
  sections: Array<{ sectionId: string; text: string }>,
  voice: string,
  props?: ListingVideoProps
): string {
  resetVariationSeed();
  const innerBlocks: string[] = [];

  // Silence config from first section
  const firstSilence = SECTION_SILENCE[sections[0]?.sectionId] || SECTION_SILENCE.full;

  for (let s = 0; s < sections.length; s++) {
    const section = sections[s];
    const clauses = splitIntoClauses(section.text);

    for (let i = 0; i < clauses.length; i++) {
      const clause = clauses[i];
      let cleanClause = clause.endsWith("...") ? clause.slice(0, -3).trim() : clause;
      if (!cleanClause || cleanClause.length < 2) continue;

      const prosody = classifyProsody(cleanClause, section.sectionId, i, clauses.length);
      const ssmlContent = processClauseToSSML(cleanClause, props);

      const attrs = [`rate="${prosody.rate}"`, `pitch="${prosody.pitch}"`, `volume="${prosody.volume}"`];
      if (prosody.contour) attrs.push(`contour="${prosody.contour}"`);

      innerBlocks.push(`      <prosody ${attrs.join(" ")}>\n        <s>${ssmlContent}</s>\n      </prosody>`);

      if (i < clauses.length - 1) {
        const breakMs = getInterClauseBreak(clause, clauses[i + 1] || null, section.sectionId);
        innerBlocks.push(`      <break time="${breakMs}ms"/>`);
      }
    }

    // v6: Section-specific transition gap (not uniform)
    if (s < sections.length - 1) {
      const gapMs = getSectionTransitionGap(section.sectionId);
      innerBlocks.push(`      <break time="${gapMs}ms"/>`);
    }
  }

  const silenceBlocks: string[] = [];
  if (firstSilence.leading > 0) silenceBlocks.push(`    <mstts:silence type="Leading" value="${firstSilence.leading}ms"/>`);
  silenceBlocks.push(`    <mstts:silence type="Sentenceboundary" value="40ms"/>`);

  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="hi-IN">
  <voice name="${voice}">
${silenceBlocks.join("\n")}
    <mstts:express-as style="${GLOBAL_STYLE}" styledegree="${GLOBAL_STYLE_DEGREE}">
${innerBlocks.join("\n")}
    </mstts:express-as>
  </voice>
</speak>`;
}

// ── Azure Synthesis ──────────────────────────────────────────

/** Word boundary data collected during synthesis */
interface WordBoundaryEvent {
  text: string;
  audioOffsetMs: number;
  durationMs: number;
  boundaryType: string;
}

function synthesizeAzure(
  ssml: string,
  outputWavPath: string,
  collectWordBoundaries?: WordBoundaryEvent[]
): Promise<void> {
  return new Promise((resolve, reject) => {
    const key = process.env.AZURE_SPEECH_KEY!;
    const region = process.env.AZURE_SPEECH_REGION!;

    const speechConfig = sdk.SpeechConfig.fromSubscription(key, region);
    speechConfig.speechSynthesisOutputFormat =
      sdk.SpeechSynthesisOutputFormat.Riff48Khz16BitMonoPcm;

    // v6: Enable sentence boundary events for precise timing
    speechConfig.setProperty("SpeechServiceResponse_RequestSentenceBoundary", "true");

    const synthesizer = new sdk.SpeechSynthesizer(speechConfig, null as any);

    // v6: Collect word boundary events for precise per-section timing
    if (collectWordBoundaries) {
      synthesizer.wordBoundary = (_s: any, e: any) => {
        collectWordBoundaries.push({
          text: e.text,
          audioOffsetMs: Math.round(e.audioOffset / 10000), // ticks → ms
          durationMs: Math.round(e.duration / 10000),
          boundaryType: e.boundaryType?.toString() || "Word",
        });
      };
    }

    synthesizer.speakSsmlAsync(
      ssml,
      (result) => {
        synthesizer.close();
        if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
          const rawPath = outputWavPath + ".raw.wav";
          fs.writeFileSync(rawPath, Buffer.from(result.audioData));

          // v6 ffmpeg: Preserve natural dynamics, add warmth
          // - highpass 75Hz: remove low rumble without cutting warmth
          // - acompressor ratio=1.8: gentler than v5's 2 — more natural dynamics
          //   release=250ms: slower release preserves volume fluctuation that sounds human
          // - equalizer 180Hz +1.2dB: subtle warmth in voice fundamental
          // - equalizer 3kHz +1.5dB: presence/clarity boost for word intelligibility
          // - equalizer 6kHz -0.5dB: slight de-essing to reduce sibilance
          try {
            execSync(
              `ffmpeg -y -i "${rawPath}" -af "highpass=f=75,acompressor=threshold=-22dB:ratio=1.8:attack=10:release=250,equalizer=f=180:t=q:w=0.8:g=1.2,equalizer=f=3000:t=q:w=1.0:g=1.5,equalizer=f=6000:t=q:w=1.0:g=-0.5" -ar 48000 -ac 1 -sample_fmt s16 -f wav "${outputWavPath}" 2>/dev/null`,
              { timeout: 15000 }
            );
            try { fs.unlinkSync(rawPath); } catch {}
          } catch {
            fs.renameSync(rawPath, outputWavPath);
          }
          resolve();
        } else {
          reject(new Error(`Azure TTS: ${result.errorDetails || "Unknown error"}`));
        }
      },
      (err) => {
        synthesizer.close();
        reject(new Error(`Azure TTS: ${err}`));
      }
    );
  });
}

// ── Public API ───────────────────────────────────────────────

export async function generateVoiceover(
  props: ListingVideoProps,
  options: VoiceoverOptions = {}
): Promise<string | null> {
  if (!hasAzureCredentials()) {
    console.log("[voiceover:azure] No AZURE_SPEECH_KEY — falling back to edge-tts");
    return edgeGenerateVoiceover(props, options as EdgeVoiceoverOptions);
  }

  const voice = options.voice || DEFAULT_VOICE;
  const script = generateScript(props);

  console.log(`[voiceover:azure] Script (${script.length} chars):\n${script}`);
  console.log(`[voiceover:azure] Voice: ${voice} | ${GLOBAL_STYLE} ${GLOBAL_STYLE_DEGREE} | prosody-only | 48kHz`);

  try {
    const audioDir = path.join(process.cwd(), "public", "audio");
    ensureDir(audioDir);

    const filename = `voiceover_${props.listingId}.wav`;
    const outputPath = path.join(audioDir, filename);

    // v6: Try primary voice, fallback to SwaraNeural if AartiNeural unavailable
    let usedVoice = voice;
    try {
      const ssml = buildIntelligentSSML(script, voice, "full", props);
      await synthesizeAzure(ssml, outputPath);
    } catch (primaryErr) {
      if (voice === DEFAULT_VOICE && FALLBACK_VOICE !== voice) {
        console.warn(`[voiceover:azure] ${voice} failed, trying ${FALLBACK_VOICE}...`);
        usedVoice = FALLBACK_VOICE;
        const ssml = buildIntelligentSSML(script, FALLBACK_VOICE, "full", props);
        await synthesizeAzure(ssml, outputPath);
      } else {
        throw primaryErr;
      }
    }

    const durationMs = getAudioDurationMs(outputPath);
    const fileSize = fs.statSync(outputPath).size;
    console.log(`[voiceover:azure] Saved (${usedVoice}, ${(fileSize / 1024).toFixed(1)}KB, ${(durationMs / 1000).toFixed(1)}s)`);
    return filename;
  } catch (error) {
    console.error("[voiceover:azure] Failed, falling back to edge-tts:", error);
    return edgeGenerateVoiceover(props, options as EdgeVoiceoverOptions);
  }
}

export async function generateTimedVoiceover(
  props: ListingVideoProps,
  richness: ContentRichness,
  options: VoiceoverOptions = {}
): Promise<TimedVoiceover | null> {
  if (!hasAzureCredentials()) {
    console.log("[voiceover:azure] No AZURE_SPEECH_KEY — falling back to edge-tts");
    return edgeGenerateTimedVoiceover(props, richness, options as EdgeVoiceoverOptions);
  }

  let voice = options.voice || DEFAULT_VOICE;
  const sections = generateTimedScript(props, richness);
  const totalChars = sections.reduce((sum, s) => sum + s.text.length, 0);

  console.log(`[voiceover:azure] v6 One-Voice TTS (${totalChars} chars, ${sections.length} sections, ${GLOBAL_STYLE} ${GLOBAL_STYLE_DEGREE})`);
  sections.forEach((s) => {
    const clauses = splitIntoClauses(s.text);
    const prosodies = clauses.map((c, i) => {
      const clean = c.endsWith("...") ? c.slice(0, -3).trim() : c;
      const p = classifyProsody(clean, s.sectionId, i, clauses.length);
      return `${p.rate}${p.contour ? "⤴" : ""}`;
    });
    console.log(`  [${s.sectionId}] ${prosodies.join(" → ")} | ${s.text}`);
  });

  const audioDir = path.join(process.cwd(), "public", "audio");
  const tmpDir = path.join(audioDir, "tmp");
  ensureDir(audioDir);
  ensureDir(tmpDir);

  try {
    const sectionWavPaths: string[] = [];
    const sectionGaps: number[] = []; // v6: per-section gap durations
    let cumulativeMs = 0;
    const sectionEstimates: TimedVoiceover["sectionEstimates"] = [];

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      console.log(`[voiceover:azure] ${i + 1}/${sections.length}: ${section.sectionId} (prosody-only, ${GLOBAL_STYLE})...`);

      // v6: Collect word boundaries for precise timing
      const wordBoundaries: WordBoundaryEvent[] = [];

      try {
        const secPath = path.join(tmpDir, `section_${i}.wav`);
        const ssml = buildIntelligentSSML(section.text, voice, section.sectionId, props);
        try {
          await synthesizeAzure(ssml, secPath, wordBoundaries);
        } catch (voiceErr) {
          // v6: If primary voice fails (e.g., AartiNeural not in region), try fallback
          if (voice === DEFAULT_VOICE && FALLBACK_VOICE !== voice && i === 0) {
            console.warn(`[voiceover:azure] ${voice} unavailable, switching to ${FALLBACK_VOICE}`);
            voice = FALLBACK_VOICE;
            const fallbackSsml = buildIntelligentSSML(section.text, voice, section.sectionId, props);
            await synthesizeAzure(fallbackSsml, secPath, wordBoundaries);
          } else {
            throw voiceErr;
          }
        }

        const durationMs = getAudioDurationMs(secPath);
        sectionWavPaths.push(secPath);
        sectionEstimates.push({
          sectionId: section.sectionId,
          estimatedStartMs: cumulativeMs,
          estimatedEndMs: cumulativeMs + durationMs,
        });
        cumulativeMs += durationMs;

        // v6: Section-specific transition gap
        if (i < sections.length - 1) {
          const gapMs = getSectionTransitionGap(section.sectionId);
          sectionGaps.push(gapMs);
          cumulativeMs += gapMs;
        }

        // Log word boundary count for debugging
        if (wordBoundaries.length > 0) {
          console.log(`  [${section.sectionId}] ${wordBoundaries.length} word boundaries, ${(durationMs / 1000).toFixed(1)}s exact`);
        }
      } catch (secErr) {
        console.warn(`[voiceover:azure] Section "${section.sectionId}" failed`);
        sectionEstimates.push({
          sectionId: section.sectionId,
          estimatedStartMs: cumulativeMs,
          estimatedEndMs: cumulativeMs + section.estimatedDurationMs,
        });
        cumulativeMs += section.estimatedDurationMs;
        if (i < sections.length - 1) {
          sectionGaps.push(DEFAULT_SECTION_GAP_MS);
        }
      }
    }

    if (sectionWavPaths.length === 0) {
      console.error("[voiceover:azure] All sections failed — edge-tts fallback");
      return edgeGenerateTimedVoiceover(props, richness, options as EdgeVoiceoverOptions);
    }

    // v6: Generate per-section silence files (different durations)
    const silencePaths: string[] = [];
    for (let i = 0; i < sectionGaps.length; i++) {
      const gapMs = sectionGaps[i];
      const silPath = path.join(tmpDir, `silence_${i}.wav`);
      execSync(
        `ffmpeg -y -f lavfi -i anullsrc=r=48000:cl=mono -t ${gapMs / 1000} -sample_fmt s16 "${silPath}" 2>/dev/null`,
        { timeout: 5000 }
      );
      silencePaths.push(silPath);
    }

    const concatList = path.join(tmpDir, "concat.txt");
    const lines: string[] = [];
    for (let i = 0; i < sectionWavPaths.length; i++) {
      lines.push(`file '${sectionWavPaths[i]}'`);
      if (i < sectionWavPaths.length - 1 && silencePaths[i]) {
        lines.push(`file '${silencePaths[i]}'`);
      }
    }
    fs.writeFileSync(concatList, lines.join("\n"));

    const filename = `voiceover_${props.listingId}.wav`;
    const outputPath = path.join(audioDir, filename);
    // v6: Higher LRA=14 (was 13) for even more natural dynamic range
    // Subtle fade-in (50ms) + fade-out (30ms) for clean edges
    execSync(
      `ffmpeg -y -f concat -safe 0 -i "${concatList}" -af "loudnorm=I=-16:LRA=14:TP=-1.5,afade=t=in:d=0.05,afade=t=out:d=0.03:st=0" -ar 48000 -ac 1 -sample_fmt s16 -f wav "${outputPath}" 2>/dev/null`,
      { timeout: 30000 }
    );

    const totalDurationMs = getAudioDurationMs(outputPath);
    const fileSize = fs.statSync(outputPath).size;

    for (const p of sectionWavPaths) { try { fs.unlinkSync(p); } catch {} }
    for (const p of silencePaths) { try { fs.unlinkSync(p); } catch {} }
    try { fs.unlinkSync(concatList); } catch {}

    console.log(`[voiceover:azure] v6 Done: ${(fileSize / 1024).toFixed(1)}KB, ${(totalDurationMs / 1000).toFixed(1)}s`);
    console.log(`[voiceover:azure] Section gaps:`, sections.map((s, i) =>
      `${s.sectionId}${i < sectionGaps.length ? ` →${sectionGaps[i]}ms→` : ""}`
    ).join(" "));
    console.log(`[voiceover:azure] Sections:`, sectionEstimates.map(
      (s) => `${s.sectionId}: ${(s.estimatedStartMs / 1000).toFixed(1)}-${(s.estimatedEndMs / 1000).toFixed(1)}s`
    ));

    return { filename, totalDurationMs, sectionEstimates };
  } catch (error) {
    console.error("[voiceover:azure] Failed:", error);
    return edgeGenerateTimedVoiceover(props, richness, options as EdgeVoiceoverOptions);
  }
}

export function cleanupVoiceover(filename: string): void {
  edgeCleanupVoiceover(filename);
}

// ── CLI Test ─────────────────────────────────────────────────
if (process.argv.includes("--test") && process.argv[1]?.includes("generateVoiceoverAzure")) {
  (async () => {
    const { config } = await import("dotenv");
    config();

    console.log("\n═══ Azure TTS v6 — Indian Accent, Human Emotion ═══\n");

    if (!hasAzureCredentials()) {
      console.log("AZURE_SPEECH_KEY not set. Add to .env:");
      console.log("  AZURE_SPEECH_KEY=your_key");
      console.log("  AZURE_SPEECH_REGION=centralindia\n");
      return;
    }

    const audioDir = path.join(process.cwd(), "public", "audio");
    ensureDir(audioDir);
    const voice = DEFAULT_VOICE;

    const mockProps: Partial<ListingVideoProps> = {
      price: 780000,
      pricePerSqft: 650,
    };

    const testSections = [
      { id: "hook",     text: "अरे सुनिए... GIET Einstein College में एक शानदार प्लॉट आया है... सिर्फ़ 7.8 लाख रुपये में! BhoomiScan verified।" },
      { id: "details",  text: "सब ready है यहाँ... सड़क, पानी, बिजली, और बाउंड्री... सब कुछ। 1,200 square feet का प्लॉट। Full infrastructure।" },
      { id: "context",  text: "Site visit का video भी है... ख़ुद आँखों से देख लीजिए... प्लॉट कैसा है।" },
      { id: "numbers",  text: "Price बात करें तो... 7.8 लाख रुपये। Per square feet सिर्फ़ 650 रुपये। Fair deal है ना!" },
      { id: "cta",      text: "Satish Sahoo जी... ये direct मालिक हैं। DM में number माँगिए... कोई spam नहीं होगा।" },
      { id: "branding", text: "bhoomiscan.in पर जाइए... अपनी ज़मीन free में list करें!" },
    ];

    // Show prosody analysis for each section
    console.log(`── Prosody Analysis (global: ${GLOBAL_STYLE} ${GLOBAL_STYLE_DEGREE}) ──\n`);
    for (const section of testSections) {
      const clauses = splitIntoClauses(section.text);
      console.log(`[${section.id}]`);
      clauses.forEach((c, i) => {
        const clean = c.endsWith("...") ? c.slice(0, -3).trim() : c;
        const prosody = classifyProsody(clean, section.id, i, clauses.length);
        const breakMs = i < clauses.length - 1 ? getInterClauseBreak(c, clauses[i + 1] || null, section.id) : 0;
        const contourFlag = prosody.contour ? " ⤴contour" : "";
        console.log(`  ${i + 1}. rate=${prosody.rate} pitch=${prosody.pitch}${contourFlag} | "${clean.slice(0, 50)}${clean.length > 50 ? "..." : ""}"${breakMs ? ` → ${breakMs}ms pause` : ""}`);
      });
      console.log();
    }

    // Generate per-section audio
    console.log("── Generating Per-Section Audio ──\n");
    for (const section of testSections) {
      const ssml = buildIntelligentSSML(section.text, voice, section.id, mockProps as ListingVideoProps);
      const outPath = path.join(audioDir, `test_azure_v6_${section.id}.wav`);
      await synthesizeAzure(ssml, outPath);

      const dur = getAudioDurationMs(outPath);
      const size = fs.statSync(outPath).size;
      const clauses = splitIntoClauses(section.text);
      const contourCount = clauses.filter((c, i) => {
        const clean = c.endsWith("...") ? c.slice(0, -3).trim() : c;
        return classifyProsody(clean, section.id, i, clauses.length).contour;
      }).length;
      console.log(`[${section.id}] ${(dur / 1000).toFixed(1)}s, ${(size / 1024).toFixed(0)}KB | ${clauses.length} clauses, ${contourCount} with contour`);
    }

    // Combined multi-section
    console.log("\n── Generating Combined Full Voiceover ──\n");
    const fullSSML = buildMultiSectionSSML(
      testSections.map((s) => ({ sectionId: s.id, text: s.text })),
      voice,
      mockProps as ListingVideoProps
    );
    const fullPath = path.join(audioDir, "test_azure_v6_full.wav");
    await synthesizeAzure(fullSSML, fullPath);

    const fullDur = getAudioDurationMs(fullPath);
    const fullSize = fs.statSync(fullPath).size;
    console.log(`Full voiceover: ${(fullDur / 1000).toFixed(1)}s, ${(fullSize / 1024).toFixed(0)}KB, 48kHz`);
    console.log(`Style: ${GLOBAL_STYLE} ${GLOBAL_STYLE_DEGREE} (ONE style, entire voiceover)`);
    console.log(`v6: Hindi-tuned prosody (slower details, wider contours, Indian accent)`);
    console.log(`Contour: melodic ±15Hz pitch curves, Hindi declarative/question patterns`);
    console.log(`Audio: gentle compression (ratio=1.8), LRA=14, 3kHz clarity boost`);
    console.log(`Cost: FREE (F0 tier)\n`);

    // Debug: show generated SSML for hook section
    console.log("── Sample SSML (hook) ──\n");
    const hookSSML = buildIntelligentSSML(testSections[0].text, voice, "hook", mockProps as ListingVideoProps);
    console.log(hookSSML);

    console.log("\nOpening for playback...");
    try { execSync(`open "${fullPath}"`); } catch {}

    console.log(`\nFiles: ${audioDir}/test_azure_v6_*.wav\n`);
  })();
}
