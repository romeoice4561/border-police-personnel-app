/**
 * OCRResult construction and derived helpers (Phase 10A).
 *
 * Pure functions that (a) map a Tesseract recognize() page into the
 * project's OCRResult shape, and (b) derive small facts about a result
 * (character count, emptiness). Kept separate from tesseract_engine.ts so
 * the mapping is independently testable without the Tesseract runtime, and
 * so ocr_statistics.ts can reuse the same character-count definition rather
 * than redefining it.
 */

import type { OCRBlock, OCRBoundingBox, OCRLine, OCRResult, OCRLanguage, OCRWord } from "@/lib/ocr/ocr_types";

/**
 * Minimal structural subset of a Tesseract.js `Page` this layer reads.
 * Declared locally (rather than importing Tesseract's types) so ocr_result
 * stays free of the Tesseract runtime dependency and can be unit-tested with
 * plain objects.
 */
export interface TesseractPageLike {
  text?: string | null;
  confidence?: number | null;
  words?: TesseractElementLike[] | null;
  lines?: TesseractElementLike[] | null;
  blocks?: TesseractElementLike[] | null;
}

export interface TesseractElementLike {
  text?: string | null;
  confidence?: number | null;
  bbox?: Partial<OCRBoundingBox> | null;
}

function toBoundingBox(bbox: Partial<OCRBoundingBox> | null | undefined): OCRBoundingBox {
  return {
    x0: bbox?.x0 ?? 0,
    y0: bbox?.y0 ?? 0,
    x1: bbox?.x1 ?? 0,
    y1: bbox?.y1 ?? 0,
  };
}

function toWord(element: TesseractElementLike): OCRWord {
  return {
    text: element.text ?? "",
    confidence: element.confidence ?? 0,
    bbox: toBoundingBox(element.bbox),
  };
}

function toLine(element: TesseractElementLike): OCRLine {
  return {
    text: element.text ?? "",
    confidence: element.confidence ?? 0,
    bbox: toBoundingBox(element.bbox),
  };
}

function toBlock(element: TesseractElementLike): OCRBlock {
  return {
    text: element.text ?? "",
    confidence: element.confidence ?? 0,
    bbox: toBoundingBox(element.bbox),
  };
}

/**
 * Builds a normalized OCRResult from a Tesseract page, the language mode
 * used, and the measured processing time. Tolerates missing/partial fields
 * (Tesseract can omit words/lines/blocks depending on options) by defaulting
 * to empty arrays and zeroed values.
 */
export function buildOCRResult(
  page: TesseractPageLike,
  language: OCRLanguage,
  processingTimeMs: number
): OCRResult {
  return {
    fullText: (page.text ?? "").trim(),
    confidence: page.confidence ?? 0,
    words: (page.words ?? []).map(toWord),
    lines: (page.lines ?? []).map(toLine),
    blocks: (page.blocks ?? []).map(toBlock),
    processingTimeMs,
    language,
  };
}

/** An empty result, used when OCR yields nothing (e.g. a blank image) — never null, so consumers need no null checks. */
export function emptyOCRResult(language: OCRLanguage, processingTimeMs = 0): OCRResult {
  return {
    fullText: "",
    confidence: 0,
    words: [],
    lines: [],
    blocks: [],
    processingTimeMs,
    language,
  };
}

/** Number of characters extracted (length of the full text). The single definition of "characters extracted" reused by ocr_statistics.ts. */
export function characterCount(result: OCRResult): number {
  return result.fullText.length;
}

/** True when the result carries no readable text. */
export function isEmptyResult(result: OCRResult): boolean {
  return result.fullText.length === 0;
}
