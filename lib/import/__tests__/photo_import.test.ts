/**
 * Unit tests for Phase 17B photo persistence in the import engine, over the
 * in-memory fake DatabaseClient. Proves the Drive file id from the export
 * (source_id) is mapped to driveFileId + derived thumbnail/webView URLs, and
 * that a filesystem export (no source_id) persists null photo fields.
 *
 * Run with:
 *   npx tsx --test lib/import/__tests__/photo_import.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { InMemoryDatabaseClient } from "@/lib/database/__tests__/in_memory_client";
import { JsonImporter } from "@/lib/import/json_importer";
import { toOfficerInput } from "@/lib/import/officer_upsert";
import { resolveImportInput } from "@/lib/import/validation";

function baseExport(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    source_file: "5.jpg",
    region: "ภาค1",
    confidence: 82,
    career_intelligence: { careerYears: 19 },
    normalized_extraction: {
      rank: "ร.ต.ท.",
      first_name: "อนิรุทธิ์",
      last_name: "ขาว",
      position: "ผบ.ร้อย",
      unit: "ตชด.447",
      phone: "081-540-7336",
      timeline: [{ year: "2564", position: "ผบ.ร้อย", unit: "ตชด.447" }],
      notes: "",
      confidence: 82,
    },
    ...overrides,
  };
}

test("toOfficerInput maps source_id (Drive file id) → driveFileId + derived URLs", () => {
  const input = resolveImportInput(baseExport({ source_id: "DRIVEFILE123" }));
  const officer = toOfficerInput(input);

  assert.equal(officer.driveFileId, "DRIVEFILE123");
  assert.match(officer.thumbnailUrl ?? "", /thumbnail\?id=DRIVEFILE123/);
  assert.match(officer.webViewUrl ?? "", /file\/d\/DRIVEFILE123\/view/);
});

test("toOfficerInput prefers captured thumbnail/web-view links when present", () => {
  const input = resolveImportInput(
    baseExport({
      source_id: "DRIVEFILE123",
      thumbnail_link: "https://lh3.googleusercontent.com/captured",
      web_view_link: "https://drive.google.com/captured-view",
    })
  );
  const officer = toOfficerInput(input);
  assert.equal(officer.thumbnailUrl, "https://lh3.googleusercontent.com/captured");
  assert.equal(officer.webViewUrl, "https://drive.google.com/captured-view");
});

test("a filesystem export (no source_id) persists null photo fields", () => {
  const input = resolveImportInput(baseExport()); // no source_id
  const officer = toOfficerInput(input);
  assert.equal(officer.driveFileId, null);
  assert.equal(officer.thumbnailUrl, null);
  assert.equal(officer.webViewUrl, null);
});

test("importing a Drive-sourced record stores the photo; re-import backfills on update", async () => {
  const db = new InMemoryDatabaseClient();
  const importer = new JsonImporter({ client: db });

  // First import WITHOUT a Drive id (like the current filesystem exports).
  await importer.importBatch([baseExport()]);
  let row = db.officerRows().find((o) => o.officerId === "ภาค1/5")!;
  assert.equal(row.driveFileId ?? null, null);
  assert.equal(row.thumbnailUrl ?? null, null);

  // Re-import the SAME officer now WITH a Drive id → photo backfilled on update.
  await importer.importBatch([baseExport({ source_id: "DRIVEFILE123" })]);
  row = db.officerRows().find((o) => o.officerId === "ภาค1/5")!;
  assert.equal(row.driveFileId, "DRIVEFILE123");
  assert.match(String(row.thumbnailUrl), /thumbnail\?id=DRIVEFILE123/);

  // Still exactly one officer — idempotent.
  assert.equal(db.counts().officers, 1);
});
