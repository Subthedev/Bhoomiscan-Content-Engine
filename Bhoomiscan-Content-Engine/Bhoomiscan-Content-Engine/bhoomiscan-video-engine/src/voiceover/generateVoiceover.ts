import * as fs from "fs";
import * as path from "path";
import { ListingVideoProps } from "../types";
import { generateScript, generateTimedScript } from "./scriptGenerator";
import { ContentRichness } from "../analysis/contentAnalyzer";

const SARVAM_TTS_URL = "https://api.sarvam.ai/text-to-speech";

/** Silence gap between per-section audio segments (ms) */
const SILENCE_GAP_MS = 300;

interface SarvamTTSResponse {
  audios: string[];
}

export interface VoiceoverOptions {
  speaker?: string;
  pace?: number;
  temperature?: number;
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

/** Get the configured speaker, allowing env override for A/B testing */
function getSpeaker(override?: string): string {
  return override || process.env.SARVAM_SPEAKER || "kavitha";
}

/** Calculate WAV duration in ms from buffer size (16kHz, 16-bit mono) */
function wavDurationMs(bufferLength: number): number {
  return Math.round(((bufferLength - 44) / (16000 * 2)) * 1000);
}

/** Generate a silence WAV buffer of given duration (16kHz, 16-bit mono) */
function generateSilenceBuffer(durationMs: number): Buffer {
  const sampleRate = 16000;
  const bytesPerSample = 2;
  const numSamples = Math.round((durationMs / 1000) * sampleRate);
  const dataSize = numSamples * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);

  // WAV header
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16); // PCM chunk size
  buffer.writeUInt16LE(1, 20); // PCM format
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * bytesPerSample, 28);
  buffer.writeUInt16LE(bytesPerSample, 32);
  buffer.writeUInt16LE(16, 34); // bits per sample
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);
  // Data portion is already zeroed (silence)

  return buffer;
}

/**
 * Generate an Odia voiceover for a property listing using Sarvam AI TTS.
 *
 * Saves the WAV file to public/audio/ so Remotion can serve it via staticFile().
 * Returns the staticFile-compatible path (e.g. "audio/voiceover_abc123.wav"),
 * or null if generation fails.
 */
export async function generateVoiceover(
  props: ListingVideoProps,
  options: VoiceoverOptions = {}
): Promise<string | null> {
  const apiKey = process.env.SARVAM_API_KEY;
  if (!apiKey) {
    console.warn("[voiceover] SARVAM_API_KEY not set, skipping voiceover generation");
    return null;
  }

  const script = generateScript(props);
  console.log(`[voiceover] Script (${script.length} chars):\n${script}\n`);

  try {
    const response = await fetch(SARVAM_TTS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-subscription-key": apiKey,
      },
      body: JSON.stringify({
        inputs: [script],
        target_language_code: "od-IN",
        speaker: getSpeaker(options.speaker),
        model: "bulbul:v3",
        pace: options.pace ?? 0.95,
        temperature: options.temperature ?? 0.7,
        enable_preprocessing: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[voiceover] Sarvam API error ${response.status}: ${errorText}`);
      return null;
    }

    const data = (await response.json()) as SarvamTTSResponse;

    if (!data.audios || data.audios.length === 0) {
      console.error("[voiceover] No audio data in Sarvam API response");
      return null;
    }

    // Save to public/audio/ so Remotion can access it via staticFile()
    const audioDir = path.join(process.cwd(), "public", "audio");
    if (!fs.existsSync(audioDir)) {
      fs.mkdirSync(audioDir, { recursive: true });
    }

    const filename = `voiceover_${props.listingId}.wav`;
    const outputPath = path.join(audioDir, filename);
    const audioBuffer = Buffer.from(data.audios[0], "base64");
    fs.writeFileSync(outputPath, audioBuffer);

    console.log(`[voiceover] Saved to ${outputPath} (${(audioBuffer.length / 1024).toFixed(1)}KB)`);

    // Return the staticFile-compatible relative path
    return filename;
  } catch (error) {
    console.error("[voiceover] Failed to generate voiceover:", error);
    return null;
  }
}

/**
 * Generate a timed voiceover with per-section timing estimates.
 *
 * Key improvement: sends each script section as a separate element in Sarvam's
 * `inputs` array. This gives us:
 * - Exact per-section audio duration (no more character-count estimation)
 * - Natural inter-sentence pauses (TTS restarts breathing per input)
 * - Better pronunciation per section (shorter text = less drift)
 * - Same cost (Sarvam charges per character, not per call)
 */
export async function generateTimedVoiceover(
  props: ListingVideoProps,
  richness: ContentRichness,
  options: VoiceoverOptions = {}
): Promise<TimedVoiceover | null> {
  const apiKey = process.env.SARVAM_API_KEY;
  if (!apiKey) {
    console.warn("[voiceover] SARVAM_API_KEY not set, skipping voiceover generation");
    return null;
  }

  const sections = generateTimedScript(props, richness);
  const sectionTexts = sections.map((s) => s.text);
  const totalChars = sectionTexts.reduce((sum, t) => sum + t.length, 0);
  console.log(`[voiceover] Per-section TTS (${totalChars} chars, ${sections.length} sections):`);
  sections.forEach((s) => console.log(`  [${s.sectionId}] ${s.text}`));

  try {
    const speaker = getSpeaker(options.speaker);
    const response = await fetch(SARVAM_TTS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-subscription-key": apiKey,
      },
      body: JSON.stringify({
        inputs: sectionTexts,
        target_language_code: "od-IN",
        speaker,
        model: "bulbul:v3",
        pace: options.pace ?? 0.95,
        temperature: options.temperature ?? 0.7,
        enable_preprocessing: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[voiceover] Sarvam API error ${response.status}: ${errorText}`);
      return null;
    }

    const data = (await response.json()) as SarvamTTSResponse;

    if (!data.audios || data.audios.length === 0) {
      console.error("[voiceover] No audio data in Sarvam API response");
      return null;
    }

    // Parse each audio buffer
    const audioBuffers = data.audios.map((b64) => Buffer.from(b64, "base64"));

    // Generate silence buffer for breathing pauses
    const silenceBuffer = generateSilenceBuffer(SILENCE_GAP_MS);
    // Strip the WAV header (44 bytes) from silence for raw PCM
    const silencePCM = silenceBuffer.subarray(44);

    // Calculate exact per-section durations and build section estimates
    let cumulativeMs = 0;
    const sectionEstimates: TimedVoiceover["sectionEstimates"] = [];
    const pcmChunks: Buffer[] = [];

    for (let i = 0; i < sections.length; i++) {
      const buf = audioBuffers[i];
      if (!buf || buf.length <= 44) {
        // Empty or invalid audio for this section — use template estimate
        const durationMs = sections[i].estimatedDurationMs;
        sectionEstimates.push({
          sectionId: sections[i].sectionId,
          estimatedStartMs: cumulativeMs,
          estimatedEndMs: cumulativeMs + durationMs,
        });
        cumulativeMs += durationMs;
        continue;
      }

      const durationMs = wavDurationMs(buf.length);
      sectionEstimates.push({
        sectionId: sections[i].sectionId,
        estimatedStartMs: cumulativeMs,
        estimatedEndMs: cumulativeMs + durationMs,
      });

      // Append raw PCM data (skip 44-byte WAV header)
      pcmChunks.push(buf.subarray(44));
      cumulativeMs += durationMs;

      // Add silence gap between sections (not after last)
      if (i < sections.length - 1) {
        pcmChunks.push(silencePCM);
        cumulativeMs += SILENCE_GAP_MS;
      }
    }

    // Concatenate all PCM into a single WAV file
    const totalPCMSize = pcmChunks.reduce((sum, c) => sum + c.length, 0);
    const finalWav = Buffer.alloc(44 + totalPCMSize);

    // Write WAV header for concatenated audio
    finalWav.write("RIFF", 0);
    finalWav.writeUInt32LE(36 + totalPCMSize, 4);
    finalWav.write("WAVE", 8);
    finalWav.write("fmt ", 12);
    finalWav.writeUInt32LE(16, 16);
    finalWav.writeUInt16LE(1, 20); // PCM
    finalWav.writeUInt16LE(1, 22); // mono
    finalWav.writeUInt32LE(16000, 24); // sample rate
    finalWav.writeUInt32LE(16000 * 2, 28); // byte rate
    finalWav.writeUInt16LE(2, 32); // block align
    finalWav.writeUInt16LE(16, 34); // bits per sample
    finalWav.write("data", 36);
    finalWav.writeUInt32LE(totalPCMSize, 40);

    let offset = 44;
    for (const chunk of pcmChunks) {
      chunk.copy(finalWav, offset);
      offset += chunk.length;
    }

    // Save concatenated WAV
    const audioDir = path.join(process.cwd(), "public", "audio");
    if (!fs.existsSync(audioDir)) {
      fs.mkdirSync(audioDir, { recursive: true });
    }

    const filename = `voiceover_${props.listingId}.wav`;
    const outputPath = path.join(audioDir, filename);
    fs.writeFileSync(outputPath, finalWav);

    const totalDurationMs = cumulativeMs;

    console.log(`[voiceover] Speaker: ${speaker}, pace: ${options.pace ?? 0.95}, temp: ${options.temperature ?? 0.7}`);
    console.log(`[voiceover] Timed voiceover: ${(finalWav.length / 1024).toFixed(1)}KB, ${(totalDurationMs / 1000).toFixed(1)}s`);
    console.log(`[voiceover] Section durations:`, sectionEstimates.map((s) =>
      `${s.sectionId}: ${(s.estimatedStartMs / 1000).toFixed(1)}-${(s.estimatedEndMs / 1000).toFixed(1)}s`
    ));

    return {
      filename,
      totalDurationMs,
      sectionEstimates,
    };
  } catch (error) {
    console.error("[voiceover] Failed to generate timed voiceover:", error);
    return null;
  }
}

/** Clean up voiceover file from public/audio/ */
export function cleanupVoiceover(filename: string): void {
  try {
    const filePath = path.join(process.cwd(), "public", "audio", filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`[voiceover] Cleaned up ${filePath}`);
    }
  } catch {
    // non-critical
  }
}

// CLI test mode
if (process.argv.includes("--test")) {
  import("../fixtures/sampleProperty").then(async ({ sampleProperty }) => {
    const { config } = await import("dotenv");
    config();
    console.log("[voiceover:test] Generating test voiceover...");
    const result = await generateVoiceover(sampleProperty);
    if (result) {
      console.log(`[voiceover:test] Success: ${result}`);
    } else {
      console.log("[voiceover:test] Failed or skipped (no API key?)");
    }
  });
}
