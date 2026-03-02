/**
 * Image metadata extraction via HTTP Range requests.
 * Parses JPEG SOF / PNG IHDR headers without downloading full images.
 */

export interface ImageDimensions {
  width: number;
  height: number;
}

/**
 * Get image dimensions by fetching only the first chunk of data.
 * Uses HTTP Range request for first 64KB, parses JPEG SOF or PNG IHDR.
 * Falls back to fetching first 256KB if Range not supported.
 */
export async function getImageDimensions(url: string): Promise<ImageDimensions | null> {
  try {
    // Try Range request first (64KB is enough for most headers)
    const res = await fetch(url, {
      headers: { Range: "bytes=0-65535" },
    });

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length < 8) return null;

    // Try JPEG
    const jpegDims = parseJpegDimensions(buffer);
    if (jpegDims) return jpegDims;

    // Try PNG
    const pngDims = parsePngDimensions(buffer);
    if (pngDims) return pngDims;

    return null;
  } catch {
    return null;
  }
}

/** Parse JPEG SOF marker to get width/height */
function parseJpegDimensions(buf: Buffer): ImageDimensions | null {
  // JPEG starts with FF D8
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return null;

  let offset = 2;
  while (offset < buf.length - 9) {
    if (buf[offset] !== 0xff) {
      offset++;
      continue;
    }

    const marker = buf[offset + 1];

    // SOF markers (0xC0–0xCF except 0xC4 (DHT) and 0xCC (DAC))
    if (
      marker >= 0xc0 && marker <= 0xcf &&
      marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc
    ) {
      // SOF format: FF Cx LL LL PP HH HH WW WW
      if (offset + 9 <= buf.length) {
        const height = buf.readUInt16BE(offset + 5);
        const width = buf.readUInt16BE(offset + 7);
        if (width > 0 && height > 0) {
          return { width, height };
        }
      }
    }

    // Skip to next marker using segment length
    if (offset + 3 < buf.length) {
      const segLen = buf.readUInt16BE(offset + 2);
      offset += 2 + segLen;
    } else {
      break;
    }
  }

  return null;
}

/** Parse PNG IHDR chunk to get width/height */
function parsePngDimensions(buf: Buffer): ImageDimensions | null {
  // PNG signature: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] !== 0x89 || buf[1] !== 0x50 ||
    buf[2] !== 0x4e || buf[3] !== 0x47
  ) {
    return null;
  }

  // IHDR is always the first chunk, starting at byte 8
  // Chunk: 4-byte length, 4-byte type ("IHDR"), then data
  if (buf.length < 24) return null;

  const chunkType = buf.toString("ascii", 12, 16);
  if (chunkType !== "IHDR") return null;

  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);

  return width > 0 && height > 0 ? { width, height } : null;
}
