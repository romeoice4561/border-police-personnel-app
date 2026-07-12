/**
 * Officer Document upload validation (Phase 29A — Officer Document Vault Foundation).
 *
 * Validates the MIME type and byte length of an uploaded document.
 * Supported types:
 *   • Images — jpg/jpeg/png/webp (same subset as portrait upload)
 *   • PDF   — application/pdf
 *
 * Max file size: 10 MB (documents may be scanned multi-page PDFs).
 *
 * Pure, dependency-free; shared by the upload service and the API handler
 * so validation rules live in exactly one place.
 */

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024; // 10 MB

/** Allowed MIME types → canonical file extension. */
export const ALLOWED_DOCUMENT_MIME: Readonly<Record<string, string>> = {
  "image/jpeg":    "jpg",
  "image/jpg":     "jpg",
  "image/png":     "png",
  "image/webp":    "webp",
  "application/pdf": "pdf",
};

export interface DocumentValidationInput {
  mimeType: string;
  byteLength: number;
}

export interface DocumentValidationOk {
  ok: true;
  /** Canonical extension for the accepted MIME type (e.g. "pdf", "jpg"). */
  extension: string;
}

export interface DocumentValidationError {
  ok: false;
  code: "UNSUPPORTED_TYPE" | "TOO_LARGE" | "EMPTY";
  message: string;
}

export type DocumentValidationResult = DocumentValidationOk | DocumentValidationError;

/** Validates a document's declared MIME type and byte length. */
export function validateDocument(input: DocumentValidationInput): DocumentValidationResult {
  if (input.byteLength <= 0) {
    return { ok: false, code: "EMPTY", message: "The uploaded file is empty." };
  }
  const extension = ALLOWED_DOCUMENT_MIME[input.mimeType.toLowerCase()];
  if (!extension) {
    return {
      ok: false,
      code: "UNSUPPORTED_TYPE",
      message: "Unsupported file type. Allowed types: JPG, PNG, WEBP, PDF.",
    };
  }
  if (input.byteLength > MAX_DOCUMENT_BYTES) {
    return {
      ok: false,
      code: "TOO_LARGE",
      message: `File is too large. Maximum size is ${Math.round(MAX_DOCUMENT_BYTES / (1024 * 1024))} MB.`,
    };
  }
  return { ok: true, extension };
}
