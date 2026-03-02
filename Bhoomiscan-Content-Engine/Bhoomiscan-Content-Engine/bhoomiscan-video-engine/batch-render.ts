/**
 * Batch renderer — generates videos for multiple properties.
 * Prefer using generate.ts (the pipeline CLI) instead for production use.
 * This file is kept for backwards compatibility.
 */
import { config } from "dotenv";
config();

import { generateAllPendingVideos, generatePropertyVideo } from "./src/pipeline";
import type { VideoVariant } from "./src/types";

async function main() {
  const args = process.argv.slice(2);
  const allUnrendered = args.includes("--all-unrendered") || args.includes("--all");
  const skipVoiceover = args.includes("--no-voiceover");
  const skipUpload = args.includes("--no-upload");
  const allVariants = args.includes("--all-variants");

  const idsArg = args.find((a) => a.startsWith("--ids="));
  const propertyIds = idsArg ? idsArg.split("=")[1].split(",") : undefined;

  const variant: VideoVariant = "spotlight";
  const options = { variant, skipVoiceover, skipUpload };

  if (propertyIds && propertyIds.length > 0) {
    console.log(`[batch] Rendering ${propertyIds.length} properties`);
    for (const id of propertyIds) {
      try {
        await generatePropertyVideo(id, options);
      } catch (err) {
        console.error(`[batch] Failed ${id}:`, err);
      }
    }
  } else {
    await generateAllPendingVideos(options);
  }
}

main().catch((err) => {
  console.error("[batch] Fatal:", err);
  process.exit(1);
});
