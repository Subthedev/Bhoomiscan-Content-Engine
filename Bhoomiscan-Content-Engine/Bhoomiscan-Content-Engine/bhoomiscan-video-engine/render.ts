import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { createClient } from "@supabase/supabase-js";
import * as path from "path";
import * as fs from "fs";
import { config } from "dotenv";
import { mapPropertyToVideoProps, VideoVariant, ListingVideoProps } from "./src/types";
import { generateVoiceover, cleanupVoiceover } from "./src/voiceover/generateVoiceover";
import { sampleProperty } from "./src/fixtures/sampleProperty";

config();

const ENTRY_POINT = path.join(__dirname, "src", "index.ts");
const OUTPUT_DIR = path.join(__dirname, "output");

interface RenderOptions {
  propertyId: string;
  variant?: VideoVariant;
  skipVoiceover?: boolean;
}

async function renderProperty(options: RenderOptions): Promise<string> {
  const { propertyId, variant = "spotlight", skipVoiceover = false } = options;

  let inputProps: ListingVideoProps;

  if (propertyId === "test") {
    console.log("[render] Using sample test property");
    inputProps = { ...sampleProperty, variant };
  } else {
    console.log(`[render] Fetching property ${propertyId} from Supabase...`);
    inputProps = await fetchProperty(propertyId, variant);
  }

  // Generate voiceover
  let voiceoverPath: string | null = null;
  if (!skipVoiceover) {
    console.log("[render] Generating voiceover...");
    voiceoverPath = await generateVoiceover(inputProps);
    if (voiceoverPath) {
      inputProps = { ...inputProps, voiceoverAudioUrl: voiceoverPath };
    }
  }

  // Ensure output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const outputPath = path.join(
    OUTPUT_DIR,
    `${inputProps.listingId}_${variant}.mp4`
  );

  console.log("[render] Bundling Remotion project...");
  const bundled = await bundle({
    entryPoint: ENTRY_POINT,
    webpackOverride: (config) => config,
  });

  console.log("[render] Selecting composition...");
  const composition = await selectComposition({
    serveUrl: bundled,
    id: "ListingVideo",
    inputProps,
  });

  console.log("[render] Rendering video...");
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

  console.log(`[render] Done! Output: ${outputPath}`);

  // Clean up voiceover temp file
  if (voiceoverPath) {
    cleanupVoiceover(voiceoverPath);
  }

  // Log file size
  const stats = fs.statSync(outputPath);
  const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
  console.log(`[render] File size: ${sizeMB} MB`);

  if (stats.size > 16 * 1024 * 1024) {
    console.warn("[render] Warning: File exceeds 16MB! Consider increasing CRF.");
  }

  return outputPath;
}

async function fetchProperty(
  propertyId: string,
  variant: VideoVariant
): Promise<ListingVideoProps> {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("SUPABASE_URL/VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: property, error } = await supabase
    .from("properties")
    .select(`
      *,
      property_images (id, image_url, is_primary, display_order),
      profiles (full_name, phone, email)
    `)
    .eq("id", propertyId)
    .single();

  if (error || !property) {
    throw new Error(`Property not found: ${propertyId} — ${error?.message}`);
  }

  return mapPropertyToVideoProps(property, variant);
}

// CLI entry
async function main() {
  const args = process.argv.slice(2);
  const propertyIdArg = args.find((a) => a.startsWith("--property-id="));
  const variantArg = args.find((a) => a.startsWith("--variant="));
  const skipVoiceover = args.includes("--no-voiceover");

  const propertyId = propertyIdArg?.split("=")[1] || "test";
  const variant = (variantArg?.split("=")[1] as VideoVariant) || "spotlight";

  console.log(`[render] Property: ${propertyId}, Variant: ${variant}`);

  try {
    const output = await renderProperty({ propertyId, variant, skipVoiceover });
    console.log(`[render] Success: ${output}`);
  } catch (error) {
    console.error("[render] Failed:", error);
    process.exit(1);
  }
}

main();
