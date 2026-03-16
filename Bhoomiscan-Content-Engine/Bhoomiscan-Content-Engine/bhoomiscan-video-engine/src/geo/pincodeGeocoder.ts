/**
 * India Post Pincode API integration for geocoding accuracy.
 *
 * Extracts 6-digit Indian pincodes from text and uses the free
 * India Post API to get approximate location. Used as a viewbox
 * constraint for Nominatim or as a "medium" confidence fallback.
 *
 * API: https://api.postalpincode.in/pincode/{pincode}
 * Rate: No official limit, but we add 2 req/sec to be safe.
 * Cost: FREE, no API key required.
 */

import { GeoCoordinates } from "./types";
import { acquireToken } from "./rateLimiter";
import { getCached, setCache } from "./cache";

const PINCODE_REGEX = /\b[1-9]\d{5}\b/;
const API_BASE = "https://api.postalpincode.in/pincode";

/**
 * Extract a 6-digit Indian pincode from text.
 * Returns the first match or null.
 */
export function extractPincode(text: string): string | null {
  const match = text.match(PINCODE_REGEX);
  return match ? match[0] : null;
}

export interface PincodeResult {
  pincode: string;
  placeName: string;
  district: string;
  state: string;
}

/**
 * Look up a pincode via India Post API.
 * Returns the post office name, district, and state.
 * Does NOT return coordinates — use Nominatim with the result as viewbox context.
 */
export async function lookupPincode(pincode: string): Promise<PincodeResult | null> {
  const cached = getCached<PincodeResult>("geocode", `pincode:${pincode}`);
  if (cached) return cached;

  try {
    await acquireToken("indiapost");
    const res = await fetch(`${API_BASE}/${pincode}`);
    if (!res.ok) return null;

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;

    const entry = data[0];
    if (entry.Status !== "Success" || !entry.PostOffice?.length) return null;

    const po = entry.PostOffice[0];
    const result: PincodeResult = {
      pincode,
      placeName: po.Name,
      district: po.District,
      state: po.State,
    };

    setCache("geocode", `pincode:${pincode}`, result);
    console.log(`[pincode] ${pincode} → ${po.Name}, ${po.District}, ${po.State}`);
    return result;
  } catch (err) {
    console.warn(`[pincode] API error for ${pincode}:`, err);
    return null;
  }
}
