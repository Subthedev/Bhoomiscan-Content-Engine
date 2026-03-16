/**
 * Token-bucket rate limiter for free geo APIs.
 *
 * Nominatim: 1 request/second (strict policy)
 * Overpass: 2 requests/second
 * OSRM: 10 requests/second
 */

interface BucketConfig {
  maxTokens: number;
  refillRateMs: number; // ms between token refills
}

const CONFIGS: Record<string, BucketConfig> = {
  nominatim: { maxTokens: 1, refillRateMs: 1000 },
  overpass: { maxTokens: 2, refillRateMs: 500 },
  osrm: { maxTokens: 10, refillRateMs: 100 },
  indiapost: { maxTokens: 2, refillRateMs: 500 },
};

const buckets: Record<string, { tokens: number; lastRefill: number }> = {};

function getBucket(name: string) {
  if (!buckets[name]) {
    const config = CONFIGS[name] || CONFIGS.nominatim;
    buckets[name] = { tokens: config.maxTokens, lastRefill: Date.now() };
  }
  return buckets[name];
}

/**
 * Wait until a request token is available for the given API.
 */
export async function acquireToken(apiName: string): Promise<void> {
  const config = CONFIGS[apiName] || CONFIGS.nominatim;
  const bucket = getBucket(apiName);

  // Refill tokens based on elapsed time
  const now = Date.now();
  const elapsed = now - bucket.lastRefill;
  const newTokens = Math.floor(elapsed / config.refillRateMs);

  if (newTokens > 0) {
    bucket.tokens = Math.min(config.maxTokens, bucket.tokens + newTokens);
    bucket.lastRefill = now;
  }

  // Wait if no tokens available
  if (bucket.tokens <= 0) {
    const waitMs = config.refillRateMs - (now - bucket.lastRefill);
    if (waitMs > 0) {
      await new Promise((r) => setTimeout(r, waitMs));
    }
    bucket.tokens = 1;
    bucket.lastRefill = Date.now();
  }

  bucket.tokens--;
}
