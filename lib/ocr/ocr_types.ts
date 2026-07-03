/**
 * Shared types for the Local OCR Engine (Phase 10A).
 *
 * This layer extracts *readable text* from an image so the Smart Image
 * Classification Engine (Phase 8.5) can key its keyword rules on real text
 * instead of always falling back to UNKNOWN. It is deliberately NOT a
 * personnel-extraction step: it produces plain text/geometry only, never
 * structured personnel fields, and never calls OpenAI, Google Vision, or any
 * cloud OCR — only local Tesseract.js.
 *
 * Pure domain typing only — no engine implementation, no I/O, no Tesseract
 * import here (that lives in tesseract_engine.ts, behind the OCREngine
 * interface below), so consumers and tests can depend on the contract
 * without pulling in the Tesseract runtime.
 */

/** Languages the OCR layer supports. "mixed" runs Thai+English together. */
export type OCRLanguage = "tha" | "eng" | "mixed";

/** A normalized bounding box in pixels, mirroring Tesseract's bbox convention. */
export interface OCRBoundingBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** One recognized word, with its confidence and location. */
export interface OCRWord {
  text: string;
  /** 0-100. */
  confidence: number;
  bbox: OCRBoundingBox;
}

/** One recognized line of text. */
export interface OCRLine {
  text: string;
  /** 0-100. */
  confidence: number;
  bbox: OCRBoundingBox;
}

/** One recognized block/region of text. */
export interface OCRBlock {
  text: string;
  /** 0-100. */
  confidence: number;
  bbox: OCRBoundingBox;
}

/**
 * Result of recognizing text in a single image. The exact shape required by
 * Phase 10A: full text plus overall confidence, the word/line/block
 * geometry, timing, and which language mode produced it.
 */
export interface OCRResult {
  fullText: string;
  /** Overall recognition confidence, 0-100. */
  confidence: number;
  words: OCRWord[];
  lines: OCRLine[];
  blocks: OCRBlock[];
  processingTimeMs: number;
  language: OCRLanguage;
}

/** Options for a single recognize() call. */
export interface OCROptions {
  /** Language mode to recognize with. Defaults to the engine's configured default (typically "mixed"). */
  language?: OCRLanguage;
  /**
   * Pre-computed content hash for cache lookup/store. When provided, a
   * CachingOCREngine reuses a prior result for the same hash instead of
   * running OCR again. Computed from the image bytes if omitted.
   */
  hash?: string;
}

/**
 * Contract every OCR engine implements. Injected wherever OCR is needed, so
 * the real Tesseract engine, a caching decorator, or a test fake are
 * interchangeable (dependency injection; no singleton).
 */
export interface OCREngine {
  /** Recognizes text in the image at `imagePath`, returning the full OCRResult. */
  recognize(imagePath: string, options?: OCROptions): Promise<OCRResult>;
}

/** Whether an OCR result was served from cache or freshly computed — surfaced for statistics. */
export type OCRSource = "cache" | "fresh";
