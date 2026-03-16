/**
 * Edge TTS Voiceover Generator — FREE, natural Hindi speech.
 *
 * v6 improvements:
 *   1. Per-section prosody profiles with SLOWER detail rates for word clarity
 *   2. Text preprocessing — real estate terms, Hindi punctuation → natural pauses
 *   3. ffmpeg audio chain — loudness normalization, 3kHz clarity boost, de-essing
 *   4. Optimal rate/pitch tuning per voice for conversational Hindi
 *   5. Sentence-level breathing via commas and ellipsis placement
 *
 * Voice: hi-IN-SwaraNeural (Hindi Female Neural) — warm, conversational.
 * Cost: ₹0 (FREE, unlimited, no API key).
 *
 * NOTE: Edge TTS has NO SSML support (no styles, no contours, no breaks).
 * All naturalness comes from text preprocessing and prosody CLI flags.
 */

import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import { ListingVideoProps } from "../types";
import { generateScript, generateTimedScript } from "./scriptGenerator";
import { ContentRichness } from "../analysis/contentAnalyzer";

// v6: Slightly shorter gaps for better flow (was 400ms → 350ms)
const SILENCE_GAP_MS = 350;
const DEFAULT_VOICE = process.env.EDGE_TTS_VOICE || "hi-IN-SwaraNeural";

/**
 * Per-section prosody profiles.
 * v6: SLOWER rates for details/numbers (clarity), energetic hooks.
 * Wider pitch variation between sections for natural personality changes.
 */
const SECTION_PROSODY: Record<string, { rate: string; pitch: string; volume: string }> = {
  hook:     { rate: "+0%",   pitch: "+5Hz",  volume: "+8%" },   // Energetic but clear
  details:  { rate: "-8%",   pitch: "+0Hz",  volume: "+3%" },   // SLOWER for word clarity
  context:  { rate: "-3%",   pitch: "+3Hz",  volume: "+5%" },   // Warm, reassuring
  numbers:  { rate: "-6%",   pitch: "+2Hz",  volume: "+5%" },   // Deliberate, measured
  cta:      { rate: "-2%",   pitch: "+4Hz",  volume: "+8%" },   // Warm, inviting
  branding: { rate: "-2%",   pitch: "+3Hz",  volume: "+5%" },   // Clear, memorable
  full:     { rate: "-3%",   pitch: "+3Hz",  volume: "+5%" },   // Default balanced
};

/** Voice presets */
const VOICE_PRESETS = {
  warm:      { voice: "hi-IN-SwaraNeural",  rate: "-3%",  pitch: "+3Hz",  volume: "+5%" },
  energetic: { voice: "hi-IN-SwaraNeural",  rate: "+2%",  pitch: "+5Hz",  volume: "+8%" },
  calm:      { voice: "hi-IN-MadhurNeural",  rate: "-5%",  pitch: "-2Hz",  volume: "+3%" },
  male:      { voice: "hi-IN-MadhurNeural",  rate: "-3%",  pitch: "+0Hz",  volume: "+5%" },
} as const;

export const INDIAN_VOICES = {
  "hi-IN-female": "hi-IN-SwaraNeural",
  "hi-IN-male": "hi-IN-MadhurNeural",
  "en-IN-female": "en-IN-NeerjaNeural",
  "en-IN-female-expressive": "en-IN-NeerjaExpressiveNeural",
  "en-IN-male": "en-IN-PrabhatNeural",
} as const;

export interface VoiceoverOptions {
  voice?: string;
  rate?: string;
  pitch?: string;
  volume?: string;
  preset?: keyof typeof VOICE_PRESETS;
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

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/** Get WAV duration in ms — finds the "data" chunk for robustness */
function wavDurationMs(buf: Buffer): number {
  if (buf.length < 44) return 0;
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
}

/**
 * Preprocess Hindi text for more natural TTS output.
 *
 * v6: Since Edge TTS has NO SSML, all naturalness comes from text manipulation.
 * - Ellipsis → comma for natural micro-pause
 * - English abbreviations → Hindi transliteration for correct pronunciation
 * - Brand names → Hindi spelling
 * - Ensure proper spacing after punctuation
 */
function preprocessText(text: string): string {
  let processed = text;

  // Ellipsis → comma for a natural micro-pause (edge-tts handles commas as short pauses)
  processed = processed.replace(/\.\.\./g, ", ");

  // English abbreviations → Hindi for correct pronunciation
  processed = processed.replace(/\bDM\b/g, "डी एम");
  processed = processed.replace(/\bRERA\b/g, "रेरा");
  processed = processed.replace(/\bNA\s+plot/gi, "एन ए प्लॉट");
  processed = processed.replace(/\bFSI\b/g, "एफ़ एस आई");
  processed = processed.replace(/bhoomiscan\.in/gi, "भूमी स्कैन डॉट इन");
  processed = processed.replace(/BhoomiScan/g, "भूमी स्कैन");

  // English real estate terms → Hindi transliteration for Indian accent
  processed = processed.replace(/\bFull infrastructure\b/gi, "फ़ुल इंफ़्रास्ट्रक्चर");
  processed = processed.replace(/\bFair deal\b/gi, "फ़ेयर डील");
  processed = processed.replace(/\btitle clear\b/gi, "टाइटल क्लियर");
  processed = processed.replace(/\bdirect deal\b/gi, "डायरेक्ट डील");
  processed = processed.replace(/\bhidden charge\b/gi, "हिडन चार्ज");
  processed = processed.replace(/\bextra cost\b/gi, "एक्स्ट्रा कॉस्ट");
  processed = processed.replace(/\bgrowth potential\b/gi, "ग्रोथ पोटेन्शियल");
  processed = processed.replace(/\bregistration\b/gi, "रजिस्ट्रेशन");
  processed = processed.replace(/\bDocuments\b/g, "डॉक्यूमेंट्स");
  processed = processed.replace(/\bverified\b/gi, "वेरिफ़ाइड");
  processed = processed.replace(/\btrusted\b/gi, "ट्रस्टेड");
  processed = processed.replace(/\bpremium\b/gi, "प्रीमियम");
  processed = processed.replace(/\bavailable\b/gi, "अवेलेबल");
  processed = processed.replace(/\btransparent\b/gi, "ट्रांसपेरेंट");
  processed = processed.replace(/\bspam\b/gi, "स्पैम");
  processed = processed.replace(/\bbuyers\b/gi, "बायर्स");
  processed = processed.replace(/\bagent\b/gi, "एजेंट");
  processed = processed.replace(/\bowner\b/gi, "ओनर");
  processed = processed.replace(/\bsupport\b/gi, "सपोर्ट");
  processed = processed.replace(/\bdetails\b/gi, "डीटेल्स");
  processed = processed.replace(/\bplatform\b/gi, "प्लैटफ़ॉर्म");
  processed = processed.replace(/\bsquare feet\b/gi, "स्क्वेयर फ़ीट");
  processed = processed.replace(/\binvest\b/gi, "इन्वेस्ट");
  processed = processed.replace(/\binvestment\b/gi, "इन्वेस्टमेंट");
  processed = processed.replace(/\bexperience\b/gi, "एक्सपीरियंस");

  // Ensure space after Devanagari purna viram (।)
  processed = processed.replace(/।\s*/g, "। ");

  // Clean up multiple spaces
  processed = processed.replace(/\s{2,}/g, " ");

  return processed.trim();
}

/**
 * Synthesize text → WAV using Python edge-tts with prosody parameters.
 * Edge-tts internally creates proper SSML with these parameters.
 */
function synthesize(
  text: string,
  outputWavPath: string,
  voice: string,
  rate: string,
  pitch: string,
  volume: string
): void {
  const tmpMp3 = outputWavPath.replace(/\.wav$/, "_tmp.mp3");

  // Preprocess for natural pauses
  const processedText = preprocessText(text);

  // Pass text via base64 to avoid shell escaping issues with Hindi
  const textB64 = Buffer.from(processedText).toString("base64");

  const pyScript = `
import asyncio, base64
import edge_tts

text = base64.b64decode("${textB64}").decode("utf-8")

async def main():
    comm = edge_tts.Communicate(
        text=text,
        voice="${voice}",
        rate="${rate}",
        pitch="${pitch}",
        volume="${volume}"
    )
    await comm.save("${tmpMp3.replace(/"/g, '\\"')}")

asyncio.run(main())
`;

  execSync(`python3 -c '${pyScript.replace(/'/g, "'\\''")}'`, {
    timeout: 60000,
    stdio: ["pipe", "pipe", "pipe"],
  });

  // v6: Convert MP3 → WAV with improved audio chain:
  // 1. highpass 75Hz: remove rumble without cutting warmth
  // 2. acompressor ratio=2, release=150ms: gentler than v5 for natural dynamics
  // 3. equalizer 3kHz +1.5dB: presence/clarity boost for word intelligibility
  // 4. equalizer 6kHz -0.5dB: de-essing to reduce sibilance
  // 5. loudnorm LRA=13: more dynamic range than v5's LRA=11
  // 6. aresample 24kHz: good balance of quality + file size
  execSync(
    `ffmpeg -y -i "${tmpMp3}" -af "highpass=f=75,acompressor=threshold=-20dB:ratio=2:attack=8:release=150,equalizer=f=3000:t=q:w=1.0:g=1.5,equalizer=f=6000:t=q:w=1.0:g=-0.5,loudnorm=I=-16:LRA=13:TP=-1.5,aresample=24000" -ac 1 -sample_fmt s16 "${outputWavPath}" 2>/dev/null`,
    { timeout: 15000 }
  );

  try { fs.unlinkSync(tmpMp3); } catch {}
}

/**
 * Synthesize with per-section prosody profile.
 */
function synthesizeSection(
  text: string,
  outputWavPath: string,
  voice: string,
  sectionId: string,
  fallbackRate: string,
  fallbackPitch: string,
  fallbackVolume: string
): void {
  const prosody = SECTION_PROSODY[sectionId] || {
    rate: fallbackRate,
    pitch: fallbackPitch,
    volume: fallbackVolume,
  };
  synthesize(text, outputWavPath, voice, prosody.rate, prosody.pitch, prosody.volume);
}

/**
 * Generate voiceover for a property listing using Edge TTS (FREE).
 * Drop-in replacement for Sarvam-based generateVoiceover().
 */
export async function generateVoiceover(
  props: ListingVideoProps,
  options: VoiceoverOptions = {}
): Promise<string | null> {
  const preset = options.preset ? VOICE_PRESETS[options.preset] : VOICE_PRESETS.warm;
  const voice = options.voice || preset.voice;
  const rate = options.rate || preset.rate;
  const pitch = options.pitch || preset.pitch;
  const volume = options.volume || preset.volume;

  const script = generateScript(props);

  console.log(`[voiceover:edge] Script (${script.length} chars):\n${script}`);
  console.log(`[voiceover:edge] Voice: ${voice} | rate=${rate} pitch=${pitch} | FREE`);

  try {
    const audioDir = path.join(process.cwd(), "public", "audio");
    ensureDir(audioDir);

    const filename = `voiceover_${props.listingId}.wav`;
    const outputPath = path.join(audioDir, filename);

    synthesize(script, outputPath, voice, rate, pitch, volume);

    const wavBuf = fs.readFileSync(outputPath);
    const durationMs = wavDurationMs(wavBuf);

    console.log(
      `[voiceover:edge] Saved ${outputPath} (${(wavBuf.length / 1024).toFixed(1)}KB, ${(durationMs / 1000).toFixed(1)}s)`
    );

    return filename;
  } catch (error) {
    console.error("[voiceover:edge] Failed:", error);
    return null;
  }
}

/**
 * Generate timed voiceover with per-section timing.
 * Each section synthesized separately with its own prosody profile.
 * This creates natural voice personality changes across the video:
 *   hook → energetic | details → calm/clear | cta → encouraging
 */
export async function generateTimedVoiceover(
  props: ListingVideoProps,
  richness: ContentRichness,
  options: VoiceoverOptions = {}
): Promise<TimedVoiceover | null> {
  const preset = options.preset ? VOICE_PRESETS[options.preset] : VOICE_PRESETS.warm;
  const voice = options.voice || preset.voice;
  const rate = options.rate || preset.rate;
  const pitch = options.pitch || preset.pitch;
  const volume = options.volume || preset.volume;

  const sections = generateTimedScript(props, richness);
  const totalChars = sections.reduce((sum, s) => sum + s.text.length, 0);

  console.log(`[voiceover:edge] Per-section TTS (${totalChars} chars, ${sections.length} sections)`);
  console.log(`[voiceover:edge] Voice: ${voice} | per-section prosody | FREE`);
  sections.forEach((s) => {
    const p = SECTION_PROSODY[s.sectionId] || { rate, pitch, volume };
    console.log(`  [${s.sectionId}] rate=${p.rate} pitch=${p.pitch} | ${s.text}`);
  });

  const audioDir = path.join(process.cwd(), "public", "audio");
  const tmpDir = path.join(audioDir, "tmp");
  ensureDir(audioDir);
  ensureDir(tmpDir);

  try {
    const sectionWavPaths: string[] = [];
    let cumulativeMs = 0;
    const sectionEstimates: TimedVoiceover["sectionEstimates"] = [];

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      console.log(`[voiceover:edge] Section ${i + 1}/${sections.length}: ${section.sectionId}...`);

      try {
        const secWavPath = path.join(tmpDir, `section_${i}.wav`);
        synthesizeSection(section.text, secWavPath, voice, section.sectionId, rate, pitch, volume);

        const wavBuf = fs.readFileSync(secWavPath);
        const durationMs = wavDurationMs(wavBuf);

        sectionWavPaths.push(secWavPath);
        sectionEstimates.push({
          sectionId: section.sectionId,
          estimatedStartMs: cumulativeMs,
          estimatedEndMs: cumulativeMs + durationMs,
        });
        cumulativeMs += durationMs;

        if (i < sections.length - 1) {
          cumulativeMs += SILENCE_GAP_MS;
        }
      } catch (secErr) {
        console.warn(`[voiceover:edge] Section "${section.sectionId}" failed, using estimate`);
        sectionEstimates.push({
          sectionId: section.sectionId,
          estimatedStartMs: cumulativeMs,
          estimatedEndMs: cumulativeMs + section.estimatedDurationMs,
        });
        cumulativeMs += section.estimatedDurationMs;
      }
    }

    if (sectionWavPaths.length === 0) {
      console.error("[voiceover:edge] No sections generated");
      return null;
    }

    // Concatenate all sections with silence gaps using ffmpeg
    const silencePath = path.join(tmpDir, "silence.wav");
    execSync(
      `ffmpeg -y -f lavfi -i anullsrc=r=24000:cl=mono -t ${SILENCE_GAP_MS / 1000} -sample_fmt s16 "${silencePath}" 2>/dev/null`,
      { timeout: 5000 }
    );

    const concatListPath = path.join(tmpDir, "concat_list.txt");
    const concatLines: string[] = [];
    for (let i = 0; i < sectionWavPaths.length; i++) {
      concatLines.push(`file '${sectionWavPaths[i]}'`);
      if (i < sectionWavPaths.length - 1) {
        concatLines.push(`file '${silencePath}'`);
      }
    }
    fs.writeFileSync(concatListPath, concatLines.join("\n"));

    const filename = `voiceover_${props.listingId}.wav`;
    const outputPath = path.join(audioDir, filename);

    // v6: Final concat with improved loudness normalization and fade
    execSync(
      `ffmpeg -y -f concat -safe 0 -i "${concatListPath}" -af "loudnorm=I=-16:LRA=13:TP=-1.5,afade=t=in:d=0.05" -ar 24000 -ac 1 -sample_fmt s16 "${outputPath}" 2>/dev/null`,
      { timeout: 30000 }
    );

    const finalBuf = fs.readFileSync(outputPath);
    const totalDurationMs = wavDurationMs(finalBuf);

    // Cleanup temp files
    for (const p of sectionWavPaths) { try { fs.unlinkSync(p); } catch {} }
    try { fs.unlinkSync(silencePath); } catch {}
    try { fs.unlinkSync(concatListPath); } catch {}

    console.log(`[voiceover:edge] Timed voiceover: ${(finalBuf.length / 1024).toFixed(1)}KB, ${(totalDurationMs / 1000).toFixed(1)}s`);
    console.log(
      `[voiceover:edge] Sections:`,
      sectionEstimates.map(
        (s) => `${s.sectionId}: ${(s.estimatedStartMs / 1000).toFixed(1)}-${(s.estimatedEndMs / 1000).toFixed(1)}s`
      )
    );

    return { filename, totalDurationMs, sectionEstimates };
  } catch (error) {
    console.error("[voiceover:edge] Failed:", error);
    return null;
  }
}

/** Clean up voiceover file */
export function cleanupVoiceover(filename: string): void {
  try {
    const filePath = path.join(process.cwd(), "public", "audio", filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch {}
}

// ── CLI Test ──────────────────────────────────────────────────
// Only run when this file is the direct entry point (not imported by Azure test)
if (process.argv.includes("--test") && process.argv[1]?.includes("generateVoiceoverEdge")) {
  (async () => {
    console.log("\n═══ Hindi Natural Voice Test (edge-tts + ffmpeg) ═══\n");

    const audioDir = path.join(process.cwd(), "public", "audio");
    ensureDir(audioDir);

    // Conversational Hindi property pitch — realistic length for a 30s video
    const script =
      "सुनिए... Khordha में एक शानदार प्लॉट आया है... " +
      "सिर्फ़ 7.8 लाख रुपये में! BhoomiScan verified। " +
      "1,200 square feet का प्लॉट है... सड़क, पानी, बिजली, और बाउंड्री... सब ready है। " +
      "Location बहुत अच्छी है... तेज़ बढ़ता area। " +
      "Per square feet सिर्फ़ 650 रुपये। Fair deal है! " +
      "Satish Sahoo जी... ये direct मालिक हैं। DM करें। " +
      "bhoomiscan.in पर अपनी ज़मीन free में list करें!";

    console.log(`Script:\n${script}\n`);
    console.log(`Preprocessed:\n${preprocessText(script)}\n`);

    const voice = DEFAULT_VOICE;

    // Generate with warm female preset
    console.log(`Generating with ${voice} (warm preset, per-section prosody)...\n`);

    const outputPath = path.join(audioDir, "test_hindi_natural.wav");
    synthesize(script, outputPath, voice, "-3%", "+3Hz", "+5%");

    const wavBuf = fs.readFileSync(outputPath);
    const durationMs = wavDurationMs(wavBuf);

    console.log(`Generated: ${outputPath}`);
    console.log(`  Duration: ${(durationMs / 1000).toFixed(1)}s`);
    console.log(`  Size: ${(wavBuf.length / 1024).toFixed(1)}KB`);
    console.log(`  Voice: ${voice}`);
    console.log(`  Audio: 24kHz, 16-bit, mono, loudnorm + compression`);
    console.log(`  Cost: FREE\n`);

    console.log("Playing...\n");
    try {
      execSync(`afplay "${outputPath}"`, { timeout: 60000 });
    } catch {
      console.log("(afplay not available — file saved for manual playback)");
    }

    // Also generate male voice for comparison
    console.log("Generating male voice (hi-IN-MadhurNeural) for comparison...\n");
    const maleOutput = path.join(audioDir, "test_hindi_natural_male.wav");
    synthesize(script, maleOutput, "hi-IN-MadhurNeural", "-3%", "+0Hz", "+5%");

    const maleBuf = fs.readFileSync(maleOutput);
    const maleDuration = wavDurationMs(maleBuf);
    console.log(`Male voice: ${(maleDuration / 1000).toFixed(1)}s, ${(maleBuf.length / 1024).toFixed(1)}KB`);

    console.log("Playing male voice...\n");
    try {
      execSync(`afplay "${maleOutput}"`, { timeout: 60000 });
    } catch {
      console.log("(afplay not available)");
    }

    console.log("\n═══ Test complete ═══");
    console.log(`Files saved:`);
    console.log(`  Female: ${outputPath}`);
    console.log(`  Male: ${maleOutput}\n`);
  })();
}
