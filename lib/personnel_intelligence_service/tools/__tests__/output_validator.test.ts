import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assertSafeIntelligenceToolOutput,
  validateIntelligenceToolOutput,
} from "@/lib/personnel_intelligence_service/tools/output_validator";
import { IntelligenceToolError } from "@/lib/personnel_intelligence_service/tools/errors";

test("output validation: safe DTO accepted", () => {
  const safe = { personnelTotal: 3, asOfIso: "2026-07-23T00:00:00.000Z", kpis: [] };
  assert.equal(validateIntelligenceToolOutput(safe), true);
  assertSafeIntelligenceToolOutput(safe);
});

test("output validation: sensitive and unsafe shapes rejected; data not returned by assert", () => {
  const cases: unknown[] = [
    { nationalId: "1101700123456" },
    { ocrText: "secret" },
    { signedUrl: "https://example.com/x" },
    { storagePath: "/bucket/x" },
    { driveFileId: "abc" },
    { fn: () => 1 },
    { when: new Date() },
  ];
  for (const bad of cases) {
    assert.equal(validateIntelligenceToolOutput(bad), false);
    assert.throws(
      () => assertSafeIntelligenceToolOutput(bad),
      (e: unknown) => e instanceof IntelligenceToolError && e.code === "OUTPUT_VALIDATION_FAILED"
    );
  }

  const a: Record<string, unknown> = {};
  const b: Record<string, unknown> = { a };
  a.b = b;
  assert.equal(validateIntelligenceToolOutput(a), false);
});
