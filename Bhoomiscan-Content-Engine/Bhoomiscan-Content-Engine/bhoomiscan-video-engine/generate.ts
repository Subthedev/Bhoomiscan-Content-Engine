/**
 * Video Generation CLI
 *
 * Usage:
 *   npx tsx generate.ts --id=<property-uuid>     # Generate for specific property
 *   npx tsx generate.ts --all                     # Generate for all properties without video
 *   npx tsx generate.ts --retry-upload --id=<id>  # Retry upload for a rendered video (FREE)
 *   npx tsx generate.ts --id=<uuid> --no-voiceover --no-upload
 *
 * Options:
 *   --id=<uuid>         Property ID to generate video for
 *   --all               Generate for all published properties without walkthrough
 *   --retry-upload      Skip rendering, just retry the upload (cost-saving)
 *   --variant=spotlight  Video variant (spotlight | area-context | availability)
 *   --no-voiceover      Skip Sarvam AI voiceover generation
 *   --no-upload         Skip upload (save locally only)
 */

import { config } from "dotenv";
config();

import {
  generatePropertyVideo,
  generateAllPendingVideos,
  retryUpload,
} from "./src/pipeline";
import type { VideoVariant } from "./src/types";

async function main() {
  const args = process.argv.slice(2);

  const idArg = args.find((a) => a.startsWith("--id="));
  const propertyId = idArg?.split("=")[1];
  const generateAll = args.includes("--all");
  const isRetryUpload = args.includes("--retry-upload");
  const skipVoiceover = args.includes("--no-voiceover");
  const skipUpload = args.includes("--no-upload");
  const variantArg = args.find((a) => a.startsWith("--variant="));
  const variant = (variantArg?.split("=")[1] as VideoVariant) || "spotlight";

  const options = { variant, skipVoiceover, skipUpload };

  // ── Retry upload (cost-saving: no re-render, no voiceover API call) ──
  if (isRetryUpload && propertyId) {
    console.log(`\n=== Retrying upload for: ${propertyId} (no re-render) ===\n`);
    const result = await retryUpload(propertyId);
    if (result) {
      console.log(`\n=== Upload complete ===`);
      console.log(`Video URL: ${result.videoUrl}`);
    } else {
      console.error(`\n=== No local render found — need to regenerate ===`);
      process.exit(1);
    }
    return;
  }

  // ── Single property generation ──
  if (propertyId) {
    console.log(`\n=== Generating video for property: ${propertyId} ===\n`);
    const result = await generatePropertyVideo(propertyId, options);
    console.log(`\n=== Complete (${result.status}) ===`);
    console.log(`Output: ${result.outputPath}`);
    console.log(`Duration: ${(result.duration / 1000).toFixed(1)}s`);
    if (result.status === "upload_failed") {
      console.log(`\nTo retry upload: npx tsx generate.ts --retry-upload --id=${propertyId}`);
    }
    return;
  }

  // ── Batch generation ──
  if (generateAll) {
    console.log(`\n=== Generating videos for all pending properties ===\n`);
    const results = await generateAllPendingVideos(options);
    const done = results.filter((r) => r.status === "done").length;
    const uploadFailed = results.filter((r) => r.status === "upload_failed").length;
    console.log(`\n=== Complete: ${done} uploaded, ${uploadFailed} need upload retry ===`);
    if (uploadFailed > 0) {
      console.log("\nTo retry failed uploads:");
      results
        .filter((r) => r.status === "upload_failed")
        .forEach((r) => console.log(`  npx tsx generate.ts --retry-upload --id=${r.propertyId}`));
    }
    return;
  }

  // ── Usage ──
  console.log("Usage:");
  console.log("  npx tsx generate.ts --id=<property-uuid>");
  console.log("  npx tsx generate.ts --all");
  console.log("  npx tsx generate.ts --retry-upload --id=<uuid>    # Retry upload (free)");
  console.log("");
  console.log("Options:");
  console.log("  --variant=spotlight    Video style (spotlight|area-context|availability)");
  console.log("  --no-voiceover         Skip Odia voiceover generation");
  console.log("  --no-upload            Save locally, don't upload");
  process.exit(1);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
