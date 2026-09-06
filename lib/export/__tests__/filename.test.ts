import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDrugExportFilename, sanitizeExportFilename } from "@/lib/export/filename";

test("Thai titles are preserved and unsafe characters are stripped", () => {
  const name = sanitizeExportFilename("บอร์ด วิเคราะห์/ลับ:ชื่อ*?\"<>|", "csv");
  assert.match(name, /บอร์ด/);
  assert.doesNotMatch(name, /[\\/:*?"<>|]/);
  assert.equal(name.endsWith(".csv"), true);
});

test("control characters and path traversal are removed", () => {
  const name = sanitizeExportFilename("..\\..\\secret\u0000name", "csv");
  assert.doesNotMatch(name, /\.\./);
  assert.doesNotMatch(name, /[\\/]/);
  assert.doesNotMatch(name, /\u0000/);
});

test("Windows reserved names are replaced", () => {
  for (const reserved of ["CON", "PRN", "AUX", "NUL", "COM1", "LPT1"]) {
    const name = sanitizeExportFilename(reserved, "csv");
    assert.equal(name, "export.csv", reserved);
  }
});

test("very long titles are capped", () => {
  const name = sanitizeExportFilename("ก".repeat(400), "csv");
  assert.ok(name.length <= 120);
  assert.equal(name.endsWith(".csv"), true);
});

test("dated drug-cases filename is predictable", () => {
  const name = buildDrugExportFilename({
    kind: "drug-cases",
    fiscalYearBe: 2569,
    ext: "csv",
    now: new Date("2026-09-06T00:00:00.000Z"),
  });
  assert.equal(name, "drug-cases-fy2569-20260906.csv");
});

test("persons and case-report filenames stay identifier-free", () => {
  const persons = buildDrugExportFilename({
    kind: "drug-persons",
    ext: "csv",
    now: new Date("2026-09-06T00:00:00.000Z"),
  });
  const report = buildDrugExportFilename({
    kind: "case",
    caseNumber: "ตชด.44-2569-001",
    ext: "html",
    now: new Date("2026-09-06T00:00:00.000Z"),
  });
  assert.equal(persons, "drug-persons-20260906.csv");
  assert.match(report, /^case-.*-20260906\.html$/);
  assert.doesNotMatch(report, /1103700123456|0812345678/);
});
