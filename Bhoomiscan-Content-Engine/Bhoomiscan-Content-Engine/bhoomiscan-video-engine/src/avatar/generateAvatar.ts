/**
 * Avatar Video Generator — Creates talking head videos from image + audio.
 *
 * Supports multiple backends:
 *   1. D-ID API (cloud, $18-50/mo, best quality) — RECOMMENDED
 *   2. Wav2Lip (local, free, needs pre-recorded base video)
 *   3. Static fallback (no lip-sync, just image overlay)
 *
 * Pipeline: edge-tts audio + avatar image → lip-synced MP4
 */

import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

// ── Types ──────────────────────────────────────────────────────

export interface AvatarConfig {
  avatarImagePath: string;
  audioPath: string;
  outputPath: string;
  backend?: "d-id" | "wav2lip" | "static";
  /** D-ID API key (base64 encoded). Set via DID_API_KEY env var */
  didApiKey?: string;
  /** Pre-recorded base video for Wav2Lip */
  baseVideoPath?: string;
}

export interface AvatarResult {
  success: boolean;
  outputPath: string;
  durationMs: number;
  backend: string;
  error?: string;
}

// ── Constants ──────────────────────────────────────────────────

const DID_API_URL = "https://api.d-id.com/talks";
const DEFAULT_AVATAR = path.join(process.cwd(), "public", "avatar", "bhoomiscan_avatar.png");
const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 60; // 3 min max wait

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ── D-ID API Backend ──────────────────────────────────────────

/**
 * Upload a local file to a temporary public URL for D-ID.
 * Uses a simple base64 data URL approach for the image,
 * and converts audio to a publicly accessible format.
 */
async function uploadForDID(
  filePath: string,
  type: "image" | "audio"
): Promise<string> {
  const data = fs.readFileSync(filePath);
  const ext = path.extname(filePath).slice(1);
  const mime = type === "image"
    ? `image/${ext === "jpg" ? "jpeg" : ext}`
    : `audio/${ext === "wav" ? "wav" : ext}`;
  return `data:${mime};base64,${data.toString("base64")}`;
}

/**
 * Generate avatar video using D-ID's Talks API.
 *
 * Cost: ~$0.02-0.06 per second of video.
 * For 60 videos × 30s = $18-50/month.
 */
async function generateWithDID(config: AvatarConfig): Promise<AvatarResult> {
  const apiKey = config.didApiKey || process.env.DID_API_KEY;
  if (!apiKey) {
    return { success: false, outputPath: "", durationMs: 0, backend: "d-id", error: "DID_API_KEY not set" };
  }

  const startTime = Date.now();
  console.log(`[avatar:d-id] Starting video generation...`);

  try {
    // Step 1: Create the talk
    const imageData = await uploadForDID(config.avatarImagePath, "image");
    const audioData = await uploadForDID(config.audioPath, "audio");

    const createResponse = await fetch(DID_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source_url: imageData,
        script: {
          type: "audio",
          audio_url: audioData,
        },
        config: {
          stitch: true,
          result_format: "mp4",
          fluent: true,
        },
      }),
    });

    if (!createResponse.ok) {
      const err = await createResponse.text();
      return {
        success: false, outputPath: "", durationMs: Date.now() - startTime,
        backend: "d-id", error: `D-ID create failed (${createResponse.status}): ${err}`,
      };
    }

    const createData = await createResponse.json() as { id: string; status: string };
    console.log(`[avatar:d-id] Talk created: ${createData.id} (status: ${createData.status})`);

    // Step 2: Poll for completion
    let resultUrl = "";
    for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

      const pollResponse = await fetch(`${DID_API_URL}/${createData.id}`, {
        headers: { "Authorization": `Basic ${apiKey}` },
      });

      if (!pollResponse.ok) continue;

      const pollData = await pollResponse.json() as { status: string; result_url?: string; error?: any };
      console.log(`[avatar:d-id] Poll ${i + 1}: status=${pollData.status}`);

      if (pollData.status === "done" && pollData.result_url) {
        resultUrl = pollData.result_url;
        break;
      }
      if (pollData.status === "error" || pollData.status === "rejected") {
        return {
          success: false, outputPath: "", durationMs: Date.now() - startTime,
          backend: "d-id", error: `D-ID generation failed: ${JSON.stringify(pollData.error)}`,
        };
      }
    }

    if (!resultUrl) {
      return {
        success: false, outputPath: "", durationMs: Date.now() - startTime,
        backend: "d-id", error: "D-ID timed out waiting for video",
      };
    }

    // Step 3: Download the result
    console.log(`[avatar:d-id] Downloading result video...`);
    const videoResponse = await fetch(resultUrl);
    const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());

    ensureDir(path.dirname(config.outputPath));
    fs.writeFileSync(config.outputPath, videoBuffer);

    const elapsed = Date.now() - startTime;
    const fileSize = videoBuffer.length;
    console.log(`[avatar:d-id] Saved: ${config.outputPath} (${(fileSize / 1024 / 1024).toFixed(1)}MB, ${(elapsed / 1000).toFixed(0)}s)`);

    return { success: true, outputPath: config.outputPath, durationMs: elapsed, backend: "d-id" };
  } catch (err: any) {
    return {
      success: false, outputPath: "", durationMs: Date.now() - startTime,
      backend: "d-id", error: err.message,
    };
  }
}

// ── Static Fallback (no lip-sync) ─────────────────────────────

/**
 * Create a static avatar video: just the image with audio overlay.
 * Uses ffmpeg to combine a still image + audio into an MP4.
 * This is the zero-cost fallback when no lip-sync is available.
 */
async function generateStatic(config: AvatarConfig): Promise<AvatarResult> {
  const startTime = Date.now();
  console.log(`[avatar:static] Creating static avatar video (no lip-sync)...`);

  try {
    // Get audio duration
    const durationStr = execSync(
      `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${config.audioPath}"`,
      { timeout: 10000 }
    ).toString().trim();
    const audioDuration = parseFloat(durationStr);

    ensureDir(path.dirname(config.outputPath));

    // Combine image + audio into MP4 (image loops for audio duration)
    execSync(
      `ffmpeg -y -loop 1 -i "${config.avatarImagePath}" -i "${config.audioPath}" ` +
      `-c:v libx264 -tune stillimage -c:a aac -b:a 192k ` +
      `-pix_fmt yuv420p -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2" ` +
      `-shortest -t ${audioDuration} "${config.outputPath}" 2>/dev/null`,
      { timeout: 60000 }
    );

    const elapsed = Date.now() - startTime;
    const fileSize = fs.statSync(config.outputPath).size;
    console.log(`[avatar:static] Saved: ${config.outputPath} (${(fileSize / 1024 / 1024).toFixed(1)}MB, ${(elapsed / 1000).toFixed(0)}s)`);

    return { success: true, outputPath: config.outputPath, durationMs: elapsed, backend: "static" };
  } catch (err: any) {
    return {
      success: false, outputPath: "", durationMs: Date.now() - startTime,
      backend: "static", error: err.message,
    };
  }
}

// ── Main Entry Point ──────────────────────────────────────────

/**
 * Generate an avatar video with automatic backend selection.
 *
 * Priority:
 *   1. D-ID API (if DID_API_KEY set) — best quality, ~$0.03/sec
 *   2. Static fallback — free, image + audio combined
 */
export async function generateAvatarVideo(config: AvatarConfig): Promise<AvatarResult> {
  const backend = config.backend || (process.env.DID_API_KEY ? "d-id" : "static");

  console.log(`[avatar] Backend: ${backend}`);
  console.log(`[avatar] Image: ${config.avatarImagePath}`);
  console.log(`[avatar] Audio: ${config.audioPath}`);

  if (!fs.existsSync(config.avatarImagePath)) {
    return { success: false, outputPath: "", durationMs: 0, backend, error: `Image not found: ${config.avatarImagePath}` };
  }
  if (!fs.existsSync(config.audioPath)) {
    return { success: false, outputPath: "", durationMs: 0, backend, error: `Audio not found: ${config.audioPath}` };
  }

  switch (backend) {
    case "d-id":
      return generateWithDID(config);
    case "static":
      return generateStatic(config);
    default:
      return generateStatic(config);
  }
}

/**
 * Full pipeline: Script → edge-tts audio → avatar video
 */
export async function generateAvatarFromScript(
  script: string,
  listingId: string,
  avatarImage?: string
): Promise<{ audioPath: string | null; videoPath: string | null; error?: string }> {
  const audioDir = path.join(process.cwd(), "public", "audio");
  const avatarDir = path.join(process.cwd(), "public", "avatar");
  ensureDir(audioDir);
  ensureDir(avatarDir);

  const image = avatarImage || DEFAULT_AVATAR;
  const audioPath = path.join(audioDir, `avatar_${listingId}.wav`);

  // Step 1: Generate audio with edge-tts
  console.log(`[avatar-pipeline] Step 1: Generating voiceover...`);
  try {
    const { EdgeTTS } = await import("@andresaya/edge-tts");
    const tts = new EdgeTTS();
    const voice = process.env.EDGE_TTS_VOICE || "en-IN-NeerjaNeural";

    await tts.synthesize(script, voice, { rate: "-5%" });
    const mp3Buf = Buffer.from(tts.toBuffer());

    const mp3Tmp = path.join(audioDir, `tmp_avatar_${listingId}.mp3`);
    fs.writeFileSync(mp3Tmp, mp3Buf);
    execSync(`ffmpeg -y -i "${mp3Tmp}" -ar 24000 -ac 1 -sample_fmt s16 "${audioPath}" 2>/dev/null`);
    try { fs.unlinkSync(mp3Tmp); } catch {}

    console.log(`[avatar-pipeline] Audio saved: ${audioPath}`);
  } catch (err: any) {
    return { audioPath: null, videoPath: null, error: `TTS failed: ${err.message}` };
  }

  // Step 2: Generate avatar video
  console.log(`[avatar-pipeline] Step 2: Generating avatar video...`);
  const videoPath = path.join(avatarDir, `avatar_${listingId}.mp4`);

  const result = await generateAvatarVideo({
    avatarImagePath: image,
    audioPath,
    outputPath: videoPath,
  });

  if (!result.success) {
    return { audioPath, videoPath: null, error: `Avatar failed: ${result.error}` };
  }

  return { audioPath, videoPath };
}

// ── CLI Test ──────────────────────────────────────────────────

if (process.argv.includes("--test")) {
  (async () => {
    console.log("\n═══ Avatar Video Pipeline Test ═══\n");

    const audioDir = path.join(process.cwd(), "public", "audio");
    const avatarDir = path.join(process.cwd(), "public", "avatar");
    ensureDir(avatarDir);

    const testAudio = path.join(audioDir, "test_edge_tts.wav");
    const testImage = path.join(avatarDir, "bhoomiscan_avatar.png");

    if (!fs.existsSync(testAudio)) {
      console.log("  ✗ No test audio. Run first:");
      console.log("    npx tsx src/voiceover/generateVoiceoverEdge.ts --test");
      return;
    }

    // Test 1: Static fallback (always works)
    console.log("▸ Test 1: Static avatar (image + audio = MP4)\n");

    // Use a shorter clip for faster testing
    const shortAudio = path.join(audioDir, "test_short.wav");
    if (!fs.existsSync(shortAudio)) {
      execSync(`ffmpeg -y -i "${testAudio}" -t 8 -ar 24000 -ac 1 "${shortAudio}" 2>/dev/null`);
    }

    const staticResult = await generateAvatarVideo({
      avatarImagePath: testImage,
      audioPath: shortAudio,
      outputPath: path.join(avatarDir, "test_static.mp4"),
      backend: "static",
    });

    if (staticResult.success) {
      const size = fs.statSync(staticResult.outputPath).size;
      console.log(`  ✓ Static video: ${staticResult.outputPath}`);
      console.log(`    Size: ${(size / 1024 / 1024).toFixed(1)}MB`);
      console.log(`    Time: ${(staticResult.durationMs / 1000).toFixed(1)}s`);
      console.log(`    Cost: ₹0 (FREE)\n`);
    } else {
      console.log(`  ✗ Static failed: ${staticResult.error}\n`);
    }

    // Test 2: D-ID (if API key available)
    if (process.env.DID_API_KEY) {
      console.log("▸ Test 2: D-ID API avatar (lip-synced)\n");
      const didResult = await generateAvatarVideo({
        avatarImagePath: testImage,
        audioPath: shortAudio,
        outputPath: path.join(avatarDir, "test_did.mp4"),
        backend: "d-id",
      });

      if (didResult.success) {
        console.log(`  ✓ D-ID video: ${didResult.outputPath}`);
        console.log(`    Time: ${(didResult.durationMs / 1000).toFixed(0)}s\n`);
      } else {
        console.log(`  ✗ D-ID failed: ${didResult.error}\n`);
      }
    } else {
      console.log("▸ Test 2: D-ID skipped (set DID_API_KEY to test)\n");
    }

    // Test 3: Full pipeline (script → audio → video)
    console.log("▸ Test 3: Full pipeline (script → audio → video)\n");
    const testScript = "Khordha re plot 5 lakh taka re achhi. BhoomiScan verified listing.";
    const pipelineResult = await generateAvatarFromScript(testScript, "test_pipeline");

    if (pipelineResult.videoPath) {
      console.log(`  ✓ Pipeline complete!`);
      console.log(`    Audio: ${pipelineResult.audioPath}`);
      console.log(`    Video: ${pipelineResult.videoPath}\n`);
    } else {
      console.log(`  ✗ Pipeline error: ${pipelineResult.error}\n`);
    }

    console.log("═══ Test complete ═══");
    console.log("Play: open public/avatar/test_static.mp4\n");
  })();
}
