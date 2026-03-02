/**
 * Video Generation Pipeline — Cost-Effective & Resilient
 *
 * Key design principles:
 * 1. NEVER lose a rendered video — if upload fails, save path to DB for retry
 * 2. NEVER double-pay for voiceover — single API call, no fallback retry
 * 3. Checkpoint at every expensive step — can resume from any failure point
 * 4. Batch mode shares a single Webpack bundle across all renders
 *
 * Pipeline steps:
 * 1. Fetch property data from Supabase
 * 2. Check for existing local render (skip re-render if MP4 exists)
 * 3. Analyze content richness + smart photo selection (parallel, free)
 * 4. Generate voiceover (single Sarvam API call — cost: ~₹0.5)
 * 5. Render video with Remotion (CPU cost: ~60-90s)
 * 6. Upload with retry + fallback (Cloudinary → Supabase Storage)
 * 7. Update DB (with retry)
 *
 * On failure at any step after rendering, the MP4 is preserved and
 * the DB is marked as "upload_failed" with the local path for retry.
 */

import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import * as path from "path";
import * as fs from "fs";
import { mapPropertyToVideoProps, VideoVariant, ListingVideoProps } from "./types";
import { generateVoiceover, cleanupVoiceover, generateTimedVoiceover } from "./voiceover/generateVoiceover";
import { uploadAndUpdateProperty, retryUploadFromLocal } from "./upload";
import { analyzeContent } from "./analysis/contentAnalyzer";
import { selectAndOrderPhotos } from "./analysis/photoSelector";
import { analyzeVideo } from "./analysis/videoAnalyzer";
import { computeDynamicSections, FPS } from "./utils/timing";

const ENTRY_POINT = path.join(__dirname, "..", "src", "index.ts");
const OUTPUT_DIR = path.join(__dirname, "..", "output");

export interface PipelineOptions {
  variant?: VideoVariant;
  skipVoiceover?: boolean;
  skipUpload?: boolean;
  /** Pre-built Remotion bundle path (for batch mode — avoids re-bundling) */
  sharedBundlePath?: string;
}

export interface PipelineResult {
  propertyId: string;
  outputPath: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  duration: number; // ms
  status: "done" | "upload_failed" | "rendered_locally";
}

function getSupabase(): SupabaseClient {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required");
  return createClient(url, key);
}

/** Update DB status helper */
async function updateStatus(
  supabase: SupabaseClient,
  propertyId: string,
  status: string,
  extra: Record<string, unknown> = {}
) {
  try {
    await supabase
      .from("properties")
      .update({ video_generation_status: status, ...extra })
      .eq("id", propertyId);
  } catch (_) {
    console.warn(`[pipeline] Could not update status to "${status}" for ${propertyId}`);
  }
}

/**
 * Generate a video for a single property.
 */
export async function generatePropertyVideo(
  propertyId: string,
  options: PipelineOptions = {}
): Promise<PipelineResult> {
  const start = Date.now();
  const { variant = "spotlight", skipVoiceover = false, skipUpload = false } = options;
  const supabase = getSupabase();

  console.log(`\n[pipeline] Starting video generation for ${propertyId}`);
  console.log(`[pipeline] Variant: ${variant}, Voiceover: ${!skipVoiceover}, Upload: ${!skipUpload}`);

  // ── Mark as "rendering" ──
  await updateStatus(supabase, propertyId, "rendering");

  try {
    // ── 1. Fetch property (with fallback if profiles join fails) ──
    let property: any;
    const { data: propData, error: propError } = await supabase
      .from("properties")
      .select(`
        *,
        property_images (id, image_url, is_primary, display_order),
        profiles!properties_owner_id_fkey (full_name, phone, email)
      `)
      .eq("id", propertyId)
      .single();

    if (propError) {
      // Fallback: fetch without profiles join
      const { data: fallback, error: fbError } = await supabase
        .from("properties")
        .select(`*, property_images (id, image_url, is_primary, display_order)`)
        .eq("id", propertyId)
        .single();

      if (fbError || !fallback) {
        throw new Error(`Property not found: ${propertyId} — ${fbError?.message || propError?.message}`);
      }
      property = { ...fallback, profiles: null };
    } else {
      property = propData;
    }

    if (!property) {
      throw new Error(`Property not found: ${propertyId}`);
    }

    const images = property.property_images || [];
    const hasVideo = !!property.video_url;
    console.log(`[pipeline] Property: "${property.title}"`);
    console.log(`[pipeline] Images: ${images.length}, Has video: ${hasVideo}`);

    if (images.length === 0 && !hasVideo) {
      console.warn("[pipeline] Warning: No images or video — using placeholder");
    }

    // ── 2. Check for existing local render (checkpoint) ──
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
    const outputPath = path.join(OUTPUT_DIR, `${propertyId}_${variant}.mp4`);
    let skipRendering = false;

    if (fs.existsSync(outputPath)) {
      const stats = fs.statSync(outputPath);
      const ageMinutes = (Date.now() - stats.mtimeMs) / 60000;
      // Reuse if the file is < 30 minutes old and > 1MB (valid render)
      if (ageMinutes < 30 && stats.size > 1_000_000) {
        const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
        console.log(`[pipeline] Found recent local render: ${outputPath} (${sizeMB}MB, ${ageMinutes.toFixed(0)}m old)`);
        console.log(`[pipeline] Skipping re-render — reusing existing file (saves ~60s + voiceover cost)`);
        skipRendering = true;
      }
    }

    let totalFrames: number | undefined;

    if (!skipRendering) {
      // ── 3. Map to video props ──
      let inputProps = mapPropertyToVideoProps(property, variant);

      // ── 4. Analyze content + photo selection (parallel, free) ──
      const richness = analyzeContent(inputProps);
      console.log(`[pipeline] Content: tier=${richness.tier}, photos=${richness.photoCount}, features=${richness.featureCount}, price=${richness.priceRange}`);

      const [photoResult, videoSegment] = await Promise.all([
        selectAndOrderPhotos(inputProps.photos),
        inputProps.videoUrl ? analyzeVideo(inputProps.videoUrl) : Promise.resolve(null),
      ]);

      inputProps = { ...inputProps, photos: photoResult.ordered };
      if (photoResult.scores.length > 0) {
        console.log(`[pipeline] Photo scores: hero=${photoResult.scores[0].composite.toFixed(2)}, total=${photoResult.scores.length}`);
      }
      if (videoSegment) {
        inputProps = { ...inputProps, videoStartFrom: videoSegment.startFrom };
        console.log(`[pipeline] Video segment: start=${videoSegment.startFrom}s, duration=${videoSegment.duration}s`);
      }

      // ── 5. Generate voiceover (SINGLE API call — cost-effective) ──
      let voiceoverPath: string | null = null;
      if (!skipVoiceover) {
        console.log("[pipeline] Generating Odia voiceover...");
        // Try timed voiceover first (uses intelligent templates)
        const timedVO = await generateTimedVoiceover(inputProps, richness);
        if (timedVO) {
          voiceoverPath = timedVO.filename;
          inputProps = { ...inputProps, voiceoverAudioUrl: timedVO.filename };
          const { sections, totalFrames: tf } = computeDynamicSections(timedVO.sectionEstimates, richness);
          inputProps = { ...inputProps, sectionTimings: sections, totalFrames: tf };
          totalFrames = tf;
          console.log(`[pipeline] Dynamic timing: ${tf} frames (${(tf / FPS).toFixed(1)}s)`);
        } else {
          // Timed failed — use legacy BUT ONLY if timed returned null due to
          // missing API key (not a network error that already spent the API call)
          if (!process.env.SARVAM_API_KEY) {
            console.log("[pipeline] Voiceover skipped (no SARVAM_API_KEY)");
          } else {
            // The timed call already used the API key and failed at parsing/file level.
            // Do NOT call legacy — that would be a second paid API call for the same result.
            console.log("[pipeline] Timed voiceover failed — skipping to avoid double API cost");
          }
        }
      }

      // ── 6. Render video ──
      console.log("[pipeline] Bundling Remotion project...");
      const bundled = options.sharedBundlePath || await bundle({
        entryPoint: ENTRY_POINT,
        webpackOverride: (c) => c,
      });

      console.log("[pipeline] Rendering video...");
      const composition = await selectComposition({
        serveUrl: bundled,
        id: "ListingVideo",
        inputProps,
      });

      await renderMedia({
        composition,
        serveUrl: bundled,
        codec: "h264",
        outputLocation: outputPath,
        inputProps,
        imageFormat: "jpeg",
        jpegQuality: 90,
        crf: 28,
      });

      // Clean up voiceover temp file (audio is baked into the MP4 now)
      if (voiceoverPath) cleanupVoiceover(voiceoverPath);
    }

    // ── CHECKPOINT: MP4 exists on disk ──
    const stats = fs.statSync(outputPath);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`[pipeline] Rendered: ${outputPath} (${sizeMB}MB)`);

    // ── 7. Upload + update DB ──
    const result: PipelineResult = {
      propertyId,
      outputPath,
      duration: Date.now() - start,
      status: "rendered_locally",
    };

    if (!skipUpload) {
      console.log("[pipeline] Uploading video...");
      try {
        const durationSec = totalFrames ? Math.round(totalFrames / FPS) : 30;
        const uploadResult = await uploadAndUpdateProperty(outputPath, propertyId, durationSec);
        result.videoUrl = uploadResult.videoUrl;
        result.thumbnailUrl = uploadResult.thumbnailUrl;
        result.status = "done";
        console.log(`[pipeline] Upload complete via ${uploadResult.provider}`);
      } catch (err) {
        // Upload failed — but the MP4 is safe on disk.
        // upload.ts already marked the DB as "upload_failed" with the local path.
        console.error(`[pipeline] Upload failed: ${err}`);
        console.log(`[pipeline] Video preserved at: ${outputPath}`);
        console.log(`[pipeline] Run: npx tsx generate.ts --retry-upload --id=${propertyId}`);
        result.status = "upload_failed";
      }
    } else {
      // Local-only mode — mark as done with local path reference
      await updateStatus(supabase, propertyId, "done", {
        video_generated_at: new Date().toISOString(),
        video_generation_config: { localPath: outputPath, variant },
      });
      result.status = "done";
    }

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`[pipeline] Done in ${elapsed}s (status: ${result.status})`);
    return result;

  } catch (pipelineError) {
    // Fatal error (fetch/render failed) — mark as failed
    const errorMsg = pipelineError instanceof Error ? pipelineError.message : String(pipelineError);
    await updateStatus(supabase, propertyId, "failed", {
      video_generation_config: {
        variant,
        error: errorMsg,
        failedAt: new Date().toISOString(),
      },
    });
    throw pipelineError;
  }
}

/**
 * Retry upload for a property that rendered successfully but failed to upload.
 * This is the cost-saving path — no re-rendering, no voiceover API call.
 */
export async function retryUpload(propertyId: string): Promise<PipelineResult | null> {
  console.log(`\n[pipeline] Retrying upload for ${propertyId}`);
  const start = Date.now();

  const result = await retryUploadFromLocal(propertyId);
  if (!result) {
    console.error("[pipeline] No local file found to retry");
    return null;
  }

  return {
    propertyId,
    outputPath: "", // already uploaded
    videoUrl: result.videoUrl,
    thumbnailUrl: result.thumbnailUrl,
    duration: Date.now() - start,
    status: "done",
  };
}

/**
 * Generate videos for all published properties without a walkthrough video.
 * Shares a single Webpack bundle across all renders (saves ~15s per property).
 */
export async function generateAllPendingVideos(
  options: PipelineOptions = {}
): Promise<PipelineResult[]> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("properties")
    .select("id, title")
    .eq("status", "published")
    .is("video_generated_at", null)
    .not("video_generation_status", "in", '("rendering","queued")')
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw new Error(`Query failed: ${error.message}`);
  if (!data || data.length === 0) {
    console.log("[pipeline] No properties need video generation");
    return [];
  }

  console.log(`[pipeline] Found ${data.length} properties without walkthrough videos`);

  // Bundle ONCE and share across all renders
  console.log("[pipeline] Bundling Remotion project (shared)...");
  const bundled = await bundle({
    entryPoint: ENTRY_POINT,
    webpackOverride: (c) => c,
  });

  const results: PipelineResult[] = [];

  for (const prop of data) {
    try {
      console.log(`\n[pipeline] Processing: ${prop.title}`);
      const result = await generatePropertyVideo(prop.id, {
        ...options,
        sharedBundlePath: bundled, // Reuse the bundle!
      });
      results.push(result);
    } catch (err) {
      console.error(`[pipeline] Failed for ${prop.id}:`, err);
    }
  }

  console.log(`\n[pipeline] Batch complete: ${results.length}/${data.length} succeeded`);
  return results;
}

/**
 * Webhook handler — called from Supabase Edge Function when a property is published.
 */
export async function handleNewListing(propertyId: string): Promise<void> {
  console.log(`[webhook] New listing published: ${propertyId}`);
  try {
    await generatePropertyVideo(propertyId, {
      variant: "spotlight",
      skipVoiceover: false,
      skipUpload: false,
    });
    console.log(`[webhook] Video generated for ${propertyId}`);
  } catch (err) {
    console.error(`[webhook] Failed for ${propertyId}:`, err);
  }
}
