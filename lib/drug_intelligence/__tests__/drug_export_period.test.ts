import { test } from "node:test";
import assert from "node:assert/strict";
import { gregorianYearFromBe, resolveExportPeriod } from "@/lib/drug_intelligence/drug_export_period";
import { caseListFiltersToExportContext } from "@/lib/drug_intelligence/drug_export_case_list_context";
import { summarizeExportContext, resolveDrugExportContext } from "@/lib/drug_intelligence/drug_export_context";

test("FY 2569 converts to 2025-10-01 through 2026-09-30", () => {
  assert.equal(gregorianYearFromBe(2569), 2026);
  const applied = resolveExportPeriod({ fiscalYearBe: 2569 });
  assert.equal(applied.source, "FISCAL_YEAR");
  assert.equal(applied.dateFrom, "2025-10-01");
  assert.equal(applied.dateTo, "2026-09-30");
  assert.equal(applied.appliedFiscalYearBe, 2569);
});

test("explicit dates win over FY (Commander precedence)", () => {
  const applied = resolveExportPeriod({
    fiscalYearBe: 2569,
    dateFrom: "2026-01-01",
    dateTo: "2026-01-31",
  });
  assert.equal(applied.source, "EXPLICIT_DATES");
  assert.equal(applied.dateFrom, "2026-01-01");
  assert.equal(applied.dateTo, "2026-01-31");
  assert.equal(applied.appliedFiscalYearBe, undefined);
});

test("context summary uses applied period, not a leftover FY label", () => {
  const input = caseListFiltersToExportContext(
    { fiscalYearBe: 2569, arrestDateFrom: "2026-06-01", arrestDateTo: "2026-06-30", province: "ระนอง" },
    "th"
  );
  const resolved = resolveDrugExportContext(input, "mock:admin", new Date("2026-09-06T00:00:00.000Z"));
  const summary = summarizeExportContext(resolved);
  assert.equal(summary.periodSource, "EXPLICIT_DATES");
  assert.equal(summary.fiscalYearBe, null);
  assert.equal(summary.dateFrom, "2026-06-01");
  assert.equal(summary.dateTo, "2026-06-30");
  assert.equal(summary.province, "ระนอง");
});
