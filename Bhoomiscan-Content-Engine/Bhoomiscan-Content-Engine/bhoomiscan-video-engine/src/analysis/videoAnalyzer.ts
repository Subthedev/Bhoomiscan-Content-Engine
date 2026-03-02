/**
 * Analyze seller video to find the best segment using ffprobe scene detection.
 * Downloads first 30s locally for fast analysis, falls back to simple trim.
 */

import { execSync } from "child_process";
import { writeFileSync, unlinkSync, mkdtempSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

export interface VideoSegment {
  startFrom: number; // seconds
  duration: number;  // usable seconds
  confidence: number; // 0-1, how confident we are in the segment
}

interface SceneSegment {
  start: number;
  end: number;
  duration: number;
  score: number; // composite quality score
}

/**
 * Analyze a video URL and return the best segment to use.
 * Uses scene detection to find the most stable, well-positioned segment.
 * Returns null if analysis fails.
 */
export async function analyzeVideo(videoUrl: string): Promise<VideoSegment | null> {
  if (!videoUrl) return null;

  try {
    // Step 1: Get total duration
    const totalDuration = getVideoDuration(videoUrl);
    if (totalDuration <= 0) return null;

    // Short videos: use from start, full duration
    if (totalDuration < 7) {
      return { startFrom: 0, duration: totalDuration, confidence: 0.5 };
    }

    // Step 2: Try scene detection
    const sceneResult = await detectBestScene(videoUrl, totalDuration);
    if (sceneResult) return sceneResult;

    // Step 3: Fallback — skip first 2s and last 2s
    return {
      startFrom: 2,
      duration: Math.min(totalDuration - 4, 15),
      confidence: 0.3,
    };
  } catch (err) {
    console.warn("[videoAnalyzer] analysis failed, using defaults:", (err as Error).message);
    return null;
  }
}

function getVideoDuration(videoUrl: string): number {
  try {
    const output = execSync(
      `ffprobe -v quiet -print_format json -show_format "${videoUrl}"`,
      { timeout: 15_000, encoding: "utf-8" }
    );
    const data = JSON.parse(output);
    return parseFloat(data.format?.duration || "0");
  } catch {
    return 0;
  }
}

async function detectBestScene(
  videoUrl: string,
  totalDuration: number
): Promise<VideoSegment | null> {
  try {
    // Download first 30s for fast local analysis
    const tmpDir = mkdtempSync(join(tmpdir(), "bhoomiscan-video-"));
    const localPath = join(tmpDir, "clip.mp4");

    try {
      const downloadDuration = Math.min(totalDuration, 30);
      execSync(
        `ffmpeg -v quiet -y -i "${videoUrl}" -t ${downloadDuration} -c copy "${localPath}"`,
        { timeout: 30_000 }
      );

      // Run scene change detection
      const sceneTimestamps = detectSceneChanges(localPath);

      if (sceneTimestamps.length === 0) {
        // No scene changes detected — video is one continuous shot
        // Use middle portion, skip shaky start/end
        const usable = Math.min(downloadDuration - 4, 15);
        return {
          startFrom: 2,
          duration: usable,
          confidence: 0.6,
        };
      }

      // Build segments between scene changes
      const allTimestamps = [0, ...sceneTimestamps, downloadDuration];
      const segments: SceneSegment[] = [];

      for (let i = 0; i < allTimestamps.length - 1; i++) {
        const start = allTimestamps[i];
        const end = allTimestamps[i + 1];
        const duration = end - start;

        if (duration < 2) continue; // Too short to be useful

        // Score the segment
        const score = scoreSegment(start, end, duration, downloadDuration, sceneTimestamps);
        segments.push({ start, end, duration, score });
      }

      if (segments.length === 0) {
        return null;
      }

      // Find best segment
      segments.sort((a, b) => b.score - a.score);
      const best = segments[0];

      // Cap duration for video section
      const useDuration = Math.min(best.duration, 15);

      return {
        startFrom: best.start,
        duration: useDuration,
        confidence: Math.min(best.score, 1),
      };
    } finally {
      // Cleanup
      try { unlinkSync(localPath); } catch { /* ignore */ }
      try { execSync(`rm -rf "${tmpDir}"`); } catch { /* ignore */ }
    }
  } catch (err) {
    console.warn("[videoAnalyzer] scene detection failed:", (err as Error).message);
    return null;
  }
}

function detectSceneChanges(localPath: string): number[] {
  try {
    const output = execSync(
      `ffprobe -v quiet -f lavfi -i "movie='${localPath.replace(/'/g, "'\\''")}',select='gt(scene\\,0.3)'" -show_entries frame=pkt_pts_time -of csv=p=0`,
      { timeout: 20_000, encoding: "utf-8" }
    );

    return output
      .trim()
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => parseFloat(line.trim()))
      .filter((t) => !isNaN(t) && t > 0);
  } catch {
    return [];
  }
}

function scoreSegment(
  start: number,
  end: number,
  duration: number,
  totalDuration: number,
  _sceneTimestamps: number[]
): number {
  let score = 0;

  // Prefer 5-8s segments (ideal for video section)
  if (duration >= 5 && duration <= 8) {
    score += 0.4;
  } else if (duration >= 3 && duration <= 12) {
    score += 0.25;
  } else {
    score += 0.1;
  }

  // Prefer middle segments (avoid shaky start/end)
  const midpoint = (start + end) / 2;
  const relativePos = midpoint / totalDuration;
  // Bell curve centered at 0.5
  const positionScore = Math.exp(-8 * Math.pow(relativePos - 0.5, 2));
  score += 0.35 * positionScore;

  // Penalize segments starting in the first 1.5s (shaky start)
  if (start < 1.5) {
    score -= 0.15;
  }

  // Penalize segments ending in the last 1.5s (often abrupt end)
  if (end > totalDuration - 1.5) {
    score -= 0.1;
  }

  // Bonus for longer usable segments (more content)
  score += 0.25 * Math.min(1, duration / 10);

  return Math.max(0, score);
}
