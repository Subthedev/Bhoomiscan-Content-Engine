/**
 * Video Engine API Server
 *
 * Lightweight HTTP server that wraps the Remotion video pipeline.
 * The Content Engine UI calls this to trigger video generation.
 *
 * Usage:
 *   npx tsx serve.ts                    # Start on default port 3456
 *   PORT=4000 npx tsx serve.ts          # Custom port
 *
 * Endpoints:
 *   GET  /health            — Check if engine is running
 *   POST /generate          — Start video generation { propertyId, options? }
 *   POST /generate-queued   — Process all queued properties from DB
 *   GET  /jobs              — List active generation jobs
 *   POST /cancel/:id        — Cancel a running job (best-effort)
 */

import { config } from "dotenv";
config();

import * as http from "http";
import { generatePropertyVideo, generateAllPendingVideos } from "./src/pipeline";
import { createClient } from "@supabase/supabase-js";

const PORT = parseInt(process.env.VIDEO_ENGINE_PORT || "3456", 10);

interface ActiveJob {
  propertyId: string;
  status: "rendering" | "done" | "failed";
  startedAt: number;
  error?: string;
}

const activeJobs = new Map<string, ActiveJob>();

function cors(res: http.ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function json(res: http.ServerResponse, status: number, data: unknown) {
  cors(res);
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (c: Buffer) => (body += c.toString()));
    req.on("end", () => resolve(body));
  });
}

const server = http.createServer(async (req, res) => {
  const url = req.url || "/";
  const method = req.method || "GET";

  // CORS preflight
  if (method === "OPTIONS") {
    cors(res);
    res.writeHead(200);
    res.end();
    return;
  }

  try {
    // GET /health
    if (method === "GET" && url === "/health") {
      return json(res, 200, {
        ok: true,
        engine: "bhoomiscan-video-engine",
        activeJobs: activeJobs.size,
        uptime: process.uptime(),
      });
    }

    // GET /jobs
    if (method === "GET" && url === "/jobs") {
      const jobs = Array.from(activeJobs.entries()).map(([id, j]) => ({
        propertyId: id,
        ...j,
        elapsed: Math.round((Date.now() - j.startedAt) / 1000),
      }));
      return json(res, 200, { jobs });
    }

    // POST /generate — single property
    if (method === "POST" && url === "/generate") {
      const body = JSON.parse(await readBody(req));
      const { propertyId, options } = body;

      if (!propertyId) {
        return json(res, 400, { error: "propertyId is required" });
      }

      if (activeJobs.has(propertyId) && activeJobs.get(propertyId)!.status === "rendering") {
        return json(res, 409, { error: "Already generating video for this property" });
      }

      // Start generation in background
      activeJobs.set(propertyId, { propertyId, status: "rendering", startedAt: Date.now() });
      json(res, 202, { ok: true, message: "Generation started", propertyId });

      // Process async (don't await — response already sent)
      generatePropertyVideo(propertyId, {
        variant: options?.variant || "spotlight",
        skipVoiceover: options?.skipVoiceover || false,
        skipUpload: options?.skipUpload || false,
      })
        .then(() => {
          activeJobs.set(propertyId, { propertyId, status: "done", startedAt: activeJobs.get(propertyId)!.startedAt });
          console.log(`[serve] Completed: ${propertyId}`);
        })
        .catch((err) => {
          activeJobs.set(propertyId, { propertyId, status: "failed", startedAt: activeJobs.get(propertyId)!.startedAt, error: String(err) });
          console.error(`[serve] Failed: ${propertyId}`, err);
        });

      return;
    }

    // POST /generate-queued — process all queued properties
    if (method === "POST" && url === "/generate-queued") {
      const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!supabaseUrl || !supabaseKey) {
        return json(res, 500, { error: "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required" });
      }

      const supabase = createClient(supabaseUrl, supabaseKey);
      const { data } = await supabase
        .from("properties")
        .select("id, title")
        .eq("video_generation_status", "queued");

      if (!data || data.length === 0) {
        return json(res, 200, { ok: true, message: "No queued properties", count: 0 });
      }

      json(res, 202, { ok: true, message: `Processing ${data.length} queued properties`, count: data.length });

      // Process sequentially in background
      for (const prop of data) {
        if (!activeJobs.has(prop.id) || activeJobs.get(prop.id)!.status !== "rendering") {
          activeJobs.set(prop.id, { propertyId: prop.id, status: "rendering", startedAt: Date.now() });
          try {
            await generatePropertyVideo(prop.id);
            activeJobs.set(prop.id, { propertyId: prop.id, status: "done", startedAt: activeJobs.get(prop.id)!.startedAt });
          } catch (err) {
            activeJobs.set(prop.id, { propertyId: prop.id, status: "failed", startedAt: activeJobs.get(prop.id)!.startedAt, error: String(err) });
          }
        }
      }
      return;
    }

    // POST /cancel/:id
    if (method === "POST" && url.startsWith("/cancel/")) {
      const propertyId = url.replace("/cancel/", "");
      // We can't truly cancel a Remotion render mid-flight, but we can mark it
      activeJobs.delete(propertyId);

      const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);
        await supabase
          .from("properties")
          .update({ video_generation_status: null, video_generation_config: null })
          .eq("id", propertyId);
      }

      return json(res, 200, { ok: true, message: "Cancelled" });
    }

    // 404
    json(res, 404, { error: "Not found" });
  } catch (err) {
    console.error("[serve] Error:", err);
    json(res, 500, { error: String(err) });
  }
});

server.listen(PORT, () => {
  console.log(`\n  ╔══════════════════════════════════════════╗`);
  console.log(`  ║  BhoomiScan Video Engine API             ║`);
  console.log(`  ║  Running on http://localhost:${PORT}        ║`);
  console.log(`  ╚══════════════════════════════════════════╝\n`);
});
