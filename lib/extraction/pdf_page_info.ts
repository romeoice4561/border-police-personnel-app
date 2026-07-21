/**
 * PDF page-count detection (Phase 48 — spec §16).
 *
 * A dependency-free, best-effort page counter: PDFs store one `/Type
 * /Page` object per page (as opposed to `/Type /Pages`, the parent tree
 * node) — counting occurrences of that pattern in the raw file bytes is a
 * well-known lightweight technique that works for the large majority of
 * non-pathological (non-object-stream-compressed, non-linearized-with-
 * unusual-structure) PDFs without needing a full parser dependency.
 *
 * This is explicitly A BEST-EFFORT count, not a guarantee: a PDF using
 * compressed object streams (common in some generators) can hide `/Type
 * /Page` inside a compressed stream where this text search won't find it.
 * When the count comes back as 0 (nothing matched — almost certainly a
 * structure this technique can't see, not actually a 0-page PDF), the
 * result is explicitly `countIsReliable: false` rather than silently
 * reporting a wrong number, so the pipeline can fall back to "require user
 * confirmation" instead of trusting a bogus page count.
 *
 * Pure — no I/O (takes bytes, not a file path).
 */

export interface PdfPageInfo {
  pageCount: number;
  /** False when the byte-scan technique likely failed to find any page objects (e.g. an object-stream-compressed PDF) — the pipeline must not trust pageCount in that case. */
  countIsReliable: boolean;
}

const PAGE_OBJECT_PATTERN = /\/Type\s*\/Page(?!s)/g;

export function estimatePdfPageCount(bytes: Uint8Array): PdfPageInfo {
  // Decode as latin1 (byte-preserving) — PDF structural tokens are always
  // ASCII regardless of the document's actual text encoding, so this is
  // safe for the pattern search even though it would mangle real Thai/
  // Unicode text content elsewhere in the file (which we never read here).
  const text = Buffer.from(bytes).toString("latin1");
  const matches = text.match(PAGE_OBJECT_PATTERN);
  const pageCount = matches ? matches.length : 0;

  return {
    pageCount,
    countIsReliable: pageCount > 0,
  };
}

export interface PdfProcessingDecision {
  allowed: boolean;
  reason: string;
  /** True when the file should be treated as requiring explicit user page-selection/confirmation before any processing (OCR or AI) proceeds. */
  requiresUserConfirmation: boolean;
}

/**
 * Decides whether a PDF may be OCR'd/processed automatically, purely from
 * its (best-effort) page count and the configured limit. Spec §16 default:
 * OCR up to 5 pages automatically; above that requires user selection or
 * confirmation; an unreliable count is treated the same as "above the
 * limit" — never assumed small.
 */
export function decidePdfProcessing(info: PdfPageInfo, maxAutomaticPages: number): PdfProcessingDecision {
  if (!info.countIsReliable) {
    return { allowed: false, reason: "Page count could not be reliably determined.", requiresUserConfirmation: true };
  }
  if (info.pageCount <= maxAutomaticPages) {
    return { allowed: true, reason: `Page count (${info.pageCount}) is within the automatic limit (${maxAutomaticPages}).`, requiresUserConfirmation: false };
  }
  return {
    allowed: false,
    reason: `Page count (${info.pageCount}) exceeds the automatic limit (${maxAutomaticPages}).`,
    requiresUserConfirmation: true,
  };
}
