/**
 * Indian currency and area formatting utilities.
 * Ported from main app: src/lib/utils.ts
 */

const CRORE = 10_000_000;
const LAKH = 100_000;

export function formatIndianPrice(price: number): string {
  if (price >= CRORE) {
    return `₹${(price / CRORE).toFixed(2)} Cr`;
  }
  if (price >= LAKH) {
    return `₹${(price / LAKH).toFixed(2)} L`;
  }
  return `₹${price.toLocaleString("en-IN")}`;
}

export function formatArea(area: number, unit: string = "sq.ft"): string {
  if (unit === "sq.ft" && area >= 43560) {
    const acres = area / 43560;
    return `${acres.toFixed(2)} acres`;
  }
  return `${area.toLocaleString("en-IN")} ${unit}`;
}

export function formatPricePerSqft(price: number): string {
  return `₹${Math.round(price).toLocaleString("en-IN")}/sq.ft`;
}
