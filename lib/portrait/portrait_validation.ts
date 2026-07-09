/**
 * Portrait upload validation (Phase 24B-1).
 *
 * Pure, dependency-free validation of an uploaded portrait's type and size,
 * plus lightweight image-dimension probing from the raw bytes. Shared by the
 * upload service and the API handler so the rules live in exactly one place.
 *
 * Allowed types: jpg, jpeg, png, webp. Max size: 5 MB (spec).
 */

export const MAX_PORTRAIT_BYTES = 5 * 1024 * 1024; // 5 MB

/** Allowed MIME types → canonical file extension. */
export const ALLOWED_PORTRAIT_MIME: Readonly<Record<string, string>> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export interface PortraitValidationInput {
  mimeType: string;
  byteLength: number;
}

export interface PortraitValidationOk {
  ok: true;
  /** Canonical extension for the accepted MIME type (e.g. "jpg"). */
  extension: string;
}

export interface PortraitValidationError {
  ok: false;
  /** Machine code for the API to map to a status; message is human-readable. */
  code: "UNSUPPORTED_TYPE" | "TOO_LARGE" | "EMPTY";
  message: string;
}

export type PortraitValidationResult = PortraitValidationOk | PortraitValidationError;

/** Validates a portrait's declared MIME type and byte length against the spec. */
export function validatePortrait(input: PortraitValidationInput): PortraitValidationResult {
  if (input.byteLength <= 0) {
    return { ok: false, code: "EMPTY", message: "The uploaded file is empty." };
  }
  const extension = ALLOWED_PORTRAIT_MIME[input.mimeType.toLowerCase()];
  if (!extension) {
    return {
      ok: false,
      code: "UNSUPPORTED_TYPE",
      message: "Unsupported file type. Allowed types: JPG, JPEG, PNG, WEBP.",
    };
  }
  if (input.byteLength > MAX_PORTRAIT_BYTES) {
    return {
      ok: false,
      code: "TOO_LARGE",
      message: `File is too large. Maximum size is ${Math.round(MAX_PORTRAIT_BYTES / (1024 * 1024))} MB.`,
    };
  }
  return { ok: true, extension };
}

export interface ImageDimensions {
  width: number;
  height: number;
}

/**
 * Reads the pixel dimensions from raw image bytes for the supported formats,
 * without decoding the whole image. Returns null when the header can't be
 * parsed (dimensions are best-effort metadata, never a hard requirement).
 *
 * Supported headers: PNG (IHDR), JPEG (SOFn markers), WEBP (VP8 / VP8L / VP8X).
 */
export function readImageDimensions(bytes: Uint8Array): ImageDimensions | null {
  return readPng(bytes) ?? readWebp(bytes) ?? readJpeg(bytes);
}

/** PNG: 8-byte signature, then IHDR chunk with width/height as big-endian u32 at offsets 16/20. */
function readPng(b: Uint8Array): ImageDimensions | null {
  if (b.length < 24) return null;
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < sig.length; i += 1) if (b[i] !== sig[i]) return null;
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

/** JPEG: scan segments for a Start-Of-Frame marker (0xFFC0..0xFFCF except C4/C8/CC). */
function readJpeg(b: Uint8Array): ImageDimensions | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let offset = 2;
  while (offset + 9 < b.length) {
    if (b[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = b[offset + 1];
    // SOF markers carry frame dimensions; skip C4 (DHT), C8 (JPG), CC (DAC).
    const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) {
      const height = view.getUint16(offset + 5);
      const width = view.getUint16(offset + 7);
      return { width, height };
    }
    const segmentLength = view.getUint16(offset + 2);
    if (segmentLength < 2) return null;
    offset += 2 + segmentLength;
  }
  return null;
}

/** WEBP: RIFF container; VP8 (lossy), VP8L (lossless), VP8X (extended) sub-headers. */
function readWebp(b: Uint8Array): ImageDimensions | null {
  if (b.length < 30) return null;
  const isRiff = b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46; // "RIFF"
  const isWebp = b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50; // "WEBP"
  if (!isRiff || !isWebp) return null;
  const fourCc = String.fromCharCode(b[12], b[13], b[14], b[15]);
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  if (fourCc === "VP8 ") {
    // Lossy: 16-bit width/height (14 bits used) at offset 26/28, little-endian.
    const width = view.getUint16(26, true) & 0x3fff;
    const height = view.getUint16(28, true) & 0x3fff;
    return { width, height };
  }
  if (fourCc === "VP8L") {
    // Lossless: 14-bit width-1 and height-1 packed from offset 21.
    const bits = view.getUint32(21, true);
    const width = (bits & 0x3fff) + 1;
    const height = ((bits >> 14) & 0x3fff) + 1;
    return { width, height };
  }
  if (fourCc === "VP8X") {
    // Extended: 24-bit width-1 and height-1 (little-endian) at offset 24/27.
    const width = (b[24] | (b[25] << 8) | (b[26] << 16)) + 1;
    const height = (b[27] | (b[28] << 8) | (b[29] << 16)) + 1;
    return { width, height };
  }
  return null;
}
