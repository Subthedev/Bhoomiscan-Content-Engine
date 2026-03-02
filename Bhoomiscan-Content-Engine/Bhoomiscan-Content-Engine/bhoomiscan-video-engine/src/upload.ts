import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ── Helpers ──

function getEnv(key: string): string | undefined {
  return process.env[key] || process.env[`VITE_${key}`];
}

function getSupabase(): SupabaseClient {
  const url = getEnv("SUPABASE_URL");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required");
  return createClient(url, key);
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Result types ──

export interface UploadResult {
  videoUrl: string;
  thumbnailUrl: string;
  provider: "cloudinary" | "supabase-storage";
}

interface CloudinaryUploadResult {
  secure_url: string;
  public_id: string;
  format: string;
  duration: number;
  width: number;
  height: number;
  bytes: number;
}

// ── Retry wrapper ──

async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  maxAttempts = 3,
  baseDelayMs = 2000
): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxAttempts) {
        const delay = baseDelayMs * Math.pow(2, attempt - 1);
        console.warn(`[upload] ${label} attempt ${attempt}/${maxAttempts} failed: ${lastError.message}`);
        console.log(`[upload] Retrying in ${(delay / 1000).toFixed(0)}s...`);
        await sleep(delay);
      }
    }
  }
  throw lastError!;
}

// ── Cloudinary upload (with retry) ──

function hasCloudinaryConfig(): boolean {
  return !!(getEnv("CLOUDINARY_CLOUD_NAME") && getEnv("CLOUDINARY_API_KEY") && getEnv("CLOUDINARY_API_SECRET"));
}

async function uploadToCloudinary(
  filePath: string,
  propertyId: string
): Promise<UploadResult> {
  const cloudName = getEnv("CLOUDINARY_CLOUD_NAME");
  const apiKey = getEnv("CLOUDINARY_API_KEY");
  const apiSecret = getEnv("CLOUDINARY_API_SECRET");

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Cloudinary credentials not configured (need CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET)");
  }

  return withRetry(async () => {
    const timestamp = Math.floor(Date.now() / 1000);
    const folder = `bhoomiscan/properties/${propertyId}`;
    const publicId = `${folder}/video_${Date.now()}`;

    const signatureString = `folder=${folder}&public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
    const signature = crypto
      .createHash("sha1")
      .update(signatureString)
      .digest("hex");

    const fileBuffer = fs.readFileSync(filePath);
    const blob = new Blob([fileBuffer], { type: "video/mp4" });

    const formData = new FormData();
    formData.append("file", blob, path.basename(filePath));
    formData.append("api_key", apiKey);
    formData.append("timestamp", timestamp.toString());
    formData.append("signature", signature);
    formData.append("folder", folder);
    formData.append("public_id", publicId);
    formData.append("resource_type", "video");

    const sizeMB = (fileBuffer.length / (1024 * 1024)).toFixed(2);
    console.log(`[upload] Uploading ${sizeMB}MB to Cloudinary...`);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`,
      { method: "POST", body: formData }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Cloudinary ${response.status}: ${errorText}`);
    }

    const result = (await response.json()) as CloudinaryUploadResult;

    const videoUrl = result.secure_url.replace("/upload/", "/upload/q_auto,f_auto/");
    const thumbnailUrl = result.secure_url
      .replace("/upload/", "/upload/c_thumb,w_400,h_300,g_auto,so_0/")
      .replace(/\.[^.]+$/, ".jpg");

    console.log(`[upload] Cloudinary upload complete`);
    return { videoUrl, thumbnailUrl, provider: "cloudinary" as const };
  }, "Cloudinary upload", 3, 3000);
}

// ── Supabase Storage fallback ──

async function uploadToSupabaseStorage(
  filePath: string,
  propertyId: string
): Promise<UploadResult> {
  const supabase = getSupabase();

  const fileBuffer = fs.readFileSync(filePath);
  const fileName = `${propertyId}/walkthrough_${Date.now()}.mp4`;

  const sizeMB = (fileBuffer.length / (1024 * 1024)).toFixed(2);
  console.log(`[upload] Uploading ${sizeMB}MB to Supabase Storage (fallback)...`);

  const { error } = await supabase.storage
    .from("property-videos")
    .upload(fileName, fileBuffer, {
      contentType: "video/mp4",
      upsert: true,
    });

  if (error) {
    throw new Error(`Supabase Storage upload failed: ${error.message}`);
  }

  const { data: urlData } = supabase.storage
    .from("property-videos")
    .getPublicUrl(fileName);

  const videoUrl = urlData.publicUrl;
  // Use first frame as thumbnail via Supabase transform (or fallback to video URL)
  const thumbnailUrl = videoUrl;

  console.log(`[upload] Supabase Storage upload complete`);
  return { videoUrl, thumbnailUrl, provider: "supabase-storage" as const };
}

// ── Smart upload: try Cloudinary → fallback to Supabase Storage ──

export async function smartUpload(
  filePath: string,
  propertyId: string
): Promise<UploadResult> {
  // Try Cloudinary first if configured
  if (hasCloudinaryConfig()) {
    try {
      return await uploadToCloudinary(filePath, propertyId);
    } catch (err) {
      console.error(`[upload] Cloudinary failed after retries: ${err}`);
      console.log("[upload] Falling back to Supabase Storage...");
    }
  } else {
    console.log("[upload] Cloudinary not configured, using Supabase Storage");
  }

  // Fallback: Supabase Storage (always available since we have service role key)
  return await withRetry(
    () => uploadToSupabaseStorage(filePath, propertyId),
    "Supabase Storage upload",
    2,
    2000
  );
}

// ── Update DB with video URL + mark as done ──

export async function updatePropertyVideo(
  propertyId: string,
  videoUrl: string,
  thumbnailUrl: string,
  durationSeconds: number = 30
): Promise<void> {
  const supabase = getSupabase();

  const { error } = await supabase
    .from("properties")
    .update({
      video_url: videoUrl,
      video_thumbnail_url: thumbnailUrl,
      video_duration: durationSeconds,
      video_generation_status: "done",
      video_generated_at: new Date().toISOString(),
    })
    .eq("id", propertyId);

  if (error) {
    throw new Error(`DB update failed for ${propertyId}: ${error.message}`);
  }

  console.log(`[upload] Property ${propertyId} marked as done`);
}

// ── Mark DB as failed (preserves local file path for retry) ──

export async function markUploadFailed(
  propertyId: string,
  localPath: string,
  errorMessage: string
): Promise<void> {
  try {
    const supabase = getSupabase();
    await supabase
      .from("properties")
      .update({
        video_generation_status: "upload_failed",
        video_generation_config: {
          localPath,
          error: errorMessage,
          failedAt: new Date().toISOString(),
          canRetryUpload: true,
        },
      })
      .eq("id", propertyId);
    console.log(`[upload] Property ${propertyId} marked as upload_failed (local file preserved)`);
  } catch (_) {
    console.error(`[upload] Could not update DB status for ${propertyId}`);
  }
}

// ── Full pipeline: smart upload + DB update (with proper error handling) ──

export async function uploadAndUpdateProperty(
  filePath: string,
  propertyId: string,
  durationSeconds: number = 30
): Promise<UploadResult> {
  try {
    const result = await smartUpload(filePath, propertyId);
    await withRetry(
      () => updatePropertyVideo(propertyId, result.videoUrl, result.thumbnailUrl, durationSeconds),
      "DB update",
      3,
      1000
    );
    return result;
  } catch (err) {
    // Upload failed completely — mark in DB so UI can show retry option
    const errorMsg = err instanceof Error ? err.message : String(err);
    await markUploadFailed(propertyId, filePath, errorMsg);
    throw err;
  }
}

// ── Retry upload for a previously rendered video ──

export async function retryUploadFromLocal(
  propertyId: string,
  durationSeconds: number = 30
): Promise<UploadResult | null> {
  const supabase = getSupabase();

  // Check if there's a local file to retry
  const { data } = await supabase
    .from("properties")
    .select("video_generation_config")
    .eq("id", propertyId)
    .single();

  const config = data?.video_generation_config;
  const localPath = config?.localPath;

  if (!localPath) {
    // Try default output path
    const defaultPath = path.join(process.cwd(), "output", `${propertyId}_spotlight.mp4`);
    if (fs.existsSync(defaultPath)) {
      console.log(`[upload] Found local file at default path: ${defaultPath}`);
      return await uploadAndUpdateProperty(defaultPath, propertyId, durationSeconds);
    }
    console.error(`[upload] No local file found for ${propertyId}`);
    return null;
  }

  if (!fs.existsSync(localPath)) {
    console.error(`[upload] Local file no longer exists: ${localPath}`);
    return null;
  }

  console.log(`[upload] Retrying upload from: ${localPath}`);
  return await uploadAndUpdateProperty(localPath, propertyId, durationSeconds);
}
