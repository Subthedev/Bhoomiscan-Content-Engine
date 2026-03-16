/**
 * Voiceover Fine-Tuning A/B Test Suite
 *
 * Generates multiple audio variants to find the OPTIMAL combination of:
 *   1. Voice (AartiNeural vs SwaraNeural vs KavyaNeural)
 *   2. Style + Degree (empathetic/cheerful/newscast × 0.7-1.5)
 *   3. Prosody presets (Indian conversational, slow-clear, fast-energetic)
 *   4. Audio processing (warm, bright, natural, broadcast)
 *
 * Usage: npx tsx tools/voiceover-finetune.ts [--phase 1|2|3|4|all]
 *   Phase 1: Voice comparison (same text, different voices)
 *   Phase 2: Style+degree sweep (winning voice, different emotions)
 *   Phase 3: Prosody presets (winning voice+style, different speech patterns)
 *   Phase 4: Audio processing (winning combo, different EQ/compression)
 *   all: Run all phases sequentially
 */

import * as sdk from "microsoft-cognitiveservices-speech-sdk";
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import { config } from "dotenv";

config();

const AZURE_KEY = process.env.AZURE_SPEECH_KEY!;
const AZURE_REGION = process.env.AZURE_SPEECH_REGION!;

if (!AZURE_KEY || !AZURE_REGION) {
  console.error("Set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION in .env");
  process.exit(1);
}

const OUT_DIR = path.join(process.cwd(), "public", "audio", "finetune");
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

// ── Test Script ──────────────────────────────────────────────
// A representative Hindi real estate pitch covering all emotional ranges:
// excitement, information, pricing, trust, call-to-action

const TEST_SCRIPT = `अरे सुनिए... Khordha में, एक शानदार प्लॉट मिला है... सिर्फ़ 7.8 लाख रुपये में! BhoomiScan verified। सब ready है यहाँ... सड़क, पानी, बिजली, और बाउंड्री... सब कुछ। 1,200 square feet का प्लॉट। Per square feet, सिर्फ़ 650 रुपये। Fair deal है ना! Satish Sahoo जी, ये direct मालिक हैं। DM करें। bhoomiscan.in पर जाइए!`;

// ── Helpers ──────────────────────────────────────────────────

function escapeXml(t: string): string {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Apply inline SSML substitutions for Hindi pronunciation */
function applySubstitutions(text: string): string {
  let s = escapeXml(text);
  s = s.replace(/bhoomiscan\.in/gi, '<sub alias="भूमी स्कैन डॉट इन">bhoomiscan.in</sub>');
  s = s.replace(/BhoomiScan/g, '<sub alias="भूमी स्कैन">BhoomiScan</sub>');
  s = s.replace(/\bDM\b/g, '<sub alias="डी एम">DM</sub>');
  s = s.replace(/\bFair deal\b/gi, '<sub alias="फ़ेयर डील">Fair deal</sub>');
  s = s.replace(/\bFull infrastructure\b/gi, '<sub alias="फ़ुल इंफ़्रास्ट्रक्चर">Full infrastructure</sub>');
  s = s.replace(/\bverified\b/gi, '<sub alias="वेरिफ़ाइड">verified</sub>');
  s = s.replace(/\bready\b/gi, '<sub alias="रेडी">ready</sub>');
  s = s.replace(/\bsquare feet\b/gi, '<sub alias="स्क्वेयर फ़ीट">square feet</sub>');
  s = s.replace(/\bdirect\b/gi, '<sub alias="डायरेक्ट">direct</sub>');
  s = s.replace(/\.\.\./g, '<break time="200ms"/>');
  s = s.replace(/सिर्फ़/g, '<break time="120ms"/>सिर्फ़');
  return s;
}

function buildSSML(
  text: string,
  voice: string,
  style: string,
  styleDegree: number,
  rate: string,
  pitch: string,
  contour?: string
): string {
  const processed = applySubstitutions(text);
  const prosodyAttrs = [`rate="${rate}"`, `pitch="${pitch}"`];
  if (contour) prosodyAttrs.push(`contour="${contour}"`);

  // If style is "none", skip express-as wrapper
  if (style === "none") {
    return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="hi-IN">
  <voice name="${voice}">
    <mstts:silence type="Leading" value="30ms"/>
    <mstts:silence type="Sentenceboundary" value="60ms"/>
    <prosody ${prosodyAttrs.join(" ")}>
      ${processed}
    </prosody>
  </voice>
</speak>`;
  }

  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="hi-IN">
  <voice name="${voice}">
    <mstts:silence type="Leading" value="30ms"/>
    <mstts:silence type="Sentenceboundary" value="60ms"/>
    <mstts:express-as style="${style}" styledegree="${styleDegree}">
      <prosody ${prosodyAttrs.join(" ")}>
        ${processed}
      </prosody>
    </mstts:express-as>
  </voice>
</speak>`;
}

function synthesize(ssml: string, outputPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const speechConfig = sdk.SpeechConfig.fromSubscription(AZURE_KEY, AZURE_REGION);
    speechConfig.speechSynthesisOutputFormat =
      sdk.SpeechSynthesisOutputFormat.Riff48Khz16BitMonoPcm;
    const synthesizer = new sdk.SpeechSynthesizer(speechConfig, null as any);

    synthesizer.speakSsmlAsync(
      ssml,
      (result) => {
        synthesizer.close();
        if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
          fs.writeFileSync(outputPath, Buffer.from(result.audioData));
          const size = fs.statSync(outputPath).size;
          resolve(size);
        } else {
          reject(new Error(result.errorDetails || "Synthesis failed"));
        }
      },
      (err) => { synthesizer.close(); reject(err); }
    );
  });
}

/** Apply ffmpeg processing and return duration in seconds */
function processAudio(inputPath: string, outputPath: string, filterChain: string): number {
  execSync(
    `ffmpeg -y -i "${inputPath}" -af "${filterChain}" -ar 48000 -ac 1 -sample_fmt s16 -f wav "${outputPath}" 2>/dev/null`,
    { timeout: 15000 }
  );
  // Get duration
  try {
    const result = execSync(
      `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${outputPath}"`,
      { timeout: 5000, encoding: "utf-8" }
    );
    return parseFloat(result.trim()) || 0;
  } catch { return 0; }
}

function playAudio(filePath: string): void {
  try {
    console.log(`  ▶ Playing...`);
    execSync(`afplay "${filePath}"`, { timeout: 120000 });
  } catch {
    console.log("  (afplay failed — check file manually)");
  }
}

// ── Phase 1: Voice Comparison ────────────────────────────────

async function phase1_voices() {
  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log("║  PHASE 1: VOICE COMPARISON                          ║");
  console.log("║  Same text, same style — which voice sounds best?   ║");
  console.log("╚══════════════════════════════════════════════════════╝\n");

  const voices = [
    { name: "hi-IN-AartiNeural",  label: "Aarti (F, DelightfulTTS2, style-enabled)" },
    { name: "hi-IN-SwaraNeural",  label: "Swara (F, original, style-enabled)" },
    { name: "hi-IN-KavyaNeural",  label: "Kavya (F, newer, default-only)" },
    { name: "hi-IN-AnanyaNeural", label: "Ananya (F, newer, default-only)" },
    { name: "hi-IN-MadhurNeural", label: "Madhur (M, original)" },
    { name: "hi-IN-AaravNeural",  label: "Aarav (M, newer)" },
  ];

  for (const v of voices) {
    const filename = `p1_${v.name}.wav`;
    const rawPath = path.join(OUT_DIR, filename + ".raw.wav");
    const outPath = path.join(OUT_DIR, filename);

    // Style-enabled voices get empathetic, others get "none"
    const hasStyles = v.name.includes("Aarti") || v.name.includes("Swara");
    const style = hasStyles ? "empathetic" : "none";
    const degree = hasStyles ? 0.9 : 1.0;

    console.log(`── ${v.label} ──`);
    try {
      const ssml = buildSSML(TEST_SCRIPT, v.name, style, degree, "-2%", "+1Hz");
      await synthesize(ssml, rawPath);
      const dur = processAudio(rawPath,outPath,
        "highpass=f=75,acompressor=threshold=-22dB:ratio=1.8:attack=10:release=250,equalizer=f=3000:t=q:w=1.0:g=1.5,equalizer=f=6000:t=q:w=1.0:g=-0.5"
      );
      try { fs.unlinkSync(rawPath); } catch {}
      console.log(`  ${dur.toFixed(1)}s | ${(fs.statSync(outPath).size / 1024).toFixed(0)}KB | style=${style} ${degree}`);
      playAudio(outPath);
      console.log();
    } catch (err: any) {
      console.log(`  FAILED: ${err.message}\n`);
      try { fs.unlinkSync(rawPath); } catch {}
    }
  }

  console.log("Listen and pick the best voice for Phase 2.\n");
}

// ── Phase 2: Style + Degree Sweep ────────────────────────────

async function phase2_styles(voice: string) {
  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log(`║  PHASE 2: STYLE + DEGREE SWEEP (${voice})  ║`);
  console.log("║  Which emotion + intensity sounds most natural?     ║");
  console.log("╚══════════════════════════════════════════════════════╝\n");

  const combos = [
    { style: "empathetic",  degree: 0.7, label: "empathetic 0.7 (gentle)" },
    { style: "empathetic",  degree: 0.9, label: "empathetic 0.9 (current)" },
    { style: "empathetic",  degree: 1.1, label: "empathetic 1.1 (warmer)" },
    { style: "empathetic",  degree: 1.3, label: "empathetic 1.3 (very warm)" },
    { style: "cheerful",    degree: 0.8, label: "cheerful 0.8 (light)" },
    { style: "cheerful",    degree: 1.0, label: "cheerful 1.0 (standard)" },
    { style: "cheerful",    degree: 1.3, label: "cheerful 1.3 (enthusiastic)" },
    { style: "newscast",    degree: 0.6, label: "newscast 0.6 (hint of authority)" },
    { style: "newscast",    degree: 0.9, label: "newscast 0.9 (news anchor)" },
    { style: "none",        degree: 1.0, label: "no style (pure neural default)" },
  ];

  for (const c of combos) {
    const filename = `p2_${c.style}_${c.degree}.wav`;
    const rawPath = path.join(OUT_DIR, filename + ".raw.wav");
    const outPath = path.join(OUT_DIR, filename);

    console.log(`── ${c.label} ──`);
    try {
      const ssml = buildSSML(TEST_SCRIPT, voice, c.style, c.degree, "-2%", "+1Hz");
      await synthesize(ssml, rawPath);
      const dur = processAudio(rawPath, outPath,
        "highpass=f=75,acompressor=threshold=-22dB:ratio=1.8:attack=10:release=250,equalizer=f=3000:t=q:w=1.0:g=1.5,equalizer=f=6000:t=q:w=1.0:g=-0.5"
      );
      try { fs.unlinkSync(rawPath); } catch {}
      console.log(`  ${dur.toFixed(1)}s | ${(fs.statSync(outPath).size / 1024).toFixed(0)}KB`);
      playAudio(outPath);
      console.log();
    } catch (err: any) {
      console.log(`  FAILED: ${err.message}\n`);
      try { fs.unlinkSync(rawPath); } catch {}
    }
  }

  console.log("Pick the best style+degree for Phase 3.\n");
}

// ── Phase 3: Prosody Presets ─────────────────────────────────

async function phase3_prosody(voice: string, style: string, degree: number) {
  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log(`║  PHASE 3: PROSODY PRESETS (${style} ${degree})              ║`);
  console.log("║  Which speech pattern sounds most Indian & natural? ║");
  console.log("╚══════════════════════════════════════════════════════╝\n");

  const presets = [
    {
      label: "Indian Conversational (current v6)",
      rate: "-2%", pitch: "+1Hz",
      contour: "(0%,+0Hz) (20%,+5Hz) (50%,+8Hz) (75%,+3Hz) (100%,-3Hz)",
    },
    {
      label: "Slow & Clear (max word clarity)",
      rate: "-8%", pitch: "+0Hz",
      contour: "(0%,+0Hz) (30%,+3Hz) (60%,+2Hz) (100%,-2Hz)",
    },
    {
      label: "Hindi Melodic (wider pitch curves)",
      rate: "-3%", pitch: "+2Hz",
      contour: "(0%,-2Hz) (15%,+8Hz) (35%,+12Hz) (55%,+5Hz) (75%,+10Hz) (100%,-5Hz)",
    },
    {
      label: "Reel-style Energetic (fast, punchy)",
      rate: "+5%", pitch: "+4Hz",
      contour: "(0%,+0Hz) (20%,+10Hz) (50%,+6Hz) (80%,+8Hz) (100%,-2Hz)",
    },
    {
      label: "Hindi News Anchor (authoritative, measured)",
      rate: "-5%", pitch: "-1Hz",
      contour: "(0%,+2Hz) (40%,+4Hz) (70%,+1Hz) (100%,-4Hz)",
    },
    {
      label: "Warm Storyteller (gentle arcs, medium pace)",
      rate: "-4%", pitch: "+2Hz",
      contour: "(0%,+0Hz) (25%,+6Hz) (50%,+10Hz) (75%,+4Hz) (100%,-2Hz)",
    },
    {
      label: "Real Estate Agent (confident, persuasive)",
      rate: "-2%", pitch: "+3Hz",
      contour: "(0%,+0Hz) (15%,+4Hz) (40%,+10Hz) (60%,+6Hz) (85%,+8Hz) (100%,-3Hz)",
    },
    {
      label: "Ultra-melodic Indian (maximum pitch variation)",
      rate: "-3%", pitch: "+2Hz",
      contour: "(0%,-3Hz) (10%,+10Hz) (25%,+5Hz) (40%,+15Hz) (55%,+3Hz) (70%,+12Hz) (85%,+6Hz) (100%,-5Hz)",
    },
  ];

  for (const p of presets) {
    const safeName = p.label.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
    const filename = `p3_${safeName}.wav`;
    const rawPath = path.join(OUT_DIR, filename + ".raw.wav");
    const outPath = path.join(OUT_DIR, filename);

    console.log(`── ${p.label} ──`);
    console.log(`  rate=${p.rate} pitch=${p.pitch} contour=${p.contour}`);
    try {
      const ssml = buildSSML(TEST_SCRIPT, voice, style, degree, p.rate, p.pitch, p.contour);
      await synthesize(ssml, rawPath);
      const dur = processAudio(rawPath, outPath,
        "highpass=f=75,acompressor=threshold=-22dB:ratio=1.8:attack=10:release=250,equalizer=f=3000:t=q:w=1.0:g=1.5,equalizer=f=6000:t=q:w=1.0:g=-0.5"
      );
      try { fs.unlinkSync(rawPath); } catch {}
      console.log(`  ${dur.toFixed(1)}s | ${(fs.statSync(outPath).size / 1024).toFixed(0)}KB`);
      playAudio(outPath);
      console.log();
    } catch (err: any) {
      console.log(`  FAILED: ${err.message}\n`);
      try { fs.unlinkSync(rawPath); } catch {}
    }
  }

  console.log("Pick the best prosody preset for Phase 4.\n");
}

// ── Phase 4: Audio Processing ────────────────────────────────

async function phase4_audio(voice: string, style: string, degree: number, rate: string, pitch: string, contour: string) {
  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log("║  PHASE 4: AUDIO PROCESSING                         ║");
  console.log("║  Which post-processing sounds most broadcast-ready? ║");
  console.log("╚══════════════════════════════════════════════════════╝\n");

  // Generate raw audio once
  const rawPath = path.join(OUT_DIR, "p4_raw.wav");
  const ssml = buildSSML(TEST_SCRIPT, voice, style, degree, rate, pitch, contour);
  await synthesize(ssml, rawPath);

  const chains = [
    {
      label: "Current v6 (balanced clarity+warmth)",
      filter: "highpass=f=75,acompressor=threshold=-22dB:ratio=1.8:attack=10:release=250,equalizer=f=180:t=q:w=0.8:g=1.2,equalizer=f=3000:t=q:w=1.0:g=1.5,equalizer=f=6000:t=q:w=1.0:g=-0.5",
    },
    {
      label: "Broadcast Warm (more bass, FM radio feel)",
      filter: "highpass=f=60,acompressor=threshold=-20dB:ratio=2.5:attack=5:release=150,equalizer=f=150:t=q:w=0.6:g=2.5,equalizer=f=2500:t=q:w=0.8:g=2.0,equalizer=f=5500:t=q:w=1.2:g=-1.0",
    },
    {
      label: "Crystal Clear (presence boost, no warmth)",
      filter: "highpass=f=100,acompressor=threshold=-18dB:ratio=2:attack=8:release=200,equalizer=f=2000:t=q:w=0.8:g=2.0,equalizer=f=4000:t=q:w=0.8:g=2.5,equalizer=f=7000:t=q:w=1.0:g=-1.5",
    },
    {
      label: "Natural Minimal (barely touched, trust the AI)",
      filter: "highpass=f=75,acompressor=threshold=-25dB:ratio=1.3:attack=15:release=300",
    },
    {
      label: "Indian Podcast (warm + clarity + de-ess + loudnorm)",
      filter: "highpass=f=70,acompressor=threshold=-22dB:ratio=2:attack=8:release=200,equalizer=f=200:t=q:w=0.7:g=1.8,equalizer=f=3000:t=q:w=0.9:g=2.0,equalizer=f=6500:t=q:w=0.8:g=-1.0,loudnorm=I=-16:LRA=12:TP=-1.5",
    },
    {
      label: "Reel/Social (punchy, compressed, loud)",
      filter: "highpass=f=80,acompressor=threshold=-18dB:ratio=3:attack=3:release=80,equalizer=f=250:t=q:w=0.6:g=2.0,equalizer=f=3500:t=q:w=0.7:g=3.0,equalizer=f=6000:t=q:w=1.0:g=-0.5,loudnorm=I=-14:LRA=8:TP=-1.0",
    },
  ];

  for (const c of chains) {
    const safeName = c.label.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
    const outPath = path.join(OUT_DIR, `p4_${safeName}.wav`);

    console.log(`── ${c.label} ──`);
    try {
      const dur = processAudio(rawPath, outPath, c.filter);
      console.log(`  ${dur.toFixed(1)}s | ${(fs.statSync(outPath).size / 1024).toFixed(0)}KB`);
      playAudio(outPath);
      console.log();
    } catch (err: any) {
      console.log(`  FAILED: ${err.message}\n`);
    }
  }

  try { fs.unlinkSync(rawPath); } catch {}
  console.log("Pick your favorite audio processing. Done!\n");
}

// ── Main ─────────────────────────────────────────────────────

const phase = process.argv.find(a => a.startsWith("--phase"))?.split("=")[1]
  || process.argv[process.argv.indexOf("--phase") + 1]
  || "1";

(async () => {
  console.log("\n════════════════════════════════════════════════════════");
  console.log("  VOICEOVER FINE-TUNING A/B TEST SUITE");
  console.log("  Listen carefully to each variant, note your favorites");
  console.log("════════════════════════════════════════════════════════");
  console.log(`\nOutput directory: ${OUT_DIR}\n`);

  if (phase === "1" || phase === "all") {
    await phase1_voices();
  }

  if (phase === "2" || phase === "all") {
    // Default to AartiNeural for phase 2; override with --voice
    const voice = process.argv.find(a => a.startsWith("--voice="))?.split("=")[1] || "hi-IN-AartiNeural";
    await phase2_styles(voice);
  }

  if (phase === "3" || phase === "all") {
    const voice = process.argv.find(a => a.startsWith("--voice="))?.split("=")[1] || "hi-IN-AartiNeural";
    const style = process.argv.find(a => a.startsWith("--style="))?.split("=")[1] || "empathetic";
    const degree = parseFloat(process.argv.find(a => a.startsWith("--degree="))?.split("=")[1] || "0.9");
    await phase3_prosody(voice, style, degree);
  }

  if (phase === "4" || phase === "all") {
    const voice = process.argv.find(a => a.startsWith("--voice="))?.split("=")[1] || "hi-IN-AartiNeural";
    const style = process.argv.find(a => a.startsWith("--style="))?.split("=")[1] || "empathetic";
    const degree = parseFloat(process.argv.find(a => a.startsWith("--degree="))?.split("=")[1] || "0.9");
    const rate = process.argv.find(a => a.startsWith("--rate="))?.split("=")[1] || "-2%";
    const pitch = process.argv.find(a => a.startsWith("--pitch="))?.split("=")[1] || "+1Hz";
    const contour = process.argv.find(a => a.startsWith("--contour="))?.split("=")[1]
      || "(0%,+0Hz) (20%,+5Hz) (50%,+8Hz) (75%,+3Hz) (100%,-3Hz)";
    await phase4_audio(voice, style, degree, rate, pitch, contour);
  }

  console.log("\n══ All files saved in: " + OUT_DIR + " ══\n");
})();
