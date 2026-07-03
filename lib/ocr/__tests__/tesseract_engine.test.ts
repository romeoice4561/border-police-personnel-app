/**
 * Unit tests for TesseractOCREngine (Phase 10A), using a FAKE Tesseract
 * worker injected via createWorkerFn — no real WASM/traineddata is loaded, so
 * these run fast and offline. Verifies Thai, English, and mixed language
 * mode selection, worker reuse per language, nested-page flattening, and
 * terminate().
 *
 * Run with:
 *   npx tsx --test lib/ocr/__tests__/tesseract_engine.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { TesseractOCREngine } from "@/lib/ocr/tesseract_engine";

/**
 * Minimal fake of the Tesseract Worker + a canned nested recognize() page,
 * so language selection, flattening, reuse, and termination can be tested
 * without the real engine. `langHistory` records which language string each
 * worker was created for.
 */
function makeFakeWorkerFactory(langHistory: string[]) {
  let terminated = 0;
  const factory = async (lang: string) => {
    langHistory.push(lang);
    return {
      async recognize() {
        return {
          data: {
            text: `[${lang}] recognized text`,
            confidence: 87,
            blocks: [
              {
                text: "block one",
                confidence: 88,
                bbox: { x0: 0, y0: 0, x1: 10, y1: 10 },
                paragraphs: [
                  {
                    lines: [
                      {
                        text: "line one",
                        confidence: 85,
                        bbox: { x0: 0, y0: 0, x1: 8, y1: 4 },
                        words: [
                          { text: "line", confidence: 90, bbox: { x0: 0, y0: 0, x1: 3, y1: 4 } },
                          { text: "one", confidence: 80, bbox: { x0: 4, y0: 0, x1: 8, y1: 4 } },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        };
      },
      async terminate() {
        terminated += 1;
        return { jobId: "", data: {} };
      },
    };
  };
  return { factory: factory as never, getTerminated: () => terminated };
}

test("uses the 'tha' traineddata for Thai OCR", async () => {
  const langs: string[] = [];
  const { factory } = makeFakeWorkerFactory(langs);
  const engine = new TesseractOCREngine({ createWorkerFn: factory });

  const result = await engine.recognize("thai.png", { language: "tha" });

  assert.deepEqual(langs, ["tha"]);
  assert.equal(result.language, "tha");
  assert.match(result.fullText, /tha/);
});

test("uses the 'eng' traineddata for English OCR", async () => {
  const langs: string[] = [];
  const { factory } = makeFakeWorkerFactory(langs);
  const engine = new TesseractOCREngine({ createWorkerFn: factory });

  const result = await engine.recognize("english.png", { language: "eng" });

  assert.deepEqual(langs, ["eng"]);
  assert.equal(result.language, "eng");
});

test("mixed mode uses the combined 'tha+eng' traineddata", async () => {
  const langs: string[] = [];
  const { factory } = makeFakeWorkerFactory(langs);
  const engine = new TesseractOCREngine({ createWorkerFn: factory });

  const result = await engine.recognize("mixed.png", { language: "mixed" });

  assert.deepEqual(langs, ["tha+eng"]);
  assert.equal(result.language, "mixed");
});

test("defaults to mixed when no language is specified", async () => {
  const langs: string[] = [];
  const { factory } = makeFakeWorkerFactory(langs);
  const engine = new TesseractOCREngine({ createWorkerFn: factory });

  const result = await engine.recognize("img.png");

  assert.deepEqual(langs, ["tha+eng"]);
  assert.equal(result.language, "mixed");
});

test("flattens nested blocks -> paragraphs -> lines -> words into flat arrays", async () => {
  const { factory } = makeFakeWorkerFactory([]);
  const engine = new TesseractOCREngine({ createWorkerFn: factory });

  const result = await engine.recognize("img.png", { language: "eng" });

  assert.equal(result.blocks.length, 1);
  assert.equal(result.lines.length, 1);
  assert.equal(result.words.length, 2);
  assert.equal(result.words[0].text, "line");
  assert.equal(result.words[1].text, "one");
  assert.equal(result.confidence, 87);
  assert.ok(result.processingTimeMs >= 0);
});

test("creates one worker per language and reuses it across calls", async () => {
  const langs: string[] = [];
  const { factory } = makeFakeWorkerFactory(langs);
  const engine = new TesseractOCREngine({ createWorkerFn: factory });

  await engine.recognize("a.png", { language: "eng" });
  await engine.recognize("b.png", { language: "eng" }); // reuse the eng worker
  await engine.recognize("c.png", { language: "tha" }); // new worker for tha

  assert.deepEqual(langs, ["eng", "tha"]);
});

test("terminate() disposes every created worker", async () => {
  const { factory, getTerminated } = makeFakeWorkerFactory([]);
  const engine = new TesseractOCREngine({ createWorkerFn: factory });

  await engine.recognize("a.png", { language: "eng" });
  await engine.recognize("b.png", { language: "tha" });
  await engine.terminate();

  assert.equal(getTerminated(), 2);
});
