/**
 * File-system cache for geo data.
 * Avoids repeated API calls to Nominatim, Overpass, OSRM.
 *
 * Cache directory: public/geo/cache/
 * TTLs: geocode 30d, boundaries 90d, routes 7d
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

const CACHE_DIR = path.join(__dirname, "..", "..", "public", "geo", "cache");

const TTL_DAYS: Record<string, number> = {
  geocode: 30,
  boundary: 90,
  route: 7,
  amenity: 14,
};

function ensureCacheDir(): void {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

function cacheKey(prefix: string, input: string): string {
  const hash = crypto.createHash("md5").update(input).digest("hex").slice(0, 12);
  return `${prefix}_${hash}`;
}

function cachePath(key: string): string {
  return path.join(CACHE_DIR, `${key}.json`);
}

export function getCached<T>(prefix: string, input: string): T | null {
  ensureCacheDir();
  const filePath = cachePath(cacheKey(prefix, input));

  if (!fs.existsSync(filePath)) return null;

  try {
    const stat = fs.statSync(filePath);
    const ttlDays = TTL_DAYS[prefix] || 30;
    const ageDays = (Date.now() - stat.mtimeMs) / (1000 * 60 * 60 * 24);

    if (ageDays > ttlDays) {
      fs.unlinkSync(filePath);
      return null;
    }

    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function setCache<T>(prefix: string, input: string, data: T): void {
  ensureCacheDir();
  const filePath = cachePath(cacheKey(prefix, input));

  try {
    fs.writeFileSync(filePath, JSON.stringify(data), "utf-8");
  } catch (err) {
    console.warn(`[geo-cache] Failed to write cache: ${err}`);
  }
}

/**
 * Remove expired cache entries.
 */
export function cleanupCache(): { removed: number; kept: number } {
  ensureCacheDir();
  let removed = 0;
  let kept = 0;

  try {
    const files = fs.readdirSync(CACHE_DIR);
    for (const file of files) {
      if (!file.endsWith(".json")) continue;

      const filePath = path.join(CACHE_DIR, file);
      const stat = fs.statSync(filePath);
      const prefix = file.split("_")[0];
      const ttlDays = TTL_DAYS[prefix] || 30;
      const ageDays = (Date.now() - stat.mtimeMs) / (1000 * 60 * 60 * 24);

      if (ageDays > ttlDays) {
        fs.unlinkSync(filePath);
        removed++;
      } else {
        kept++;
      }
    }
  } catch {
    // Cache directory issues are non-fatal
  }

  return { removed, kept };
}
