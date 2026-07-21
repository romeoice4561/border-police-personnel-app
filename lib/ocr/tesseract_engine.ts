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
import path from "node:path";
import fs from "node:fs";
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
 * Phase 48 fix: under Next.js/Turbopack's dev bundler, tesseract.js's
 * default worker-script path resolution silently miscomputes to a bogus
 * root (observed: "D:\ROOT\node_modules\tesseract.js\src\worker-script\
 * node\index.js" — nothing under this project resolves to "D:\ROOT" at
 * all), and the worker process then throws `MODULE_NOT_FOUND` as an
 * *uncaught* exception that never rejects the calling `recognize()`
 * promise — the request just hangs until it eventually times out, rather
 * than failing fast with a catchable error.
 *
 * A `require.resolve()` call does NOT fix this: Turbopack intercepts/
 * rewrites `require` inside bundled server chunks, so even
 * `require.resolve("tesseract.js/...")` returns a bundler-internal
 * identifier (observed:
 * "...node_modules/tesseract.js/.../index.js [app-route] (ecmascript)",
 * with literal "[project]"/"[app-route]" segments baked in) rather than a
 * real OS filesystem path — passing THAT to `new Worker()` fails with
 * ERR_WORKER_PATH.
 *
 * The fix that actually works: build the path from `process.cwd()` (a
 * plain runtime string, never rewritten by the bundler) joined with the
 * known, stable location of tesseract.js inside node_modules, then convert
 * to a file:// URL for worker_threads. This never goes through `require`
 * at all, so Turbopack has nothing to intercept.
 */
function resolveWorkerOptions(): { workerPath: string } | undefined {
  try {
    const resolvedPath = path.join(process.cwd(), "node_modules", "tesseract.js", "src", "worker-script", "node", "index.js");
    if (!fs.existsSync(resolvedPath)) return undefined;

    // tesseract.js's own spawnWorker.js does `new Worker(workerPath)` with
    // the raw string, unwrapped — Node's worker_threads accepts a plain
    // absolute OS path directly (no file:// URL needed for that form); a
    // file:// URL STRING (as opposed to an actual `URL` instance) is
    // rejected by this Node version with "Wrap file:// URLs with `new
    // URL`", which tesseract.js's own code never does. Passing the plain
    // absolute path (Windows-native backslashes included) sidesteps that
    // entirely and is exactly what Node's error message says is accepted.
    return { workerPath: resolvedPath };
  } catch {
    // Never throws here — a resolution failure should surface from
    // createWorker() itself (a clear, catchable error) rather than from
    // this helper, so callers fall back to tesseract.js's own default
    // resolution if this path ever changes in a future version.
    return undefined;
  }
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
    this.createWorkerFn = config.createWorkerFn ?? ((lang) => createWorker(lang, undefined, resolveWorkerOptions()));
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
