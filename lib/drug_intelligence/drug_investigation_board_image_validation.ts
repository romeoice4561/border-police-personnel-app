/**
 * DI-9.5D — investigation-board image validation.
 *
 * Server is the authority. Client MIME/size checks are convenience only.
 * Reuses IMAGE annotation allowlist + portrait dimension probing.
 * SVG is rejected. Magic bytes must match the declared MIME.
 */

import { readImageDimensions } from "@/lib/portrait/portrait_validation";
import {
  IMAGE_ANNOTATION_ALLOWED_MIME,
  IMAGE_ANNOTATION_MAX_BYTES,
} from "@/lib/drug_intelligence/drug_network_annotations";

export const BOARD_IMAGE_ALLOWED_MIME = IMAGE_ANNOTATION_ALLOWED_MIME;
export const BOARD_IMAGE_MAX_BYTES = IMAGE_ANNOTATION_MAX_BYTES;
export const BOARD_IMAGE_MAX_DIMENSION = 20_000;
export const BOARD_IMAGE_SIGNED_TTL_SECONDS = 600;

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export type BoardImageValidationCode =
  | "EMPTY"
  | "TOO_LARGE"
  | "UNSUPPORTED_TYPE"
  | "SIGNATURE_MISMATCH"
  | "DIMENSIONS";

export class BoardImageValidationError extends Error {
  constructor(public readonly code: BoardImageValidationCode) {
    super(code);
    this.name = "BoardImageValidationError";
  }
}

export function extensionForBoardImageMime(mimeType: string): string | null {
  return MIME_TO_EXT[mimeType.toLowerCase()] ?? null;
}

export function sanitizeOriginalFilename(name: string | null | undefined): string | null {
  if (!name) return null;
  const base = name.replace(/[/\\]/g, "").replace(/\.\./g, "").trim().slice(0, 180);
  return base.length > 0 ? base : null;
}

export function buildBoardImageStoragePath(boardId: string, imageId: string, ext: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(boardId) || !/^[A-Za-z0-9_-]+$/.test(imageId)) {
    throw new BoardImageValidationError("UNSUPPORTED_TYPE");
  }
  if (!/^[a-z0-9]+$/.test(ext)) throw new BoardImageValidationError("UNSUPPORTED_TYPE");
  return `boards/${boardId}/${imageId}.${ext}`;
}

export function detectBoardImageMime(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  if (
    bytes.length >= 6 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38 &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) &&
    bytes[5] === 0x61
  ) {
    return "image/gif";
  }
  return null;
}

function looksLikeSvg(bytes: Uint8Array): boolean {
  const head = new TextDecoder("utf-8", { fatal: false }).decode(bytes.slice(0, 256)).trimStart().toLowerCase();
  return head.startsWith("<svg") || head.startsWith("<?xml") || head.includes("<svg");
}

export function validateBoardImageBytes(input: {
  bytes: Uint8Array;
  declaredMime?: string | null;
}): {
  mimeType: string;
  extension: string;
  width: number | null;
  height: number | null;
} {
  if (input.bytes.byteLength <= 0) throw new BoardImageValidationError("EMPTY");
  if (input.bytes.byteLength > BOARD_IMAGE_MAX_BYTES) throw new BoardImageValidationError("TOO_LARGE");
  if (looksLikeSvg(input.bytes) || input.declaredMime?.toLowerCase() === "image/svg+xml") {
    throw new BoardImageValidationError("UNSUPPORTED_TYPE");
  }

  const detected = detectBoardImageMime(input.bytes);
  if (!detected) throw new BoardImageValidationError("UNSUPPORTED_TYPE");

  const declared = input.declaredMime?.toLowerCase() ?? "";
  if (declared && declared !== "application/octet-stream" && declared !== detected) {
    const declaredIsJpeg = declared === "image/jpg" && detected === "image/jpeg";
    if (!declaredIsJpeg) throw new BoardImageValidationError("SIGNATURE_MISMATCH");
  }

  const extension = extensionForBoardImageMime(detected);
  if (!extension) throw new BoardImageValidationError("UNSUPPORTED_TYPE");

  const dimensions = readImageDimensions(input.bytes) ?? readGifDimensions(input.bytes);
  if (
    dimensions &&
    (dimensions.width <= 0 ||
      dimensions.height <= 0 ||
      dimensions.width > BOARD_IMAGE_MAX_DIMENSION ||
      dimensions.height > BOARD_IMAGE_MAX_DIMENSION)
  ) {
    throw new BoardImageValidationError("DIMENSIONS");
  }

  return {
    mimeType: detected,
    extension,
    width: dimensions?.width ?? null,
    height: dimensions?.height ?? null,
  };
}

function readGifDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (detectBoardImageMime(bytes) !== "image/gif" || bytes.length < 10) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint16(6, true), height: view.getUint16(8, true) };
}
