import { test } from "node:test";
import assert from "node:assert/strict";

import { estimatePdfPageCount, decidePdfProcessing } from "@/lib/extraction/pdf_page_info";

// Phase 48 regression: a real PDF sent to the /extract route caused an
// ENAMETOOLONG crash because Tesseract (Tier 1) cannot OCR a PDF's raw
// bytes as an image — there is no PDF-to-image conversion in this project.
// handleExtractDocument now short-circuits with `pdfOcrUnsupported: true`
// for any PDF within the page limit, rather than ever calling
// runExtractionPipeline with the PDF's data URI. This test asserts the
// pure page-info layer this decision is built on, since the route-level
// short-circuit itself is exercised by live runtime verification (a real
// HTTP call, not something this pure-function suite can reach).

test("a small, within-limit PDF is NOT auto-blocked by the page-count gate alone (the page-count check and the OCR-format check are separate concerns)", () => {
  const info = estimatePdfPageCount(new TextEncoder().encode("%PDF-1.4\n/Type /Page"));
  const decision = decidePdfProcessing(info, 5);
  // The page-count gate alone would allow this — proving that
  // handleExtractDocument's pdfOcrUnsupported short-circuit is a SEPARATE,
  // additional check, not something the page-count gate already covers.
  assert.equal(decision.allowed, true);
});
