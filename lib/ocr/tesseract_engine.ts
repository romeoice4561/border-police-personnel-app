/**
 * TesseractOCREngine (Phase 10A).
 *
 * The one module that imports the Tesseract.js runtime and performs real
 * local OCR. Implements the OCREngine contract (ocr_types.ts) so it is
 * interchangeable with the caching decorator and test fakes. No cloud OCR,
 * no Google Vision, no OpenAI — recognition happens entirely locally via
 * Tesseract's WASM core and locally-cached language data.
 *
 * Language modes: "tha", "eng", or "mixed" (Thai + English recognized
 * together via the "tha+eng" traineddata combination). A single long-lived
 * worker is created lazily per language on first use and reused across calls
 * (Tesseract worker startup is expensive); `terminate()` disposes them.
 *
 * This engine only extracts readable text/geometry. It never produces
 * structured personnel fields and never calls the personnel-extraction
 * pipeline — that separation is the whole point of Phase 10A.
 */

import { createWorker, type Worker, type Page } from "tesseract.js";
import type { OCREngine, OCROptions, OCRResult, OCRLanguage } from "@/lib/ocr/ocr_types";
import {
  buildOCRResult,
  emptyOCRResult,
  type TesseractElementLike,
  type TesseractPageLike,
} from "@/lib/ocr/ocr_result";

/** Maps our language mode to the Tesseract traineddata language string. */
const TESSERACT_LANG: Record<OCRLanguage, string> = {
  tha: "tha",
  eng: "eng",
  mixed: "tha+eng",
};

export interface TesseractOCREngineConfig {
  /** Language mode used when a recognize() call does not specify one. Defaults to "mixed". */
  defaultLanguage?: OCRLanguage;
  /**
   * Injectable worker factory (defaults to Tesseract's createWorker), so
   * tests can supply a fake worker and never load the real WASM/traineddata.
   */
  createWorkerFn?: (lang: string) => Promise<Worker>;
}

/**
 * Flattens Tesseract's nested page (blocks -> paragraphs -> lines -> words)
 * into the flat { words, lines, blocks } shape buildOCRResult consumes. Done
 * here rather than in ocr_result so ocr_result stays free of Tesseract's
 * nested structure and remains a pure mapping over an already-flat shape.
 */
function flattenPage(page: Page): TesseractPageLike {
  const blocks = page.blocks ?? [];

  const flatBlocks: TesseractElementLike[] = [];
  const flatLines: TesseractElementLike[] = [];
  const flatWords: TesseractElementLike[] = [];

  for (const block of blocks) {
    flatBlocks.push({ text: block.text, confidence: block.confidence, bbox: block.bbox });
    for (const paragraph of block.paragraphs ?? []) {
      for (const line of paragraph.lines ?? []) {
        flatLines.push({ text: line.text, confidence: line.confidence, bbox: line.bbox });
        for (const word of line.words ?? []) {
          flatWords.push({ text: word.text, confidence: word.confidence, bbox: word.bbox });
        }
      }
    }
  }

  return {
    text: page.text,
    confidence: page.confidence,
    words: flatWords,
    lines: flatLines,
    blocks: flatBlocks,
  };
}

export class TesseractOCREngine implements OCREngine {
  private readonly defaultLanguage: OCRLanguage;
  private readonly createWorkerFn: (lang: string) => Promise<Worker>;
  /** One worker per Tesseract language string, created lazily and reused. */
  private readonly workers = new Map<string, Promise<Worker>>();

  constructor(config: TesseractOCREngineConfig = {}) {
    this.defaultLanguage = config.defaultLanguage ?? "mixed";
    this.createWorkerFn = config.createWorkerFn ?? ((lang) => createWorker(lang));
  }

  async recognize(imagePath: string, options?: OCROptions): Promise<OCRResult> {
    const language = options?.language ?? this.defaultLanguage;
    const tesseractLang = TESSERACT_LANG[language];

    const startedAt = Date.now();
    const worker = await this.getWorker(tesseractLang);

    // Ask for text + blocks so words/lines/blocks are populated.
    const { data } = await worker.recognize(imagePath, {}, { text: true, blocks: true });
    const processingTimeMs = Date.now() - startedAt;

    if (!data) {
      return emptyOCRResult(language, processingTimeMs);
    }

    return buildOCRResult(flattenPage(data as Page), language, processingTimeMs);
  }

  /** Lazily creates (and caches) one worker per language string. */
  private async getWorker(tesseractLang: string): Promise<Worker> {
    let worker = this.workers.get(tesseractLang);
    if (!worker) {
      worker = this.createWorkerFn(tesseractLang);
      this.workers.set(tesseractLang, worker);
    }
    return worker;
  }

  /** Terminates every created worker. Call once when done to release WASM resources. */
  async terminate(): Promise<void> {
    const workers = await Promise.all(this.workers.values());
    await Promise.all(workers.map((worker) => worker.terminate()));
    this.workers.clear();
  }
}
