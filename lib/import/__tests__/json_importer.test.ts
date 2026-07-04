/**
 * Unit tests for the Production Import Engine (Phase 17), over the in-memory
 * fake DatabaseClient (the Phase 12 test fake) — no live database. Verifies
 * the full flow (upsert officer → replace timeline → replace phones → resolve
 * units → ImportLog), IDEMPOTENCY (re-import many times = 0 duplicates),
 * validation/error paths, and TRANSACTION ROLLBACK.
 *
 * Run with:
 *   npx tsx --test lib/import/__tests__/json_importer.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { InMemoryDatabaseClient } from "@/lib/database/__tests__/in_memory_client";
import { JsonImporter } from "@/lib/import/json_importer";
import { ValidationError, ImageReferenceError } from "@/lib/import/types";
import { resolveImportInput } from "@/lib/import/validation";
import type { PersonnelExportFile } from "@/lib/import/types";

/** Builds a realistic export file (the OCR pipeline's output envelope). */
function exportFile(overrides: Partial<PersonnelExportFile> & { region?: string; source_file?: string } = {}): unknown {
  return {
    source_file: overrides.source_file ?? "5.jpg",
    region: overrides.region ?? "ภาค1",
    processing_timestamp: "2026-07-05T00:00:00.000Z",
    confidence: 82,
    career_intelligence: { careerYears: 19, unitCount: 2, timelineEntryCount: 2, units: [] },
    normalized_extraction: {
      rank: "ร.ต.ท.",
      first_name: "อนิรุทธิ์",
      last_name: "ขาวจันทร์คง",
      position: "ผบ.ร้อย",
      unit: "ตชด.447",
      phone: "081-540-7336",
      timeline: [
        { year: "2564", position: "ผบ.ร้อย", unit: "ตชด.447" },
        { year: "2560", position: "ผบ.มว.", unit: "ตชด.100" },
      ],
      notes: "เบอร์สำรอง 082-111-2222",
      confidence: 82,
      ...(overrides.normalized_extraction ?? {}),
    },
    ...overrides,
  };
}

test("imports one officer with timeline, phones, and units", async () => {
  const db = new InMemoryDatabaseClient();
  const summary = await new JsonImporter({ client: db }).importBatch([exportFile()]);

  assert.equal(summary.officers_created, 1);
  assert.equal(summary.officers_updated, 0);
  assert.equal(summary.failed, 0);
  assert.equal(summary.timelines_written, 2);
  // primary phone + one scavenged from notes.
  assert.equal(summary.phones_written, 2);

  const counts = db.counts();
  assert.equal(counts.officers, 1);
  assert.equal(counts.timelines, 2);
  assert.equal(counts.phones, 2);
  assert.equal(counts.units, 2); // ตชด.447 + ตชด.100
  assert.equal(counts.jobs, 1);
});

test("IDEMPOTENT: importing the same record 100 times never duplicates data", async () => {
  const db = new InMemoryDatabaseClient();
  const importer = new JsonImporter({ client: db });

  let summary = await importer.importBatch([exportFile()]);
  assert.equal(summary.officers_created, 1);

  for (let i = 0; i < 99; i += 1) {
    summary = await importer.importBatch([exportFile()]);
  }

  assert.equal(summary.officers_created, 0);
  assert.equal(summary.officers_updated, 1);

  // Row counts are unchanged after 100 imports — zero duplicates anywhere.
  const counts = db.counts();
  assert.equal(counts.officers, 1);
  assert.equal(counts.timelines, 2);
  assert.equal(counts.phones, 2);
  assert.equal(counts.units, 2);
});

test("re-import with a shorter timeline/phone set replaces (no orphans)", async () => {
  const db = new InMemoryDatabaseClient();
  const importer = new JsonImporter({ client: db });

  await importer.importBatch([exportFile()]);
  assert.equal(db.counts().timelines, 2);
  assert.equal(db.counts().phones, 2);

  // Second import: one timeline entry, no notes phone.
  await importer.importBatch([
    exportFile({
      normalized_extraction: {
        rank: "ร.ต.ท.",
        first_name: "อนิรุทธิ์",
        last_name: "ขาวจันทร์คง",
        position: "ผบ.ร้อย",
        unit: "ตชด.447",
        phone: "081-540-7336",
        timeline: [{ year: "2565", position: "x", unit: "ตชด.447" }],
        notes: "",
        confidence: 82,
      },
    }),
  ]);

  assert.equal(db.counts().timelines, 1); // replaced, not appended
  assert.equal(db.counts().phones, 1); // notes phone gone
  assert.equal(db.counts().officers, 1);
});

test("units are deduped across officers (shared unit reused, not duplicated)", async () => {
  const db = new InMemoryDatabaseClient();
  await new JsonImporter({ client: db }).importBatch([
    exportFile({ region: "ภาค1", source_file: "1.jpg" }),
    exportFile({ region: "ภาค2", source_file: "2.jpg", last_name: "ใจดี" } as Partial<PersonnelExportFile>),
  ]);
  // Both reference ตชด.447 + ตชด.100 → still just 2 unit rows.
  assert.equal(db.counts().units, 2);
  assert.equal(db.counts().officers, 2);
});

test("validation failure is recorded as failed, not thrown, and writes an error log", async () => {
  const db = new InMemoryDatabaseClient();
  const summary = await new JsonImporter({ client: db }).importBatch([
    { region: "ภาค1", source_file: "bad.jpg", normalized_extraction: { rank: 123 } }, // rank not a string
  ]);
  assert.equal(summary.failed, 1);
  assert.equal(summary.officers_created, 0);
  const errorLogs = db.logRows().filter((l) => l.action === "error");
  assert.equal(errorLogs.length, 1);
});

test("a file with no region/source_file (no derivable id) fails with ImageReferenceError", () => {
  assert.throws(
    () => resolveImportInput({ normalized_extraction: { rank: "ร.ต.ท.", first_name: "A", last_name: "B", position: "p" } }),
    ImageReferenceError
  );
});

test("resolveImportInput throws ValidationError for a malformed extraction", () => {
  assert.throws(() => resolveImportInput({ region: "ภาค1", source_file: "1.jpg", normalized_extraction: {} }), ValidationError);
});

test("duplicate officerId within one run is a conflict (second recorded as failed)", async () => {
  const db = new InMemoryDatabaseClient();
  // Two files resolving to the same id ภาค1/5.
  const summary = await new JsonImporter({ client: db }).importBatch([
    exportFile({ region: "ภาค1", source_file: "5.jpg" }),
    exportFile({ region: "ภาค1", source_file: "5.png" as string }),
  ]);
  // First imports; second is a within-run conflict (same ภาค1/5).
  assert.equal(summary.officers_created, 1);
  assert.equal(summary.failed, 1);
});

test("TRANSACTION ROLLBACK: a mid-transaction failure leaves no partial rows", async () => {
  const db = new InMemoryDatabaseClient();
  db.failOnOfficerId = "ภาค1/5"; // timeline.create throws for this officer after upsert

  const summary = await new JsonImporter({ client: db }).importBatch([
    exportFile({ region: "ภาค1", source_file: "5.jpg" }),
    exportFile({ region: "ภาค2", source_file: "9.jpg", last_name: "ok" } as Partial<PersonnelExportFile>),
  ]);

  assert.equal(summary.failed, 1);
  assert.equal(summary.officers_created, 1); // only the OK officer

  const counts = db.counts();
  assert.equal(counts.officers, 1); // failed officer rolled back
  assert.equal(counts.timelines, 2); // only OK officer's 2 rows
  // Error was logged (audit survives the rollback).
  assert.ok(db.logRows().some((l) => l.action === "error" && l.officerId === "ภาค1/5"));
});
